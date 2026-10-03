const crypto = require('node:crypto');
const os = require('node:os');
const { hasDatabaseConfig, query, transaction } = require('../db/pool');

const connectorProviders = ['shopify', 'woocommerce', 'google_drive'];
const demoHeartbeats = new Map();
const demoRecoveryEvents = [];
const demoResolutionEvents = [];
let lastHeartbeatWriteAt = 0;

function getWorkerIdentity() {
  return String(process.env.WORKER_ID || `${os.hostname()}-job-worker`).slice(0, 180);
}

async function recordWorkerHeartbeat(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  const throttleMs = normalizePositiveNumber(process.env.WORKER_HEARTBEAT_INTERVAL_MS, 15000);
  if (!input.force && now.getTime() - lastHeartbeatWriteAt < throttleMs) return null;
  lastHeartbeatWriteAt = now.getTime();

  const heartbeat = {
    workerId: String(input.workerId || getWorkerIdentity()).slice(0, 180),
    role: String(input.role || 'job-worker').slice(0, 80),
    status: normalizeWorkerStatus(input.status || 'idle'),
    processId: Number(input.processId || process.pid),
    version: String(input.version || process.env.APP_VERSION || 'development').slice(0, 80),
    currentJobId: input.currentJobId ? Number(input.currentJobId) : null,
    jobsProcessed: Math.max(0, Number(input.jobsProcessed || 0)),
    lastError: String(input.lastError || '').slice(0, 500) || null,
    lastJobAt: input.lastJobAt || null,
    lastSeenAt: now
  };

  if (!hasDatabaseConfig()) {
    const existing = demoHeartbeats.get(heartbeat.workerId);
    demoHeartbeats.set(heartbeat.workerId, {
      ...heartbeat,
      startedAt: existing?.startedAt || now,
      lastJobAt: heartbeat.lastJobAt || existing?.lastJobAt || null
    });
    return heartbeat;
  }

  await query(
    `insert into worker_heartbeats
       (worker_id, role, status, process_id, version, current_job_id, jobs_processed, last_error, started_at, last_job_at, last_seen_at)
     values
       (:workerId, :role, :status, :processId, :version, :currentJobId, :jobsProcessed, :lastError, :lastSeenAt, :lastJobAt, :lastSeenAt)
     on duplicate key update
       role = values(role), status = values(status), process_id = values(process_id), version = values(version),
       current_job_id = values(current_job_id), jobs_processed = values(jobs_processed), last_error = values(last_error),
       last_job_at = coalesce(values(last_job_at), last_job_at), last_seen_at = values(last_seen_at)`,
    heartbeat
  );
  return heartbeat;
}

async function getPlatformReliabilityOverview(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const staleSeconds = normalizePositiveNumber(process.env.WORKER_STALE_AFTER_SECONDS, 45);
  const stuckSeconds = normalizePositiveNumber(process.env.JOB_STUCK_AFTER_SECONDS, 300);

  if (!hasDatabaseConfig()) {
    const jobs = await require('./jobQueue').listJobs({ limit: 500 });
    return buildReliabilityOverview({
      now,
      staleSeconds,
      stuckSeconds,
      heartbeats: [...demoHeartbeats.values()],
      jobs,
      sources: [],
      runs: [],
      alerts: [],
      incidents: await require('./platformIncidents').listPlatformIncidents({ limit: 500 }),
      recoveryEvents: demoRecoveryEvents,
      resolutionEvents: demoResolutionEvents
    });
  }

  const [heartbeats, jobs, sources, runs, alerts, incidents, recoveryEvents, resolutionEvents] = await Promise.all([
    query(`select worker_id as workerId, role, status, process_id as processId, version,
                  current_job_id as currentJobId, jobs_processed as jobsProcessed, last_error as lastError,
                  started_at as startedAt, last_job_at as lastJobAt, last_seen_at as lastSeenAt
           from worker_heartbeats order by last_seen_at desc limit 100`),
    query(`select id, type, status, payload, attempts, max_attempts as maxAttempts, run_at as runAt,
                  last_error as lastError, created_at as createdAt, updated_at as updatedAt,
                  failed_at as failedAt, retry_of_job_id as retryOfJobId
           from jobs where status in ('queued', 'running', 'failed') order by updated_at desc limit 500`),
    query(`select bks.id, bks.business_id as businessId, b.name as businessName, bks.source_type as provider,
                  bks.status, bks.consecutive_failures as consecutiveFailures, bks.last_synced_at as lastSyncedAt,
                  bks.next_sync_at as nextSyncAt
           from business_knowledge_sources bks join businesses b on b.id = bks.business_id
           where bks.deleted_at is null and bks.source_type in ('shopify', 'woocommerce', 'google_drive')`),
    query(`select business_id as businessId, source_id as sourceId, provider, status, duration_ms as durationMs,
                  started_at as startedAt from knowledge_connector_sync_runs
           where started_at >= date_sub(current_timestamp, interval 24 hour)`),
    query(`select business_id as businessId, source_id as sourceId, severity, status
           from knowledge_connector_alerts where status in ('open', 'acknowledged')`),
    query(`select id, provider_key as providerKey, title, severity, status, started_at as startedAt
           from platform_incidents where status in ('open', 'monitoring') and provider_key is not null`),
    query(`select jre.id, jre.original_job_id as originalJobId, jre.recovery_job_id as recoveryJobId,
                  jre.reason, pu.email as platformUserEmail, jre.created_at as createdAt
           from job_recovery_events jre left join platform_users pu on pu.id = jre.platform_user_id
           order by jre.created_at desc limit 50`),
    query(`select jdlr.id, jdlr.job_id as jobId, jdlr.action, jdlr.reason,
                  pu.email as platformUserEmail, jdlr.created_at as createdAt
           from job_dead_letter_resolutions jdlr left join platform_users pu on pu.id = jdlr.platform_user_id
           order by jdlr.created_at desc limit 50`)
  ]);

  return buildReliabilityOverview({ now, staleSeconds, stuckSeconds, heartbeats, jobs, sources, runs, alerts, incidents, recoveryEvents, resolutionEvents });
}

function buildReliabilityOverview(input) {
  const workers = (input.heartbeats || []).map((worker) => normalizeWorker(worker, input.now, input.staleSeconds));
  const jobs = (input.jobs || []).map(normalizeJob);
  const stuckJobs = jobs.filter((job) => job.status === 'running' && ageSeconds(job.updatedAt, input.now) >= input.stuckSeconds);
  const deadLetters = jobs.filter((job) => job.status === 'failed' && job.attempts >= job.maxAttempts);
  const providers = summarizeProviderReliability({
    sources: input.sources,
    runs: input.runs,
    alerts: input.alerts,
    incidents: input.incidents
  });
  const healthyWorkers = workers.filter((worker) => worker.health === 'healthy').length;
  const correlatedProviders = providers.filter((provider) => provider.incidentCandidate && !provider.activeIncident).length;

  return {
    summary: {
      status: deadLetters.length || stuckJobs.length || workers.some((worker) => worker.health !== 'healthy') || correlatedProviders ? 'attention' : 'healthy',
      workers: workers.length,
      healthyWorkers,
      staleWorkers: workers.length - healthyWorkers,
      stuckJobs: stuckJobs.length,
      deadLetters: deadLetters.length,
      openConnectorAlerts: providers.reduce((sum, provider) => sum + provider.openAlerts, 0),
      correlatedProviders
    },
    thresholds: { workerStaleSeconds: input.staleSeconds, jobStuckSeconds: input.stuckSeconds },
    workers,
    stuckJobs,
    deadLetters,
    providers,
    recoveryEvents: input.recoveryEvents || [],
    resolutionEvents: input.resolutionEvents || []
  };
}

function summarizeProviderReliability({ sources = [], runs = [], alerts = [], incidents = [] } = {}) {
  return connectorProviders.map((provider) => {
    const providerSources = sources.filter((source) => source.provider === provider);
    const sourceIds = new Set(providerSources.map((source) => Number(source.id)));
    const providerRuns = runs.filter((run) => run.provider === provider || sourceIds.has(Number(run.sourceId)));
    const providerAlerts = alerts.filter((alert) => sourceIds.has(Number(alert.sourceId)));
    const affectedTenantIds = new Set([
      ...providerSources.filter((source) => source.status === 'error' || Number(source.consecutiveFailures || 0) > 0).map((source) => Number(source.businessId)),
      ...providerAlerts.map((alert) => Number(alert.businessId)),
      ...providerRuns.filter((run) => run.status === 'failed').map((run) => Number(run.businessId))
    ]);
    const successfulRuns = providerRuns.filter((run) => run.status === 'succeeded');
    const failedRuns = providerRuns.filter((run) => run.status === 'failed');
    const completedRuns = successfulRuns.length + failedRuns.length;
    const activeIncident = incidents.find((incident) => incident.providerKey === provider && incident.status !== 'resolved') || null;
    const failureRate = completedRuns ? Math.round((failedRuns.length / completedRuns) * 100) : 0;
    const incidentCandidate = affectedTenantIds.size >= 2 || (failedRuns.length >= 3 && failureRate >= 50);
    const durations = successfulRuns.map((run) => Number(run.durationMs || 0)).filter((value) => value > 0);
    return {
      key: provider,
      label: providerLabel(provider),
      sources: providerSources.length,
      activeSources: providerSources.filter((source) => !['error', 'paused'].includes(source.status)).length,
      affectedTenants: affectedTenantIds.size,
      successfulRuns: successfulRuns.length,
      failedRuns: failedRuns.length,
      successRate: completedRuns ? 100 - failureRate : null,
      averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
      openAlerts: providerAlerts.length,
      criticalAlerts: providerAlerts.filter((alert) => alert.severity === 'critical').length,
      incidentCandidate,
      activeIncident,
      health: activeIncident || incidentCandidate || providerAlerts.some((alert) => alert.severity === 'critical') ? 'attention' : failedRuns.length || providerAlerts.length ? 'watch' : 'healthy'
    };
  });
}

async function retryDeadLetterJob(input) {
  const reason = String(input.reason || '').trim().slice(0, 500);
  if (!reason) throw httpError('reason is required', 400);
  const jobId = Number(input.jobId);
  if (!Number.isFinite(jobId) || jobId < 1) throw httpError('Invalid job id', 400);

  let recovery;
  if (!hasDatabaseConfig()) {
    const queue = require('./jobQueue');
    const original = (await queue.listJobs({ limit: 1000 })).find((job) => Number(job.id) === jobId);
    if (!original) throw httpError('Job not found', 404);
    if (original.status !== 'failed' || Number(original.attempts) < Number(original.maxAttempts)) throw httpError('Only dead-letter jobs can be retried', 409);
    assertRecoverableJob(original);
    const queued = await queue.enqueueJob({
      type: original.type,
      payload: original.payload,
      maxAttempts: original.maxAttempts,
      dedupeKey: `${original.dedupeKey}:recovery:${crypto.randomUUID()}`
    });
    recovery = { id: demoRecoveryEvents.length + 1, originalJobId: jobId, recoveryJobId: queued.jobId, reason, platformUserEmail: input.platformUser?.email || null, createdAt: new Date().toISOString() };
    demoRecoveryEvents.unshift(recovery);
  } else {
    recovery = await transaction(async (db) => {
      const rows = await db.query(`select id, type, status, payload, dedupe_key as dedupeKey, attempts, max_attempts as maxAttempts
                                   from jobs where id = :jobId for update`, { jobId });
      const original = rows[0];
      if (!original) throw httpError('Job not found', 404);
      if (original.status !== 'failed' || Number(original.attempts) < Number(original.maxAttempts)) throw httpError('Only dead-letter jobs can be retried', 409);
      assertRecoverableJob(original);
      const dedupeKey = `${String(original.dedupeKey).slice(0, 120)}:recovery:${crypto.randomUUID()}`;
      const inserted = await db.query(
        `insert into jobs (type, status, payload, dedupe_key, attempts, max_attempts, run_at, retry_of_job_id)
         values (:type, 'queued', :payload, :dedupeKey, 0, :maxAttempts, current_timestamp, :jobId)`,
        { type: original.type, payload: typeof original.payload === 'string' ? original.payload : JSON.stringify(original.payload || {}), dedupeKey, maxAttempts: original.maxAttempts, jobId }
      );
      const event = await db.query(
        `insert into job_recovery_events (original_job_id, recovery_job_id, platform_user_id, reason)
         values (:jobId, :recoveryJobId, :platformUserId, :reason)`,
        { jobId, recoveryJobId: inserted.insertId, platformUserId: input.platformUser?.id || null, reason }
      );
      return { id: event.insertId, originalJobId: jobId, recoveryJobId: inserted.insertId, reason, platformUserEmail: input.platformUser?.email || null, createdAt: new Date().toISOString() };
    });
  }

  const { recordPlatformAuditEvent } = require('./platform');
  await recordPlatformAuditEvent({
    platformUser: input.platformUser,
    action: 'platform.job.dead_letter.retry',
    targetType: 'job',
    targetId: jobId,
    reason,
    metadata: { recoveryJobId: recovery.recoveryJobId },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent
  });
  return recovery;
}

async function discardDeadLetterJob(input) {
  const reason = String(input.reason || '').trim().slice(0, 500);
  if (!reason) throw httpError('reason is required', 400);
  const jobId = Number(input.jobId);
  if (!Number.isSafeInteger(jobId) || jobId < 1) throw httpError('Invalid job id', 400);

  let resolution;
  if (!hasDatabaseConfig()) {
    const queue = require('./jobQueue');
    const original = (await queue.listJobs({ limit: 1000 })).find((job) => Number(job.id) === jobId);
    if (!original) throw httpError('Job not found', 404);
    if (original.status !== 'failed' || Number(original.attempts) < Number(original.maxAttempts)) throw httpError('Only dead-letter jobs can be discarded', 409);
    await queue.discardJob(jobId);
    resolution = { id:demoResolutionEvents.length+1, jobId, action:'discarded', reason, platformUserEmail:input.platformUser?.email||null, createdAt:new Date().toISOString() };
    demoResolutionEvents.unshift(resolution);
  } else {
    resolution = await transaction(async (db) => {
      const rows = await db.query('select id,status,attempts,max_attempts as maxAttempts from jobs where id=:jobId for update',{jobId});
      const original = rows[0];
      if (!original) throw httpError('Job not found',404);
      if (original.status !== 'failed' || Number(original.attempts) < Number(original.maxAttempts)) throw httpError('Only dead-letter jobs can be discarded',409);
      await db.query("update jobs set status='discarded',updated_at=current_timestamp where id=:jobId",{jobId});
      const inserted = await db.query(
        `insert into job_dead_letter_resolutions (job_id,action,platform_user_id,reason)
         values (:jobId,'discarded',:platformUserId,:reason)`,
        {jobId,platformUserId:input.platformUser?.id||null,reason}
      );
      return {id:inserted.insertId,jobId,action:'discarded',reason,platformUserEmail:input.platformUser?.email||null,createdAt:new Date().toISOString()};
    });
  }

  const { recordPlatformAuditEvent } = require('./platform');
  await recordPlatformAuditEvent({
    platformUser:input.platformUser,
    action:'platform.job.dead_letter.discard',
    targetType:'job',
    targetId:jobId,
    reason,
    metadata:{preservedFailure:true},
    ipAddress:input.ipAddress,
    userAgent:input.userAgent
  });
  return resolution;
}

function assertRecoverableJob(job) {
  if (job.type !== 'campaign.dispatch') return;
  const payload = parseJson(job.payload, {});
  try {
    require('./broadcastDispatch').normalizeCampaignDispatchPayload(payload);
  } catch (err) {
    throw httpError(`Campaign dispatch job cannot be retried: ${err.message}. Discard it or create a new dispatch from a valid campaign.`, 409);
  }
}

function normalizeWorker(worker, now, staleSeconds) {
  const secondsSinceSeen = ageSeconds(worker.lastSeenAt, now);
  const health = worker.status === 'error' ? 'error' : secondsSinceSeen > staleSeconds ? 'stale' : worker.status === 'stopping' ? 'stopped' : 'healthy';
  return { ...worker, processId: Number(worker.processId || 0), jobsProcessed: Number(worker.jobsProcessed || 0), secondsSinceSeen, health };
}

function normalizeJob(job) {
  return { ...job, payload:parseJson(job.payload,{}), id: Number(job.id), attempts: Number(job.attempts || 0), maxAttempts: Number(job.maxAttempts || 1), retryOfJobId: job.retryOfJobId ? Number(job.retryOfJobId) : null };
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function ageSeconds(value, now) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? 0 : Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
}

function normalizeWorkerStatus(value) {
  const status = String(value || '').toLowerCase();
  return ['starting', 'idle', 'working', 'stopping', 'error'].includes(status) ? status : 'idle';
}

function normalizePositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function providerLabel(provider) {
  return { shopify: 'Shopify', woocommerce: 'WooCommerce', google_drive: 'Google Drive' }[provider] || provider;
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function resetPlatformReliabilityForTests() {
  demoHeartbeats.clear();
  demoRecoveryEvents.length = 0;
  demoResolutionEvents.length = 0;
  lastHeartbeatWriteAt = 0;
}

module.exports = {
  buildReliabilityOverview,
  discardDeadLetterJob,
  getPlatformReliabilityOverview,
  getWorkerIdentity,
  recordWorkerHeartbeat,
  resetPlatformReliabilityForTests,
  retryDeadLetterJob,
  summarizeProviderReliability
};
