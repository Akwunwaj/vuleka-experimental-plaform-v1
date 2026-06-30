const { getMetaCredentials } = require('./metaCredentials');

const demoProfiles = new Map();
const verticals = new Set([
  'OTHER',
  'AUTO',
  'BEAUTY',
  'APPAREL',
  'EDU',
  'ENTERTAIN',
  'EVENT_PLAN',
  'FINANCE',
  'GROCERY',
  'GOVT',
  'HOTEL',
  'HEALTH',
  'NONPROFIT',
  'PROF_SERVICES',
  'RETAIL',
  'TRAVEL',
  'RESTAURANT',
  'ALCOHOL',
  'ONLINE_GAMBLING',
  'PHYSICAL_GAMBLING',
  'OTC_DRUGS'
]);

async function getBusinessProfile(businessId) {
  const credentials = await getMetaCredentials(businessId);
  if (!credentials?.phoneNumberId || !credentials?.accessToken || profileMode() !== 'live') {
    const profile = demoProfiles.get(Number(businessId)) || defaultDemoProfile(credentials);
    return {
      mode: credentials ? 'mock-configured' : 'mock',
      profile,
      completeness: profileCompleteness(profile),
      note: 'Set META_PROFILE_MODE=live to read the WhatsApp Business Profile from Meta.'
    };
  }

  const fields = 'about,address,description,email,profile_picture_url,websites,vertical';
  const response = await graphRequest({
    path: `/${credentials.phoneNumberId}/whatsapp_business_profile?fields=${encodeURIComponent(fields)}`,
    accessToken: credentials.accessToken
  });
  const profile = normalizeProfile(response.data?.[0] || {});
  return {
    mode: 'live',
    profile,
    completeness: profileCompleteness(profile),
    meta: response
  };
}

async function updateBusinessProfile(businessId, payload) {
  const credentials = await getMetaCredentials(businessId);
  const profile = validateProfile(payload);

  if (!credentials?.phoneNumberId || !credentials?.accessToken || profileMode() !== 'live') {
    demoProfiles.set(Number(businessId), profile);
    return {
      mode: credentials ? 'mock-configured' : 'mock',
      updated: true,
      profile,
      completeness: profileCompleteness(profile),
      note: 'Set META_PROFILE_MODE=live to update the WhatsApp Business Profile at Meta.'
    };
  }

  const requestBody = toMetaProfilePayload(profile);
  const response = await graphRequest({
    path: `/${credentials.phoneNumberId}/whatsapp_business_profile`,
    method: 'POST',
    accessToken: credentials.accessToken,
    body: requestBody
  });
  return {
    mode: 'live',
    updated: Boolean(response.success),
    profile,
    completeness: profileCompleteness(profile),
    meta: response
  };
}

function validateProfile(payload = {}) {
  const websites = normalizeWebsites(payload.websites);
  const vertical = String(payload.vertical || 'OTHER').trim().toUpperCase();
  if (!verticals.has(vertical)) {
    const error = new Error(`vertical must be one of: ${Array.from(verticals).join(', ')}`);
    error.status = 400;
    throw error;
  }
  const email = String(payload.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('email must be a valid email address');
    error.status = 400;
    throw error;
  }
  return normalizeProfile({
    about: String(payload.about || '').trim().slice(0, 139),
    address: String(payload.address || '').trim().slice(0, 256),
    description: String(payload.description || '').trim().slice(0, 512),
    email,
    profile_picture_url: String(payload.profilePictureUrl || payload.profile_picture_url || '').trim(),
    profile_picture_handle: String(payload.profilePictureHandle || payload.profile_picture_handle || '').trim(),
    websites,
    vertical
  });
}

function normalizeProfile(profile = {}) {
  return {
    messagingProduct: profile.messaging_product || 'whatsapp',
    about: profile.about || '',
    address: profile.address || '',
    description: profile.description || '',
    email: profile.email || '',
    profilePictureUrl: profile.profilePictureUrl || profile.profile_picture_url || '',
    profilePictureHandle: profile.profilePictureHandle || profile.profile_picture_handle || '',
    websites: normalizeWebsites(profile.websites),
    vertical: String(profile.vertical || 'OTHER').trim().toUpperCase()
  };
}

function toMetaProfilePayload(profile) {
  const payload = {
    messaging_product: 'whatsapp',
    about: profile.about,
    address: profile.address,
    description: profile.description,
    email: profile.email,
    websites: profile.websites,
    vertical: profile.vertical
  };
  if (profile.profilePictureHandle) payload.profile_picture_handle = profile.profilePictureHandle;
  return payload;
}

function normalizeWebsites(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/[\n,]/);
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 2);
}

function profileCompleteness(profile) {
  const fields = [
    ['about', profile.about],
    ['description', profile.description],
    ['email', profile.email],
    ['address', profile.address],
    ['websites', profile.websites?.length],
    ['vertical', profile.vertical && profile.vertical !== 'OTHER'],
    ['profile_picture', profile.profilePictureUrl || profile.profilePictureHandle]
  ];
  const completed = fields.filter(([, value]) => Boolean(value)).map(([field]) => field);
  const missing = fields.filter(([, value]) => !value).map(([field]) => field);
  return {
    completed,
    missing,
    percent: Math.round((completed.length / fields.length) * 100)
  };
}

function defaultDemoProfile(credentials) {
  return normalizeProfile({
    about: 'Sell, support, and grow on WhatsApp.',
    description: 'ChatClan demo workspace for WhatsApp campaigns, inbox, automation, and commerce.',
    email: 'support@chatclan.co.za',
    address: 'Cape Town, South Africa',
    websites: ['https://chatclan.co.za'],
    vertical: 'PROF_SERVICES',
    profile_picture_url: '',
    messaging_product: 'whatsapp',
    phone_number_id: credentials?.phoneNumberId || ''
  });
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
    const error = new Error(payload?.error?.message || 'Meta Business Profile API request failed');
    error.status = 502;
    error.meta = payload;
    throw error;
  }
  return payload;
}

function profileMode() {
  return process.env.META_PROFILE_MODE === 'live' ? 'live' : 'mock';
}

function graphApiVersion() {
  return process.env.META_GRAPH_VERSION || 'v21.0';
}

module.exports = {
  getBusinessProfile,
  profileCompleteness,
  updateBusinessProfile,
  validateProfile,
  verticals
};
