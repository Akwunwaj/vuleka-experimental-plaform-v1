#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const { closePool, ping } = require('../src/db/pool');
const { listJobs } = require('../src/services/jobQueue');
const { runOnce } = require('../src/worker');

const baseUrl = normalizeBaseUrl(process.env.STARTUP_BASE_URL || process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`);
const workerLimit = normalizeWorkerLimit(process.env.STARTUP_WORKER_LIMIT);

async function main() {
  console.log(`ChatClan startup check: ${baseUrl}`);
  console.log(`Worker processing limit: ${workerLimit}\n`);

  await checkWebEndpoint('/health', 'web health endpoint');
  await checkWebEndpoint('/ready', 'web readiness endpoint');
  await checkWorkerBootPath();

  console.log('\nStartup check passed.');
}

async function checkWebEndpoint(path, label) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: 'application/json' } });
  const body = await parseJson(response);
  if (response.status !== 200) {
    throw new Error(`${label} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  if (body?.ok !== true) {
    throw new Error(`${label} did not return ok=true: ${JSON.stringify(body)}`);
  }
  pass(`${label} returned ok=true`);
}

async function checkWorkerBootPath() {
  try {
    const db = await ping();
    if (db.configured) {
      pass('worker database connection is reachable');
      await listJobs({ limit: 1 });
      pass('worker queue table is readable');
    } else {
      warn('database is not configured; worker check is using demo in-memory queue mode');
    }

    const result = await runOnce({ limit: workerLimit });
    pass(`worker runOnce completed with ${result.processed} processed job(s)`);
  } finally {
    await closePool();
  }
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeWorkerLimit(value) {
  if (value === undefined || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('STARTUP_WORKER_LIMIT must be a non-negative number');
  }
  return Math.floor(parsed);
}

function normalizeBaseUrl(value) {
  return String(value || 'http://localhost:3000').replace(/\/+$/, '');
}

function pass(message) {
  console.log(`[pass] ${message}`);
}

function warn(message) {
  console.log(`[warn] ${message}`);
}

main().catch(async (error) => {
  console.error(`[fail] ${error.message}`);
  await closePool();
  process.exitCode = 1;
});
