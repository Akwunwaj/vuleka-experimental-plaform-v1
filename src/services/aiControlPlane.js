const { hasDatabaseConfig, query } = require('../db/pool');
const { decryptSecret, encryptSecret, maskSecret } = require('./encryption');
const { assertPlatformGuardrailAllows } = require('./platformGuardrails');
const { assertPlatformTenantCanOperate, recordPlatformAuditEvent } = require('./platform');
const { callAiProvider } = require('./aiProviderAdapters');

const providerDefinitions = [
  { key: 'openai', label: 'OpenAI', protocol: 'openai_responses', defaultBaseUrl: 'https://api.openai.com/v1', suggestedModel: 'gpt-5-mini' },
  { key: 'google', label: 'Google Gemini', protocol: 'google_generate_content', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', suggestedModel: 'gemini-2.5-flash' },
  { key: 'anthropic', label: 'Anthropic', protocol: 'anthropic_messages', defaultBaseUrl: 'https://api.anthropic.com/v1', suggestedModel: 'claude-sonnet-4-5' },
  { key: 'deepseek', label: 'DeepSeek', protocol: 'openai_compatible', defaultBaseUrl: '', suggestedModel: '' },
  { key: 'grok', label: 'Grok by xAI', protocol: 'openai_compatible', defaultBaseUrl: '', suggestedModel: '' }
];
const demoConfigs = new Map();
const demoPolicies = new Map();
const demoUsage = [];
let nextUsageId = 1;

async function listAiProviders() {
  const rows = hasDatabaseConfig() ? await query(
    `select provider_key as providerKey, status, api_key_encrypted as apiKeyEncrypted, base_url as baseUrl,
            default_model as defaultModel, timeout_ms as timeoutMs, last_health_status as lastHealthStatus,
            last_health_message as lastHealthMessage, last_checked_at as lastCheckedAt, updated_at as updatedAt
     from ai_provider_configs`
  ) : [...demoConfigs.values()];
  const byKey = new Map(rows.map((row) => [row.providerKey, row]));
  return providerDefinitions.map((definition) => normalizeProvider(definition, byKey.get(definition.key)));
}

async function saveAiProviderConfig(input) {
  const definition = getProviderDefinition(input.providerKey);
  const existing = await getStoredProvider(definition.key);
  const apiKey = String(input.apiKey || '').trim();
  const apiKeyEncrypted = apiKey ? encryptSecret(apiKey) : existing?.apiKeyEncrypted || null;
  const enabled = Boolean(input.enabled);
  if (enabled && !apiKeyEncrypted) throw httpError('apiKey is required before enabling this provider', 400);
  const baseUrl = String(input.baseUrl || existing?.baseUrl || definition.defaultBaseUrl || '').trim().replace(/\/$/, '');
  const defaultModel = String(input.defaultModel || existing?.defaultModel || definition.suggestedModel || '').trim();
  if (enabled && (!baseUrl || !defaultModel)) throw httpError('baseUrl and defaultModel are required before enabling this provider', 400);
  const stored = {
    providerKey: definition.key, status: enabled ? 'configured' : 'disabled', apiKeyEncrypted, baseUrl,
    defaultModel, timeoutMs: normalizeInteger(input.timeoutMs || existing?.timeoutMs || 30000, 1000, 120000),
    lastHealthStatus: existing?.lastHealthStatus || 'not_checked', lastHealthMessage: existing?.lastHealthMessage || null,
    lastCheckedAt: existing?.lastCheckedAt || null, updatedAt: new Date().toISOString()
  };
  if (!hasDatabaseConfig()) demoConfigs.set(definition.key, stored);
  else await query(
    `insert into ai_provider_configs
       (provider_key, status, api_key_encrypted, base_url, default_model, timeout_ms, updated_by_platform_user_id)
     values (:providerKey, :status, :apiKeyEncrypted, :baseUrl, :defaultModel, :timeoutMs, :platformUserId)
     on duplicate key update status=values(status), api_key_encrypted=values(api_key_encrypted),
       base_url=values(base_url), default_model=values(default_model), timeout_ms=values(timeout_ms),
       updated_by_platform_user_id=values(updated_by_platform_user_id)`,
    { ...stored, platformUserId: input.platformUser?.id || null }
  );
  await audit(input, 'platform.ai_provider.update', 'ai_provider', definition.key, enabled ? 'enabled' : 'disabled', { defaultModel, baseUrl, keyRotated: Boolean(apiKey) });
  return (await listAiProviders()).find((item) => item.key === definition.key);
}

async function getBusinessAiPolicy(businessId) {
  let row;
  if (!hasDatabaseConfig()) row = demoPolicies.get(Number(businessId));
  else row = (await query(
    `select business_id as businessId, enabled, autonomy_mode as autonomyMode, provider_chain as providerChain,
            monthly_budget_cents as monthlyBudgetCents, monthly_token_limit as monthlyTokenLimit,
            max_response_tokens as maxResponseTokens, human_handoff_enabled as humanHandoffEnabled,
            updated_at as updatedAt from business_ai_policies where business_id=:businessId limit 1`, { businessId }
  ))[0];
  return normalizePolicy(row || { businessId, providerChain: [] });
}

async function saveBusinessAiPolicy(input) {
  await assertPlatformTenantCanOperate(input.businessId, 'configure_ai_policy');
  const providerChain = normalizeProviderChain(input.providerChain);
  const enabled = Boolean(input.enabled);
  if (enabled && !providerChain.length) throw httpError('At least one provider is required when AI is enabled', 400);
  const policy = normalizePolicy({
    businessId: input.businessId, enabled, autonomyMode: input.autonomyMode,
    providerChain, monthlyBudgetCents: input.monthlyBudgetCents,
    monthlyTokenLimit: input.monthlyTokenLimit, maxResponseTokens: input.maxResponseTokens,
    humanHandoffEnabled: input.humanHandoffEnabled, updatedAt: new Date().toISOString()
  });
  if (!hasDatabaseConfig()) demoPolicies.set(Number(input.businessId), policy);
  else await query(
    `insert into business_ai_policies
       (business_id, enabled, autonomy_mode, provider_chain, monthly_budget_cents, monthly_token_limit,
        max_response_tokens, human_handoff_enabled, updated_by_platform_user_id)
     values (:businessId,:enabled,:autonomyMode,:providerChain,:monthlyBudgetCents,:monthlyTokenLimit,
        :maxResponseTokens,:humanHandoffEnabled,:platformUserId)
     on duplicate key update enabled=values(enabled), autonomy_mode=values(autonomy_mode), provider_chain=values(provider_chain),
        monthly_budget_cents=values(monthly_budget_cents), monthly_token_limit=values(monthly_token_limit),
        max_response_tokens=values(max_response_tokens), human_handoff_enabled=values(human_handoff_enabled),
        updated_by_platform_user_id=values(updated_by_platform_user_id)`,
    { ...policy, enabled: enabled ? 1 : 0, providerChain: JSON.stringify(providerChain), humanHandoffEnabled: policy.humanHandoffEnabled ? 1 : 0, platformUserId: input.platformUser?.id || null }
  );
  await audit(input, 'platform.ai_policy.update', 'tenant', input.businessId, policy.autonomyMode, { enabled, providerChain });
  return getBusinessAiPolicy(input.businessId);
}

async function getAiOperationsOverview() {
  const [providers, usage] = await Promise.all([listAiProviders(), listAiUsage({ limit: 500 })]);
  return {
    providers,
    summary: {
      configuredProviders: providers.filter((item) => item.enabled).length,
      successfulRequests: usage.filter((item) => item.status === 'succeeded').length,
      failedRequests: usage.filter((item) => item.status === 'failed').length,
      inputTokens: usage.reduce((sum, item) => sum + item.inputTokens, 0),
      outputTokens: usage.reduce((sum, item) => sum + item.outputTokens, 0),
      estimatedCostCents: usage.reduce((sum, item) => sum + item.estimatedCostCents, 0)
    },
    recentUsage: usage.slice(0, 20)
  };
}

async function listAiUsage({ businessId = null, limit = 100 } = {}) {
  if (!hasDatabaseConfig()) return demoUsage.filter((item) => !businessId || Number(item.businessId) === Number(businessId)).slice(0, normalizeInteger(limit, 1, 500));
  const where = businessId ? 'where business_id=:businessId' : '';
  const rows = await query(
    `select id, business_id as businessId, provider_key as providerKey, model, workflow_key as workflowKey,
            status, input_tokens as inputTokens, output_tokens as outputTokens,
            estimated_cost_cents as estimatedCostCents, latency_ms as latencyMs,
            provider_request_id as providerRequestId, error_code as errorCode, created_at as createdAt
     from ai_usage_events ${where} order by created_at desc, id desc limit ${normalizeInteger(limit, 1, 500)}`, { businessId }
  );
  return rows.map(normalizeUsage);
}

async function orchestrateAiText(input) {
  await assertPlatformTenantCanOperate(input.businessId, 'ai_inference');
  await assertPlatformGuardrailAllows('ai_auto_replies');
  const policy = await getBusinessAiPolicy(input.businessId);
  if (!policy.enabled) throw httpError('AI is disabled for this workspace', 423, 'AI_POLICY_DISABLED');
  const usage = await listMonthlyAiUsage(input.businessId);
  const tokensUsed = usage.reduce((sum, item) => sum + item.inputTokens + item.outputTokens, 0);
  const costUsed = usage.reduce((sum, item) => sum + item.estimatedCostCents, 0);
  if (policy.monthlyTokenLimit && tokensUsed >= policy.monthlyTokenLimit) throw httpError('Monthly AI token limit reached', 429, 'AI_TOKEN_LIMIT_REACHED');
  if (policy.monthlyBudgetCents && costUsed >= policy.monthlyBudgetCents) throw httpError('Monthly AI budget reached', 429, 'AI_BUDGET_REACHED');
  const providers = await listAiProviders();
  const chain = policy.providerChain.map((key) => providers.find((item) => item.key === key)).filter((item) => item?.enabled);
  if (!chain.length) throw httpError('No configured AI provider is available', 503, 'AI_PROVIDER_UNAVAILABLE');
  const prompt = String(input.prompt || '').trim();
  if (!prompt) throw httpError('prompt is required', 400, 'AI_PROMPT_REQUIRED');
  if (process.env.AI_MODE !== 'live') {
    const selected = chain[0];
    const startedAt = Date.now();
    const text = `[AI mock:${selected.label}] ${String(input.prompt || '').trim().slice(0, 240)}`;
    await recordUsage({ businessId: input.businessId, providerKey: selected.key, model: selected.defaultModel, workflowKey: input.workflowKey, status: 'succeeded', inputTokens: estimateTokens(input.prompt), outputTokens: estimateTokens(text), latencyMs: Date.now() - startedAt });
    return { text, provider: selected.key, model: selected.defaultModel, mode: 'mock', autonomyMode: policy.autonomyMode };
  }
  const attempts = [];
  for (const provider of chain) {
    const runtimeProvider = await getRuntimeProvider(provider.key);
    const startedAt = Date.now();
    try {
      const result = await callAiProvider(runtimeProvider, {
        prompt,
        systemPrompt: input.systemPrompt,
        maxOutputTokens: Math.min(policy.maxResponseTokens, remainingTokenAllowance(policy, tokensUsed)),
        fetchImpl: input.fetchImpl
      });
      await recordUsage({
        businessId: input.businessId, providerKey: provider.key, model: provider.defaultModel,
        workflowKey: input.workflowKey, status: 'succeeded', inputTokens: result.inputTokens,
        outputTokens: result.outputTokens, latencyMs: result.latencyMs,
        providerRequestId: result.providerRequestId
      });
      return { text: result.text, provider: provider.key, model: provider.defaultModel, mode: 'live', autonomyMode: policy.autonomyMode };
    } catch (error) {
      const attempt = { provider: provider.key, code: error.code || 'AI_PROVIDER_ERROR', retryable: error.retryable !== false };
      attempts.push(attempt);
      await recordUsage({
        businessId: input.businessId, providerKey: provider.key, model: provider.defaultModel,
        workflowKey: input.workflowKey, status: 'failed', inputTokens: 0, outputTokens: 0,
        latencyMs: Date.now() - startedAt, providerRequestId: error.providerRequestId,
        errorCode: attempt.code
      });
    }
  }
  const error = httpError('All configured AI providers failed', 503, 'AI_PROVIDER_CHAIN_FAILED');
  error.attempts = attempts;
  throw error;
}

async function checkAiProviderHealth(input) {
  const publicProvider = (await listAiProviders()).find((item) => item.key === String(input.providerKey || '').toLowerCase());
  if (!publicProvider) throw httpError('Unknown AI provider', 404);
  if (!publicProvider.enabled) throw httpError('Enable and save the provider before testing it', 409, 'AI_PROVIDER_DISABLED');
  const provider = await getRuntimeProvider(publicProvider.key);
  const checkedAt = new Date().toISOString();
  try {
    const result = await callAiProvider(provider, {
      prompt: 'Reply with OK.',
      systemPrompt: 'This is a connection health check. Reply only with OK.',
      maxOutputTokens: 8,
      fetchImpl: input.fetchImpl
    });
    await updateProviderHealth(provider.key, 'healthy', 'Connection verified', checkedAt);
    await audit(input, 'platform.ai_provider.health_check', 'ai_provider', provider.key, 'healthy', { latencyMs: result.latencyMs, providerRequestId: result.providerRequestId });
    return { providerKey: provider.key, status: 'healthy', message: 'Connection verified', checkedAt, latencyMs: result.latencyMs };
  } catch (error) {
    await updateProviderHealth(provider.key, 'unhealthy', error.code || 'AI_PROVIDER_ERROR', checkedAt, true);
    await audit(input, 'platform.ai_provider.health_check', 'ai_provider', provider.key, 'unhealthy', { errorCode: error.code || 'AI_PROVIDER_ERROR' });
    const healthError = httpError('Provider connection check failed', 502, error.code || 'AI_PROVIDER_HEALTH_FAILED');
    healthError.providerKey = provider.key;
    throw healthError;
  }
}

async function recordUsage(event) {
  const normalized = normalizeUsage({ id: nextUsageId++, createdAt: new Date().toISOString(), ...event });
  if (!hasDatabaseConfig()) demoUsage.unshift(normalized);
  else await query(
    `insert into ai_usage_events (business_id,provider_key,model,workflow_key,status,input_tokens,output_tokens,estimated_cost_cents,latency_ms,provider_request_id,error_code)
     values (:businessId,:providerKey,:model,:workflowKey,:status,:inputTokens,:outputTokens,:estimatedCostCents,:latencyMs,:providerRequestId,:errorCode)`, normalized
  );
  return normalized;
}

async function getStoredProvider(key) {
  if (!hasDatabaseConfig()) return demoConfigs.get(key);
  return (await query(`select provider_key as providerKey,status,api_key_encrypted as apiKeyEncrypted,base_url as baseUrl,default_model as defaultModel,timeout_ms as timeoutMs,last_health_status as lastHealthStatus,last_health_message as lastHealthMessage,last_checked_at as lastCheckedAt from ai_provider_configs where provider_key=:key limit 1`, { key }))[0];
}

async function getRuntimeProvider(key) {
  const definition = getProviderDefinition(key);
  const stored = await getStoredProvider(key);
  if (!stored?.apiKeyEncrypted) throw httpError('AI provider key is unavailable', 503, 'AI_PROVIDER_KEY_UNAVAILABLE');
  let apiKey;
  try { apiKey = decryptSecret(stored.apiKeyEncrypted); } catch { throw httpError('AI provider key could not be decrypted', 503, 'AI_PROVIDER_KEY_UNAVAILABLE'); }
  return {
    ...definition,
    apiKey,
    baseUrl: stored.baseUrl || definition.defaultBaseUrl,
    defaultModel: stored.defaultModel || definition.suggestedModel,
    timeoutMs: Number(stored.timeoutMs || 30000)
  };
}

async function listMonthlyAiUsage(businessId) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  if (!hasDatabaseConfig()) return demoUsage.filter((item) => Number(item.businessId) === Number(businessId) && new Date(item.createdAt) >= monthStart);
  const rows = await query(
    `select id, business_id as businessId, provider_key as providerKey, model, workflow_key as workflowKey,
            status, input_tokens as inputTokens, output_tokens as outputTokens,
            estimated_cost_cents as estimatedCostCents, latency_ms as latencyMs,
            provider_request_id as providerRequestId, error_code as errorCode, created_at as createdAt
     from ai_usage_events where business_id=:businessId and created_at >= :monthStart order by created_at desc, id desc`,
    { businessId, monthStart: monthStart.toISOString().slice(0, 19).replace('T', ' ') }
  );
  return rows.map(normalizeUsage);
}

async function updateProviderHealth(providerKey, healthStatus, message, checkedAt, degraded = false) {
  const existing = await getStoredProvider(providerKey);
  if (!existing) return;
  if (!hasDatabaseConfig()) {
    demoConfigs.set(providerKey, { ...existing, status: degraded ? 'degraded' : 'configured', lastHealthStatus: healthStatus, lastHealthMessage: message, lastCheckedAt: checkedAt });
    return;
  }
  await query(
    `update ai_provider_configs set status=:status, last_health_status=:healthStatus,
       last_health_message=:message, last_checked_at=:checkedAt where provider_key=:providerKey`,
    { providerKey, status: degraded ? 'degraded' : 'configured', healthStatus, message, checkedAt }
  );
}

function normalizeProvider(definition, row = {}) {
  let apiKeyMasked = null;
  if (row.apiKeyEncrypted) {
    try { apiKeyMasked = maskSecret(decryptSecret(row.apiKeyEncrypted)); } catch { apiKeyMasked = 'Encrypted key unavailable'; }
  }
  return { ...definition, enabled: ['configured','degraded'].includes(row.status), status: row.status || 'disabled', apiKeyMasked, baseUrl: row.baseUrl || definition.defaultBaseUrl, defaultModel: row.defaultModel || definition.suggestedModel, timeoutMs: Number(row.timeoutMs || 30000), lastHealthStatus: row.lastHealthStatus || 'not_checked', lastHealthMessage: row.lastHealthMessage || null, lastCheckedAt: row.lastCheckedAt || null, updatedAt: row.updatedAt || null };
}

function normalizePolicy(row) {
  const chain = parseJson(row.providerChain, []);
  return { businessId: Number(row.businessId), enabled: Boolean(row.enabled), autonomyMode: normalizeAutonomy(row.autonomyMode), providerChain: Array.isArray(chain) ? chain : [], monthlyBudgetCents: normalizeInteger(row.monthlyBudgetCents || 0, 0, 100000000), monthlyTokenLimit: normalizeInteger(row.monthlyTokenLimit || 0, 0, 1000000000), maxResponseTokens: normalizeInteger(row.maxResponseTokens || 800, 64, 32000), humanHandoffEnabled: row.humanHandoffEnabled === undefined ? true : Boolean(row.humanHandoffEnabled), updatedAt: row.updatedAt || null };
}

function normalizeProviderChain(value) {
  const chain = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(chain.map((item) => String(item).trim().toLowerCase()).filter(Boolean).map((key) => getProviderDefinition(key).key))];
}
function normalizeAutonomy(value) { const v=String(value||'assist').toLowerCase(); if(['assist','draft','auto_reply'].includes(v)) return v; throw httpError('autonomyMode must be assist, draft, or auto_reply',400); }
function normalizeUsage(row) { return { id:Number(row.id||0),businessId:Number(row.businessId),providerKey:row.providerKey,model:row.model||'',workflowKey:row.workflowKey||null,status:row.status||'failed',inputTokens:Number(row.inputTokens||0),outputTokens:Number(row.outputTokens||0),estimatedCostCents:Number(row.estimatedCostCents||0),latencyMs:Number(row.latencyMs||0),providerRequestId:row.providerRequestId||null,errorCode:row.errorCode||null,createdAt:row.createdAt||null }; }
function getProviderDefinition(key) { const d=providerDefinitions.find((item)=>item.key===String(key||'').trim().toLowerCase()); if(d)return d; throw httpError('Unknown AI provider',404); }
function normalizeInteger(value,min,max) { const n=Number(value); if(!Number.isFinite(n)||n<min||n>max) throw httpError(`value must be between ${min} and ${max}`,400); return Math.floor(n); }
function estimateTokens(value) { return Math.max(1,Math.ceil(String(value||'').length/4)); }
function remainingTokenAllowance(policy, tokensUsed) { return policy.monthlyTokenLimit ? Math.max(1, policy.monthlyTokenLimit - tokensUsed) : policy.maxResponseTokens; }
function parseJson(value,fallback) { if(value===null||value===undefined)return fallback;if(typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;} }
function httpError(message,status,code) { const error=new Error(message);error.status=status;if(code)error.code=code;return error; }
async function audit(input,action,targetType,targetId,reason,metadata) { return recordPlatformAuditEvent({platformUser:input.platformUser,action,targetType,targetId,reason,metadata,ipAddress:input.ipAddress,userAgent:input.userAgent}); }

module.exports = { checkAiProviderHealth, getAiOperationsOverview, getBusinessAiPolicy, listAiProviders, listAiUsage, orchestrateAiText, saveAiProviderConfig, saveBusinessAiPolicy };
