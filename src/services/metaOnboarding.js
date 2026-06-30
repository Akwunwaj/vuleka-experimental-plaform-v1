const crypto = require('crypto');
const { getMaskedMetaCredentials, getMetaCredentials, saveMetaCredentials } = require('./metaCredentials');

function getMetaOnboardingConfig({ businessId, origin = null } = {}) {
  const appId = process.env.META_APP_ID || process.env.SOCIAL_FACEBOOK_CLIENT_ID || '';
  const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '';
  const graphVersion = graphApiVersion();
  const redirectUri = onboardingRedirectUri(origin);

  return {
    businessId: Number(businessId || 0),
    mode: onboardingMode(),
    configured: Boolean(appId && configId),
    appId,
    configId,
    graphVersion,
    redirectUri,
    launchParams: {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: 'whatsapp_business_app_onboarding',
        sessionInfoVersion: '3'
      }
    },
    requiredPermissions: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    docs: {
      codeExchange: `GET https://graph.facebook.com/${graphVersion}/oauth/access_token`,
      phoneRegistration: `POST https://graph.facebook.com/${graphVersion}/{PHONE_NUMBER_ID}/register`
    }
  };
}

async function getMetaOnboardingStatus({ businessId, origin = null } = {}) {
  const [config, credentials, assetHealth] = await Promise.all([
    Promise.resolve(getMetaOnboardingConfig({ businessId, origin })),
    getMaskedMetaCredentials(businessId),
    getMetaAssetHealth({ businessId }).catch((error) => ({
      mode: onboardingMode(),
      available: false,
      error: error.message,
      checks: []
    }))
  ]);
  const webhookUrl = `${origin || process.env.APP_URL || ''}/webhooks/meta`.replace(/([^:]\/)\/+/g, '$1');
  const checks = [
    check('embedded_signup_config', config.configured, config.configured ? 'Embedded Signup app ID and config ID are configured.' : 'Set META_APP_ID and META_EMBEDDED_SIGNUP_CONFIG_ID.'),
    check('business_token', credentials.connected, credentials.connected ? 'Business token or access token is saved.' : 'Complete Embedded Signup or save Meta credentials manually.'),
    check('waba_id', Boolean(credentials.wabaId), credentials.wabaId ? 'WABA ID is saved.' : 'WABA ID is missing.'),
    check('phone_number_id', Boolean(credentials.phoneNumberId), credentials.phoneNumberId ? 'Phone number ID is saved.' : 'Phone number ID is missing.'),
    check('webhook_verify_token', Boolean(credentials.verifyTokenMasked || process.env.META_VERIFY_TOKEN), 'Webhook verify token should match the Meta app subscription.'),
    ...assetHealth.checks
  ];

  return {
    config,
    credentials,
    assetHealth,
    webhookUrl,
    ready: checks.every((item) => item.ok || item.optional),
    checks
  };
}

async function completeEmbeddedSignup({ businessId, code, wabaId, phoneNumberId, businessAccountId, phoneNumber, verifyToken }) {
  const normalized = {
    wabaId: String(wabaId || businessAccountId || '').trim(),
    phoneNumberId: String(phoneNumberId || '').trim(),
    code: String(code || '').trim(),
    phoneNumber: String(phoneNumber || '').trim(),
    verifyToken: String(verifyToken || process.env.META_VERIFY_TOKEN || '').trim()
  };
  if (!normalized.wabaId || !normalized.phoneNumberId || !normalized.code) {
    const error = new Error('code, wabaId and phoneNumberId are required after Embedded Signup');
    error.status = 400;
    throw error;
  }

  const tokenResult = await exchangeEmbeddedSignupCode(normalized.code);
  const saved = await saveMetaCredentials(businessId, {
    wabaId: normalized.wabaId,
    phoneNumberId: normalized.phoneNumberId,
    accessToken: tokenResult.accessToken,
    verifyToken: normalized.verifyToken
  });

  return {
    mode: tokenResult.mode,
    businessId: Number(businessId),
    wabaId: normalized.wabaId,
    phoneNumberId: normalized.phoneNumberId,
    phoneNumber: normalized.phoneNumber || null,
    tokenMasked: saved.accessTokenMasked,
    credentials: saved,
    next: ['register_phone_number', 'subscribe_webhooks', 'send_test_message']
  };
}

async function registerPhoneNumber({ businessId, pin, dataLocalizationRegion = null }) {
  const normalizedPin = String(pin || '').trim();
  if (!/^\d{6}$/.test(normalizedPin)) {
    const error = new Error('A 6 digit registration PIN is required');
    error.status = 400;
    throw error;
  }
  const credentials = await getMetaCredentials(businessId);
  if (!credentials?.phoneNumberId || !credentials?.accessToken) {
    const error = new Error('Connect Meta credentials before registering the phone number');
    error.status = 400;
    throw error;
  }

  const payload = {
    messaging_product: 'whatsapp',
    pin: normalizedPin
  };
  if (dataLocalizationRegion) payload.data_localization_region = String(dataLocalizationRegion).trim().toUpperCase();

  if (onboardingMode() !== 'live') {
    return {
      mode: 'mock',
      phoneNumberId: credentials.phoneNumberId,
      registered: true,
      payload: { ...payload, pin: '******' },
      note: 'Set META_ONBOARDING_MODE=live to register the phone number with Meta.'
    };
  }

  const body = await graphRequest({
    path: `/${credentials.phoneNumberId}/register`,
    method: 'POST',
    accessToken: credentials.accessToken,
    body: payload
  });
  return {
    mode: 'live',
    phoneNumberId: credentials.phoneNumberId,
    registered: Boolean(body.success || body.successful_registration?.value?.success),
    meta: body
  };
}

async function subscribeWabaWebhooks({ businessId, callbackUrl = null, verifyToken = null } = {}) {
  const credentials = await getMetaCredentials(businessId);
  if (!credentials?.wabaId || !credentials?.accessToken) {
    const error = new Error('Connect Meta credentials before subscribing WABA webhooks');
    error.status = 400;
    throw error;
  }
  const webhookUrl = callbackUrl || `${(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/webhooks/meta`;
  const token = verifyToken || credentials.verifyToken || process.env.META_VERIFY_TOKEN || '';
  if (!token) {
    const error = new Error('A webhook verify token is required before subscribing webhooks');
    error.status = 400;
    throw error;
  }
  const payload = {
    override_callback_uri: webhookUrl,
    verify_token: token,
    subscribed_fields: ['messages', 'message_template_status']
  };

  if (onboardingMode() !== 'live') {
    return {
      mode: 'mock',
      subscribed: true,
      wabaId: credentials.wabaId,
      callbackUrl: webhookUrl,
      subscribedFields: payload.subscribed_fields,
      note: 'Set META_ONBOARDING_MODE=live to subscribe the WABA at Meta.'
    };
  }

  const body = await graphRequest({
    path: `/${credentials.wabaId}/subscribed_apps`,
    method: 'POST',
    accessToken: credentials.accessToken,
    body: payload
  });
  return {
    mode: 'live',
    subscribed: Boolean(body.success),
    wabaId: credentials.wabaId,
    callbackUrl: webhookUrl,
    subscribedFields: payload.subscribed_fields,
    meta: body
  };
}

async function getMetaAssetHealth({ businessId }) {
  const credentials = await getMetaCredentials(businessId);
  if (!credentials?.wabaId || !credentials?.phoneNumberId || !credentials?.accessToken) {
    return {
      mode: onboardingMode(),
      available: false,
      checks: [
        check('asset_health', false, 'Connect WABA, phone number, and token before reading live asset health.', true)
      ]
    };
  }

  if (onboardingMode() !== 'live') {
    const mock = mockAssetHealth(credentials);
    return { ...mock, checks: assetHealthChecks(mock) };
  }

  const phoneFields = 'id,display_phone_number,verified_name,quality_rating,name_status,code_verification_status,messaging_limit_tier';
  const [phone, phoneHealth, wabaHealth] = await Promise.all([
    graphRequest({
      path: `/${credentials.phoneNumberId}?fields=${encodeURIComponent(phoneFields)}`,
      accessToken: credentials.accessToken
    }),
    graphRequest({
      path: `/${credentials.phoneNumberId}?fields=health_status`,
      accessToken: credentials.accessToken
    }),
    graphRequest({
      path: `/${credentials.wabaId}?fields=health_status`,
      accessToken: credentials.accessToken
    })
  ]);
  const health = {
    mode: 'live',
    available: true,
    phone,
    phoneHealth: phoneHealth.health_status || null,
    wabaHealth: wabaHealth.health_status || null
  };
  return { ...health, checks: assetHealthChecks(health) };
}

async function exchangeEmbeddedSignupCode(code) {
  if (onboardingMode() !== 'live') {
    return {
      mode: 'mock',
      accessToken: `mock_business_token_${crypto.randomBytes(8).toString('hex')}`
    };
  }

  const appId = process.env.META_APP_ID || process.env.SOCIAL_FACEBOOK_CLIENT_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.SOCIAL_FACEBOOK_CLIENT_SECRET;
  if (!appId || !appSecret) {
    const error = new Error('META_APP_ID and META_APP_SECRET are required for live Embedded Signup token exchange');
    error.status = 400;
    throw error;
  }

  const params = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
  const response = await fetch(`https://graph.facebook.com/${graphApiVersion()}/oauth/access_token?${params.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.error?.message || 'Meta OAuth code exchange failed');
    error.status = 502;
    error.meta = body;
    throw error;
  }
  return {
    mode: 'live',
    accessToken: body.access_token || body
  };
}

async function graphRequest({ path, method = 'GET', accessToken, body = null }) {
  const response = await fetch(`https://graph.facebook.com/${graphApiVersion()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Meta Graph API request failed');
    error.status = 502;
    error.meta = payload;
    throw error;
  }
  return payload;
}

function check(id, ok, message, optional = false) {
  return { id, ok: Boolean(ok), optional, message };
}

function assetHealthChecks(health) {
  const phone = health.phone || {};
  const canSend = health.phoneHealth?.can_send_message || health.wabaHealth?.can_send_message;
  return [
    check('phone_quality', !phone.quality_rating || ['GREEN', 'NA'].includes(phone.quality_rating), phone.quality_rating ? `Phone quality rating: ${phone.quality_rating}` : 'Phone quality rating is not available yet.', true),
    check('display_name_status', !phone.name_status || ['APPROVED', 'AVAILABLE_WITHOUT_REVIEW'].includes(phone.name_status), phone.name_status ? `Display name status: ${phone.name_status}` : 'Display name status is not available yet.', true),
    check('code_verification_status', !phone.code_verification_status || phone.code_verification_status === 'VERIFIED', phone.code_verification_status ? `Code verification status: ${phone.code_verification_status}` : 'Phone code verification status is not available yet.', true),
    check('messaging_health', !canSend || canSend === 'AVAILABLE', canSend ? `Messaging health: ${canSend}` : 'Messaging health is not available yet.', true)
  ];
}

function mockAssetHealth(credentials) {
  return {
    mode: 'mock',
    available: true,
    phone: {
      id: credentials.phoneNumberId,
      display_phone_number: '+27 82 123 4567',
      verified_name: 'ChatClan Demo Store',
      quality_rating: 'GREEN',
      name_status: 'APPROVED',
      code_verification_status: 'VERIFIED',
      messaging_limit_tier: 'TIER_1K'
    },
    phoneHealth: {
      can_send_message: 'AVAILABLE',
      entities: [
        { entity_type: 'PHONE_NUMBER', id: credentials.phoneNumberId, can_send_message: 'AVAILABLE' },
        { entity_type: 'WABA', id: credentials.wabaId, can_send_message: 'AVAILABLE' }
      ]
    },
    wabaHealth: {
      can_send_message: 'AVAILABLE',
      entities: [{ entity_type: 'WABA', id: credentials.wabaId, can_send_message: 'AVAILABLE' }]
    }
  };
}

function onboardingMode() {
  return process.env.META_ONBOARDING_MODE === 'live' ? 'live' : 'mock';
}

function graphApiVersion() {
  return process.env.META_GRAPH_VERSION || 'v21.0';
}

function onboardingRedirectUri(origin) {
  const base = origin || process.env.APP_URL || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/dashboard#settings`;
}

module.exports = {
  completeEmbeddedSignup,
  exchangeEmbeddedSignupCode,
  getMetaAssetHealth,
  getMetaOnboardingConfig,
  getMetaOnboardingStatus,
  registerPhoneNumber,
  subscribeWabaWebhooks
};
