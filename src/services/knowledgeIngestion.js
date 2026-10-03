const { parse } = require('csv-parse/sync');
const { hasDatabaseConfig, query } = require('../db/pool');
const { createKnowledgeItem, listKnowledgeItems, updateKnowledgeItem } = require('./tenantKnowledge');
const { decodeBase64Document, extractDocumentText } = require('./documentExtraction');

const demoSources = new Map();
let nextDemoSourceId = 1;
const allowedFormats = new Set(['csv', 'text', 'markdown', 'json', 'pdf', 'docx', 'remote']);

async function listKnowledgeSources(businessId) {
  if (!hasDatabaseConfig()) {
    return [...demoSources.values()]
      .filter((source) => Number(source.businessId) === Number(businessId))
      .filter((source) => !source.deletedAt)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((source) => normalizeSource({ ...source }));
  }
  const rows = await query(
    `select id,business_id as businessId,source_type as sourceType,format_type as formatType,name,status,
            configuration,credentials_masked as credentialsMasked,sync_interval_minutes as syncIntervalMinutes,
            next_sync_at as nextSyncAt,consecutive_failures as consecutiveFailures,item_count as itemCount,
            last_synced_at as lastSyncedAt,last_error as lastError,created_by_user_id as createdByUserId,
            created_at as createdAt,updated_at as updatedAt
     from business_knowledge_sources where business_id=:businessId and deleted_at is null order by updated_at desc,id desc`,
    { businessId }
  );
  return rows.map(normalizeSource);
}

async function importKnowledgeContent(input) {
  const formatType = inferFormat(input.filename, input.formatType, input.mimeType);
  let content = String(input.content || '');
  if (formatType === 'pdf' || formatType === 'docx') {
    content = await extractDocumentText({ buffer:decodeBase64Document(input.contentBase64), formatType });
  } else {
    if (!content.trim()) throw httpError('Import content is required', 400);
    if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) throw httpError('Text knowledge imports are limited to 1 MB', 413);
  }
  const records = parseImportRecords({ content, filename:input.filename, formatType });
  const source = await createSource({
    businessId:input.businessId,
    actorUser:input.actorUser,
    sourceType:'upload',
    formatType,
    name:String(input.filename || `Knowledge ${formatType} import`).trim().slice(0, 220),
    configuration:{ filename:String(input.filename || ''), mimeType:String(input.mimeType || ''), reviewDefault:normalizeImportStatus(input.defaultStatus) }
  });
  return ingestRecords({ ...input, source, records, defaultStatus:normalizeImportStatus(input.defaultStatus) });
}

async function createApiPushConnector(input) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 220) throw httpError('Connector name is required and must be 220 characters or fewer', 400);
  return createSource({
    businessId:input.businessId,
    actorUser:input.actorUser,
    sourceType:'api_push',
    formatType:'json',
    name,
    configuration:{ contractVersion:1, reviewDefault:normalizeImportStatus(input.defaultStatus) }
  });
}

async function ingestApiConnectorRecords(input) {
  const source = await findSource(input.businessId, input.sourceId);
  if (!source || source.sourceType !== 'api_push') throw httpError('API knowledge connector not found', 404);
  if (source.status === 'paused') throw httpError('Knowledge connector is paused', 409);
  const records = Array.isArray(input.records) ? input.records : [];
  if (!records.length) throw httpError('records must contain at least one knowledge record', 400);
  if (records.length > 100) throw httpError('A connector sync is limited to 100 records', 400);
  return ingestRecords({ ...input, source, records, defaultStatus:normalizeImportStatus(input.defaultStatus || source.configuration.reviewDefault) });
}

async function ingestRecords(input) {
  await updateSourceState(input.source, { status:'syncing', lastError:null });
  try {
    const existing = await listKnowledgeItems(input.businessId);
    const result = { created:0, updated:0, skipped:0, errors:[], items:[] };
    for (const [index, raw] of input.records.entries()) {
      try {
        const record = normalizeRecord(raw, index, input.defaultStatus);
        const match = existing.find((item) => Number(item.sourceId) === Number(input.source.id) && (
          (record.externalRef && item.externalRef === record.externalRef) || (!record.externalRef && item.contentHash === record.contentHash)
        ));
        const payload = { ...record, businessId:input.businessId, actorUser:input.actorUser, sourceId:input.source.id };
        const item = match
          ? await updateKnowledgeItem({ ...payload, itemId:match.id })
          : await createKnowledgeItem(payload);
        result[match ? 'updated' : 'created'] += 1;
        result.items.push(item);
        if (!match) existing.push(item);
      } catch (error) {
        result.skipped += 1;
        result.errors.push({ row:index + 1, error:error.message });
      }
    }
    const source = await updateSourceState(input.source, {
      status:result.errors.length && !result.items.length ? 'error' : 'ready',
      itemCount:existing.filter((item) => Number(item.sourceId) === Number(input.source.id)).length,
      lastSyncedAt:new Date().toISOString(),
      lastError:result.errors.length ? `${result.errors.length} record(s) skipped` : null
    });
    return { source, ...result };
  } catch (error) {
    await updateSourceState(input.source, { status:'error', lastError:String(error.message || error).slice(0, 500) });
    throw error;
  }
}

async function archiveKnowledgeSource(input) {
  const source = await findSourceWithCredentials(input.businessId, input.sourceId);
  if (!source) throw httpError('Knowledge source not found', 404);
  if (!hasDatabaseConfig()) {
    const items = await listKnowledgeItems(input.businessId);
    for (const item of items.filter((candidate) => Number(candidate.sourceId) === Number(source.id))) {
      await updateKnowledgeItem({ ...item, itemId:item.id, businessId:input.businessId, actorUser:input.actorUser, status:'archived' });
    }
    source.deletedAt = new Date().toISOString();
    source.credentialsEncrypted = null;
    source.status = 'paused';
    source.updatedAt = source.deletedAt;
    return { deleted:true, sourceId:source.id };
  }
  await query(
    `update business_knowledge_items set status='archived',updated_at=current_timestamp
     where business_id=:businessId and source_id=:sourceId and status<>'archived'`,
    { businessId:input.businessId, sourceId:source.id }
  );
  await query(
    `update business_knowledge_sources set status='paused',credentials_encrypted=null,next_sync_at=null,
       deleted_at=current_timestamp,updated_at=current_timestamp where id=:sourceId and business_id=:businessId`,
    { businessId:input.businessId, sourceId:source.id }
  );
  return { deleted:true, sourceId:source.id };
}

function parseImportRecords({ content, filename, formatType }) {
  if (formatType === 'csv') {
    let rows;
    try {
      rows = parse(content, { columns:true, skip_empty_lines:true, trim:true, bom:true, relax_column_count:false });
    } catch (error) {
      throw httpError(`CSV could not be parsed: ${error.message}`, 400);
    }
    if (rows.length > 100) throw httpError('A knowledge import is limited to 100 records', 400);
    return rows.map((row, index) => ({
      title:row.title || row.question,
      content:row.content || row.answer,
      itemType:row.item_type || row.type || (row.question ? 'faq' : 'instruction'),
      keywords:row.keywords || '',
      externalRef:row.external_ref || row.id || `row-${index + 1}`,
      status:row.status
    }));
  }
  const sections = formatType === 'markdown' ? markdownSections(content) : textSections(content);
  if (sections.length > 100) throw httpError('A knowledge import is limited to 100 sections', 400);
  const baseName = String(filename || 'Imported document').replace(/\.[^.]+$/, '').trim() || 'Imported document';
  return sections.map((section, index) => ({
    title:section.title || `${baseName} - section ${index + 1}`,
    content:section.content,
    itemType:'instruction',
    externalRef:`section-${index + 1}`
  }));
}

function markdownSections(content) {
  const lines = String(content).replace(/\r\n?/g, '\n').split('\n');
  const sections = [];
  let current = { title:'', lines:[] };
  const flush = () => {
    const body = current.lines.join('\n').trim();
    if (body) sections.push({ title:current.title, content:body.slice(0, 10000) });
  };
  for (const line of lines) {
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) { flush(); current={ title:heading[1].trim().slice(0, 220), lines:[] }; }
    else current.lines.push(line);
  }
  flush();
  return sections.length ? sections : textSections(content);
}

function textSections(content) {
  const blocks = String(content).replace(/\r\n?/g, '\n').split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
  const sections = [];
  for (const block of blocks) {
    if (block.length <= 10000) sections.push({ title:'', content:block });
    else for (let index=0; index<block.length; index+=9000) sections.push({ title:'', content:block.slice(index,index+9000) });
  }
  return sections;
}

function normalizeRecord(raw, index, defaultStatus) {
  const title = String(raw?.title || '').trim();
  const content = String(raw?.content || '').trim();
  if (!title || !content) throw httpError('Each record requires title and content', 400);
  const itemType = String(raw.itemType || 'instruction').trim().toLowerCase();
  const keywords = Array.isArray(raw.keywords) ? raw.keywords : String(raw.keywords || '').split(',');
  const normalized = { title, content, itemType, keywords, externalRef:String(raw.externalRef || `record-${index + 1}`).trim().slice(0,220), status:normalizeImportStatus(defaultStatus) };
  normalized.contentHash = require('node:crypto').createHash('sha256').update(`${itemType}\n${title}\n${content}\n${keywords.join(',')}`).digest('hex');
  return normalized;
}

async function createSource(input) {
  const now = new Date().toISOString();
  if (!hasDatabaseConfig()) {
    const source = { id:nextDemoSourceId++, businessId:Number(input.businessId), sourceType:input.sourceType, formatType:input.formatType, name:input.name, status:input.status || 'ready', configuration:input.configuration || {}, credentialsEncrypted:input.credentialsEncrypted || null, credentialsMasked:input.credentialsMasked || {}, syncIntervalMinutes:Number(input.syncIntervalMinutes || 360), nextSyncAt:input.nextSyncAt || null, consecutiveFailures:0, itemCount:0, lastSyncedAt:null, lastError:null, deletedAt:null, createdByUserId:input.actorUser?.id || null, createdAt:now, updatedAt:now };
    demoSources.set(source.id, source);
    return source;
  }
  const result = await query(
    `insert into business_knowledge_sources
       (business_id,source_type,format_type,name,status,configuration,credentials_encrypted,credentials_masked,
        sync_interval_minutes,next_sync_at,created_by_user_id)
     values (:businessId,:sourceType,:formatType,:name,:status,:configuration,:credentialsEncrypted,:credentialsMasked,
             :syncIntervalMinutes,:nextSyncAt,:createdByUserId)`,
    { ...input, status:input.status || 'ready', configuration:JSON.stringify(input.configuration || {}), credentialsEncrypted:input.credentialsEncrypted || null, credentialsMasked:JSON.stringify(input.credentialsMasked || {}), syncIntervalMinutes:Number(input.syncIntervalMinutes || 360), nextSyncAt:input.nextSyncAt ? new Date(input.nextSyncAt) : null, createdByUserId:input.actorUser?.id || null }
  );
  return findSource(input.businessId, result.insertId);
}

async function findSource(businessId, sourceId) {
  return (await listKnowledgeSources(businessId)).find((source) => Number(source.id) === Number(sourceId)) || null;
}

async function findSourceWithCredentials(businessId, sourceId) {
  if (!hasDatabaseConfig()) {
    const source = demoSources.get(Number(sourceId));
    return source && Number(source.businessId) === Number(businessId) && !source.deletedAt ? source : null;
  }
  const rows = await query(
    `select id,business_id as businessId,source_type as sourceType,format_type as formatType,name,status,
            configuration,credentials_encrypted as credentialsEncrypted,credentials_masked as credentialsMasked,
            sync_interval_minutes as syncIntervalMinutes,next_sync_at as nextSyncAt,
            consecutive_failures as consecutiveFailures,item_count as itemCount,last_synced_at as lastSyncedAt,
            last_error as lastError,created_by_user_id as createdByUserId,created_at as createdAt,updated_at as updatedAt
     from business_knowledge_sources where id=:sourceId and business_id=:businessId and deleted_at is null limit 1`,
    { businessId, sourceId }
  );
  return rows[0] ? normalizeSource(rows[0], true) : null;
}

async function updateSourceState(source, changes) {
  if (!hasDatabaseConfig()) {
    Object.assign(source, changes, { updatedAt:new Date().toISOString() });
    return source;
  }
  await query(
    `update business_knowledge_sources set status=:status,item_count=:itemCount,last_synced_at=:lastSyncedAt,last_error=:lastError,
       next_sync_at=:nextSyncAt,consecutive_failures=:consecutiveFailures,configuration=:configuration,
       credentials_encrypted=coalesce(:credentialsEncrypted,credentials_encrypted),credentials_masked=:credentialsMasked,sync_interval_minutes=:syncIntervalMinutes
     where id=:sourceId and business_id=:businessId`,
    { sourceId:source.id, businessId:source.businessId, status:changes.status || source.status, itemCount:changes.itemCount ?? source.itemCount, lastSyncedAt:changes.lastSyncedAt ? new Date(changes.lastSyncedAt) : source.lastSyncedAt, lastError:changes.lastError === undefined ? source.lastError || null : changes.lastError, nextSyncAt:changes.nextSyncAt ? new Date(changes.nextSyncAt) : (changes.nextSyncAt === null ? null : source.nextSyncAt), consecutiveFailures:changes.consecutiveFailures ?? source.consecutiveFailures ?? 0, configuration:JSON.stringify(changes.configuration || source.configuration || {}), credentialsEncrypted:changes.credentialsEncrypted === undefined ? source.credentialsEncrypted || null : changes.credentialsEncrypted, credentialsMasked:JSON.stringify(changes.credentialsMasked || source.credentialsMasked || {}), syncIntervalMinutes:Number(changes.syncIntervalMinutes || source.syncIntervalMinutes || 360) }
  );
  return findSource(source.businessId, source.id);
}

function inferFormat(filename, requested, mimeType) {
  const value = String(requested || '').toLowerCase();
  if (allowedFormats.has(value) && value !== 'json') return value;
  const name = String(filename || '').toLowerCase();
  if (name.endsWith('.csv') || /csv/i.test(mimeType || '')) return 'csv';
  if (name.endsWith('.md') || name.endsWith('.markdown') || /markdown/i.test(mimeType || '')) return 'markdown';
  if (name.endsWith('.pdf') || /application\/pdf/i.test(mimeType || '')) return 'pdf';
  if (name.endsWith('.docx') || /wordprocessingml\.document/i.test(mimeType || '')) return 'docx';
  return 'text';
}
function normalizeImportStatus(value) { return String(value || 'draft').toLowerCase() === 'approved' ? 'approved' : 'draft'; }
function normalizeSource(row, includeCredentials = false) {
  const source = { ...row, id:Number(row.id), businessId:Number(row.businessId), itemCount:Number(row.itemCount || 0), syncIntervalMinutes:Number(row.syncIntervalMinutes || 360), consecutiveFailures:Number(row.consecutiveFailures || 0), configuration:parseJson(row.configuration,{}), credentialsMasked:parseJson(row.credentialsMasked,{}) };
  if (!includeCredentials) delete source.credentialsEncrypted;
  return source;
}
function parseJson(value,fallback) { if(value===null||value===undefined)return fallback;if(typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;} }
function httpError(message,status) { const error=new Error(message);error.status=status;return error; }

module.exports = { archiveKnowledgeSource, createApiPushConnector, createSource, findSource, findSourceWithCredentials, importKnowledgeContent, ingestApiConnectorRecords, ingestRecords, listKnowledgeSources, parseImportRecords, updateSourceState };
