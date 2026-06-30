const { hasDatabaseConfig, query } = require('../db/pool');

async function recordWebhookEvent({ provider, eventType, payload, processedAt = null }) {
  const event = {
    provider,
    eventType: eventType || null,
    payload,
    processedAt
  };

  if (!hasDatabaseConfig()) {
    console.log('Webhook event', JSON.stringify(event));
    return { mode: 'demo', event };
  }

  await query(
    `insert into webhook_events (provider, event_type, payload, processed_at)
     values (:provider, :eventType, :payload, :processedAt)`,
    {
      provider,
      eventType: event.eventType,
      payload: JSON.stringify(payload),
      processedAt
    }
  );

  return { mode: 'database' };
}

module.exports = { recordWebhookEvent };
