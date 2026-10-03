const { hasDatabaseConfig, query } = require('../db/pool');
const crypto = require('node:crypto');
const demo = require('../data/demoData');
const { listOrders, listProducts } = require('./commerce');

const itemTypes = new Set(['faq', 'policy', 'instruction']);
const itemStatuses = new Set(['draft', 'approved', 'archived']);
const demoItems = new Map();
let nextDemoItemId = 1;

async function listKnowledgeItems(businessId, filters = {}) {
  if (!hasDatabaseConfig()) {
    return [...demoItems.values()]
      .filter((item) => Number(item.businessId) === Number(businessId))
      .filter((item) => !filters.status || item.status === filters.status)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  const where = ['business_id=:businessId'];
  const params = { businessId };
  if (filters.status) { where.push('status=:status'); params.status = normalizeStatus(filters.status); }
  const rows = await query(
    `select id,business_id as businessId,item_type as itemType,title,content,keywords,status,version,
            source_id as sourceId,external_ref as externalRef,content_hash as contentHash,
            created_by_user_id as createdByUserId,approved_by_user_id as approvedByUserId,
            approved_at as approvedAt,created_at as createdAt,updated_at as updatedAt
     from business_knowledge_items where ${where.join(' and ')} order by updated_at desc,id desc limit 500`,
    params
  );
  return rows.map(normalizeItem);
}

async function createKnowledgeItem(input) {
  const item = validateItem(input);
  const now = new Date().toISOString();
  const approved = item.status === 'approved';
  if (!hasDatabaseConfig()) {
    const stored = { id:nextDemoItemId++, businessId:Number(input.businessId), ...item, version:1, sourceId:input.sourceId ? Number(input.sourceId) : null, externalRef:normalizeExternalRef(input.externalRef), contentHash:contentHash(item), createdByUserId:input.actorUser?.id || null, approvedByUserId:approved ? input.actorUser?.id || null : null, approvedAt:approved ? now : null, createdAt:now, updatedAt:now };
    demoItems.set(stored.id, stored);
    return stored;
  }
  const result = await query(
    `insert into business_knowledge_items
       (business_id,item_type,title,content,keywords,status,source_id,external_ref,content_hash,created_by_user_id,approved_by_user_id,approved_at)
     values (:businessId,:itemType,:title,:content,:keywords,:status,:sourceId,:externalRef,:contentHash,:createdByUserId,:approvedByUserId,:approvedAt)`,
    { businessId:input.businessId, ...item, keywords:JSON.stringify(item.keywords), sourceId:input.sourceId || null, externalRef:normalizeExternalRef(input.externalRef), contentHash:contentHash(item), createdByUserId:input.actorUser?.id || null, approvedByUserId:approved ? input.actorUser?.id || null : null, approvedAt:approved ? new Date() : null }
  );
  return (await listKnowledgeItems(input.businessId)).find((candidate) => Number(candidate.id) === Number(result.insertId));
}

async function updateKnowledgeItem(input) {
  const existing = await findKnowledgeItem(input.businessId, input.itemId);
  if (!existing) throw httpError('Knowledge item not found', 404);
  const item = validateItem({ ...existing, ...input });
  const approving = item.status === 'approved' && existing.status !== 'approved';
  const approvedByUserId = item.status === 'approved' ? (approving ? input.actorUser?.id || null : existing.approvedByUserId) : null;
  const approvedAt = item.status === 'approved' ? (approving ? new Date().toISOString() : existing.approvedAt) : null;
  if (!hasDatabaseConfig()) {
    Object.assign(existing, item, { version:Number(existing.version || 1) + 1, contentHash:contentHash(item), approvedByUserId, approvedAt, updatedAt:new Date().toISOString() });
    return existing;
  }
  await query(
    `update business_knowledge_items set item_type=:itemType,title=:title,content=:content,keywords=:keywords,
       status=:status,version=version+1,content_hash=:contentHash,approved_by_user_id=:approvedByUserId,approved_at=:approvedAt
     where id=:itemId and business_id=:businessId`,
    { itemId:input.itemId, businessId:input.businessId, ...item, keywords:JSON.stringify(item.keywords), contentHash:contentHash(item), approvedByUserId, approvedAt:approvedAt ? new Date(approvedAt) : null }
  );
  return findKnowledgeItem(input.businessId, input.itemId);
}

async function retrieveTenantKnowledge(input) {
  const queryText = String(input.queryText || '').trim().slice(0, 5000);
  const queryTokens = tokenize(queryText);
  const [manualItems, products, orders, business] = await Promise.all([
    listKnowledgeItems(input.businessId, { status:'approved' }),
    listProducts(input.businessId, { status:'active' }),
    listOrders(input.businessId),
    getBusinessFact(input.businessId)
  ]);
  const sources = [];
  if (business) sources.push({ ref:`business:${input.businessId}`, type:'business', title:'Workspace identity', fact:`Business name: ${business.name}. Plan: ${business.plan}.`, score:0.15 });
  for (const item of manualItems) {
    const score = lexicalScore(queryTokens, `${item.title} ${item.content} ${(item.keywords || []).join(' ')}`) + (item.itemType === 'policy' || item.itemType === 'instruction' ? 0.12 : 0);
    if (score > 0.1) sources.push({ ref:`knowledge:${item.id}:v${item.version}`, type:item.itemType, title:item.title, fact:item.content.slice(0, 1200), score });
  }
  const productIntent = /\b(product|price|cost|stock|available|availability|catalog|catalogue|size|colour|color)\b/i.test(queryText);
  for (const product of products) {
    const score = lexicalScore(queryTokens, `${product.name} ${product.description || ''} ${product.sku || ''}`) + (productIntent ? 0.12 : 0);
    if (score > 0.12) sources.push({
      ref:`product:${product.id}`, type:'product', title:product.name,
      fact:`${product.name}. Price ${product.currency || 'ZAR'} ${product.price}. Stock ${Number(product.inventoryCount || 0)}. ${String(product.description || '').slice(0, 500)}`.trim(), score
    });
  }
  const normalizedPhone = normalizePhone(input.customerPhone);
  const orderIntent = /\b(order|delivery|deliver|track|tracking|payment|paid|refund|return|collect|collection)\b/i.test(queryText);
  if (normalizedPhone && orderIntent) {
    orders.filter((order) => normalizePhone(order.customerPhone) === normalizedPhone).slice(0, 3).forEach((order, index) => {
      sources.push({
        ref:`order:${order.id}`, type:'customer_order', title:`Order #${order.id}`,
        fact:`Order #${order.id}. Status ${order.status}. Total ${order.currency || 'ZAR'} ${order.total}. Payment ${order.paymentReady ? 'link ready' : order.paymentProvider || 'not recorded'}. Tracking ${order.trackingNumber || 'not available'}.`,
        score:0.95 - index * 0.05
      });
    });
  }
  const selected = dedupeSources(sources).sort((a, b) => b.score - a.score).slice(0, normalizeLimit(input.limit || 8));
  return { queryTokens:[...queryTokens].slice(0, 30), sources:selected.map(({ score, ...source }) => source) };
}

async function getKnowledgeOverview(businessId) {
  const items = await listKnowledgeItems(businessId);
  return {
    summary:{ total:items.length, approved:items.filter((item) => item.status === 'approved').length, drafts:items.filter((item) => item.status === 'draft').length, archived:items.filter((item) => item.status === 'archived').length },
    items
  };
}

async function findKnowledgeItem(businessId, itemId) {
  if (!hasDatabaseConfig()) {
    const item = demoItems.get(Number(itemId));
    return item && Number(item.businessId) === Number(businessId) ? item : null;
  }
  return (await listKnowledgeItems(businessId)).find((item) => Number(item.id) === Number(itemId)) || null;
}

async function getBusinessFact(businessId) {
  if (!hasDatabaseConfig()) return { name:demo.business?.name || 'ChatClan workspace', plan:demo.business?.plan || 'Starter' };
  return (await query('select name,plan from businesses where id=:businessId limit 1', { businessId }))[0] || null;
}

function validateItem(input) {
  const itemType = String(input.itemType || '').toLowerCase();
  if (!itemTypes.has(itemType)) throw httpError('itemType must be faq, policy, or instruction', 400);
  const title = String(input.title || '').trim();
  const content = String(input.content || '').trim();
  if (!title || title.length > 220) throw httpError('title is required and must be 220 characters or fewer', 400);
  if (!content || content.length > 10000) throw httpError('content is required and must be 10000 characters or fewer', 400);
  return { itemType, title, content, keywords:normalizeKeywords(input.keywords), status:normalizeStatus(input.status || 'draft') };
}
function normalizeKeywords(value) { const list=Array.isArray(value)?value:String(value||'').split(','); return [...new Set(list.map((item)=>String(item).trim().toLowerCase()).filter(Boolean))].slice(0,30); }
function normalizeStatus(value) { const status=String(value||'draft').toLowerCase(); if(itemStatuses.has(status))return status; throw httpError('status must be draft, approved, or archived',400); }
function normalizeItem(row) { return { ...row, id:Number(row.id), businessId:Number(row.businessId), version:Number(row.version || 1), keywords:parseJson(row.keywords, []) }; }
function normalizeExternalRef(value) { const normalized=String(value||'').trim(); return normalized ? normalized.slice(0,220) : null; }
function contentHash(item) { return crypto.createHash('sha256').update(`${item.itemType}\n${item.title}\n${item.content}\n${item.keywords.join(',')}`).digest('hex'); }
function tokenize(value) { return new Set(String(value||'').toLowerCase().match(/[a-z0-9]{3,}/g) || []); }
function lexicalScore(queryTokens, text) { if (!queryTokens.size) return 0; const target=tokenize(text); let matches=0; for(const token of queryTokens) if(target.has(token)) matches+=1; return matches/queryTokens.size; }
function normalizePhone(value) { const digits=String(value||'').replace(/\D/g,''); return digits.startsWith('0')?`27${digits.slice(1)}`:digits; }
function normalizeLimit(value) { return Math.max(1,Math.min(12,Math.floor(Number(value)||8))); }
function dedupeSources(items) { const seen=new Set(); return items.filter((item)=>!seen.has(item.ref)&&seen.add(item.ref)); }
function parseJson(value,fallback) { if(value===null||value===undefined)return fallback;if(typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;} }
function httpError(message,status) { const error=new Error(message);error.status=status;return error; }

module.exports = { createKnowledgeItem, getKnowledgeOverview, listKnowledgeItems, retrieveTenantKnowledge, updateKnowledgeItem };
