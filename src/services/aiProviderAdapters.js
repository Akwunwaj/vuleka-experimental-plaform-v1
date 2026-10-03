const DEFAULT_TIMEOUT_MS = 30000;

async function callAiProvider(provider, input = {}) {
  const prompt = normalizeRequiredText(input.prompt, 'prompt', 100000);
  const systemPrompt = normalizeOptionalText(input.systemPrompt, 20000);
  const maxOutputTokens = normalizeInteger(input.maxOutputTokens || 800, 1, 32000);
  const fetchImpl = input.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw providerError('Fetch is unavailable', 'AI_FETCH_UNAVAILABLE', 503, true);
  const request = buildProviderRequest(provider, { prompt, systemPrompt, maxOutputTokens });
  const controller = new AbortController();
  const timeoutMs = normalizeInteger(provider.timeoutMs || DEFAULT_TIMEOUT_MS, 1000, 120000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: controller.signal
    });
    const payload = await readJson(response);
    const providerRequestId = response.headers?.get?.('x-request-id') || response.headers?.get?.('request-id') || payload?.id || null;
    if (!response.ok) throw responseError(provider.key, response.status, payload, providerRequestId);
    const normalized = normalizeProviderResponse(provider, payload);
    if (!normalized.text) throw providerError(`${provider.label} returned no text`, 'AI_PROVIDER_EMPTY_RESPONSE', 502, true, providerRequestId);
    return { ...normalized, providerRequestId, latencyMs: Date.now() - startedAt };
  } catch (error) {
    if (error?.name === 'AbortError') throw providerError(`${provider.label} timed out`, 'AI_PROVIDER_TIMEOUT', 504, true);
    if (error?.isAiProviderError) throw error;
    throw providerError(`${provider.label} could not be reached`, 'AI_PROVIDER_CONNECTION_ERROR', 503, true, null, error);
  } finally {
    clearTimeout(timer);
  }
}

function buildProviderRequest(provider, input) {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  const apiKey = normalizeRequiredText(provider.apiKey, 'apiKey', 10000);
  const model = normalizeRequiredText(provider.defaultModel, 'defaultModel', 500);
  if (provider.protocol === 'openai_responses') {
    return {
      url: appendPath(baseUrl, 'responses'),
      headers: jsonHeaders({ Authorization: `Bearer ${apiKey}` }),
      body: compact({ model, instructions: input.systemPrompt, input: input.prompt, max_output_tokens: input.maxOutputTokens, store: false })
    };
  }
  if (provider.protocol === 'anthropic_messages') {
    return {
      url: appendPath(baseUrl, 'messages'),
      headers: jsonHeaders({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
      body: compact({ model, max_tokens: input.maxOutputTokens, system: input.systemPrompt, messages: [{ role: 'user', content: input.prompt }] })
    };
  }
  if (provider.protocol === 'google_generate_content') {
    const modelId = model.replace(/^models\//, '');
    const contents = [{ role: 'user', parts: [{ text: input.prompt }] }];
    return {
      url: appendPath(baseUrl, `models/${encodeURIComponent(modelId)}:generateContent`),
      headers: jsonHeaders({ 'x-goog-api-key': apiKey }),
      body: compact({
        systemInstruction: input.systemPrompt ? { parts: [{ text: input.systemPrompt }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: input.maxOutputTokens }
      })
    };
  }
  if (provider.protocol === 'openai_compatible') {
    const messages = input.systemPrompt ? [{ role: 'system', content: input.systemPrompt }] : [];
    messages.push({ role: 'user', content: input.prompt });
    return {
      url: appendPath(baseUrl, 'chat/completions'),
      headers: jsonHeaders({ Authorization: `Bearer ${apiKey}` }),
      body: { model, messages, max_tokens: input.maxOutputTokens, stream: false }
    };
  }
  throw providerError('Unsupported AI provider protocol', 'AI_PROVIDER_PROTOCOL_UNSUPPORTED', 500, false);
}

function normalizeProviderResponse(provider, payload) {
  if (provider.protocol === 'openai_responses') {
    const outputText = payload?.output_text || (payload?.output || []).flatMap((item) => item?.content || []).filter((item) => item?.type === 'output_text').map((item) => item.text || '').join('\n');
    return { text: String(outputText || '').trim(), inputTokens: number(payload?.usage?.input_tokens), outputTokens: number(payload?.usage?.output_tokens) };
  }
  if (provider.protocol === 'anthropic_messages') {
    return { text: (payload?.content || []).filter((item) => item?.type === 'text').map((item) => item.text || '').join('\n').trim(), inputTokens: number(payload?.usage?.input_tokens), outputTokens: number(payload?.usage?.output_tokens) };
  }
  if (provider.protocol === 'google_generate_content') {
    const parts = payload?.candidates?.[0]?.content?.parts || [];
    return { text: parts.map((item) => item?.text || '').join('\n').trim(), inputTokens: number(payload?.usageMetadata?.promptTokenCount), outputTokens: number(payload?.usageMetadata?.candidatesTokenCount) };
  }
  const choice = payload?.choices?.[0];
  return { text: String(choice?.message?.content || choice?.text || '').trim(), inputTokens: number(payload?.usage?.prompt_tokens), outputTokens: number(payload?.usage?.completion_tokens) };
}

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

function responseError(providerKey, status, payload, providerRequestId) {
  const rawCode = payload?.error?.type || payload?.error?.code || payload?.code || `http_${status}`;
  const code = `AI_${String(providerKey || 'provider').toUpperCase()}_${String(rawCode).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`.slice(0, 100);
  const retryable = status === 408 || status === 409 || status === 429 || status >= 500;
  return providerError(`AI provider request failed with HTTP ${status}`, code, status >= 500 ? 502 : status, retryable, providerRequestId);
}

function providerError(message, code, status, retryable, providerRequestId = null, cause = null) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  error.status = status;
  error.retryable = Boolean(retryable);
  error.providerRequestId = providerRequestId;
  error.isAiProviderError = true;
  return error;
}

function appendPath(baseUrl, path) { return `${baseUrl}/${String(path).replace(/^\/+/, '')}`; }
function normalizeBaseUrl(value) {
  const baseUrl = normalizeRequiredText(value, 'baseUrl', 2000).replace(/\/+$/, '');
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw providerError('Provider base URL is invalid', 'AI_PROVIDER_BASE_URL_INVALID', 400, false); }
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) throw providerError('Provider base URL must use HTTPS', 'AI_PROVIDER_BASE_URL_INVALID', 400, false);
  return baseUrl;
}
function normalizeRequiredText(value, field, maxLength) {
  const text = String(value || '').trim();
  if (!text) throw providerError(`${field} is required`, `AI_${field.toUpperCase()}_REQUIRED`, 400, false);
  if (text.length > maxLength) throw providerError(`${field} is too long`, `AI_${field.toUpperCase()}_TOO_LONG`, 400, false);
  return text;
}
function normalizeOptionalText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length > maxLength) throw providerError('systemPrompt is too long', 'AI_SYSTEM_PROMPT_TOO_LONG', 400, false);
  return text || undefined;
}
function normalizeInteger(value, min, max) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) throw providerError(`value must be between ${min} and ${max}`, 'AI_VALUE_OUT_OF_RANGE', 400, false);
  return Math.floor(numberValue);
}
function jsonHeaders(extra) { return { Accept: 'application/json', 'Content-Type': 'application/json', ...extra }; }
function compact(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)); }
function number(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

module.exports = { buildProviderRequest, callAiProvider, normalizeProviderResponse };
