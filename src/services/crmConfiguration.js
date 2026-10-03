const { hasDatabaseConfig, query } = require('../db/pool');
const { decryptSecret, encryptSecret, maskSecret } = require('./encryption');

let demoConfig = null;

async function getCrmConfiguration({ includeSecrets = false } = {}) {
  const stored = hasDatabaseConfig() ? (await query(`select provider_key as providerKey, hubspot_delivery_mode as hubspotDeliveryMode, enabled, access_token_encrypted as accessTokenEncrypted, webhook_url as webhookUrl, webhook_secret_encrypted as webhookSecretEncrypted, timeout_ms as timeoutMs, last_health_status as lastHealthStatus, last_health_message as lastHealthMessage, last_checked_at as lastCheckedAt, updated_at as updatedAt from crm_provider_config where id=1 limit 1`))[0] : demoConfig;
  const env = environmentConfig();
  const config = stored || env;
  const normalized = {
    providerKey:config?.providerKey || 'hubspot', hubspotDeliveryMode:normalizeHubSpotDeliveryMode(config?.hubspotDeliveryMode), enabled:Boolean(Number(config?.enabled || 0)),
    accessTokenMasked:secretMask(config?.accessTokenEncrypted, config?.accessToken),
    webhookUrl:config?.webhookUrl || '', webhookSecretMasked:secretMask(config?.webhookSecretEncrypted, config?.webhookSecret),
    timeoutMs:Number(config?.timeoutMs || 10000), lastHealthStatus:config?.lastHealthStatus || 'not_checked',
    lastHealthMessage:config?.lastHealthMessage || null, lastCheckedAt:config?.lastCheckedAt || null, updatedAt:config?.updatedAt || null,
    source:stored ? 'saved' : env ? 'environment' : 'none'
  };
  normalized.configured = normalized.enabled && (normalized.providerKey === 'hubspot' ? Boolean(normalized.accessTokenMasked) : Boolean(normalized.webhookUrl && normalized.webhookSecretMasked));
  normalized.destination = normalized.providerKey === 'hubspot' ? 'HubSpot' : safeHost(normalized.webhookUrl);
  if (includeSecrets) {
    normalized.accessToken = decrypt(config?.accessTokenEncrypted) || config?.accessToken || '';
    normalized.webhookSecret = decrypt(config?.webhookSecretEncrypted) || config?.webhookSecret || '';
  }
  return normalized;
}

async function saveCrmConfiguration(input) {
  const current = await getStored();
  const providerKey = ['hubspot','webhook'].includes(String(input.providerKey || '').toLowerCase()) ? String(input.providerKey).toLowerCase() : 'hubspot';
  const accessToken = String(input.accessToken || '').trim();
  const webhookSecret = String(input.webhookSecret || '').trim();
  const stored = {
    providerKey, hubspotDeliveryMode:normalizeHubSpotDeliveryMode(input.hubspotDeliveryMode || current?.hubspotDeliveryMode), enabled:Boolean(input.enabled), accessTokenEncrypted:accessToken ? encryptSecret(accessToken) : current?.accessTokenEncrypted || null,
    webhookUrl:String(input.webhookUrl || current?.webhookUrl || '').trim(), webhookSecretEncrypted:webhookSecret ? encryptSecret(webhookSecret) : current?.webhookSecretEncrypted || null,
    timeoutMs:Math.min(30000, Math.max(1000, Number(input.timeoutMs || current?.timeoutMs || 10000))),
    lastHealthStatus:'not_checked', lastHealthMessage:null, lastCheckedAt:null, updatedAt:new Date().toISOString()
  };
  if (stored.enabled && providerKey === 'hubspot' && !stored.accessTokenEncrypted) throw badRequest('HubSpot service key is required before enabling.');
  if (stored.enabled && providerKey === 'webhook' && (!stored.webhookUrl || !stored.webhookSecretEncrypted)) throw badRequest('Webhook URL and signing secret are required before enabling.');
  if (!hasDatabaseConfig()) demoConfig = stored;
  else await query(`insert into crm_provider_config (id,provider_key,hubspot_delivery_mode,enabled,access_token_encrypted,webhook_url,webhook_secret_encrypted,timeout_ms,updated_by_platform_user_id) values (1,:providerKey,:hubspotDeliveryMode,:enabled,:accessTokenEncrypted,:webhookUrl,:webhookSecretEncrypted,:timeoutMs,:platformUserId) on duplicate key update provider_key=values(provider_key),hubspot_delivery_mode=values(hubspot_delivery_mode),enabled=values(enabled),access_token_encrypted=values(access_token_encrypted),webhook_url=values(webhook_url),webhook_secret_encrypted=values(webhook_secret_encrypted),timeout_ms=values(timeout_ms),last_health_status='not_checked',last_health_message=null,last_checked_at=null,updated_by_platform_user_id=values(updated_by_platform_user_id)`, { ...stored, enabled:stored.enabled ? 1 : 0, platformUserId:input.platformUser?.id || null });
  return getCrmConfiguration();
}

async function testCrmConfiguration(options = {}) {
  const config = await getCrmConfiguration({ includeSecrets:true });
  if (!config.configured) throw badRequest('Save and enable the CRM provider before testing.');
  if (config.providerKey !== 'hubspot') throw badRequest('Connection testing is currently available for HubSpot.');
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let health;
  try {
    const response = await (options.fetchImpl || fetch)('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', { headers:{ Authorization:`Bearer ${config.accessToken}`, 'User-Agent':'ChatClan-HubSpot/1.0' }, signal:controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(`HubSpot returned HTTP ${response.status}${body.message ? `: ${body.message}` : ''}`), { status:response.status });
    health = { status:'healthy', message:'HubSpot contact access verified.', latencyMs:Date.now()-started, checkedAt:new Date().toISOString() };
  } catch (error) {
    health = { status:'failed', message:error.name === 'AbortError' ? 'HubSpot connection timed out.' : String(error.message || error).slice(0,500), latencyMs:Date.now()-started, checkedAt:new Date().toISOString() };
  } finally { clearTimeout(timer); }
  await saveHealth(health);
  return health;
}

async function saveHealth(health) {
  if (!hasDatabaseConfig()) Object.assign(demoConfig, { lastHealthStatus:health.status, lastHealthMessage:health.message, lastCheckedAt:health.checkedAt });
  else await query('update crm_provider_config set last_health_status=:status,last_health_message=:message,last_checked_at=:checkedAt where id=1', { ...health, checkedAt:new Date(health.checkedAt) });
}

async function getStored() { return hasDatabaseConfig() ? (await query('select provider_key as providerKey,hubspot_delivery_mode as hubspotDeliveryMode,access_token_encrypted as accessTokenEncrypted,webhook_url as webhookUrl,webhook_secret_encrypted as webhookSecretEncrypted,timeout_ms as timeoutMs from crm_provider_config where id=1 limit 1'))[0] : demoConfig; }
function environmentConfig() { const providerKey=String(process.env.CRM_LEAD_PROVIDER||'').toLowerCase(); if(providerKey==='hubspot'&&process.env.CRM_HUBSPOT_ACCESS_TOKEN)return{providerKey,hubspotDeliveryMode:normalizeHubSpotDeliveryMode(process.env.CRM_HUBSPOT_DELIVERY_MODE),enabled:true,accessToken:process.env.CRM_HUBSPOT_ACCESS_TOKEN,timeoutMs:process.env.CRM_HUBSPOT_TIMEOUT_MS}; if(process.env.CRM_LEAD_WEBHOOK_ENABLED==='true')return{providerKey:'webhook',enabled:true,webhookUrl:process.env.CRM_LEAD_WEBHOOK_URL,webhookSecret:process.env.CRM_LEAD_WEBHOOK_SECRET,timeoutMs:process.env.CRM_LEAD_WEBHOOK_TIMEOUT_MS}; return null; }
function normalizeHubSpotDeliveryMode(value) { return String(value || '').toLowerCase() === 'contacts_and_leads' ? 'contacts_and_leads' : 'contacts_only'; }
function secretMask(encrypted, plain) { const value=decrypt(encrypted)||plain; return value ? maskSecret(value) : null; }
function decrypt(value) { try { return value ? decryptSecret(value) : ''; } catch { return ''; } }
function safeHost(value) { try { return new URL(value).host; } catch { return ''; } }
function badRequest(message) { return Object.assign(new Error(message), { status:400 }); }

module.exports = { getCrmConfiguration, saveCrmConfiguration, testCrmConfiguration };
