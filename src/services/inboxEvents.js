const { EventEmitter } = require('node:events');

const emitter = new EventEmitter();
emitter.setMaxListeners(500);

let sequence = 0;

function publishInboxEvent(businessId, event) {
  if (!businessId || !event?.type) return null;
  const payload = {
    id: `${Date.now()}_${++sequence}`,
    businessId: Number(businessId),
    occurredAt: new Date().toISOString(),
    ...event
  };
  emitter.emit(channelFor(businessId), payload);
  return payload;
}

function subscribeInboxEvents(businessId, listener) {
  const channel = channelFor(businessId);
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
}

function channelFor(businessId) {
  return `business:${Number(businessId)}`;
}

module.exports = {
  publishInboxEvent,
  subscribeInboxEvents
};
