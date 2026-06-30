const crypto = require('crypto');

function verifyMetaChallenge(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  return {
    ok: Boolean(process.env.META_VERIFY_TOKEN) && mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN,
    challenge
  };
}

function verifyMetaSignature(rawBody, signatureHeader) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return { ok: true, mode: 'unsigned-demo' };
  if (!rawBody || !signatureHeader) return { ok: false, mode: 'missing-signature' };

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  const ok = timingSafeEqual(expected, signatureHeader);
  return { ok, mode: 'signed' };
}

function extractMetaEvents(payload) {
  const events = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        events.push({
          type: 'message.received',
          phoneNumberId: value.metadata?.phone_number_id,
          from: message.from,
          messageId: message.id,
          messageType: message.type,
          text: message.text?.body || message.order?.text || null,
          profileName: value.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name,
          raw: message
        });
      }
      for (const status of value.statuses || []) {
        events.push({
          type: 'message.status',
          phoneNumberId: value.metadata?.phone_number_id,
          recipient: status.recipient_id,
          messageId: status.id,
          status: status.status,
          raw: status
        });
      }
    }
  }
  return events.length ? events : [{ type: 'meta.raw', raw: payload }];
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = { verifyMetaChallenge, verifyMetaSignature, extractMetaEvents };
