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

async function sendTemplateMessage({ to, templateName, language = 'en_ZA', parameters = [], businessId = 1 }) {
  const payload = buildTemplateMessagePayload({ to, templateName, language, parameters });
  const credentials = await getMetaCredentials(businessId);
  const phoneNumberId = credentials?.phoneNumberId;
  const accessToken = credentials?.accessToken;

  if (process.env.META_SEND_MODE !== 'live') {
    return {
      mode: credentials ? 'mock-configured' : 'mock',
      messageId: mockMessageId(),
      messageType: 'template',
      payload,
      note: 'Set META_SEND_MODE=live to send real WhatsApp template messages.'
    };
  }

  if (!phoneNumberId || !accessToken) {
    return {
      mode: 'mock',
      messageId: mockMessageId(),
      messageType: 'template',
      payload,
      note: 'Set Meta phone number and access token credentials to send real WhatsApp template messages.'
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
    const detail = body?.error?.message || 'Meta Cloud API template request failed';
    const error = new Error(detail);
    error.status = 502;
    throw error;
  }

  return {
    mode: 'live',
    messageId: body.messages?.[0]?.id,
    messageType: 'template',
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

function buildTemplateMessagePayload({ to, templateName, language = 'en_ZA', parameters = [] }) {
  const name = String(templateName || '').trim();
  if (!name) {
    const error = new Error('WhatsApp template name is required');
    error.status = 400;
    throw error;
  }
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name,
      language: { code: language || 'en_ZA' },
      components: [
        {
          type: 'body',
          parameters: parameters.map((value) => ({
            type: 'text',
            text: String(value ?? '').slice(0, 1024)
          }))
        }
      ]
    }
  };
}

function mockMessageId() {
  return `mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { buildTemplateMessagePayload, sendInteractiveMessage, sendTemplateMessage, sendTextMessage };
