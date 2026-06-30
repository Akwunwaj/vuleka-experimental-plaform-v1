const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');

const demoJobs = [];
let demoJobId = 1;

async function enqueueJob({ type, payload, runAt = new Date(), maxAttempts = 3, dedupeKey = null }) {
  if (!type) {
    const error = new Error('type is required');
    error.status = 400;
    throw error;
  }

  const normalized = {
    type,
    payload: payload || {},
    runAt: runAt instanceof Date ? runAt : new Date(runAt),
    maxAttempts: Math.max(1, Number(maxAttempts || 3)),
    dedupeKey: dedupeKey || buildDedupeKey(type, payload)
  };

  if (!hasDatabaseConfig()) {
    const existing = demoJobs.find((job) => job.dedupeKey === normalized.dedupeKey && ['queued', 'running'].includes(job.status));
    if (existing) return { mode: 'demo', jobId: existing.id, deduped: true };
    const job = {
      id: demoJobId++,
      ...normalized,
      status: 'queued',
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    demoJobs.push(job);
    return { mode: 'demo', jobId: job.id, deduped: false };
  }

  try {
    const result = await query(
      `insert into jobs
         (type, status, payload, dedupe_key, attempts, max_attempts, run_at)
       values
         (:type, 'queued', :payload, :dedupeKey, 0, :maxAttempts, :runAt)`,
      {
        type: normalized.type,
        payload: JSON.stringify(normalized.payload),
        dedupeKey: normalized.dedupeKey,
        maxAttempts: normalized.maxAttempts,
        runAt: normalized.runAt
      }
    );
    return { mode: 'database', jobId: result.insertId, deduped: false };
  } catch (err) {
    if (String(err.message || '').includes('jobs_dedupe_key_unique')) {
      return { mode: 'database', jobId: null, deduped: true };
    }
    throw err;
  }
}

async function claimNextJob() {
  if (!hasDatabaseConfig()) {
    const job = demoJobs.find((item) => item.status === 'queued' && item.runAt <= new Date());
    if (!job) return null;
    job.status = 'running';
    job.attempts += 1;
    job.updatedAt = new Date();
    return { ...job };
  }

  const rows = await query(
    `select id, type, payload, attempts, max_attempts as maxAttempts
     from jobs
     where status = 'queued' and run_at <= current_timestamp
     order by run_at asc, id asc
     limit 1`
  );
  const job = rows?.[0];
  if (!job) return null;

  const result = await query(
    `update jobs
     set status = 'running', attempts = attempts + 1, updated_at = current_timestamp
     where id = :id and status = 'queued'`,
    { id: job.id }
  );
  if (!result.affectedRows) return null;

  return {
    ...job,
    payload: parsePayload(job.payload),
    attempts: Number(job.attempts || 0) + 1
  };
}

async function completeJob(jobId, result = null) {
  if (!hasDatabaseConfig()) {
    const job = demoJobs.find((item) => Number(item.id) === Number(jobId));
    if (job) {
      job.status = 'completed';
      job.result = result;
      job.updatedAt = new Date();
    }
    return;
  }

  await query(
    `update jobs
     set status = 'completed', result = :result, completed_at = current_timestamp, updated_at = current_timestamp
     where id = :jobId`,
    { jobId, result: result ? JSON.stringify(result) : null }
  );
}

async function failJob(job, err) {
  const errorMessage = String(err.message || err).slice(0, 500);
  const shouldRetry = Number(job.attempts || 0) < Number(job.maxAttempts || 1);
  const nextRun = new Date(Date.now() + retryDelayMs(job.attempts));

  if (!hasDatabaseConfig()) {
    const stored = demoJobs.find((item) => Number(item.id) === Number(job.id));
    if (stored) {
      stored.status = shouldRetry ? 'queued' : 'failed';
      stored.runAt = shouldRetry ? nextRun : stored.runAt;
      stored.lastError = errorMessage;
      stored.updatedAt = new Date();
    }
    return { retried: shouldRetry };
  }

  await query(
    `update jobs
     set status = :status,
         run_at = :runAt,
         last_error = :lastError,
         failed_at = case when :status = 'failed' then current_timestamp else failed_at end,
         updated_at = current_timestamp
     where id = :jobId`,
    {
      jobId: job.id,
      status: shouldRetry ? 'queued' : 'failed',
      runAt: shouldRetry ? nextRun : new Date(),
      lastError: errorMessage
    }
  );

  return { retried: shouldRetry };
}

async function listJobs({ status = null, limit = 100 } = {}) {
  if (!hasDatabaseConfig()) {
    return demoJobs
      .filter((job) => !status || job.status === status)
      .slice(-normalizeLimit(limit))
      .map((job) => ({ ...job }));
  }

  const statusSql = status ? 'where status = :status' : '';
  return query(
    `select id, type, status, attempts, max_attempts as maxAttempts,
            run_at as runAt, last_error as lastError, created_at as createdAt, updated_at as updatedAt
     from jobs
     ${statusSql}
     order by id desc
     limit ${normalizeLimit(limit)}`,
    { status }
  );
}

function buildDedupeKey(type, payload) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex').slice(0, 32);
  return `${type}:${hash}`;
}

function parsePayload(payload) {
  if (!payload || typeof payload !== 'string') return payload || {};
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

function retryDelayMs(attempts) {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, Number(attempts || 1) - 1));
}

function normalizeLimit(limit) {
  const parsed = Number(limit || 100);
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return Math.min(Math.floor(parsed), 1000);
}

module.exports = {
  claimNextJob,
  completeJob,
  enqueueJob,
  failJob,
  listJobs
};
