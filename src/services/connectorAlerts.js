const { hasDatabaseConfig, query } = require('../db/pool');
const { sendConnectorAlertEmail } = require('./mailer');
const { getKnowledgeConnectorOperations } = require('./knowledgeConnectorOperations');

const severityRank = { info:0, warning:1, critical:2 };
const demoPolicies = new Map();
const demoAlerts = [];
const demoEvents = [];
let nextDemoAlertId = 1;
let nextDemoEventId = 1;

async function getConnectorAlertCenter(businessId) {
  const [policy, alerts] = await Promise.all([getConnectorAlertPolicy(businessId), listConnectorAlerts(businessId)]);
  return { policy, alerts, summary:{
    open:alerts.filter((item) => item.status === 'open').length,
    acknowledged:alerts.filter((item) => item.status === 'acknowledged').length,
    critical:alerts.filter((item) => item.status !== 'resolved' && item.severity === 'critical').length
  } };
}

async function getConnectorAlertPolicy(businessId) {
  const fallback = defaultPolicy(businessId);
  if (!hasDatabaseConfig()) return { ...fallback, ...(demoPolicies.get(Number(businessId)) || {}) };
  const rows = await query(
    `select business_id as businessId,email_enabled as emailEnabled,minimum_email_severity as minimumEmailSeverity,
            notify_roles as notifyRoles,additional_emails as additionalEmails,escalation_minutes as escalationMinutes,
            updated_by_user_id as updatedByUserId,updated_at as updatedAt
     from knowledge_connector_alert_policies where business_id=:businessId limit 1`, { businessId }
  );
  return rows[0] ? normalizePolicy(rows[0]) : fallback;
}

async function updateConnectorAlertPolicy(input) {
  const policy = {
    businessId:Number(input.businessId), emailEnabled:input.emailEnabled === true || String(input.emailEnabled).toLowerCase() === 'true',
    minimumEmailSeverity:normalizeSeverity(input.minimumEmailSeverity || 'warning'), notifyRoles:normalizeRoles(input.notifyRoles),
    additionalEmails:normalizeEmails(input.additionalEmails), escalationMinutes:normalizeEscalation(input.escalationMinutes),
    updatedByUserId:input.actorUser?.id || null, updatedAt:new Date().toISOString()
  };
  if (!hasDatabaseConfig()) demoPolicies.set(policy.businessId, policy);
  else await query(
    `insert into knowledge_connector_alert_policies
       (business_id,email_enabled,minimum_email_severity,notify_roles,additional_emails,escalation_minutes,updated_by_user_id)
     values (:businessId,:emailEnabled,:minimumEmailSeverity,:notifyRoles,:additionalEmails,:escalationMinutes,:updatedByUserId)
     on duplicate key update email_enabled=values(email_enabled),minimum_email_severity=values(minimum_email_severity),
       notify_roles=values(notify_roles),additional_emails=values(additional_emails),
       escalation_minutes=values(escalation_minutes),updated_by_user_id=values(updated_by_user_id)`,
    { ...policy, emailEnabled:policy.emailEnabled ? 1 : 0, notifyRoles:JSON.stringify(policy.notifyRoles), additionalEmails:JSON.stringify(policy.additionalEmails) }
  );
  return policy;
}

async function listConnectorAlerts(businessId, { includeResolved = true, limit = 100 } = {}) {
  if (!hasDatabaseConfig()) {
    return demoAlerts.filter((item) => item.businessId === Number(businessId) && (includeResolved || item.status !== 'resolved')).slice(-limit).reverse()
      .map((item) => ({ ...item, events:demoEvents.filter((event) => event.alertId === item.id).slice(-20).reverse() }));
  }
  const where = includeResolved ? '' : "and status<>'resolved'";
  const alerts = await query(
    `select id,business_id as businessId,source_id as sourceId,alert_key as alertKey,severity,status,title,detail,
            first_detected_at as firstDetectedAt,last_detected_at as lastDetectedAt,
            acknowledged_by_user_id as acknowledgedByUserId,acknowledged_at as acknowledgedAt,
            resolved_at as resolvedAt,escalation_at as escalationAt,escalated_at as escalatedAt,
            last_notified_at as lastNotifiedAt,notification_count as notificationCount
     from knowledge_connector_alerts where business_id=:businessId ${where}
     order by case status when 'open' then 0 when 'acknowledged' then 1 else 2 end,
       case severity when 'critical' then 0 when 'warning' then 1 else 2 end,last_detected_at desc limit ${normalizeLimit(limit)}`, { businessId }
  );
  const events = await listAlertEvents(alerts.map((item) => item.id));
  return alerts.map((item) => ({ ...item, events:events.filter((event) => Number(event.alertId) === Number(item.id)) }));
}

async function evaluateConnectorAlerts(input, dependencies = {}) {
  const operations = await getKnowledgeConnectorOperations(input.businessId);
  const source = operations.sources.find((item) => Number(item.id) === Number(input.sourceId));
  const desired = source ? operations.alerts.filter((item) => Number(item.sourceId) === Number(source.id)) : [];
  const existing = (await listConnectorAlerts(input.businessId, { includeResolved:true, limit:500 })).filter((item) => Number(item.sourceId) === Number(input.sourceId));
  const activeKeys = new Set(desired.map((item) => item.alertKey));
  const policy = await getConnectorAlertPolicy(input.businessId);
  const touched = [];
  for (const signal of desired) {
    const current = existing.find((item) => item.alertKey === signal.alertKey);
    const result = await upsertAlert({ ...signal, businessId:Number(input.businessId), sourceId:Number(input.sourceId), current, policy });
    touched.push(result.alert);
    if (result.opened) await notifyAlert(result.alert, policy, false, dependencies);
  }
  for (const alert of existing.filter((item) => item.status !== 'resolved' && !activeKeys.has(item.alertKey))) await resolveAlert(alert, 'Connector returned within its operating threshold.');
  const active = (await listConnectorAlerts(input.businessId, { includeResolved:false, limit:500 })).filter((item) => Number(item.sourceId) === Number(input.sourceId));
  for (const alert of active) {
    if (alert.status === 'open' && !alert.escalatedAt && alert.escalationAt && new Date(alert.escalationAt).getTime() <= Date.now()) {
      await markEscalated(alert);
      await notifyAlert({ ...alert, escalatedAt:new Date().toISOString() }, policy, true, dependencies);
    }
  }
  await scheduleNextEvaluation(source, active, dependencies);
  return { evaluated:true, sourceId:Number(input.sourceId), alerts:touched };
}

async function acknowledgeConnectorAlert(input) {
  const alert = await findAlert(input.businessId, input.alertId);
  if (alert.status === 'resolved') throw httpError('Resolved alerts cannot be acknowledged', 409);
  const now = new Date();
  if (!hasDatabaseConfig()) Object.assign(alert, { status:'acknowledged', acknowledgedByUserId:input.actorUser?.id || null, acknowledgedAt:now.toISOString() });
  else await query(
    `update knowledge_connector_alerts set status='acknowledged',acknowledged_by_user_id=:userId,acknowledged_at=:now
     where id=:id and business_id=:businessId and status<>'resolved'`,
    { id:alert.id, businessId:input.businessId, userId:input.actorUser?.id || null, now }
  );
  await addEvent(alert.id, 'acknowledged', { detail:'Alert acknowledged by workspace user.', actorUserId:input.actorUser?.id || null });
  return findAlert(input.businessId, input.alertId);
}

async function queueConnectorAlertEvaluation(input, runAt = new Date()) {
  const { enqueueJob } = require('./jobQueue');
  const scheduled = runAt instanceof Date ? runAt : new Date(runAt);
  return enqueueJob({ type:'knowledge.connector.alert.evaluate', payload:{ businessId:Number(input.businessId), sourceId:Number(input.sourceId) },
    runAt:scheduled, maxAttempts:3, dedupeKey:`knowledge.connector.alert.evaluate:${Number(input.businessId)}:${Number(input.sourceId)}:${scheduled.toISOString()}` });
}

async function upsertAlert({ businessId, sourceId, alertKey, severity, title, detail, current, policy }) {
  const now = new Date();
  const escalationAt = new Date(now.getTime() + policy.escalationMinutes * 60_000);
  const opened = !current || current.status === 'resolved';
  if (!hasDatabaseConfig()) {
    if (current) current = demoAlerts.find((item) => item.id === Number(current.id)) || current;
    if (!current) {
      current = { id:nextDemoAlertId++, businessId, sourceId, alertKey, severity, status:'open', title, detail, firstDetectedAt:now.toISOString(), lastDetectedAt:now.toISOString(), acknowledgedByUserId:null, acknowledgedAt:null, resolvedAt:null, escalationAt:escalationAt.toISOString(), escalatedAt:null, lastNotifiedAt:null, notificationCount:0 };
      demoAlerts.push(current);
    } else Object.assign(current, { severity, title, detail, status:opened ? 'open' : current.status, firstDetectedAt:opened ? now.toISOString() : current.firstDetectedAt, lastDetectedAt:now.toISOString(), acknowledgedByUserId:opened ? null : current.acknowledgedByUserId, acknowledgedAt:opened ? null : current.acknowledgedAt, resolvedAt:null, escalationAt:opened ? escalationAt.toISOString() : current.escalationAt, escalatedAt:opened ? null : current.escalatedAt });
  } else if (!current) {
    const result = await query(
      `insert into knowledge_connector_alerts
         (business_id,source_id,alert_key,severity,status,title,detail,first_detected_at,last_detected_at,escalation_at)
       values (:businessId,:sourceId,:alertKey,:severity,'open',:title,:detail,:now,:now,:escalationAt)`,
      { businessId, sourceId, alertKey, severity, title, detail, now, escalationAt }
    );
    current = await findAlert(businessId, result.insertId);
  } else {
    await query(
      `update knowledge_connector_alerts set severity=:severity,title=:title,detail=:detail,last_detected_at=:now,
         first_detected_at=case when status='resolved' then :now else first_detected_at end,
         acknowledged_by_user_id=case when status='resolved' then null else acknowledged_by_user_id end,
         acknowledged_at=case when status='resolved' then null else acknowledged_at end,resolved_at=null,
         escalation_at=case when status='resolved' then :escalationAt else escalation_at end,
         escalated_at=case when status='resolved' then null else escalated_at end,
         status=case when status='resolved' then 'open' else status end
       where id=:id and business_id=:businessId`,
      { id:current.id, businessId, severity, title, detail, now, escalationAt }
    );
    current = await findAlert(businessId, current.id);
  }
  await addEvent(current.id, opened ? 'opened' : 'updated', { detail });
  return { alert:current, opened };
}

async function notifyAlert(alert, policy, escalated, dependencies) {
  if (!policy.emailEnabled || severityRank[alert.severity] < severityRank[policy.minimumEmailSeverity]) return;
  const recipients = await resolveRecipients(alert.businessId, policy, dependencies);
  if (!recipients.length) return addEvent(alert.id, 'delivery_failed', { channel:'email', detail:'No active alert recipients are configured.' });
  const sender = dependencies.sendEmail || sendConnectorAlertEmail;
  for (const recipient of recipients) {
    try {
      await sender({ to:recipient, alert, escalated });
      await addEvent(alert.id, escalated ? 'escalated' : 'notified', { channel:'email', recipient, detail:escalated ? 'Escalation email sent.' : 'Alert email sent.' });
      await markNotified(alert.id);
    } catch (error) { await addEvent(alert.id, 'delivery_failed', { channel:'email', recipient, detail:String(error.message || error).slice(0,1000) }); }
  }
}

async function resolveRecipients(businessId, policy, dependencies) {
  if (dependencies.resolveRecipients) return normalizeEmails(await dependencies.resolveRecipients(businessId, policy));
  let roleEmails = [];
  if (hasDatabaseConfig() && policy.notifyRoles.length) {
    const placeholders = policy.notifyRoles.map((_, index) => `:role${index}`);
    const params = Object.fromEntries(policy.notifyRoles.map((role, index) => [`role${index}`, role]));
    const rows = await query(
      `select distinct u.email from users u join business_memberships bm on bm.user_id=u.id
       where bm.business_id=:businessId and bm.role in (${placeholders.join(',')}) and u.status='active'`, { businessId, ...params }
    );
    roleEmails = rows.map((row) => row.email);
  } else roleEmails = normalizeEmails(process.env.CONNECTOR_ALERT_EMAILS || process.env.DEMO_ADMIN_EMAIL || 'admin@chatclan.co.za');
  return [...new Set([...roleEmails, ...policy.additionalEmails])];
}

async function scheduleNextEvaluation(source, alerts, dependencies) {
  if (dependencies.skipSchedule || !source || source.status === 'paused') return;
  const times = [source.slaDueAt, ...alerts.filter((item) => item.status === 'open' && !item.escalatedAt).map((item) => item.escalationAt)]
    .filter(Boolean).map((value) => new Date(value)).filter((value) => value.getTime() > Date.now() + 1000);
  if (!times.length) return;
  await queueConnectorAlertEvaluation({ businessId:source.businessId, sourceId:source.id }, new Date(Math.min(...times.map((value) => value.getTime()))));
}

async function findAlert(businessId, alertId) {
  if (!hasDatabaseConfig()) {
    const alert = demoAlerts.find((item) => item.id === Number(alertId) && item.businessId === Number(businessId));
    if (!alert) throw httpError('Connector alert not found', 404);
    return alert;
  }
  const alert = (await listConnectorAlerts(businessId, { includeResolved:true, limit:500 })).find((item) => Number(item.id) === Number(alertId));
  if (!alert) throw httpError('Connector alert not found', 404);
  return alert;
}

async function resolveAlert(alert, detail) {
  const now = new Date();
  if (!hasDatabaseConfig()) Object.assign(demoAlerts.find((item) => item.id === Number(alert.id)) || alert, { status:'resolved', resolvedAt:now.toISOString() });
  else await query(`update knowledge_connector_alerts set status='resolved',resolved_at=:now where id=:id`, { id:alert.id, now });
  await addEvent(alert.id, 'resolved', { detail });
}
async function markEscalated(alert) { const now=new Date(); if (!hasDatabaseConfig()) (demoAlerts.find((item)=>item.id===Number(alert.id))||alert).escalatedAt=now.toISOString(); else await query('update knowledge_connector_alerts set escalated_at=:now where id=:id',{id:alert.id,now}); }
async function markNotified(alertId) { const now=new Date(); if (!hasDatabaseConfig()) { const alert=demoAlerts.find((item)=>item.id===Number(alertId)); if(alert){alert.lastNotifiedAt=now.toISOString();alert.notificationCount+=1;} } else await query('update knowledge_connector_alerts set last_notified_at=:now,notification_count=notification_count+1 where id=:id',{id:alertId,now}); }

async function addEvent(alertId, eventType, input = {}) {
  if (!hasDatabaseConfig()) { const event={id:nextDemoEventId++,alertId:Number(alertId),eventType,channel:input.channel||null,recipient:input.recipient||null,detail:input.detail||null,actorUserId:input.actorUserId||null,createdAt:new Date().toISOString()};demoEvents.push(event);return event; }
  const result=await query(`insert into knowledge_connector_alert_events (alert_id,event_type,channel,recipient,detail,actor_user_id) values (:alertId,:eventType,:channel,:recipient,:detail,:actorUserId)`,{alertId,eventType,channel:input.channel||null,recipient:input.recipient||null,detail:String(input.detail||'').slice(0,1000)||null,actorUserId:input.actorUserId||null});
  return {id:result.insertId,alertId,eventType,...input};
}
async function listAlertEvents(alertIds) { const ids=alertIds.map(Number).filter(Number.isFinite); if(!ids.length)return []; return query(`select id,alert_id as alertId,event_type as eventType,channel,recipient,detail,actor_user_id as actorUserId,created_at as createdAt from knowledge_connector_alert_events where alert_id in (${ids.join(',')}) order by created_at desc,id desc`); }

function defaultPolicy(businessId) { return {businessId:Number(businessId),emailEnabled:true,minimumEmailSeverity:'warning',notifyRoles:['owner','admin'],additionalEmails:[],escalationMinutes:60,updatedByUserId:null,updatedAt:null}; }
function normalizePolicy(row) { return {...row,emailEnabled:Boolean(row.emailEnabled),notifyRoles:parseJson(row.notifyRoles,['owner','admin']),additionalEmails:parseJson(row.additionalEmails,[]),escalationMinutes:Number(row.escalationMinutes||60)}; }
function normalizeSeverity(value) { const result=String(value||'').toLowerCase(); if(!(result in severityRank))throw httpError('minimumEmailSeverity must be info, warning, or critical',400); return result; }
function normalizeRoles(value) { const values=Array.isArray(value)?value:String(value||'owner,admin').split(','); const roles=[...new Set(values.map((item)=>String(item).trim().toLowerCase()).filter((item)=>['owner','admin'].includes(item)))]; if(!roles.length)throw httpError('Select at least one notification role',400); return roles; }
function normalizeEmails(value) { const values=Array.isArray(value)?value:String(value||'').split(/[\s,;]+/); return [...new Set(values.map((item)=>String(item).trim().toLowerCase()).filter((item)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))].slice(0,20); }
function normalizeEscalation(value) { const minutes=Number(value||60); if(!Number.isInteger(minutes)||minutes<15||minutes>10080)throw httpError('escalationMinutes must be between 15 and 10080',400); return minutes; }
function normalizeLimit(value) { const parsed=Number(value||100); return Number.isFinite(parsed)&&parsed>0?Math.min(Math.floor(parsed),500):100; }
function parseJson(value,fallback){if(value&&typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;}}
function httpError(message,status){const error=new Error(message);error.status=status;return error;}

module.exports={acknowledgeConnectorAlert,evaluateConnectorAlerts,getConnectorAlertCenter,getConnectorAlertPolicy,listConnectorAlerts,queueConnectorAlertEvaluation,updateConnectorAlertPolicy};
