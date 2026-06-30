const { getMetaCredentials } = require('./metaCredentials');
const crypto = require('crypto');

async function sendTextMessage({ to, text, businessId = 1 }) {
  const credentials = await getMetaCredentials(businessId);
  const phoneNumberId = credentials?.phoneNumberId;
  const accessToken = credentials?.accessToken;

  if (process.env.META_SEND_MODE !== 'live') {
    return {
      mode: credentials ? 'mock-configured' : 'mock',
      messageId: mockMessageId(),
      note: 'Set META_SEND_MODE=live to send real WhatsApp messages.'
    };
  }

  if (!phoneNumberId || !accessToken) {
    return {
      mode: 'mock',
      messageId: mockMessageId(),
      note: 'Set META_PHONE_NUMBER_ID and META_ACCESS_TOKEN to send real WhatsApp messages.'
    };
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text }
    })
  });

  const body = await response.json();
  if (!response.ok) {
    const detail = body?.error?.message || 'Meta Cloud API request failed';
    const error = new Error(detail);
    error.status = 502;
    throw error;
  }

  return {
    mode: 'live',
    messageId: body.messages?.[0]?.id,
    raw: body
  };
}

async function sendInteractiveMessage({ payload, businessId = 1 }) {
  const credentials = await getMetaCredentials(businessId);
  const phoneNumberId = credentials?.phoneNumberId;
  const accessToken = credentials?.accessToken;

  if (process.env.META_SEND_MODE !== 'live') {
    return {
      mode: credentials ? 'mock-configured' : 'mock',
      messageId: mockMessageId(),
      note: 'Set META_SEND_MODE=live to send real WhatsApp interactive messages.'
    };
  }

  if (!phoneNumberId || !accessToken) {
    return {
      mode: 'mock',
      messageId: mockMessageId(),
      note: 'Set Meta phone number and access token credentials to send real WhatsApp messages.'
    };
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    const detail = body?.error?.message || 'Meta Cloud API request failed';
    const error = new Error(detail);
    error.status = 502;
    throw error;
  }

  return {
    mode: 'live',
    messageId: body.messages?.[0]?.id,
    raw: body
  };
}

function mockMessageId() {
  return `mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { sendInteractiveMessage, sendTextMessage };
