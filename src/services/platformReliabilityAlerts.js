const { hasDatabaseConfig, query } = require('../db/pool');
const { sendPlatformReliabilityAlertEmail } = require('./mailer');

const severityRank = { info:0, warning:1, critical:2 };
const demoAlerts = [];
const demoEvents = [];
let demoPolicy = null;
let nextAlertId = 1;
let nextEventId = 1;

async function getPlatformReliabilityAlertCenter() {
  const [policy, alerts, platformUsers] = await Promise.all([
    getPlatformReliabilityAlertPolicy(),
    listPlatformReliabilityAlerts({ includeResolved:false }),
    listActivePlatformUsers()
  ]);
  return {
    policy,
    alerts,
    platformUsers,
    summary:{
      open:alerts.filter((alert) => alert.status === 'open').length,
      acknowledged:alerts.filter((alert) => alert.status === 'acknowledged').length,
      critical:alerts.filter((alert) => alert.status !== 'resolved' && alert.severity === 'critical').length,
      escalated:alerts.filter((alert) => alert.status !== 'resolved' && alert.escalatedAt).length
    }
  };
}

async function getPlatformReliabilityAlertPolicy() {
  const fallback = defaultPolicy();
  if (!hasDatabaseConfig()) return { ...fallback, ...(demoPolicy || {}) };
  const rows = await query(
    `select prap.id,prap.email_enabled as emailEnabled,prap.in_app_enabled as inAppEnabled,
            prap.minimum_email_severity as minimumEmailSeverity,prap.notify_roles as notifyRoles,
            prap.additional_emails as additionalEmails,prap.on_call_platform_user_id as onCallPlatformUserId,
            pu.name as onCallName,pu.email as onCallEmail,prap.escalation_minutes as escalationMinutes,
            prap.repeat_minutes as repeatMinutes,prap.updated_by_platform_user_id as updatedByPlatformUserId,
            prap.updated_at as updatedAt
     from platform_reliability_alert_policies prap
     left join platform_users pu on pu.id=prap.on_call_platform_user_id where prap.id=1 limit 1`
  );
  return rows[0] ? normalizePolicy(rows[0]) : fallback;
}

async function updatePlatformReliabilityAlertPolicy(input) {
  const onCallPlatformUserId = input.onCallPlatformUserId ? Number(input.onCallPlatformUserId) : null;
  if (onCallPlatformUserId) await assertActivePlatformUser(onCallPlatformUserId);
  const policy = {
    id:1,
    emailEnabled:toBoolean(input.emailEnabled),
    inAppEnabled:input.inAppEnabled === undefined ? true : toBoolean(input.inAppEnabled),
    minimumEmailSeverity:normalizeSeverity(input.minimumEmailSeverity || 'warning'),
    notifyRoles:normalizeRoles(input.notifyRoles),
    additionalEmails:normalizeEmails(input.additionalEmails),
    onCallPlatformUserId,
    escalationMinutes:normalizeMinutes(input.escalationMinutes, 15, 1440, 'escalationMinutes'),
    repeatMinutes:normalizeMinutes(input.repeatMinutes, 15, 10080, 'repeatMinutes'),
    updatedByPlatformUserId:input.platformUser?.id || null,
    updatedAt:new Date().toISOString()
  };
  if (!hasDatabaseConfig()) demoPolicy = policy;
  else await query(
    `insert into platform_reliability_alert_policies
       (id,email_enabled,in_app_enabled,minimum_email_severity,notify_roles,additional_emails,on_call_platform_user_id,
        escalation_minutes,repeat_minutes,updated_by_platform_user_id)
     values (1,:emailEnabled,:inAppEnabled,:minimumEmailSeverity,:notifyRoles,:additionalEmails,:onCallPlatformUserId,
        :escalationMinutes,:repeatMinutes,:updatedByPlatformUserId)
     on duplicate key update email_enabled=values(email_enabled),in_app_enabled=values(in_app_enabled),
       minimum_email_severity=values(minimum_email_severity),notify_roles=values(notify_roles),
       additional_emails=values(additional_emails),on_call_platform_user_id=values(on_call_platform_user_id),
       escalation_minutes=values(escalation_minutes),repeat_minutes=values(repeat_minutes),
       updated_by_platform_user_id=values(updated_by_platform_user_id)`,
    { ...policy, emailEnabled:policy.emailEnabled?1:0, inAppEnabled:policy.inAppEnabled?1:0,
      notifyRoles:JSON.stringify(policy.notifyRoles), additionalEmails:JSON.stringify(policy.additionalEmails) }
  );
  await audit(input, 'platform.reliability.alert.policy.update', 'policy', policy.minimumEmailSeverity, {
    onCallPlatformUserId, escalationMinutes:policy.escalationMinutes, repeatMinutes:policy.repeatMinutes
  });
  return getPlatformReliabilityAlertPolicy();
}

async function listPlatformReliabilityAlerts({ includeResolved = true, limit = 100 } = {}) {
  if (!hasDatabaseConfig()) return demoAlerts
    .filter((alert) => includeResolved || alert.status !== 'resolved').slice(-normalizeLimit(limit)).reverse()
    .map((alert) => ({ ...alert, events:demoEvents.filter((event) => event.alertId === alert.id).slice(-30).reverse() }));
  const where = includeResolved ? '' : "where pra.status<>'resolved'";
  const alerts = await query(
    `select pra.id,pra.alert_key as alertKey,pra.signal_type as signalType,pra.target_key as targetKey,
            pra.severity,pra.status,pra.title,pra.detail,pra.snapshot,
            pra.owner_platform_user_id as ownerPlatformUserId,owner.name as ownerName,owner.email as ownerEmail,
            pra.acknowledged_by_platform_user_id as acknowledgedByPlatformUserId,
            ack.email as acknowledgedByEmail,pra.acknowledged_at as acknowledgedAt,
            pra.incident_id as incidentId,pi.title as incidentTitle,pra.escalation_at as escalationAt,
            pra.escalated_at as escalatedAt,pra.last_notified_at as lastNotifiedAt,
            pra.notification_count as notificationCount,pra.first_detected_at as firstDetectedAt,
            pra.last_detected_at as lastDetectedAt,pra.resolved_at as resolvedAt
     from platform_reliability_alerts pra
     left join platform_users owner on owner.id=pra.owner_platform_user_id
     left join platform_users ack on ack.id=pra.acknowledged_by_platform_user_id
     left join platform_incidents pi on pi.id=pra.incident_id ${where}
     order by case pra.status when 'open' then 0 when 'acknowledged' then 1 else 2 end,
       case pra.severity when 'critical' then 0 when 'warning' then 1 else 2 end,pra.last_detected_at desc
     limit ${normalizeLimit(limit)}`
  );
  const events = await listEvents(alerts.map((alert) => alert.id));
  return alerts.map((alert) => ({ ...alert, snapshot:parseJson(alert.snapshot,{}), notificationCount:Number(alert.notificationCount||0), events:events.filter((event) => Number(event.alertId) === Number(alert.id)) }));
}

async function evaluatePlatformReliabilityAlerts(input = {}, dependencies = {}) {
  const now = dependencies.now instanceof Date ? dependencies.now : new Date();
  const overview = dependencies.overview || await require('./platformReliability').getPlatformReliabilityOverview({ now });
  const desired = buildPlatformReliabilitySignals(overview);
  const existing = await listPlatformReliabilityAlerts({ includeResolved:true, limit:500 });
  const policy = await getPlatformReliabilityAlertPolicy();
  const activeKeys = new Set(desired.map((signal) => signal.alertKey));
  for (const signal of desired) {
    const current = existing.find((alert) => alert.alertKey === signal.alertKey);
    const result = await upsertAlert(signal, current, policy, now);
    if (result.opened) await notifyAlert(result.alert, policy, false, dependencies);
  }
  for (const alert of existing.filter((item) => item.status !== 'resolved' && !activeKeys.has(item.alertKey))) {
    await resolveAlert(alert, 'Reliability signal returned within its operating threshold.', now);
  }
  const active = await listPlatformReliabilityAlerts({ includeResolved:false, limit:500 });
  for (const alert of active) {
    const escalationDue = alert.escalationAt && new Date(alert.escalationAt).getTime() <= now.getTime();
    const repeatDue = alert.escalatedAt && (!alert.lastNotifiedAt || now.getTime() - new Date(alert.lastNotifiedAt).getTime() >= policy.repeatMinutes*60_000);
    if (alert.status === 'open' && (escalationDue || repeatDue)) {
      await markEscalated(alert, now);
      await notifyAlert({ ...alert, escalatedAt:now.toISOString() }, policy, true, dependencies);
    }
  }
  if (!dependencies.skipSchedule) await queuePlatformReliabilityAlertEvaluation(new Date(now.getTime() + 60_000));
  return { evaluated:true, signals:desired.length, active:(await listPlatformReliabilityAlerts({ includeResolved:false, limit:500 })).length };
}

function buildPlatformReliabilitySignals(overview) {
  const signals = [];
  for (const worker of overview.workers || []) if (worker.health !== 'healthy') signals.push({
    alertKey:`worker:${worker.workerId}:${worker.health}`, signalType:'worker', targetKey:worker.workerId,
    severity:worker.health === 'error' ? 'critical' : 'warning', title:`Worker ${worker.health}: ${worker.workerId}`,
    detail:`${worker.role} has state ${worker.status} and was last seen ${worker.secondsSinceSeen} seconds ago.`, snapshot:worker
  });
  for (const job of overview.stuckJobs || []) signals.push({
    alertKey:`job:stuck:${job.id}`, signalType:'stuck_job', targetKey:String(job.id), severity:'critical',
    title:`Job #${job.id} is stuck`, detail:`${job.type} has remained running beyond the configured threshold.`, snapshot:job
  });
  for (const job of overview.deadLetters || []) signals.push({
    alertKey:`job:dead_letter:${job.id}`, signalType:'dead_letter', targetKey:String(job.id), severity:'warning',
    title:`Job #${job.id} exhausted retries`, detail:`${job.type} failed after ${job.attempts}/${job.maxAttempts} attempts: ${job.lastError || 'No failure detail'}`, snapshot:job
  });
  for (const provider of overview.providers || []) if (provider.incidentCandidate && !provider.activeIncident) signals.push({
    alertKey:`provider:correlated:${provider.key}`, signalType:'provider', targetKey:provider.key, severity:'critical',
    title:`${provider.label} failures span tenants`, detail:`${provider.failedRuns} failed runs affect ${provider.affectedTenants} tenants in the last 24 hours.`, snapshot:provider
  });
  return signals;
}

async function acknowledgePlatformReliabilityAlert(input) {
  const alert = await findAlert(input.alertId);
  if (alert.status === 'resolved') throw httpError('Resolved alerts cannot be acknowledged',409);
  const ownerPlatformUserId = input.ownerPlatformUserId ? Number(input.ownerPlatformUserId) : Number(input.platformUser?.id || 0);
  if (ownerPlatformUserId) await assertActivePlatformUser(ownerPlatformUserId);
  const now = new Date();
  if (!hasDatabaseConfig()) Object.assign(demoAlerts.find((item)=>item.id===alert.id), { status:'acknowledged', ownerPlatformUserId, ownerEmail:input.platformUser?.email || null, acknowledgedByPlatformUserId:input.platformUser?.id || null, acknowledgedByEmail:input.platformUser?.email || null, acknowledgedAt:now.toISOString() });
  else await query(`update platform_reliability_alerts set status='acknowledged',owner_platform_user_id=:ownerPlatformUserId,
                    acknowledged_by_platform_user_id=:actorId,acknowledged_at=:now where id=:id and status<>'resolved'`,
    { id:alert.id, ownerPlatformUserId:ownerPlatformUserId||null, actorId:input.platformUser?.id||null, now });
  await addEvent(alert.id,'acknowledged',{ platformUserId:input.platformUser?.id, detail:'Alert acknowledged and operational ownership accepted.', metadata:{ ownerPlatformUserId } });
  await audit(input,'platform.reliability.alert.acknowledge',alert.id,'Responsibility accepted',{ ownerPlatformUserId });
  return findAlert(alert.id);
}

async function assignPlatformReliabilityAlert(input) {
  const alert = await findAlert(input.alertId);
  const ownerPlatformUserId = Number(input.ownerPlatformUserId);
  await assertActivePlatformUser(ownerPlatformUserId);
  if (!hasDatabaseConfig()) Object.assign(demoAlerts.find((item)=>item.id===alert.id),{ownerPlatformUserId});
  else await query('update platform_reliability_alerts set owner_platform_user_id=:ownerPlatformUserId where id=:id',{id:alert.id,ownerPlatformUserId});
  await addEvent(alert.id,'assigned',{platformUserId:input.platformUser?.id,detail:'Alert owner updated.',metadata:{ownerPlatformUserId}});
  await audit(input,'platform.reliability.alert.assign',alert.id,'Owner updated',{ownerPlatformUserId});
  return findAlert(alert.id);
}

async function linkPlatformReliabilityAlertIncident(input) {
  const alert = await findAlert(input.alertId);
  const incident = await require('./platformIncidents').getPlatformIncident(input.incidentId);
  if (!hasDatabaseConfig()) Object.assign(demoAlerts.find((item)=>item.id===alert.id),{incidentId:incident.id,incidentTitle:incident.title});
  else await query('update platform_reliability_alerts set incident_id=:incidentId where id=:id',{id:alert.id,incidentId:incident.id});
  await addEvent(alert.id,'incident_linked',{platformUserId:input.platformUser?.id,detail:`Linked to incident #${incident.id}: ${incident.title}`,metadata:{incidentId:incident.id}});
  await require('./platformIncidents').createPlatformIncidentEvent({ incidentId:incident.id,eventType:'reliability_alert_linked',note:`Reliability alert #${alert.id} linked: ${alert.title}`,platformUser:input.platformUser,metadata:{alertId:alert.id,signalType:alert.signalType},skipAudit:true });
  await audit(input,'platform.reliability.alert.incident.link',alert.id,incident.title,{incidentId:incident.id});
  return findAlert(alert.id);
}

async function queuePlatformReliabilityAlertEvaluation(runAt = new Date()) {
  const scheduled = runAt instanceof Date ? runAt : new Date(runAt);
  const minute = scheduled.toISOString().slice(0,16);
  return require('./jobQueue').enqueueJob({ type:'platform.reliability.alert.evaluate',payload:{},runAt:scheduled,maxAttempts:3,dedupeKey:`platform.reliability.alert.evaluate:${minute}` });
}

async function upsertAlert(signal,current,policy,now) {
  const opened = !current || current.status === 'resolved';
  const escalationAt = new Date(now.getTime()+policy.escalationMinutes*60_000);
  const ownerId = policy.onCallPlatformUserId || null;
  if (!hasDatabaseConfig()) {
    if (!current) { current={id:nextAlertId++,...signal,status:'open',ownerPlatformUserId:ownerId,acknowledgedByPlatformUserId:null,acknowledgedAt:null,incidentId:null,escalationAt:escalationAt.toISOString(),escalatedAt:null,lastNotifiedAt:null,notificationCount:0,firstDetectedAt:now.toISOString(),lastDetectedAt:now.toISOString(),resolvedAt:null};demoAlerts.push(current); }
    else Object.assign(demoAlerts.find((item)=>item.id===current.id),{...signal,status:opened?'open':current.status,ownerPlatformUserId:opened?ownerId:current.ownerPlatformUserId,acknowledgedByPlatformUserId:opened?null:current.acknowledgedByPlatformUserId,acknowledgedAt:opened?null:current.acknowledgedAt,escalationAt:opened?escalationAt.toISOString():current.escalationAt,escalatedAt:opened?null:current.escalatedAt,lastDetectedAt:now.toISOString(),resolvedAt:null});
  } else await query(
    `insert into platform_reliability_alerts
       (alert_key,signal_type,target_key,severity,status,title,detail,snapshot,owner_platform_user_id,escalation_at,first_detected_at,last_detected_at)
     values (:alertKey,:signalType,:targetKey,:severity,'open',:title,:detail,:snapshot,:ownerId,:escalationAt,:now,:now)
     on duplicate key update signal_type=values(signal_type),target_key=values(target_key),severity=values(severity),title=values(title),detail=values(detail),snapshot=values(snapshot),
       owner_platform_user_id=case when status='resolved' then values(owner_platform_user_id) else owner_platform_user_id end,
       acknowledged_by_platform_user_id=case when status='resolved' then null else acknowledged_by_platform_user_id end,acknowledged_at=case when status='resolved' then null else acknowledged_at end,
       escalation_at=case when status='resolved' then values(escalation_at) else escalation_at end,escalated_at=case when status='resolved' then null else escalated_at end,
       first_detected_at=case when status='resolved' then values(first_detected_at) else first_detected_at end,last_detected_at=values(last_detected_at),resolved_at=null,
       status=case when status='resolved' then 'open' else status end`,
    {...signal,snapshot:JSON.stringify(signal.snapshot||{}),ownerId,escalationAt,now}
  );
  current = await findAlertByKey(signal.alertKey);
  await addEvent(current.id,opened?'opened':'updated',{detail:signal.detail,metadata:{severity:signal.severity}});
  return {alert:current,opened};
}

async function notifyAlert(alert,policy,escalated,dependencies) {
  if (!policy.emailEnabled || severityRank[alert.severity] < severityRank[policy.minimumEmailSeverity]) return;
  const recipients = dependencies.resolveRecipients ? normalizeEmails(await dependencies.resolveRecipients(alert,policy)) : await resolveRecipients(policy);
  if (!recipients.length) return addEvent(alert.id,'delivery_failed',{channel:'email',detail:'No active platform alert recipients are configured.'});
  const sender = dependencies.sendEmail || sendPlatformReliabilityAlertEmail;
  for (const recipient of recipients) try {
    await sender({to:recipient,alert,escalated});
    await addEvent(alert.id,escalated?'escalated':'notified',{channel:'email',recipient,detail:escalated?'Escalation email sent.':'Alert email sent.'});
    await markNotified(alert.id,new Date());
  } catch (error) { await addEvent(alert.id,'delivery_failed',{channel:'email',recipient,detail:String(error.message||error).slice(0,1000)}); }
}

async function resolveRecipients(policy) {
  let emails=[];
  if (hasDatabaseConfig()) {
    const roles=policy.notifyRoles.length?policy.notifyRoles:['owner'];
    const placeholders=roles.map((_,i)=>`:role${i}`);const params=Object.fromEntries(roles.map((role,i)=>[`role${i}`,role]));
    const rows=await query(`select distinct email from platform_users where status='active' and role in (${placeholders.join(',')})`,params);
    emails=rows.map((row)=>row.email);
    if (policy.onCallPlatformUserId) { const onCall=await query("select email from platform_users where id=:id and status='active'",{id:policy.onCallPlatformUserId});emails.push(...onCall.map((row)=>row.email)); }
  } else emails=normalizeEmails(process.env.PLATFORM_ALERT_EMAILS||process.env.PLATFORM_OWNER_EMAIL||'owner@chatclan.co.za');
  return [...new Set([...emails,...policy.additionalEmails])];
}

async function listActivePlatformUsers() {
  if (!hasDatabaseConfig()) return [{id:1,name:'Platform Owner',email:process.env.PLATFORM_OWNER_EMAIL||'owner@chatclan.co.za',role:'owner'}];
  return query("select id,name,email,role from platform_users where status='active' order by case role when 'owner' then 0 else 1 end,name");
}
async function assertActivePlatformUser(id){const users=await listActivePlatformUsers();if(!users.some((user)=>Number(user.id)===Number(id)))throw httpError('Active platform user not found',404);}
async function findAlert(id){const alert=(await listPlatformReliabilityAlerts({includeResolved:true,limit:500})).find((item)=>Number(item.id)===Number(id));if(!alert)throw httpError('Reliability alert not found',404);return alert;}
async function findAlertByKey(key){const alert=(await listPlatformReliabilityAlerts({includeResolved:true,limit:500})).find((item)=>item.alertKey===key);if(!alert)throw httpError('Reliability alert not found',404);return alert;}
async function resolveAlert(alert,detail,now){if(!hasDatabaseConfig())Object.assign(demoAlerts.find((item)=>item.id===alert.id),{status:'resolved',resolvedAt:now.toISOString()});else await query("update platform_reliability_alerts set status='resolved',resolved_at=:now where id=:id",{id:alert.id,now});await addEvent(alert.id,'resolved',{detail});}
async function markEscalated(alert,now){if(!hasDatabaseConfig())demoAlerts.find((item)=>item.id===alert.id).escalatedAt=now.toISOString();else await query('update platform_reliability_alerts set escalated_at=:now where id=:id',{id:alert.id,now});}
async function markNotified(id,now){if(!hasDatabaseConfig()){const alert=demoAlerts.find((item)=>item.id===id);alert.lastNotifiedAt=now.toISOString();alert.notificationCount+=1;}else await query('update platform_reliability_alerts set last_notified_at=:now,notification_count=notification_count+1 where id=:id',{id,now});}
async function addEvent(alertId,eventType,input={}){if(!hasDatabaseConfig()){const event={id:nextEventId++,alertId:Number(alertId),eventType,channel:input.channel||null,recipient:input.recipient||null,detail:input.detail||null,platformUserId:input.platformUserId||null,metadata:input.metadata||{},createdAt:new Date().toISOString()};demoEvents.push(event);return event;}const result=await query(`insert into platform_reliability_alert_events (alert_id,event_type,channel,recipient,detail,platform_user_id,metadata) values (:alertId,:eventType,:channel,:recipient,:detail,:platformUserId,:metadata)`,{alertId,eventType,channel:input.channel||null,recipient:input.recipient||null,detail:String(input.detail||'').slice(0,1000)||null,platformUserId:input.platformUserId||null,metadata:JSON.stringify(input.metadata||{})});return{id:result.insertId,alertId,eventType,...input};}
async function listEvents(ids){if(!ids.length)return[];const rows=await query(`select id,alert_id as alertId,event_type as eventType,channel,recipient,detail,platform_user_id as platformUserId,metadata,created_at as createdAt from platform_reliability_alert_events where alert_id in (${ids.map(Number).join(',')}) order by created_at desc,id desc`);return rows.map((row)=>({...row,metadata:parseJson(row.metadata,{})}));}
async function audit(input,action,targetId,reason,metadata){return require('./platform').recordPlatformAuditEvent({platformUser:input.platformUser,action,targetType:'platform_reliability_alert',targetId,reason,metadata,ipAddress:input.ipAddress,userAgent:input.userAgent});}
function defaultPolicy(){return{id:1,emailEnabled:true,inAppEnabled:true,minimumEmailSeverity:'warning',notifyRoles:['owner'],additionalEmails:[],onCallPlatformUserId:null,onCallName:null,onCallEmail:null,escalationMinutes:30,repeatMinutes:60,updatedByPlatformUserId:null,updatedAt:null};}
function normalizePolicy(row){return{...row,emailEnabled:Boolean(row.emailEnabled),inAppEnabled:Boolean(row.inAppEnabled),notifyRoles:parseJson(row.notifyRoles,['owner']),additionalEmails:parseJson(row.additionalEmails,[]),onCallPlatformUserId:row.onCallPlatformUserId?Number(row.onCallPlatformUserId):null,escalationMinutes:Number(row.escalationMinutes||30),repeatMinutes:Number(row.repeatMinutes||60)};}
function normalizeRoles(value){const values=Array.isArray(value)?value:String(value||'owner').split(',');const roles=[...new Set(values.map((item)=>String(item).trim().toLowerCase()).filter((item)=>['owner','operator'].includes(item)))];if(!roles.length)throw httpError('Select at least one platform notification role',400);return roles;}
function normalizeEmails(value){const values=Array.isArray(value)?value:String(value||'').split(/[\s,;]+/);return[...new Set(values.map((item)=>String(item).trim().toLowerCase()).filter((item)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)))].slice(0,20);}
function normalizeSeverity(value){const severity=String(value||'').toLowerCase();if(!(severity in severityRank))throw httpError('Severity must be info, warning, or critical',400);return severity;}
function normalizeMinutes(value,min,max,field){const number=Number(value);if(!Number.isInteger(number)||number<min||number>max)throw httpError(`${field} must be between ${min} and ${max}`,400);return number;}
function toBoolean(value){return value===true||String(value).toLowerCase()==='true';}
function parseJson(value,fallback){if(value&&typeof value==='object')return value;try{return JSON.parse(value);}catch{return fallback;}}
function normalizeLimit(value){const number=Number(value||100);return Number.isFinite(number)&&number>0?Math.min(Math.floor(number),500):100;}
function httpError(message,status){const error=new Error(message);error.status=status;return error;}
function resetPlatformReliabilityAlertsForTests(){demoAlerts.length=0;demoEvents.length=0;demoPolicy=null;nextAlertId=1;nextEventId=1;}

module.exports={acknowledgePlatformReliabilityAlert,assignPlatformReliabilityAlert,buildPlatformReliabilitySignals,evaluatePlatformReliabilityAlerts,getPlatformReliabilityAlertCenter,getPlatformReliabilityAlertPolicy,linkPlatformReliabilityAlertIncident,listPlatformReliabilityAlerts,queuePlatformReliabilityAlertEvaluation,resetPlatformReliabilityAlertsForTests,updatePlatformReliabilityAlertPolicy};
