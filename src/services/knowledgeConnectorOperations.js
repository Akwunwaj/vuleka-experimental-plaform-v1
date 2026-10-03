const { hasDatabaseConfig, query } = require('../db/pool');
const { listKnowledgeSources } = require('./knowledgeIngestion');

const demoRuns = [];
let nextDemoRunId = 1;

async function beginConnectorSyncRun(input) {
  const startedAt = new Date();
  const run = {
    id:nextDemoRunId++, businessId:Number(input.businessId), sourceId:Number(input.sourceId),
    jobId:input.jobId ? Number(input.jobId) : null, provider:String(input.provider),
    triggerType:normalizeTrigger(input.triggerType), status:'running', attempt:Number(input.attempt || 1),
    maxAttempts:Number(input.maxAttempts || 1), fetchedCount:0, createdCount:0, updatedCount:0,
    skippedCount:0, durationMs:null, errorMessage:null,
    scheduledFor:input.scheduledFor || null, startedAt:startedAt.toISOString(), completedAt:null
  };
  if (!hasDatabaseConfig()) { demoRuns.push(run); return run; }
  const result = await query(
    `insert into knowledge_connector_sync_runs
       (business_id,source_id,job_id,provider,trigger_type,status,attempt,max_attempts,scheduled_for,started_at)
     values (:businessId,:sourceId,:jobId,:provider,:triggerType,'running',:attempt,:maxAttempts,:scheduledFor,:startedAt)`,
    { ...run, scheduledFor:run.scheduledFor ? new Date(run.scheduledFor) : null, startedAt }
  );
  return { ...run, id:Number(result.insertId) };
}

async function completeConnectorSyncRun(run, changes) {
  const completedAt = new Date();
  const durationMs = Math.max(0, completedAt.getTime() - new Date(run.startedAt).getTime());
  const completed = {
    ...run, status:changes.status, fetchedCount:Number(changes.fetchedCount || 0),
    createdCount:Number(changes.createdCount || 0), updatedCount:Number(changes.updatedCount || 0),
    skippedCount:Number(changes.skippedCount || 0), durationMs,
    errorMessage:changes.errorMessage ? String(changes.errorMessage).slice(0, 500) : null,
    completedAt:completedAt.toISOString()
  };
  if (!hasDatabaseConfig()) { Object.assign(run, completed); return completed; }
  await query(
    `update knowledge_connector_sync_runs set status=:status,fetched_count=:fetchedCount,
       created_count=:createdCount,updated_count=:updatedCount,skipped_count=:skippedCount,
       duration_ms=:durationMs,error_message=:errorMessage,completed_at=:completedAt where id=:id`,
    { ...completed, completedAt }
  );
  return completed;
}

async function listConnectorSyncRuns(businessId, limit = 100) {
  if (!hasDatabaseConfig()) return demoRuns.filter((run) => Number(run.businessId) === Number(businessId)).slice(-limit).reverse();
  const rows = await query(
    `select id,business_id as businessId,source_id as sourceId,job_id as jobId,provider,
            trigger_type as triggerType,status,attempt,max_attempts as maxAttempts,
            fetched_count as fetchedCount,created_count as createdCount,updated_count as updatedCount,
            skipped_count as skippedCount,duration_ms as durationMs,error_message as errorMessage,
            scheduled_for as scheduledFor,started_at as startedAt,completed_at as completedAt
     from knowledge_connector_sync_runs where business_id=:businessId order by started_at desc,id desc limit ${normalizeLimit(limit)}`,
    { businessId }
  );
  return rows.map(normalizeRun);
}

async function getKnowledgeConnectorOperations(businessId, providedSources = null) {
  const [allSources, recentRuns] = await Promise.all([providedSources || listKnowledgeSources(businessId), listConnectorSyncRuns(businessId, 100)]);
  const sources = allSources.filter((source) => ['shopify','woocommerce','google_drive'].includes(source.sourceType));
  const now = Date.now();
  const enriched = sources.map((source) => enrichSource(source, recentRuns, now));
  const alerts = enriched.flatMap(sourceAlerts);
  const completed = recentRuns.filter((run) => Number.isFinite(run.durationMs));
  return {
    summary:{
      total:enriched.length,
      active:enriched.filter((source) => source.status !== 'paused').length,
      healthy:enriched.filter((source) => source.healthState === 'healthy').length,
      attention:enriched.filter((source) => ['degraded','stale','never_synced'].includes(source.healthState)).length,
      failed24h:recentRuns.filter((run) => run.status === 'failed' && now - new Date(run.startedAt).getTime() <= 86_400_000).length,
      averageDurationMs:completed.length ? Math.round(completed.reduce((sum, run) => sum + run.durationMs, 0) / completed.length) : null
    },
    sources:enriched,
    alerts,
    recentRuns:recentRuns.slice(0, 30)
  };
}

function enrichSource(source, runs, now) {
  const sourceRuns = runs.filter((run) => Number(run.sourceId) === Number(source.id));
  const lastRun = sourceRuns[0] || null;
  const lastSuccess = sourceRuns.find((run) => run.status === 'succeeded') || null;
  const intervalMs = Number(source.syncIntervalMinutes || 360) * 60_000;
  const lastSuccessAt = lastSuccess?.completedAt || source.lastSyncedAt;
  const slaDueAt = lastSuccessAt ? new Date(new Date(lastSuccessAt).getTime() + Math.max(intervalMs * 1.5, intervalMs + 15 * 60_000)).toISOString() : null;
  let healthState = 'healthy';
  if (source.status === 'paused') healthState = 'paused';
  else if (source.status === 'syncing') healthState = 'syncing';
  else if (source.status === 'error' || Number(source.consecutiveFailures || 0) > 0) healthState = 'degraded';
  else if (!lastSuccessAt) healthState = 'never_synced';
  else if (new Date(slaDueAt).getTime() < now) healthState = 'stale';
  const successful = sourceRuns.filter((run) => run.status === 'succeeded').length;
  const terminal = sourceRuns.filter((run) => ['succeeded','failed'].includes(run.status)).length;
  return { ...source, healthState, slaDueAt, lastRun, lastSuccessAt:lastSuccessAt || null, successRate:terminal ? successful / terminal : null };
}

function sourceAlerts(source) {
  if (source.healthState === 'degraded') return [{ alertKey:'sync_failure', severity:Number(source.consecutiveFailures || 0) >= 3 ? 'critical' : 'warning', sourceId:source.id, title:`${source.name} sync is failing`, detail:source.lastError || `${source.consecutiveFailures} consecutive failure(s)` }];
  if (source.healthState === 'stale') return [{ alertKey:'freshness_sla', severity:'warning', sourceId:source.id, title:`${source.name} is stale`, detail:`Freshness SLA passed ${source.slaDueAt}` }];
  if (source.healthState === 'never_synced') return [{ alertKey:'never_synced', severity:'info', sourceId:source.id, title:`${source.name} has not synced`, detail:'Run the initial sync and review its records.' }];
  return [];
}

function normalizeRun(run) { return { ...run, id:Number(run.id), businessId:Number(run.businessId), sourceId:Number(run.sourceId), jobId:run.jobId ? Number(run.jobId) : null, attempt:Number(run.attempt || 1), maxAttempts:Number(run.maxAttempts || 1), fetchedCount:Number(run.fetchedCount || 0), createdCount:Number(run.createdCount || 0), updatedCount:Number(run.updatedCount || 0), skippedCount:Number(run.skippedCount || 0), durationMs:run.durationMs === null ? null : Number(run.durationMs) }; }
function normalizeTrigger(value) { return ['initial','scheduled','manual','oauth'].includes(value) ? value : 'scheduled'; }
function normalizeLimit(value) { return Math.max(1, Math.min(500, Math.floor(Number(value) || 100))); }

module.exports = { beginConnectorSyncRun, completeConnectorSyncRun, getKnowledgeConnectorOperations, listConnectorSyncRuns };
