const { hasDatabaseConfig, query } = require('../db/pool');

const severities = ['sev1', 'sev2', 'sev3', 'sev4'];
const statuses = ['open', 'monitoring', 'resolved'];
const guardrailKeys = ['campaign_dispatch', 'meta_live_sends', 'ai_auto_replies'];
const providerKeys = ['shopify', 'woocommerce', 'google_drive'];
const demoIncidents = [];
const demoEvents = [];
let nextIncidentId = 1;
let nextEventId = 1;

async function listPlatformIncidents({ status = '', limit = 100 } = {}) {
  const normalizedStatus = status ? normalizeStatus(status) : '';
  if (!hasDatabaseConfig()) {
    return demoIncidents
      .filter((item) => !normalizedStatus || item.status === normalizedStatus)
      .slice(0, normalizeLimit(limit))
      .map((item) => ({ ...item, events: demoEvents.filter((event) => event.incidentId === item.id) }));
  }
  const where = normalizedStatus ? 'where pi.status = :status' : '';
  const rows = await query(
    `select pi.id, pi.title, pi.summary, pi.customer_impact as customerImpact,
            pi.severity, pi.status, pi.linked_guardrail_key as linkedGuardrailKey,
            pi.provider_key as providerKey,
            pi.owner_platform_user_id as ownerPlatformUserId, pu.name as ownerName, pu.email as ownerEmail,
            pi.resolution_note as resolutionNote, pi.started_at as startedAt, pi.resolved_at as resolvedAt,
            pi.created_at as createdAt, pi.updated_at as updatedAt
     from platform_incidents pi
     left join platform_users pu on pu.id = pi.owner_platform_user_id
     ${where}
     order by case pi.status when 'open' then 0 when 'monitoring' then 1 else 2 end,
              case pi.severity when 'sev1' then 0 when 'sev2' then 1 when 'sev3' then 2 else 3 end,
              pi.started_at desc
     limit ${normalizeLimit(limit)}`,
    { status: normalizedStatus }
  );
  const events = await listStoredEvents(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, events: events.filter((event) => Number(event.incidentId) === Number(row.id)) }));
}

async function getPlatformIncident(id) {
  const incidents = await listPlatformIncidents({ limit: 500 });
  const incident = incidents.find((item) => Number(item.id) === Number(id));
  if (!incident) throw httpError('Incident not found', 404);
  return incident;
}

async function createPlatformIncident(input) {
  const title = requiredText(input.title, 'title', 180);
  const summary = requiredText(input.summary, 'summary', 5000);
  const customerImpact = requiredText(input.customerImpact, 'customerImpact', 5000);
  const severity = normalizeSeverity(input.severity);
  const linkedGuardrailKey = normalizeGuardrailKey(input.linkedGuardrailKey);
  const providerKey = normalizeProviderKey(input.providerKey);
  let id;
  if (!hasDatabaseConfig()) {
    id = nextIncidentId++;
    const now = new Date().toISOString();
    demoIncidents.unshift({
      id, title, summary, customerImpact, severity, status: 'open', linkedGuardrailKey, providerKey,
      ownerPlatformUserId: input.platformUser?.id || null, ownerName: input.platformUser?.name || null,
      ownerEmail: input.platformUser?.email || null, resolutionNote: null,
      startedAt: now, resolvedAt: null, createdAt: now, updatedAt: now
    });
  } else {
    const result = await query(
      `insert into platform_incidents
         (title, summary, customer_impact, severity, linked_guardrail_key, provider_key, owner_platform_user_id)
       values (:title, :summary, :customerImpact, :severity, :linkedGuardrailKey, :providerKey, :ownerPlatformUserId)`,
      { title, summary, customerImpact, severity, linkedGuardrailKey, providerKey, ownerPlatformUserId: input.platformUser?.id || null }
    );
    id = result.insertId;
  }
  await createPlatformIncidentEvent({ incidentId: id, eventType: 'created', note: 'Incident opened.', platformUser: input.platformUser, skipAudit: true });
  await audit(input, 'platform.incident.create', id, title, { severity, linkedGuardrailKey, providerKey });
  return getPlatformIncident(id);
}

async function updatePlatformIncident(input) {
  const current = await getPlatformIncident(input.incidentId);
  const severity = normalizeSeverity(input.severity || current.severity);
  const status = normalizeStatus(input.status || current.status);
  const linkedGuardrailKey = input.linkedGuardrailKey === undefined ? current.linkedGuardrailKey : normalizeGuardrailKey(input.linkedGuardrailKey);
  const providerKey = input.providerKey === undefined ? current.providerKey : normalizeProviderKey(input.providerKey);
  const resolutionNote = String(input.resolutionNote || current.resolutionNote || '').trim().slice(0, 5000) || null;
  if (status === 'resolved' && !resolutionNote) throw httpError('resolutionNote is required when resolving an incident', 400);
  if (!hasDatabaseConfig()) {
    const stored = demoIncidents.find((item) => item.id === Number(current.id));
    Object.assign(stored, {
      severity, status, linkedGuardrailKey, providerKey, resolutionNote,
      resolvedAt: status === 'resolved' ? (current.resolvedAt || new Date().toISOString()) : null,
      updatedAt: new Date().toISOString()
    });
  } else {
    await query(
      `update platform_incidents
       set severity = :severity, status = :status, linked_guardrail_key = :linkedGuardrailKey, provider_key = :providerKey,
           resolution_note = :resolutionNote,
           resolved_at = case when :status = 'resolved' then coalesce(resolved_at, current_timestamp) else null end
       where id = :incidentId`,
      { incidentId: current.id, severity, status, linkedGuardrailKey, providerKey, resolutionNote }
    );
  }
  if (status !== current.status) {
    await createPlatformIncidentEvent({
      incidentId: current.id, eventType: 'status_change',
      note: `Status changed from ${current.status} to ${status}.`, platformUser: input.platformUser,
      metadata: { from: current.status, to: status }, skipAudit: true
    });
  }
  await audit(input, 'platform.incident.update', current.id, resolutionNote, { severity, status, linkedGuardrailKey, providerKey });
  return getPlatformIncident(current.id);
}

async function createPlatformIncidentEvent(input) {
  await assertIncidentExists(input.incidentId);
  const note = requiredText(input.note, 'note', 5000);
  const eventType = String(input.eventType || 'note').trim().toLowerCase().slice(0, 80) || 'note';
  const metadata = input.metadata || {};
  let event;
  if (!hasDatabaseConfig()) {
    event = {
      id: nextEventId++, incidentId: Number(input.incidentId), platformUserId: input.platformUser?.id || null,
      platformUserEmail: input.platformUser?.email || null, eventType, note, metadata, createdAt: new Date().toISOString()
    };
    demoEvents.unshift(event);
  } else {
    const result = await query(
      `insert into platform_incident_events (incident_id, platform_user_id, event_type, note, metadata)
       values (:incidentId, :platformUserId, :eventType, :note, :metadata)`,
      { incidentId: input.incidentId, platformUserId: input.platformUser?.id || null, eventType, note, metadata: JSON.stringify(metadata) }
    );
    event = { id: result.insertId, incidentId: Number(input.incidentId), platformUserId: input.platformUser?.id || null, platformUserEmail: input.platformUser?.email || null, eventType, note, metadata, createdAt: new Date().toISOString() };
  }
  if (!input.skipAudit) await audit(input, 'platform.incident.event.create', input.incidentId, eventType, { eventId: event.id });
  return event;
}

async function assertIncidentExists(id) {
  if (!hasDatabaseConfig()) {
    if (!demoIncidents.some((item) => item.id === Number(id))) throw httpError('Incident not found', 404);
    return;
  }
  const rows = await query('select id from platform_incidents where id = :id limit 1', { id });
  if (!rows[0]) throw httpError('Incident not found', 404);
}

async function listStoredEvents(incidentIds) {
  const ids = incidentIds.map(Number).filter(Number.isFinite);
  if (!ids.length) return [];
  const rows = await query(
    `select pie.id, pie.incident_id as incidentId, pie.platform_user_id as platformUserId,
            pu.email as platformUserEmail, pie.event_type as eventType, pie.note, pie.metadata,
            pie.created_at as createdAt
     from platform_incident_events pie
     left join platform_users pu on pu.id = pie.platform_user_id
     where pie.incident_id in (${ids.join(',')})
     order by pie.created_at desc, pie.id desc`
  );
  return rows.map((row) => ({ ...row, metadata: parseJson(row.metadata) }));
}

async function audit(input, action, targetId, reason, metadata) {
  const { recordPlatformAuditEvent } = require('./platform');
  return recordPlatformAuditEvent({
    platformUser: input.platformUser, action, targetType: 'platform_incident', targetId, reason, metadata,
    ipAddress: input.ipAddress, userAgent: input.userAgent
  });
}

function normalizeSeverity(value) {
  const normalized = String(value || 'sev3').trim().toLowerCase();
  if (severities.includes(normalized)) return normalized;
  throw httpError('severity must be sev1, sev2, sev3, or sev4', 400);
}

function normalizeStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (statuses.includes(normalized)) return normalized;
  throw httpError('status must be open, monitoring, or resolved', 400);
}

function normalizeGuardrailKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (guardrailKeys.includes(normalized)) return normalized;
  throw httpError('Unknown platform guardrail', 400);
}

function normalizeProviderKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (providerKeys.includes(normalized)) return normalized;
  throw httpError('Unknown connector provider', 400);
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) throw httpError(`${field} is required`, 400);
  return normalized.slice(0, maxLength);
}

function normalizeLimit(value) {
  const parsed = Number(value || 100);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 500) : 100;
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  createPlatformIncident,
  createPlatformIncidentEvent,
  getPlatformIncident,
  listPlatformIncidents,
  updatePlatformIncident
};
