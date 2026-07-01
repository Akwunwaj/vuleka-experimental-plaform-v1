#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_EMAIL = 'admin@chatclan.co.za';
const DEFAULT_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'ChangeMe123!';
const { signPayFastData } = require('../src/services/payfast');

const baseUrl = normalizeBaseUrl(process.env.VENDOR_BASE_URL || process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL);
const email = process.env.VENDOR_EMAIL || process.env.SMOKE_EMAIL || DEFAULT_EMAIL;
const password = process.env.VENDOR_PASSWORD || process.env.SMOKE_PASSWORD || DEFAULT_PASSWORD;
const checkList = parseChecks(process.env.VENDOR_CHECKS || 'smtp');
const metaVerifyToken = process.env.VENDOR_META_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || '';
const payFastPlanCode = process.env.VENDOR_PAYFAST_PLAN || 'starter';

async function main() {
  console.log(`ChatClan vendor check: ${baseUrl}`);
  console.log(`Checks: ${checkList.join(', ')}\n`);

  const cookie = await login();

  if (checkList.includes('smtp')) {
    await verifySmtp(cookie);
  }

  if (checkList.includes('meta')) {
    await verifyMeta(cookie);
  }

  if (checkList.includes('payfast')) {
    await verifyPayFast(cookie);
  }

  if (checkList.includes('commerce')) {
    await verifyCommerceAutomation(cookie);
  }

  console.log('\nVendor check passed.');
}

async function login() {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  assertStatus(response, 200, 'login');
  const cookie = parseCookie(response.headers);
  if (!cookie) throw new Error('login did not return a session cookie');
  pass(`authenticated as ${response.body?.user?.email || email}`);
  return cookie;
}

async function verifySmtp(cookie) {
  const response = await request('/api/integrations/email/verify', { cookie });
  assertStatus(response, 200, 'SMTP verification');
  if (response.body?.ok !== true) {
    throw new Error(`SMTP verification did not return ok=true: ${JSON.stringify(response.body)}`);
  }
  pass(`SMTP verification returned ok=true in ${response.body.mode || 'unknown'} mode`);

  if (process.env.VENDOR_REQUIRE_SMTP === 'true' && response.body.mode !== 'smtp') {
    throw new Error(`VENDOR_REQUIRE_SMTP=true but mailer mode is ${response.body.mode || 'unknown'}`);
  }
}

async function verifyMeta(cookie) {
  await verifyMetaWebhookChallenge();

  const response = await request('/api/integrations/meta', { cookie });
  assertStatus(response, 200, 'Meta integration status');
  pass('Meta integration status endpoint is reachable');

  if (process.env.VENDOR_REQUIRE_META_CONNECTED === 'true') {
    if (response.body?.connected !== true) {
      throw new Error('VENDOR_REQUIRE_META_CONNECTED=true but Meta integration is not connected');
    }
    if (!response.body.phoneNumberId || !response.body.accessTokenMasked) {
      throw new Error('Meta integration is connected but missing phone number or access-token metadata');
    }
    pass(`Meta integration is connected for phone number ${response.body.phoneNumberId}`);
  }
}

async function verifyMetaWebhookChallenge() {
  if (!metaVerifyToken) {
    throw new Error('VENDOR_META_VERIFY_TOKEN or META_VERIFY_TOKEN is required for the Meta webhook challenge check');
  }

  const challenge = `chatclan_vendor_check_${Date.now()}`;
  const query = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': metaVerifyToken,
    'hub.challenge': challenge
  });
  const response = await request(`/webhooks/meta?${query}`);
  assertStatus(response, 200, 'Meta webhook challenge');
  if (response.body !== challenge) {
    throw new Error(`Meta webhook challenge returned unexpected body: ${formatBody(response.body)}`);
  }
  pass('Meta webhook challenge returned the expected challenge');
}

async function verifyPayFast(cookie) {
  const checkout = await request('/api/billing/payfast/checkout', {
    method: 'POST',
    cookie,
    body: { planCode: payFastPlanCode }
  });
  assertStatus(checkout, 201, 'PayFast checkout');

  if (checkout.body?.provider !== 'payfast') {
    throw new Error(`PayFast checkout returned unexpected provider: ${checkout.body?.provider || '(missing)'}`);
  }
  if (!checkout.body?.actionUrl || !checkout.body?.fields?.signature || !checkout.body?.fields?.m_payment_id) {
    throw new Error(`PayFast checkout response is missing action URL, signature, or merchant payment id: ${formatBody(checkout.body)}`);
  }
  pass(`PayFast checkout generated in ${checkout.body.mode || 'unknown'} mode`);

  const requiredMode = process.env.VENDOR_REQUIRE_PAYFAST_MODE;
  if (requiredMode && checkout.body.mode !== requiredMode) {
    throw new Error(`VENDOR_REQUIRE_PAYFAST_MODE=${requiredMode} but checkout mode is ${checkout.body.mode || 'unknown'}`);
  }

  if (process.env.VENDOR_PAYFAST_SIMULATE_ITN === 'true') {
    await simulatePayFastItn({ cookie, checkout: checkout.body });
  }
}

async function verifyCommerceAutomation(cookie) {
  const response = await request('/api/commerce/automation-insights', { cookie });
  assertStatus(response, 200, 'commerce automation insights');
  const readiness = response.body?.summary?.templateReadiness || {};
  const total = Number(readiness.total || 0);
  const ready = Number(readiness.ready || 0);
  const blocked = Number(readiness.blocked || 0);
  pass(`commerce automation template readiness ${ready}/${total} approved`);

  if (blocked > 0) {
    const blockedRules = (response.body?.rules || [])
      .filter((rule) => !rule.templateReadiness?.ready)
      .map((rule) => `${rule.ruleKey}:${rule.templateReadiness?.status || 'Missing'}`)
      .join(', ');
    const message = `${blocked} commerce automation rule(s) are not approved-template ready${blockedRules ? `: ${blockedRules}` : ''}`;
    if (process.env.VENDOR_REQUIRE_COMMERCE_AUTOMATION_READY === 'true') {
      throw new Error(`VENDOR_REQUIRE_COMMERCE_AUTOMATION_READY=true but ${message}`);
    }
    warn(message);
  }
}

async function simulatePayFastItn({ cookie, checkout }) {
  const fields = checkout.fields;
  const payload = {
    m_payment_id: fields.m_payment_id,
    pf_payment_id: `pf_vendor_${Date.now()}`,
    payment_status: 'COMPLETE',
    item_name: fields.item_name,
    amount_gross: fields.amount,
    amount_fee: '0.00',
    amount_net: fields.amount,
    custom_int1: fields.custom_int1,
    custom_str1: fields.custom_str1,
    token: `token_vendor_${Date.now()}`
  };
  payload.signature = signPayFastData(payload);

  const response = await request('/webhooks/payfast/itn', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    rawBody: new URLSearchParams(payload).toString()
  });
  assertStatus(response, 200, 'PayFast simulated ITN');
  pass('PayFast simulated ITN was accepted by the webhook');

  await wait(300);
  const billing = await request('/api/billing', { cookie });
  assertStatus(billing, 200, 'billing overview after PayFast ITN');
  const paidInvoice = (billing.body?.invoices || []).find((invoice) => invoice.merchantPaymentId === fields.m_payment_id && invoice.status === 'paid');
  if (!paidInvoice) {
    throw new Error('PayFast simulated ITN did not produce a paid invoice. If PAYFAST_CONFIRM_SERVER=true, use a real PayFast sandbox ITN instead.');
  }
  pass('PayFast simulated ITN produced a paid invoice');
}

async function request(path, options = {}) {
  const headers = {
    accept: 'application/json',
    ...(options.headers || {})
  };

  if (options.cookie) headers.cookie = options.cookie;

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.rawBody !== undefined) {
    fetchOptions.body = options.rawBody;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, fetchOptions);
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body: parseBody(text, response.headers.get('content-type'))
  };
}

function parseBody(text, contentType) {
  if (!text) return null;
  if (!contentType?.includes('application/json')) return text;
  return JSON.parse(text);
}

function parseCookie(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(';')[0];
}

function assertStatus(response, expectedStatus, label) {
  if (response.status !== expectedStatus) {
    throw new Error(`${label} expected HTTP ${expectedStatus}, got HTTP ${response.status}: ${formatBody(response.body)}`);
  }
}

function parseChecks(value) {
  const checks = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const allowed = new Set(['smtp', 'meta', 'payfast', 'commerce']);
  for (const check of checks) {
    if (!allowed.has(check)) throw new Error(`Unsupported vendor check: ${check}`);
  }
  return checks.length ? checks : ['smtp'];
}

function formatBody(body) {
  if (!body) return '';
  if (typeof body === 'string') return body.slice(0, 200);
  return JSON.stringify(body).slice(0, 200);
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function pass(message) {
  console.log(`[pass] ${message}`);
}

function warn(message) {
  console.log(`[warn] ${message}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(`[fail] ${error.message}`);
  process.exitCode = 1;
});
