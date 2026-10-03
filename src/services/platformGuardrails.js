const { hasDatabaseConfig, query } = require('../db/pool');

const guardrailDefinitions = [
  {
    key: 'campaign_dispatch',
    label: 'Campaign dispatch',
    description: 'Stops broadcast campaign jobs from sending queued recipients.'
  },
  {
    key: 'meta_live_sends',
    label: 'Meta outbound sends',
    description: 'Stops WhatsApp outbound messages across campaigns, inbox replies, automations, and commerce.'
  },
  {
    key: 'ai_auto_replies',
    label: 'AI and bot auto-replies',
    description: 'Stops automated chatbot replies while leaving human inbox access available.'
  }
];

const demoGuardrails = new Map(guardrailDefinitions.map((definition) => [
  definition.key,
  {
    key: definition.key,
    enabled: false,
    reason: defaultReason(definition.key),
    updatedByPlatformUserId: 1,
    updatedAt: null
  }
]));

async function listPlatformGuardrails() {
  const stored = hasDatabaseConfig() ? await listStoredGuardrails() : [...demoGuardrails.values()];
  const byKey = new Map(stored.map((guardrail) => [guardrail.key, guardrail]));
  return guardrailDefinitions.map((definition) => normalizeGuardrail({
    ...definition,
    ...(byKey.get(definition.key) || {})
  }));
}

async function getPlatformGuardrail(key) {
  const normalizedKey = normalizeGuardrailKey(key);
  const guardrails = await listPlatformGuardrails();
  return guardrails.find((guardrail) => guardrail.key === normalizedKey);
}

async function updatePlatformGuardrail({ key, enabled, reason, platformUser, ipAddress = '', userAgent = '' }) {
  const normalizedKey = normalizeGuardrailKey(key);
  const normalizedEnabled = Boolean(enabled);
  const normalizedReason = String(reason || '').trim();
  if (normalizedEnabled && !normalizedReason) {
    const error = new Error('reason is required when enabling a platform guardrail');
    error.status = 400;
    throw error;
  }

  const stored = {
    key: normalizedKey,
    enabled: normalizedEnabled,
    reason: normalizedReason || defaultReason(normalizedKey),
    updatedByPlatformUserId: platformUser?.id || null,
    updatedAt: new Date().toISOString()
  };

  if (!hasDatabaseConfig()) {
    demoGuardrails.set(normalizedKey, stored);
  } else {
    await query(
      `insert into platform_guardrails
         (guardrail_key, enabled, reason, updated_by_platform_user_id)
       values
         (:key, :enabled, :reason, :platformUserId)
       on duplicate key update
         enabled = values(enabled),
         reason = values(reason),
         updated_by_platform_user_id = values(updated_by_platform_user_id)`,
      {
        key: normalizedKey,
        enabled: normalizedEnabled ? 1 : 0,
        reason: stored.reason,
        platformUserId: platformUser?.id || null
      }
    );
  }

  const { recordPlatformAuditEvent } = require('./platform');
  await recordPlatformAuditEvent({
    platformUser,
    action: 'platform.guardrail.update',
    targetType: 'platform_guardrail',
    targetId: normalizedKey,
    reason: stored.reason,
    metadata: { enabled: normalizedEnabled },
    ipAddress,
    userAgent
  });

  return getPlatformGuardrail(normalizedKey);
}

async function assertPlatformGuardrailAllows(key) {
  const guardrail = await getPlatformGuardrail(key);
  if (guardrail?.enabled) {
    const error = new Error(`${guardrail.label} is paused by Platform Owner. ${guardrail.reason || ''}`.trim());
    error.status = 423;
    error.code = 'PLATFORM_GUARDRAIL_ENABLED';
    error.guardrail = guardrail;
    throw error;
  }
  return true;
}

async function listStoredGuardrails() {
  const rows = await query(
    `select guardrail_key as guardrailKey, enabled, reason,
            updated_by_platform_user_id as updatedByPlatformUserId,
            updated_at as updatedAt
     from platform_guardrails`
  );
  return rows.map(normalizeGuardrail);
}

function normalizeGuardrail(row) {
  const key = row.key || row.guardrailKey;
  const definition = guardrailDefinitions.find((item) => item.key === key) || {};
  return {
    key,
    label: row.label || definition.label || key,
    description: row.description || definition.description || '',
    enabled: Boolean(row.enabled),
    reason: row.reason || defaultReason(key),
    updatedByPlatformUserId: row.updatedByPlatformUserId || null,
    updatedAt: row.updatedAt || null
  };
}

function normalizeGuardrailKey(key) {
  const normalized = String(key || '').trim().toLowerCase();
  if (guardrailDefinitions.some((definition) => definition.key === normalized)) return normalized;
  const error = new Error('Unknown platform guardrail');
  error.status = 404;
  throw error;
}

function defaultReason(key) {
  if (key === 'campaign_dispatch') return 'Campaign dispatch is available.';
  if (key === 'meta_live_sends') return 'Meta outbound sends are available.';
  if (key === 'ai_auto_replies') return 'AI and bot auto-replies are available.';
  return 'Guardrail is available.';
}

module.exports = {
  assertPlatformGuardrailAllows,
  getPlatformGuardrail,
  listPlatformGuardrails,
  updatePlatformGuardrail
};
