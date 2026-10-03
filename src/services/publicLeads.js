const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');

const demoLeads = [];
const demoLeadEvents = [];
let nextDemoLeadEventId = 1;
const VALID_TYPES = new Set(['sales', 'demo']);
const VALID_STATUSES = new Set(['new', 'contacted', 'qualified', 'disqualified', 'converted']);

async function createPublicLead(input = {}, context = {}) {
  if (clean(input.website, 120)) {
    return { accepted: true, filtered: true, reference: createReference() };
  }

  const lead = normalizeLead(input, context);
  const existing = await findRecentLead(lead.email, lead.leadType);
  if (existing) {
    await recordDuplicate(existing.id, lead);
    return { ...existing, accepted: true, duplicate: true };
  }

  if (!hasDatabaseConfig()) {
    const created = {
      id: demoLeads.length + 1,
      ...lead,
      status: 'new',
      responseDueAt: lead.responseDueAt,
      lastActivityAt: new Date().toISOString(),
      crmDeliveryStatus: crmWebhookConfigured() ? 'pending' : 'not_configured',
      duplicateCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    demoLeads.unshift(created);
    await addPublicLeadEvent({ leadId: created.id, eventType: 'created', note: 'Public enquiry received.', metadata: { routeKey:created.routeKey, priority:created.priority } });
    return { ...created, accepted: true };
  }

  const result = await query(
    `insert into public_leads
       (reference_code, lead_type, status, priority, route_key, name, work_email, phone, company,
        role_title, team_size, monthly_conversations, use_case, preferred_contact, message,
        consent_to_contact, marketing_opt_in, source_path, attribution, ip_hash, user_agent,
        response_due_at, last_activity_at, crm_delivery_status, retention_expires_at)
     values
       (:reference, :leadType, 'new', :priority, :routeKey, :name, :email, :phone, :company,
        :roleTitle, :teamSize, :monthlyConversations, :useCase, :preferredContact, :message,
        1, :marketingOptIn, :sourcePath, :attribution, :ipHash, :userAgent,
        :responseDueAt, current_timestamp, :crmDeliveryStatus,
        date_add(current_timestamp, interval 365 day))`,
    {
      ...lead,
      responseDueAt: databaseDate(lead.responseDueAt),
      marketingOptIn: lead.marketingOptIn ? 1 : 0,
      crmDeliveryStatus: crmWebhookConfigured() ? 'pending' : 'not_configured',
      attribution: JSON.stringify(lead.attribution)
    }
  );

  await addPublicLeadEvent({ leadId: result.insertId, eventType: 'created', note: 'Public enquiry received.', metadata: { routeKey:lead.routeKey, priority:lead.priority } });
  return { id: result.insertId, ...lead, status: 'new', crmDeliveryStatus:crmWebhookConfigured() ? 'pending' : 'not_configured', duplicateCount: 0, accepted: true };
}

async function listPublicLeads({ status = '', limit = 100 } = {}) {
  const normalizedStatus = status ? normalizeStatus(status) : '';
  const normalizedLimit = Math.min(250, Math.max(1, Number(limit) || 100));
  if (!hasDatabaseConfig()) {
    return demoLeads
      .filter((lead) => !normalizedStatus || lead.status === normalizedStatus)
      .slice(0, normalizedLimit)
      .map(publicLeadRecord);
  }

  const rows = await query(
    `select l.id, l.reference_code as reference, l.lead_type as leadType, l.status, l.priority,
            l.route_key as routeKey, l.name, l.work_email as email, l.phone, l.company,
            l.role_title as roleTitle, l.team_size as teamSize,
            l.monthly_conversations as monthlyConversations, l.use_case as useCase,
            l.preferred_contact as preferredContact, l.message,
            l.consent_to_contact as consentToContact, l.marketing_opt_in as marketingOptIn,
            l.source_path as sourcePath, l.attribution, l.duplicate_count as duplicateCount,
            l.owner_platform_user_id as ownerPlatformUserId, u.name as ownerName, u.email as ownerEmail,
            l.response_due_at as responseDueAt, l.next_follow_up_at as nextFollowUpAt,
            l.last_activity_at as lastActivityAt, l.first_contacted_at as firstContactedAt,
            l.converted_at as convertedAt, l.disqualification_reason as disqualificationReason,
            l.crm_delivery_status as crmDeliveryStatus, l.crm_delivered_at as crmDeliveredAt,
            l.created_at as createdAt, l.updated_at as updatedAt
     from public_leads l
     left join platform_users u on u.id = l.owner_platform_user_id
     ${normalizedStatus ? 'where l.status = :status' : ''}
     order by case l.priority when 'high' then 0 when 'normal' then 1 else 2 end, l.created_at desc
     limit ${normalizedLimit}`,
    { status: normalizedStatus }
  );
  return rows.map(publicLeadRecord);
}

async function getPublicLeadSummary() {
  if (hasDatabaseConfig()) {
    const rows = await query(
      `select count(*) as total,
              sum(case when status = 'new' then 1 else 0 end) as newCount,
              sum(case when priority = 'high' and status not in ('converted', 'disqualified') then 1 else 0 end) as highPriority,
              sum(case when lead_type = 'demo' then 1 else 0 end) as demoRequests,
              sum(case when status = 'new' and response_due_at < current_timestamp then 1 else 0 end) as slaBreached,
              sum(case when status = 'converted' then 1 else 0 end) as converted,
              avg(case when first_contacted_at is not null then timestampdiff(minute, created_at, first_contacted_at) end) as averageResponseMinutes
       from public_leads`
    );
    const summary = rows[0] || {};
    return {
      total: Number(summary.total || 0),
      new: Number(summary.newCount || 0),
      highPriority: Number(summary.highPriority || 0),
      demoRequests: Number(summary.demoRequests || 0),
      slaBreached: Number(summary.slaBreached || 0),
      converted: Number(summary.converted || 0),
      conversionRate: Number(summary.total || 0) ? Math.round(Number(summary.converted || 0) / Number(summary.total) * 1000) / 10 : 0,
      averageResponseMinutes: summary.averageResponseMinutes === null ? null : Math.round(Number(summary.averageResponseMinutes || 0))
    };
  }

  const leads = await listPublicLeads({ limit: 250 });
  return {
    total: leads.length,
    new: leads.filter((lead) => lead.status === 'new').length,
    highPriority: leads.filter((lead) => lead.priority === 'high' && !['converted', 'disqualified'].includes(lead.status)).length,
    demoRequests: leads.filter((lead) => lead.leadType === 'demo').length,
    slaBreached: leads.filter((lead) => lead.slaStatus === 'breached').length,
    converted: leads.filter((lead) => lead.status === 'converted').length,
    conversionRate: leads.length ? Math.round(leads.filter((lead) => lead.status === 'converted').length / leads.length * 1000) / 10 : 0,
    averageResponseMinutes: average(leads.filter((lead) => lead.firstContactedAt).map((lead) => (new Date(lead.firstContactedAt) - new Date(lead.createdAt)) / 60000))
  };
}

async function getPublicLead(leadId) {
  const id = positiveId(leadId);
  if (!hasDatabaseConfig()) {
    const lead = demoLeads.find((item) => Number(item.id) === id);
    if (!lead) throw notFoundError();
    return publicLeadRecord(lead);
  }
  const rows = await query(
    `select l.id, l.reference_code as reference, l.lead_type as leadType, l.status, l.priority,
            l.route_key as routeKey, l.name, l.work_email as email, l.phone, l.company,
            l.role_title as roleTitle, l.team_size as teamSize, l.monthly_conversations as monthlyConversations,
            l.use_case as useCase, l.preferred_contact as preferredContact, l.message,
            l.consent_to_contact as consentToContact, l.marketing_opt_in as marketingOptIn,
            l.source_path as sourcePath, l.attribution, l.duplicate_count as duplicateCount,
            l.owner_platform_user_id as ownerPlatformUserId, u.name as ownerName, u.email as ownerEmail,
            l.response_due_at as responseDueAt, l.next_follow_up_at as nextFollowUpAt,
            l.last_activity_at as lastActivityAt, l.first_contacted_at as firstContactedAt,
            l.converted_at as convertedAt, l.disqualification_reason as disqualificationReason,
            l.crm_delivery_status as crmDeliveryStatus, l.crm_delivered_at as crmDeliveredAt,
            l.created_at as createdAt, l.updated_at as updatedAt
     from public_leads l left join platform_users u on u.id = l.owner_platform_user_id
     where l.id = :id limit 1`,
    { id }
  );
  if (!rows[0]) throw notFoundError();
  return publicLeadRecord(rows[0]);
}

async function updatePublicLead({ leadId, status, ownerPlatformUserId, nextFollowUpAt, disqualificationReason, platformUser = null }) {
  const id = positiveId(leadId);
  const current = await getPublicLead(id);
  const normalizedStatus = status === undefined ? current.status : normalizeStatus(status);
  const ownerId = ownerPlatformUserId === undefined ? current.ownerPlatformUserId : (ownerPlatformUserId ? positiveId(ownerPlatformUserId) : null);
  const followUpAt = nextFollowUpAt === undefined ? current.nextFollowUpAt : optionalDate(nextFollowUpAt);
  const reason = disqualificationReason === undefined ? current.disqualificationReason : clean(disqualificationReason, 500);
  if (normalizedStatus === 'disqualified' && !reason) throw validationError('Provide a disqualification reason.');
  if (!hasDatabaseConfig()) {
    const lead = demoLeads.find((item) => Number(item.id) === id);
    lead.status = normalizedStatus;
    lead.ownerPlatformUserId = ownerId;
    lead.ownerName = platformUser && ownerId === platformUser.id ? platformUser.name : lead.ownerName;
    lead.ownerEmail = platformUser && ownerId === platformUser.id ? platformUser.email : lead.ownerEmail;
    lead.nextFollowUpAt = followUpAt;
    lead.disqualificationReason = reason;
    if (normalizedStatus === 'contacted' && !lead.firstContactedAt) lead.firstContactedAt = new Date().toISOString();
    if (normalizedStatus === 'converted' && !lead.convertedAt) lead.convertedAt = new Date().toISOString();
    lead.lastActivityAt = new Date().toISOString();
    lead.updatedAt = new Date().toISOString();
  } else {
    const result = await query(
      `update public_leads
       set status = :status, owner_platform_user_id = :ownerPlatformUserId,
           next_follow_up_at = :nextFollowUpAt, disqualification_reason = :disqualificationReason,
           last_activity_at = current_timestamp,
           first_contacted_at = case when :status = 'contacted' and first_contacted_at is null then current_timestamp else first_contacted_at end,
           converted_at = case when :status = 'converted' then coalesce(converted_at, current_timestamp) else converted_at end
       where id = :id`,
      { id, status: normalizedStatus, ownerPlatformUserId: ownerId, nextFollowUpAt: databaseDate(followUpAt), disqualificationReason: reason || null }
    );
    if (!Number(result.affectedRows)) throw notFoundError();
  }
  const changes = [];
  if (normalizedStatus !== current.status) changes.push(`Status changed from ${current.status} to ${normalizedStatus}.`);
  if (Number(ownerId || 0) !== Number(current.ownerPlatformUserId || 0)) changes.push(ownerId ? 'Lead ownership updated.' : 'Lead unassigned.');
  if (String(followUpAt || '') !== String(current.nextFollowUpAt || '')) changes.push(followUpAt ? 'Follow-up scheduled.' : 'Follow-up cleared.');
  if (changes.length) await addPublicLeadEvent({ leadId:id, platformUser, eventType:'updated', note:changes.join(' '), metadata:{ status:normalizedStatus, ownerPlatformUserId:ownerId, nextFollowUpAt:followUpAt } });
  return getPublicLead(id);
}

async function addPublicLeadEvent({ leadId, platformUser = null, eventType = 'note', note, metadata = {} }) {
  const id = positiveId(leadId);
  const normalizedNote = required(note, 'Activity note', 2000);
  const normalizedType = clean(eventType, 80).toLowerCase() || 'note';
  if (!hasDatabaseConfig()) {
    const lead = demoLeads.find((item) => Number(item.id) === id);
    if (!lead) throw notFoundError();
    const event = { id:nextDemoLeadEventId++, leadId:id, platformUserId:platformUser?.id || null, platformUserName:platformUser?.name || null, platformUserEmail:platformUser?.email || null, eventType:normalizedType, note:normalizedNote, metadata, createdAt:new Date().toISOString() };
    demoLeadEvents.unshift(event);
    lead.lastActivityAt = event.createdAt;
    return event;
  }
  const result = await query(
    `insert into public_lead_events (lead_id, platform_user_id, event_type, note, metadata)
     values (:leadId, :platformUserId, :eventType, :note, :metadata)`,
    { leadId:id, platformUserId:platformUser?.id || null, eventType:normalizedType, note:normalizedNote, metadata:JSON.stringify(metadata || {}) }
  );
  await query('update public_leads set last_activity_at = current_timestamp where id = :id', { id });
  return { id:result.insertId, leadId:id, platformUserId:platformUser?.id || null, platformUserName:platformUser?.name || null, platformUserEmail:platformUser?.email || null, eventType:normalizedType, note:normalizedNote, metadata, createdAt:new Date().toISOString() };
}

async function listPublicLeadEvents(leadId) {
  const id = positiveId(leadId);
  if (!hasDatabaseConfig()) return demoLeadEvents.filter((event) => event.leadId === id).map((event) => ({ ...event }));
  const rows = await query(
    `select e.id, e.lead_id as leadId, e.platform_user_id as platformUserId,
            u.name as platformUserName, u.email as platformUserEmail,
            e.event_type as eventType, e.note, e.metadata, e.created_at as createdAt
     from public_lead_events e left join platform_users u on u.id = e.platform_user_id
     where e.lead_id = :id order by e.created_at desc, e.id desc`,
    { id }
  );
  return rows.map((row) => ({ ...row, id:Number(row.id), leadId:Number(row.leadId), metadata:parseJson(row.metadata) }));
}

function normalizeLead(input, context) {
  const leadType = clean(input.leadType, 20).toLowerCase();
  if (!VALID_TYPES.has(leadType)) throw validationError('Choose a valid enquiry type.');
  const name = required(input.name, 'Name', 180);
  const email = clean(input.workEmail || input.email, 180).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw validationError('Enter a valid work email address.');
  const company = required(input.company, 'Company name', 180);
  if (input.consentToContact !== true && input.consentToContact !== 'true' && input.consentToContact !== 'on') {
    throw validationError('Please allow ChatClan to respond to this enquiry.');
  }

  const teamSize = option(input.teamSize, ['1-2', '3-5', '6-20', '21-50', '51+']);
  const monthlyConversations = option(input.monthlyConversations, ['under-500', '500-2000', '2001-10000', '10000+']);
  const useCase = option(input.useCase, ['sales', 'support', 'campaigns', 'commerce', 'automation', 'agency', 'other']);
  const preferredContact = option(input.preferredContact || 'email', ['email', 'phone', 'whatsapp']);
  const route = routeLead({ leadType, teamSize, monthlyConversations, useCase });
  const responseDueAt = new Date(Date.now() + responseSlaMinutes(route.priority) * 60_000).toISOString();
  return {
    reference: createReference(),
    leadType,
    priority: route.priority,
    routeKey: route.routeKey,
    responseDueAt,
    name,
    email,
    phone: clean(input.phone, 40),
    company,
    roleTitle: clean(input.roleTitle, 120),
    teamSize,
    monthlyConversations,
    useCase,
    preferredContact,
    message: required(input.message, 'Enquiry details', 2000),
    consentToContact: true,
    marketingOptIn: input.marketingOptIn === true || input.marketingOptIn === 'true' || input.marketingOptIn === 'on',
    sourcePath: safeSourcePath(input.sourcePath),
    attribution: normalizeAttribution(input),
    ipHash: hashIp(context.ipAddress),
    userAgent: clean(context.userAgent, 255)
  };
}

function routeLead({ leadType, teamSize, monthlyConversations, useCase }) {
  const highIntent = leadType === 'demo' || ['21-50', '51+'].includes(teamSize) || monthlyConversations === '10000+';
  if (useCase === 'agency') return { priority: highIntent ? 'high' : 'normal', routeKey: 'sales_agencies' };
  if (highIntent) return { priority: 'high', routeKey: 'sales_growth' };
  return { priority: 'normal', routeKey: 'sales_general' };
}

async function findRecentLead(email, leadType) {
  if (!hasDatabaseConfig()) {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return demoLeads.find((lead) => lead.email === email && lead.leadType === leadType && new Date(lead.createdAt).getTime() >= cutoff) || null;
  }
  const rows = await query(
    `select id, reference_code as reference, lead_type as leadType, status, priority, route_key as routeKey,
            name, work_email as email, company, created_at as createdAt
     from public_leads
     where work_email = :email and lead_type = :leadType and created_at >= date_sub(current_timestamp, interval 1 day)
     order by created_at desc limit 1`,
    { email, leadType }
  );
  return rows[0] ? publicLeadRecord(rows[0]) : null;
}

async function recordDuplicate(id, lead) {
  if (!hasDatabaseConfig()) {
    const existing = demoLeads.find((item) => Number(item.id) === Number(id));
    if (existing) {
      existing.duplicateCount = Number(existing.duplicateCount || 0) + 1;
      existing.message = lead.message;
      existing.updatedAt = new Date().toISOString();
    }
    return;
  }
  await query(
    `update public_leads
     set duplicate_count = duplicate_count + 1, message = :message, preferred_contact = :preferredContact,
         phone = coalesce(nullif(:phone, ''), phone), attribution = :attribution
     where id = :id`,
    { id, message: lead.message, preferredContact: lead.preferredContact, phone: lead.phone, attribution: JSON.stringify(lead.attribution) }
  );
}

function publicLeadRecord(row) {
  const lead = {
    ...row,
    id: Number(row.id),
    consentToContact: Boolean(Number(row.consentToContact ?? row.consent_to_contact ?? 1)),
    marketingOptIn: Boolean(Number(row.marketingOptIn ?? row.marketing_opt_in ?? 0)),
    duplicateCount: Number(row.duplicateCount || 0),
    attribution: parseJson(row.attribution)
  };
  return { ...lead, slaStatus:leadSlaStatus(lead), followUpStatus:leadFollowUpStatus(lead) };
}

async function setPublicLeadCrmDelivery({ leadId, status, deliveredAt = null, detail = '' }) {
  const id = positiveId(leadId);
  const normalized = option(status, ['pending', 'delivered', 'failed', 'not_configured']);
  if (!hasDatabaseConfig()) {
    const lead = demoLeads.find((item) => Number(item.id) === id);
    if (!lead) throw notFoundError();
    lead.crmDeliveryStatus = normalized;
    lead.crmDeliveredAt = deliveredAt;
  } else {
    await query(
      `update public_leads set crm_delivery_status = :status, crm_delivered_at = :deliveredAt, last_activity_at = current_timestamp where id = :id`,
      { id, status:normalized, deliveredAt:deliveredAt ? new Date(deliveredAt) : null }
    );
  }
  await addPublicLeadEvent({ leadId:id, eventType:`crm_${normalized}`, note:detail || `CRM delivery ${normalized.replaceAll('_', ' ')}.`, metadata:{} });
  return getPublicLead(id);
}

async function exportPublicLeadsCsv() {
  const leads = hasDatabaseConfig() ? await listPublicLeadsForExport() : demoLeads.map(publicLeadRecord);
  const headers = ['Reference','Type','Status','Priority','SLA','Owner','Name','Work email','Phone','Company','Team size','Monthly conversations','Use case','Preferred contact','Marketing opt-in','Source','Created','First contacted','Converted'];
  const rows = leads.map((lead) => [lead.reference,lead.leadType,lead.status,lead.priority,lead.slaStatus,lead.ownerEmail || '',lead.name,lead.email,lead.phone,lead.company,lead.teamSize,lead.monthlyConversations,lead.useCase,lead.preferredContact,lead.marketingOptIn ? 'yes' : 'no',lead.attribution?.source || '',lead.createdAt,lead.firstContactedAt,lead.convertedAt]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

async function listPublicLeadsForExport() {
  const rows = await query(
    `select l.id, l.reference_code as reference, l.lead_type as leadType, l.status, l.priority,
            l.name, l.work_email as email, l.phone, l.company, l.team_size as teamSize,
            l.monthly_conversations as monthlyConversations, l.use_case as useCase,
            l.preferred_contact as preferredContact, l.marketing_opt_in as marketingOptIn,
            l.attribution, l.response_due_at as responseDueAt, l.first_contacted_at as firstContactedAt,
            l.converted_at as convertedAt, l.created_at as createdAt, u.email as ownerEmail
     from public_leads l left join platform_users u on u.id = l.owner_platform_user_id
     order by l.created_at desc limit 10000`
  );
  return rows.map(publicLeadRecord);
}

function normalizeAttribution(input) {
  return {
    source: clean(input.utmSource, 120),
    medium: clean(input.utmMedium, 120),
    campaign: clean(input.utmCampaign, 160),
    content: clean(input.utmContent, 160),
    term: clean(input.utmTerm, 160),
    referrerHost: safeReferrerHost(input.referrer)
  };
}

function safeReferrerHost(value) {
  try { return new URL(String(value || '')).hostname.slice(0, 180); } catch { return ''; }
}

function safeSourcePath(value) {
  const source = clean(value, 300);
  return source.startsWith('/') && !source.startsWith('//') ? source : '/contact';
}

function hashIp(value) {
  if (!value) return '';
  const secret = process.env.LEAD_HASH_SECRET || process.env.SESSION_SECRET || 'chatclan-local-lead-hash';
  return crypto.createHmac('sha256', secret).update(String(value)).digest('hex');
}

function createReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `CCL-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function required(value, label, limit) {
  const normalized = clean(value, limit);
  if (!normalized) throw validationError(`${label} is required.`);
  return normalized;
}

function option(value, allowed) {
  const normalized = clean(value, 80).toLowerCase();
  if (!normalized) return '';
  if (!allowed.includes(normalized)) throw validationError('Choose a valid form option.');
  return normalized;
}

function clean(value, limit) {
  return String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, limit);
}

function normalizeStatus(value) {
  const status = clean(value, 30).toLowerCase();
  if (!VALID_STATUSES.has(status)) throw validationError('Choose a valid lead status.');
  return status;
}

function positiveId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw validationError('A valid identifier is required.');
  return id;
}

function optionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError('Choose a valid follow-up date.');
  return date.toISOString();
}

function databaseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw validationError('Choose a valid date.');
  return date;
}

function responseSlaMinutes(priority) {
  const key = priority === 'high' ? 'LEAD_HIGH_PRIORITY_SLA_MINUTES' : 'LEAD_STANDARD_SLA_MINUTES';
  const fallback = priority === 'high' ? 30 : 240;
  const parsed = Number(process.env[key] || fallback);
  return Number.isFinite(parsed) && parsed >= 5 && parsed <= 10080 ? parsed : fallback;
}

function leadSlaStatus(lead) {
  if (!lead.responseDueAt) return 'not_set';
  const due = new Date(lead.responseDueAt).getTime();
  if (lead.firstContactedAt) return new Date(lead.firstContactedAt).getTime() <= due ? 'met' : 'breached';
  if (['converted','disqualified'].includes(lead.status)) return 'closed';
  const remaining = due - Date.now();
  if (remaining < 0) return 'breached';
  return remaining <= 30 * 60_000 ? 'at_risk' : 'on_track';
}

function leadFollowUpStatus(lead) {
  if (!lead.nextFollowUpAt || ['converted','disqualified'].includes(lead.status)) return 'none';
  return new Date(lead.nextFollowUpAt).getTime() < Date.now() ? 'overdue' : 'scheduled';
}

function crmWebhookConfigured() {
  if (String(process.env.CRM_LEAD_PROVIDER || '').toLowerCase() === 'hubspot') return Boolean(process.env.CRM_HUBSPOT_ACCESS_TOKEN);
  return process.env.CRM_LEAD_WEBHOOK_ENABLED === 'true' && Boolean(process.env.CRM_LEAD_WEBHOOK_URL && process.env.CRM_LEAD_WEBHOOK_SECRET);
}

function csvCell(value) {
  let text = String(value || '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function validationError(message) { return Object.assign(new Error(message), { status: 400, code: 'INVALID_PUBLIC_LEAD' }); }
function notFoundError() { return Object.assign(new Error('Lead not found'), { status: 404, code: 'PUBLIC_LEAD_NOT_FOUND' }); }

module.exports = {
  addPublicLeadEvent,
  createPublicLead,
  exportPublicLeadsCsv,
  getPublicLead,
  getPublicLeadSummary,
  listPublicLeadEvents,
  listPublicLeads,
  setPublicLeadCrmDelivery,
  updatePublicLead
};
