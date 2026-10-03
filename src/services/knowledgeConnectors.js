const net = require('node:net');
const { decryptSecret, encryptSecret, maskSecret } = require('./encryption');
const { enqueueJob, cancelJobsByDedupePrefix } = require('./jobQueue');
const {
  archiveKnowledgeSource,
  createSource,
  findSource,
  findSourceWithCredentials,
  ingestRecords,
  updateSourceState
} = require('./knowledgeIngestion');
const { extractDocumentText } = require('./documentExtraction');
const { beginConnectorSyncRun, completeConnectorSyncRun } = require('./knowledgeConnectorOperations');
const { revokeGoogleDriveCredentials } = require('./googleDriveOAuth');
const { queueConnectorAlertEvaluation } = require('./connectorAlerts');

const providers = new Set(['shopify', 'woocommerce', 'google_drive']);
const GOOGLE_DOCUMENT = 'application/vnd.google-apps.document';
const GOOGLE_FOLDER = 'application/vnd.google-apps.folder';

async function createKnowledgeConnector(input) {
  const provider = normalizeProvider(input.provider || input.sourceType);
  const configuration = validateConfiguration(provider, input);
  const credentials = validateCredentials(provider, input.credentials || input);
  const interval = normalizeInterval(input.syncIntervalMinutes);
  const name = String(input.name || defaultName(provider, configuration)).trim().slice(0, 220);
  if (!name) throw httpError('Connector name is required', 400);
  const runAt = new Date();
  const source = await createSource({
    businessId:input.businessId,
    actorUser:input.actorUser,
    sourceType:provider,
    formatType:'remote',
    name,
    status:'ready',
    configuration:{ ...configuration, reviewDefault:normalizeReviewStatus(input.defaultStatus) },
    credentialsEncrypted:encryptSecret(JSON.stringify(credentials)),
    credentialsMasked:maskCredentials(provider, credentials),
    syncIntervalMinutes:interval,
    nextSyncAt:runAt
  });
  await enqueueSourceSync(source, runAt, input.triggerType || 'initial');
  return findSource(source.businessId, source.id);
}

async function updateKnowledgeConnector(input) {
  const source = await findSourceWithCredentials(input.businessId, input.sourceId);
  if (!source || !providers.has(source.sourceType)) throw httpError('Live knowledge connector not found', 404);
  const changes = {};
  if (input.status !== undefined) {
    const status = String(input.status).toLowerCase();
    if (!['ready', 'paused'].includes(status)) throw httpError('Connector status must be ready or paused', 400);
    changes.status = status;
    changes.nextSyncAt = status === 'paused' ? null : new Date().toISOString();
  }
  if (input.syncIntervalMinutes !== undefined) changes.syncIntervalMinutes = normalizeInterval(input.syncIntervalMinutes);
  if (input.configuration) changes.configuration = validateConfiguration(source.sourceType, { ...source.configuration, ...input.configuration });
  if (input.credentials && Object.values(input.credentials).some(Boolean)) {
    const current = parseCredentials(source.credentialsEncrypted);
    const credentials = validateCredentials(source.sourceType, { ...current, ...stripEmpty(input.credentials) });
    changes.credentialsEncrypted = encryptSecret(JSON.stringify(credentials));
    changes.credentialsMasked = maskCredentials(source.sourceType, credentials);
  }
  const updated = await updateSourceState(source, changes);
  if (updated.status === 'ready') await enqueueSourceSync(updated, changes.nextSyncAt || new Date(), 'manual');
  else await cancelJobsByDedupePrefix(sourceDedupePrefix(source));
  return findSource(updated.businessId, updated.id);
}

async function requestKnowledgeConnectorSync(input) {
  const source = await findSource(input.businessId, input.sourceId);
  if (!source || !providers.has(source.sourceType)) throw httpError('Live knowledge connector not found', 404);
  if (source.status === 'paused') throw httpError('Resume this connector before syncing it', 409);
  return enqueueSourceSync(source, new Date(), 'manual');
}

async function deleteKnowledgeConnector(input) {
  const source = await findSourceWithCredentials(input.businessId, input.sourceId);
  if (!source) throw httpError('Knowledge source not found', 404);
  let revocation = null;
  if (source.sourceType === 'google_drive' && source.credentialsEncrypted) {
    try { revocation = await revokeGoogleDriveCredentials(parseCredentials(source.credentialsEncrypted), input.fetchImpl || global.fetch); }
    catch (error) { revocation = { revoked:false, error:String(error.message || error).slice(0, 240) }; }
  }
  await cancelJobsByDedupePrefix(sourceDedupePrefix(source));
  const archived = await archiveKnowledgeSource(input);
  await queueConnectorAlertEvaluation(source).catch(() => null);
  return { ...archived, revocation };
}

async function syncKnowledgeConnector(input, dependencies = {}) {
  const source = await findSourceWithCredentials(input.businessId, input.sourceId);
  if (!source) return { skipped:true, reason:'source_deleted' };
  if (source.status === 'paused') return { skipped:true, reason:'source_paused' };
  const fetchImpl = dependencies.fetchImpl || global.fetch;
  const credentials = parseCredentials(source.credentialsEncrypted);
  const syncRun = await beginConnectorSyncRun({
    businessId:source.businessId, sourceId:source.id, provider:source.sourceType,
    jobId:input.jobId, triggerType:input.triggerType, attempt:input.attempt,
    maxAttempts:input.maxAttempts, scheduledFor:input.scheduledFor
  });
  try {
    const adapterResult = await fetchProviderRecords(source, credentials, fetchImpl);
    if (adapterResult.credentials) {
      source.credentialsEncrypted = encryptSecret(JSON.stringify(adapterResult.credentials));
      source.credentialsMasked = maskCredentials(source.sourceType, adapterResult.credentials);
    }
    const result = await ingestRecords({
      businessId:source.businessId,
      actorUser:null,
      source,
      records:adapterResult.records,
      defaultStatus:source.configuration.reviewDefault || 'draft'
    });
    const nextSyncAt = nextRun(source.syncIntervalMinutes);
    await updateSourceState({ ...source, ...result.source }, {
      status:'ready', nextSyncAt, consecutiveFailures:0,
      credentialsEncrypted:source.credentialsEncrypted,
      credentialsMasked:source.credentialsMasked
    });
    await completeConnectorSyncRun(syncRun, {
      status:'succeeded', fetchedCount:adapterResult.records.length,
      createdCount:result.created, updatedCount:result.updated, skippedCount:result.skipped
    });
    await queueConnectorAlertEvaluation(source).catch(() => null);
    await enqueueSourceSync(source, nextSyncAt, 'scheduled');
    return { ...result, provider:source.sourceType, nextSyncAt };
  } catch (error) {
    const nextSyncAt = source.nextSyncAt && new Date(source.nextSyncAt) > new Date() ? source.nextSyncAt : nextRun(source.syncIntervalMinutes);
    await updateSourceState(source, {
      status:'error', nextSyncAt, consecutiveFailures:Number(source.consecutiveFailures || 0) + 1,
      lastError:String(error.message || error).slice(0, 500)
    });
    await completeConnectorSyncRun(syncRun, { status:'failed', errorMessage:String(error.message || error) });
    await queueConnectorAlertEvaluation(source).catch(() => null);
    await enqueueSourceSync(source, nextSyncAt, 'scheduled');
    throw error;
  }
}

async function fetchProviderRecords(source, credentials, fetchImpl) {
  if (source.sourceType === 'shopify') return { records:await fetchShopifyRecords(source.configuration, credentials, fetchImpl) };
  if (source.sourceType === 'woocommerce') return { records:await fetchWooCommerceRecords(source.configuration, credentials, fetchImpl) };
  if (source.sourceType === 'google_drive') return fetchGoogleDriveRecords(source.configuration, credentials, fetchImpl);
  throw httpError('Unsupported knowledge connector provider', 400);
}

async function fetchShopifyRecords(configuration, credentials, fetchImpl) {
  const query = `query KnowledgeProducts { products(first: 100, sortKey: UPDATED_AT, reverse: true) { nodes { id title handle status descriptionHtml updatedAt variants(first: 20) { nodes { title sku price inventoryQuantity } } } } }`;
  const response = await requestJson(fetchImpl, `https://${configuration.shopDomain}/admin/api/2026-07/graphql.json`, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'X-Shopify-Access-Token':credentials.accessToken }, body:JSON.stringify({ query })
  });
  if (response.errors?.length) throw httpError(`Shopify returned: ${response.errors[0].message}`, 502);
  return (response.data?.products?.nodes || []).map((product) => ({
    title:product.title,
    content:[stripHtml(product.descriptionHtml), `Status: ${product.status}.`, ...((product.variants?.nodes || []).map((variant) => `${variant.title}: ${variant.price}; SKU ${variant.sku || 'not set'}; stock ${variant.inventoryQuantity ?? 'not tracked'}.`))].filter(Boolean).join('\n').slice(0, 10000),
    itemType:'instruction', keywords:['product', product.title, ...(product.variants?.nodes || []).map((variant) => variant.sku).filter(Boolean)],
    externalRef:`shopify:${product.id}`
  }));
}

async function fetchWooCommerceRecords(configuration, credentials, fetchImpl) {
  const url = new URL('/wp-json/wc/v3/products', configuration.storeUrl);
  url.searchParams.set('per_page', '100'); url.searchParams.set('page', '1'); url.searchParams.set('status', 'publish');
  url.searchParams.set('orderby', 'modified'); url.searchParams.set('order', 'desc');
  const products = await requestJson(fetchImpl, url, { headers:{ Authorization:`Basic ${Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64')}` } });
  if (!Array.isArray(products)) throw httpError('WooCommerce returned an invalid product response', 502);
  return products.map((product) => ({
    title:String(product.name || `Product ${product.id}`),
    content:[stripHtml(product.description || product.short_description), `Price: ${product.price || 'not set'}.`, `Stock: ${(product.stock_quantity ?? product.stock_status) || 'not tracked'}.`, product.permalink ? `Product page: ${product.permalink}` : ''].filter(Boolean).join('\n').slice(0, 10000),
    itemType:'instruction', keywords:['product', product.name, product.sku].filter(Boolean), externalRef:`woocommerce:product:${product.id}`
  }));
}

async function fetchGoogleDriveRecords(configuration, credentials, fetchImpl) {
  const activeCredentials = await refreshGoogleToken(credentials, fetchImpl);
  const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
  const filters = ['trashed = false', `mimeType != '${GOOGLE_FOLDER}'`];
  if (configuration.folderId) filters.push(`'${escapeDriveQuery(configuration.folderId)}' in parents`);
  listUrl.searchParams.set('q', filters.join(' and '));
  listUrl.searchParams.set('pageSize', '50');
  listUrl.searchParams.set('orderBy', 'modifiedTime desc');
  listUrl.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,capabilities(canDownload))');
  const result = await requestJson(fetchImpl, listUrl, { headers:{ Authorization:`Bearer ${activeCredentials.accessToken}` } });
  const records = [];
  for (const file of result.files || []) {
    if (file.capabilities?.canDownload === false || !isSupportedDriveType(file)) continue;
    const text = await downloadDriveText(file, activeCredentials.accessToken, fetchImpl);
    if (!text.trim()) continue;
    records.push({ title:file.name, content:text.slice(0, 10000), itemType:'instruction', keywords:['google drive', file.name], externalRef:`google-drive:${file.id}` });
  }
  return { records, credentials:activeCredentials };
}

async function downloadDriveText(file, accessToken, fetchImpl) {
  const headers = { Authorization:`Bearer ${accessToken}` };
  if (file.mimeType === GOOGLE_DOCUMENT) {
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export`);
    url.searchParams.set('mimeType', 'text/plain');
    return requestText(fetchImpl, url, { headers });
  }
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);
  url.searchParams.set('alt', 'media');
  const response = await request(fetchImpl, url, { headers });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (/pdf/i.test(file.mimeType)) return extractDocumentText({ buffer, formatType:'pdf' });
  if (/wordprocessingml\.document/i.test(file.mimeType)) return extractDocumentText({ buffer, formatType:'docx' });
  return buffer.toString('utf8');
}

async function refreshGoogleToken(credentials, fetchImpl) {
  if (!credentials.refreshToken) return credentials;
  const clientId = credentials.clientId || process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
  const clientSecret = credentials.clientSecret || process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw httpError('Google OAuth client configuration is unavailable', 503);
  const body = new URLSearchParams({ client_id:clientId, client_secret:clientSecret, refresh_token:credentials.refreshToken, grant_type:'refresh_token' });
  const token = await requestJson(fetchImpl, 'https://oauth2.googleapis.com/token', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:body.toString() });
  return { ...credentials, accessToken:token.access_token || credentials.accessToken, expiresAt:token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : credentials.expiresAt };
}

async function enqueueSourceSync(source, runAt, triggerType = 'scheduled') {
  const scheduled = runAt instanceof Date ? runAt : new Date(runAt);
  await updateSourceState(source, { nextSyncAt:scheduled.toISOString() });
  return enqueueJob({
    type:'knowledge.source.sync', payload:{ businessId:source.businessId, sourceId:source.id, triggerType, scheduledFor:scheduled.toISOString() }, runAt:scheduled,
    maxAttempts:4, dedupeKey:`${sourceDedupePrefix(source)}${scheduled.toISOString()}`
  });
}

async function request(fetchImpl, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(String(url), { ...options, signal:controller.signal });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw httpError(`Remote provider returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`, 502);
    }
    return response;
  } finally { clearTimeout(timeout); }
}
async function requestJson(fetchImpl, url, options) { return (await request(fetchImpl, url, options)).json(); }
async function requestText(fetchImpl, url, options) { return (await request(fetchImpl, url, options)).text(); }

function validateConfiguration(provider, input) {
  if (provider === 'shopify') {
    const shopDomain = String(input.shopDomain || input.configuration?.shopDomain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain)) throw httpError('A valid *.myshopify.com shop domain is required', 400);
    return { shopDomain };
  }
  if (provider === 'woocommerce') {
    const storeUrl = safeRemoteUrl(input.storeUrl || input.configuration?.storeUrl);
    return { storeUrl:storeUrl.origin };
  }
  const folderId = String(input.folderId || input.configuration?.folderId || '').trim().slice(0, 220);
  return { folderId:folderId || null };
}

function validateCredentials(provider, input) {
  if (provider === 'shopify') return { accessToken:required(input.accessToken, 'Shopify Admin API access token') };
  if (provider === 'woocommerce') return { consumerKey:required(input.consumerKey, 'WooCommerce consumer key'), consumerSecret:required(input.consumerSecret, 'WooCommerce consumer secret') };
  const credentials = {
    accessToken:required(input.accessToken, 'Google OAuth access token'),
    refreshToken:String(input.refreshToken || '').trim(), clientId:String(input.clientId || '').trim(), clientSecret:String(input.clientSecret || '').trim(),
    authMode:String(input.authMode || 'manual'), expiresAt:input.expiresAt || null, scope:String(input.scope || ''), tokenType:String(input.tokenType || 'Bearer')
  };
  const platformOAuthConfigured = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID && process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;
  if (credentials.refreshToken && (!credentials.clientId || !credentials.clientSecret) && !platformOAuthConfigured) throw httpError('Google client ID and client secret are required with a refresh token', 400);
  return credentials;
}

function maskCredentials(provider, credentials) {
  if (provider === 'shopify') return { accessToken:maskSecret(credentials.accessToken) };
  if (provider === 'woocommerce') return { consumerKey:maskSecret(credentials.consumerKey), consumerSecret:maskSecret(credentials.consumerSecret) };
  return { accessToken:maskSecret(credentials.accessToken), refreshToken:maskSecret(credentials.refreshToken), clientId:maskSecret(credentials.clientId), clientSecret:maskSecret(credentials.clientSecret) };
}

function parseCredentials(value) { try { return JSON.parse(decryptSecret(value) || '{}'); } catch { throw httpError('Connector credentials could not be decrypted', 500); } }
function normalizeProvider(value) { const provider=String(value || '').trim().toLowerCase(); if (!providers.has(provider)) throw httpError('provider must be shopify, woocommerce, or google_drive', 400); return provider; }
function normalizeInterval(value) { const interval=Math.floor(Number(value || 360)); if (!Number.isFinite(interval) || interval < 15 || interval > 10080) throw httpError('Sync interval must be between 15 and 10080 minutes', 400); return interval; }
function normalizeReviewStatus(value) { return String(value || 'draft').toLowerCase() === 'approved' ? 'approved' : 'draft'; }
function required(value, label) { const text=String(value || '').trim(); if (!text) throw httpError(`${label} is required`, 400); return text; }
function stripEmpty(value) { return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => String(item || '').trim())); }
function defaultName(provider, configuration) { return provider === 'shopify' ? `Shopify - ${configuration.shopDomain}` : provider === 'woocommerce' ? `WooCommerce - ${new URL(configuration.storeUrl).hostname}` : 'Google Drive'; }
function nextRun(interval) { return new Date(Date.now() + Number(interval || 360) * 60_000).toISOString(); }
function sourceDedupePrefix(source) { return `knowledge-source-sync:${source.businessId}:${source.id}:`; }
function safeRemoteUrl(value) { let url; try { url=new URL(String(value || '')); } catch { throw httpError('A valid WooCommerce store URL is required', 400); } if (url.protocol !== 'https:' || url.username || url.password || url.port) throw httpError('WooCommerce store URL must use standard HTTPS', 400); const host=url.hostname.toLowerCase(); if (host === 'localhost' || host.endsWith('.local') || net.isIP(host)) throw httpError('WooCommerce store URL must use a public hostname', 400); return url; }
function stripHtml(value) { return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim(); }
function escapeDriveQuery(value) { return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function isSupportedDriveType(file) { return file.mimeType === GOOGLE_DOCUMENT || /^(text\/plain|text\/markdown|application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(file.mimeType || ''); }
function httpError(message, status) { const error=new Error(message); error.status=status; return error; }

module.exports = { createKnowledgeConnector, deleteKnowledgeConnector, fetchGoogleDriveRecords, fetchShopifyRecords, fetchWooCommerceRecords, requestKnowledgeConnectorSync, syncKnowledgeConnector, updateKnowledgeConnector };
