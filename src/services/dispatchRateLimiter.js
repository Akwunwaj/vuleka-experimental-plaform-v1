const { hasDatabaseConfig, query } = require('../db/pool');
const { getMetaCredentials } = require('./metaCredentials');

const demoWindows = new Map();

async function consumeDispatchQuota({ businessId, requested, tenantLimitOverride = null }) {
  const envTenantLimit = limitFromEnv('DISPATCH_TENANT_PER_MINUTE', 120);
  const planTenantLimit = Number(tenantLimitOverride);
  const tenantLimit = Number.isFinite(planTenantLimit) && planTenantLimit > 0 ? Math.min(envTenantLimit, Math.floor(planTenantLimit)) : envTenantLimit;
  const phoneLimit = limitFromEnv('DISPATCH_PHONE_PER_MINUTE', 80);
  const credentials = await getMetaCredentials(businessId);
  const phoneNumberId = credentials?.phoneNumberId || process.env.META_PHONE_NUMBER_ID || 'default';
  const windowStart = currentMinute();
  const tenant = await consumeBucket({
    scope: 'tenant',
    scopeKey: String(businessId),
    limit: tenantLimit,
    requested,
    windowStart
  });
  const phone = await consumeBucket({
    scope: 'phone',
    scopeKey: String(phoneNumberId),
    limit: phoneLimit,
    requested: tenant.allowed,
    windowStart
  });

  if (phone.allowed < tenant.allowed) {
    await refundBucket({
      scope: 'tenant',
      scopeKey: String(businessId),
      amount: tenant.allowed - phone.allowed,
      windowStart
    });
  }

  return {
    allowed: phone.allowed,
    requested,
    limited: phone.allowed < requested,
    windowStart: windowStart.toISOString(),
    limits: {
      tenant: tenantLimit,
      phone: phoneLimit
    },
    remaining: {
      tenant: Math.max(tenant.remaining - Math.max(tenant.allowed - phone.allowed, 0), 0),
      phone: phone.remaining
    },
    phoneNumberId
  };
}

async function consumeBucket({ scope, scopeKey, limit, requested, windowStart }) {
  const amount = Math.max(Number(requested || 0), 0);
  if (!amount) return { allowed: 0, remaining: limit };

  if (!hasDatabaseConfig()) {
    const key = keyFor(scope, scopeKey, windowStart);
    const used = demoWindows.get(key) || 0;
    const allowed = Math.min(amount, Math.max(limit - used, 0));
    demoWindows.set(key, used + allowed);
    return { allowed, remaining: Math.max(limit - used - allowed, 0) };
  }

  const existing = await query(
    `select sent_count as sentCount
     from dispatch_rate_limits
     where scope = :scope and scope_key = :scopeKey and window_start = :windowStart
     limit 1`,
    { scope, scopeKey, windowStart }
  );
  const used = Number(existing?.[0]?.sentCount || 0);
  const allowed = Math.min(amount, Math.max(limit - used, 0));

  await query(
    `insert into dispatch_rate_limits (scope, scope_key, window_start, sent_count)
     values (:scope, :scopeKey, :windowStart, :allowed)
     on duplicate key update sent_count = sent_count + values(sent_count)`,
    { scope, scopeKey, windowStart, allowed }
  );

  return { allowed, remaining: Math.max(limit - used - allowed, 0) };
}

async function refundBucket({ scope, scopeKey, amount, windowStart }) {
  const refund = Math.max(Number(amount || 0), 0);
  if (!refund) return;

  if (!hasDatabaseConfig()) {
    const key = keyFor(scope, scopeKey, windowStart);
    demoWindows.set(key, Math.max((demoWindows.get(key) || 0) - refund, 0));
    return;
  }

  await query(
    `update dispatch_rate_limits
     set sent_count = greatest(sent_count - :refund, 0)
     where scope = :scope and scope_key = :scopeKey and window_start = :windowStart`,
    { scope, scopeKey, windowStart, refund }
  );
}

function currentMinute() {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

function limitFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function keyFor(scope, scopeKey, windowStart) {
  return `${scope}:${scopeKey}:${windowStart.toISOString()}`;
}

function resetDispatchRateLimiterForTests() {
  demoWindows.clear();
}

module.exports = {
  consumeDispatchQuota,
  resetDispatchRateLimiterForTests
};
