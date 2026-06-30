const express = require('express');
const { hasDatabaseConfig } = require('../db/pool');
const { enqueueJob } = require('../services/jobQueue');
const { runOnce } = require('../worker');
const {
  verifyMetaChallenge,
  verifyMetaSignature,
  extractMetaEvents
} = require('../services/metaWebhook');
const {
  verifyPayFastSignature,
  confirmPayFastWithServer,
  summarizePayFastEvent
} = require('../services/payfast');

const router = express.Router();

router.get('/meta', (req, res) => {
  const verification = verifyMetaChallenge(req.query);

  if (verification.ok) {
    return res.status(200).send(verification.challenge);
  }
  return res.sendStatus(403);
});

router.post('/meta', async (req, res) => {
  const signature = verifyMetaSignature(req.rawBody, req.get('x-hub-signature-256'));
  if (!signature.ok) return res.sendStatus(403);

  res.sendStatus(200);

  const events = extractMetaEvents(req.body);
  queueJobs(
    events.map((event) => ({
      type: 'webhook.meta.event',
      payload: { event },
      dedupeKey: metaEventDedupeKey(event)
    }))
  );
});

router.post('/payfast/itn', async (req, res) => {
  res.sendStatus(200);

  const signature = verifyPayFastSignature(req.body);
  let serverConfirmation = { ok: false, response: 'skipped' };

  if (signature.ok && process.env.PAYFAST_CONFIRM_SERVER === 'true') {
    serverConfirmation = await confirmPayFastWithServer(req.body);
  }

  queueJobs([
    {
      type: 'webhook.payfast.itn',
      payload: {
        eventType: req.body.payment_status || 'itn',
        summary: summarizePayFastEvent(req.body),
        checks: {
          signature,
          serverConfirmation
        },
        raw: req.body
      },
      dedupeKey: `webhook.payfast.itn:${req.body.pf_payment_id || req.body.m_payment_id || Date.now()}`
    }
  ]);
});

module.exports = router;

function queueJobs(jobs) {
  Promise.resolve()
    .then(async () => {
      for (const job of jobs) {
        await enqueueJob(job);
      }

      if (!hasDatabaseConfig()) {
        await runOnce({ limit: jobs.length });
      }
    })
    .catch((err) => {
      console.error({ error: err.message, source: 'webhook-job-enqueue' });
    });
}

function metaEventDedupeKey(event) {
  if (event.type === 'message.status') {
    return `webhook.meta.event:${event.type}:${event.messageId || 'unknown'}:${event.status || 'unknown'}:${event.phoneNumberId || 'unknown'}`;
  }
  return `webhook.meta.event:${event.type}:${event.messageId || event.from || 'unknown'}:${event.phoneNumberId || 'unknown'}`;
}
