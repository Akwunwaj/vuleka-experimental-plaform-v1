#!/usr/bin/env node

const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_EMAIL = 'admin@chatclan.co.za';
const DEFAULT_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'ChangeMe123!';

const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL);
const email = process.env.SMOKE_EMAIL || DEFAULT_EMAIL;
const password = process.env.SMOKE_PASSWORD || DEFAULT_PASSWORD;
const writeMode = process.env.SMOKE_WRITE === 'true';

const checks = [];

async function main() {
  console.log(`ChatClan beta smoke check: ${baseUrl}`);
  console.log(`Mode: ${writeMode ? 'read/write' : 'read-only'}`);

  await check('health endpoint responds', async () => {
    const response = await request('/health');
    assertStatus(response, 200);
    assert(response.body?.ok === true, '/health did not return ok=true');
  });

  await check('readiness endpoint responds', async () => {
    const response = await request('/ready');
    assertStatus(response, 200);
    assert(response.body?.ok === true, '/ready did not return ok=true');
  });

  await check('dashboard rejects anonymous access', async () => {
    const response = await request('/api/dashboard');
    assertStatus(response, 401);
  });

  let cookie = '';
  await check('demo admin can log in', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    assertStatus(response, 200);
    assert(response.body?.user?.email === email, 'login response did not include the expected user');
    cookie = parseCookie(response.headers);
    assert(cookie, 'login did not return a session cookie');
  });

  const authedReads = [
    ['current session', '/api/auth/me'],
    ['dashboard data', '/api/dashboard'],
    ['setup wizard', '/api/setup/wizard'],
    ['template library', '/api/templates/library'],
    ['workspace templates', '/api/templates'],
    ['chatbot templates', '/api/chatbot/templates'],
    ['workspace flows', '/api/chatbot/flows'],
    ['billing overview', '/api/billing'],
    ['billing plans', '/api/billing/plans'],
    ['analytics overview', '/api/analytics/overview'],
    ['Meta cost report', '/api/analytics/costs'],
    ['inbox conversations', '/api/inbox/conversations'],
    ['consent audit', '/api/consent/events'],
    ['Meta integration status', '/api/integrations/meta'],
    ['deletion request list', '/api/compliance/deletion-requests']
  ];

  for (const [label, path] of authedReads) {
    await check(`${label} is readable`, async () => {
      const response = await request(path, { cookie });
      assertStatus(response, 200);
    });
  }

  if (writeMode) {
    await runWriteChecks(cookie);
  }

  const failed = checks.filter((item) => item.status === 'failed');
  const passed = checks.length - failed.length;
  console.log(`\n${passed}/${checks.length} checks passed.`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function runWriteChecks(cookie) {
  const suffix = Date.now();
  let campaignId = null;

  await check('can create a throwaway contact', async () => {
    const response = await request('/api/contacts', {
      method: 'POST',
      cookie,
      body: {
        name: `Smoke Contact ${suffix}`,
        phone: `+2782${String(suffix).slice(-7).padStart(7, '0')}`,
        segment: 'Smoke QA',
        optedIn: true
      }
    });
    assertStatus(response, 201);
    assert(response.body?.id, 'contact response did not include an id');
  });

  await check('can create a throwaway campaign', async () => {
    const response = await request('/api/campaigns', {
      method: 'POST',
      cookie,
      body: {
        name: `Smoke Campaign ${suffix}`,
        audience: 'Smoke QA',
        category: 'MARKETING',
        body: 'Smoke test message for {{first_name}}',
        scheduleType: 'now'
      }
    });
    assertStatus(response, 201);
    campaignId = response.body?.id;
    assert(campaignId, 'campaign response did not include an id');
  });

  await check('can prepare opted-in campaign recipients', async () => {
    const response = await request(`/api/campaigns/${campaignId}/recipients/prepare`, {
      method: 'POST',
      cookie,
      body: {
        audience: 'Smoke QA',
        body: 'Smoke test message for {{first_name}}'
      }
    });
    assertStatus(response, 200);
    assert(Number(response.body?.eligible) >= 1, 'recipient preparation found no eligible smoke contacts');
  });

  await check('can queue campaign dispatch in mock/live-gated path', async () => {
    const response = await request(`/api/campaigns/${campaignId}/dispatch`, {
      method: 'POST',
      cookie,
      body: { limit: 1 }
    });
    assertStatus(response, 202);
    assert(response.body?.queued === true, 'dispatch response was not queued');
  });
}

async function check(label, fn) {
  try {
    await fn();
    checks.push({ label, status: 'passed' });
    console.log(`[pass] ${label}`);
  } catch (error) {
    checks.push({ label, status: 'failed', error });
    console.error(`[fail] ${label}: ${error.message}`);
  }
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

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, fetchOptions);
  const text = await response.text();
  const body = parseBody(text, response.headers.get('content-type'));
  return { status: response.status, headers: response.headers, body, text };
}

function parseBody(text, contentType) {
  if (!text) return null;
  if (!contentType?.includes('application/json')) return text;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON response: ${error.message}`);
  }
}

function parseCookie(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  return raw.split(';')[0];
}

function assertStatus(response, expectedStatus) {
  assert(
    response.status === expectedStatus,
    `expected HTTP ${expectedStatus}, got HTTP ${response.status}${formatErrorBody(response.body)}`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatErrorBody(body) {
  if (!body) return '';
  if (typeof body === 'string') return `: ${body.slice(0, 200)}`;
  return `: ${JSON.stringify(body).slice(0, 200)}`;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
