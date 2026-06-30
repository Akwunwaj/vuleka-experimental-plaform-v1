#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const REQUIRED = 'required';
const WARNING = 'warning';

const checks = [];

function main() {
  checkNodeVersion();
  checkCoreApp();
  checkDatabase();
  checkMail();
  checkMeta();
  checkPayFast();
  checkWorkerAndQuotas();
  checkCostRates();
  report();
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  pass('Node.js runtime is available', `v${process.versions.node}`);
  if (major >= 20) {
    pass('Node.js version is production-supported', `v${process.versions.node}`);
  } else {
    fail('Node.js version is production-supported', 'Use Node.js 20 or newer.', REQUIRED);
  }
}

function checkCoreApp() {
  requireUrl('APP_URL', { httpsOnly: true });
  requireStrongSecret('SESSION_SECRET', 32);
  requireBase64Bytes('CREDENTIAL_ENCRYPTION_KEY', 32);
  requireValue('SUPPORT_EMAIL');

  const demoPassword = env('DEMO_ADMIN_PASSWORD');
  if (!demoPassword) {
    fail('DEMO_ADMIN_PASSWORD is set', 'Set a unique production bootstrap password.', REQUIRED);
  } else if (demoPassword === 'ChangeMe123!') {
    fail('DEMO_ADMIN_PASSWORD is changed', 'Set DEMO_ADMIN_PASSWORD to a unique production bootstrap password.', REQUIRED);
  } else {
    pass('DEMO_ADMIN_PASSWORD is changed');
  }
}

function checkDatabase() {
  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) requireValue(key);
  requireNumber('DB_PORT', { min: 1, max: 65535 });
}

function checkMail() {
  requireExact('MAIL_MODE', 'smtp');
  requireValue('MAIL_FROM');
  requireValue('SMTP_HOST');
  requireNumber('SMTP_PORT', { min: 1, max: 65535 });
  requireBoolean('SMTP_SECURE');
  requireValue('SMTP_USER');
  requireValue('SMTP_PASSWORD');
}

function checkMeta() {
  requireValue('META_VERIFY_TOKEN');
  requireValue('META_APP_SECRET');
  requireValue('META_WABA_ID');
  requireValue('META_PHONE_NUMBER_ID');
  requireValue('META_ACCESS_TOKEN');
  requireValue('META_GRAPH_VERSION');
  requireExact('META_SEND_MODE', 'live');
  requireExact('META_TEMPLATE_MODE', 'live');
}

function checkPayFast() {
  requireExact('PAYFAST_ENV', 'live');
  requireValue('PAYFAST_MERCHANT_ID');
  requireValue('PAYFAST_MERCHANT_KEY');
  requireValue('PAYFAST_PASSPHRASE');
  requireExact('PAYFAST_CONFIRM_SERVER', 'true');
}

function checkWorkerAndQuotas() {
  requireNumber('WORKER_POLL_INTERVAL_MS', { min: 250 });
  requireNumber('WORKER_BATCH_SIZE', { min: 1 });
  requireNumber('DISPATCH_TENANT_PER_MINUTE', { min: 1 });
  requireNumber('DISPATCH_PHONE_PER_MINUTE', { min: 1 });
  requireNumber('INBOX_FIRST_RESPONSE_SLA_MINUTES', { min: 1 });
}

function checkCostRates() {
  const rateKeys = [
    'META_COST_MARKETING_ZAR_CENTS',
    'META_COST_UTILITY_ZAR_CENTS',
    'META_COST_AUTHENTICATION_ZAR_CENTS',
    'META_COST_AUTHENTICATION_INTERNATIONAL_ZAR_CENTS',
    'META_COST_SERVICE_ZAR_CENTS'
  ];

  requireValue('META_COST_MARKET');

  for (const key of rateKeys) {
    const value = env(key);
    if (value === '') {
      fail(`${key} is configured`, 'Set this from the current Meta rate card before relying on cost reports.', WARNING);
      continue;
    }
    const cents = Number(value);
    if (!Number.isFinite(cents) || cents < 0) {
      fail(`${key} is a non-negative number`, `Current value: ${value}`, REQUIRED);
    } else if (cents === 0) {
      fail(`${key} is confirmed`, 'Zero is allowed only after confirming the current Meta rate card.', WARNING);
    } else {
      pass(`${key} is configured`, `${cents} cents`);
    }
  }
}

function requireValue(key) {
  const value = env(key);
  if (value) pass(`${key} is set`, maskIfSecret(key, value));
  else fail(`${key} is set`, 'Missing required production environment variable.', REQUIRED);
}

function requireExact(key, expected) {
  const value = env(key);
  if (value === expected) pass(`${key} is ${expected}`);
  else fail(`${key} is ${expected}`, `Current value: ${value || '(empty)'}`, REQUIRED);
}

function requireBoolean(key) {
  const value = env(key);
  if (['true', 'false'].includes(value)) pass(`${key} is boolean`, value);
  else fail(`${key} is boolean`, `Current value: ${value || '(empty)'}`, REQUIRED);
}

function requireNumber(key, { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY } = {}) {
  const value = env(key);
  const number = Number(value);
  if (Number.isFinite(number) && number >= min && number <= max) {
    pass(`${key} is valid`, String(number));
  } else {
    fail(`${key} is valid`, `Expected number between ${min} and ${max}; current value: ${value || '(empty)'}`, REQUIRED);
  }
}

function requireUrl(key, { httpsOnly = false } = {}) {
  const value = env(key);
  try {
    const url = new URL(value);
    if (httpsOnly && url.protocol !== 'https:') {
      fail(`${key} uses HTTPS`, `Current value: ${value}`, REQUIRED);
      return;
    }
    pass(`${key} is a valid URL`, value);
  } catch {
    fail(`${key} is a valid URL`, `Current value: ${value || '(empty)'}`, REQUIRED);
  }
}

function requireStrongSecret(key, minimumLength) {
  const value = env(key);
  if (!value) {
    fail(`${key} is set`, 'Missing required production secret.', REQUIRED);
    return;
  }
  if (value.length < minimumLength || value.includes('replace-with')) {
    fail(`${key} is strong`, `Use at least ${minimumLength} random characters.`, REQUIRED);
    return;
  }
  pass(`${key} is strong`, `${value.length} characters`);
}

function requireBase64Bytes(key, expectedBytes) {
  const value = env(key);
  if (!value) {
    fail(`${key} is set`, 'Missing required encryption key.', REQUIRED);
    return;
  }

  const decoded = Buffer.from(value, 'base64');
  const normalized = decoded.toString('base64').replace(/=+$/, '');
  const input = value.replace(/=+$/, '');
  if (decoded.length !== expectedBytes || normalized !== input || value.includes('base64-encoded')) {
    fail(`${key} is a ${expectedBytes}-byte base64 key`, 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"', REQUIRED);
    return;
  }
  pass(`${key} is a ${expectedBytes}-byte base64 key`);
}

function pass(label, detail = '') {
  checks.push({ status: 'pass', label, detail });
}

function fail(label, detail, level) {
  checks.push({ status: 'fail', label, detail, level });
}

function env(key) {
  return String(process.env[key] || '').trim();
}

function maskIfSecret(key, value) {
  if (!/(SECRET|PASSWORD|TOKEN|KEY|PASSPHRASE)/i.test(key)) return value;
  if (value.length <= 8) return '********';
  return `${value.slice(0, 2)}...${value.slice(-2)}`;
}

function report() {
  console.log('ChatClan production preflight\n');

  for (const check of checks) {
    if (check.status === 'pass') {
      console.log(`[pass] ${check.label}${check.detail ? `: ${check.detail}` : ''}`);
    } else {
      const tag = check.level === WARNING ? 'warn' : 'fail';
      console.log(`[${tag}] ${check.label}: ${check.detail}`);
    }
  }

  const failures = checks.filter((check) => check.status === 'fail' && check.level === REQUIRED);
  const warnings = checks.filter((check) => check.status === 'fail' && check.level === WARNING);

  const requiredChecks = checks.filter((check) => check.level !== WARNING);
  const passedRequiredChecks = requiredChecks.filter((check) => check.status === 'pass').length;

  console.log(`\n${passedRequiredChecks}/${requiredChecks.length} required checks passed.`);
  if (warnings.length > 0) console.log(`${warnings.length} warning(s) need operator confirmation.`);
  if (failures.length > 0) {
    console.log(`${failures.length} required check(s) failed.`);
    process.exitCode = 1;
  }
}

main();
