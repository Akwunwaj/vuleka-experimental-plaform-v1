const { brand } = require('./config/app');
const { closePool } = require('./db/pool');
const { claimNextJob, completeJob, failJob } = require('./services/jobQueue');
const { processJob } = require('./services/jobProcessor');

let stopped = false;

async function runOnce({ limit = 10 } = {}) {
  let processed = 0;

  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextJob();
    if (!job) break;

    try {
      const result = await processJob(job);
      await completeJob(job.id, result);
    } catch (err) {
      await failJob(job, err);
      console.error({ jobId: job.id, type: job.type, error: err.message });
    }
    processed += 1;
  }

  return { processed };
}

async function runLoop() {
  const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS || 2000);
  const batchSize = Number(process.env.WORKER_BATCH_SIZE || 10);
  console.log(`${brand.name} worker started`);

  while (!stopped) {
    const result = await runOnce({ limit: batchSize });
    if (!result.processed) {
      await sleep(intervalMs);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shutdown(signal) {
  stopped = true;
  console.log(`${signal} received, shutting down ${brand.name} worker`);
  await closePool();
  process.exit(0);
}

if (require.main === module) {
  require('dotenv').config();

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  runLoop().catch(async (err) => {
    console.error(err);
    await closePool();
    process.exit(1);
  });
}

module.exports = { runOnce };
