const crypto = require('crypto');
const { hasDatabaseConfig, query, transaction } = require('../db/pool');
const { brand } = require('../config/app');
const { createTrialSubscription } = require('./billing');
const { createDemoBusiness } = require('./demoStore');
const { findDemoUserByEmail, hashPassword, saveDemoUser } = require('./auth');
const { getPlan } = require('./planCatalog');

const STATE_TTL_MS = 1000 * 60 * 10;
const VERIFICATION_TTL_MS = 1000 * 60 * 20;
const providers = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid email profile'
  },
  yahoo: {
    name: 'Yahoo',
    authUrl: 'https://api.login.yahoo.com/oauth2/request_auth',
    tokenUrl: 'https://api.login.yahoo.com/oauth2/get_token',
    userInfoUrl: 'https://api.login.yahoo.com/openid/v1/userinfo',
    scope: 'openid email profile'
  },
  facebook: {
    name: 'Facebook',
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me?fields=id,name,email',
    scope: 'email,public_profile'
  },
  linkedin: {
    name: 'LinkedIn',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userInfoUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email'
  },
  apple: {
    name: 'Apple',
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: null,
    scope: 'name email'
  }
};

const demoStates = new Map();
const demoVerifications = new Map();
const demoIdentities = new Map();

function listSocialProviders() {
  return Object.entries(providers).map(([id, provider]) => ({
    id,
    name: provider.name,
    configured: isProviderConfigured(id)
  }));
}

async function createSocialAuthStart({ provider, purpose = 'signup', planCode = 'starter', redirectTo = null }) {
  const providerConfig = getProvider(provider);
  const normalizedPurpose = purpose === 'signin' ? 'signin' : 'signup';
  const plan = getPlan(planCode || 'starter');
  const credentials = providerCredentials(providerConfig.id);
  if (!credentials.clientId) {
    const error = new Error(`${providerConfig.name} sign in is not configured`);
    error.status = 503;
    error.code = 'SOCIAL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }

  const state = crypto.randomBytes(32).toString('base64url');
  await storeState({
    state,
    provider: providerConfig.id,
    purpose: normalizedPurpose,
    planCode: plan.code,
    redirectTo
  });

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: callbackUrl(providerConfig.id),
    response_type: 'code',
    scope: providerConfig.scope,
    state
  });
  if (providerConfig.id === 'apple') {
    params.set('response_mode', 'form_post');
  }

  return {
    provider: providerConfig.id,
    providerName: providerConfig.name,
    authorizationUrl: `${providerConfig.authUrl}?${params.toString()}`
  };
}

async function handleSocialCallback({ provider, state, code }) {
  const providerConfig = getProvider(provider);
  if (!code) {
    const error = new Error('Social sign in did not return an authorization code');
    error.status = 400;
    throw error;
  }
  const authState = await consumeState({ state, provider: providerConfig.id });
  const profile = await fetchSocialProfile({ providerConfig, code });
  if (authState.purpose === 'signin') {
    const user = await findSocialUser(profile);
    if (user) {
      return {
        purpose: authState.purpose,
        profile,
        user,
        redirectTo: authState.redirectTo || '/dashboard'
      };
    }
  }
  const verification = await createSocialSignupVerification({
    provider: providerConfig.id,
    providerUserId: profile.providerUserId,
    email: profile.email,
    name: profile.name,
    planCode: authState.planCode
  });

  return {
    purpose: authState.purpose,
    profile,
    verification,
    redirectTo: `/signup/social/complete?token=${encodeURIComponent(verification.token)}`
  };
}

async function findSocialUser(profile) {
  if (!hasDatabaseConfig()) {
    const identity = demoIdentities.get(identityKey(profile.provider, profile.providerUserId));
    if (!identity) return null;
    const { findDemoUserById } = require('./auth');
    return findDemoUserById(identity.userId);
  }

  const rows = await query(
    `select u.id, u.name, u.email, bm.business_id as businessId, bm.role
     from social_identities si
     join users u on u.id = si.user_id
     join business_memberships bm on bm.user_id = u.id
     where si.provider = :provider
       and si.provider_user_id = :providerUserId
       and u.status = 'active'
     order by bm.created_at asc
     limit 1`,
    {
      provider: profile.provider,
      providerUserId: profile.providerUserId
    }
  );
  return rows?.[0] || null;
}

async function getSocialSignupVerification(token) {
  const tokenHash = hashToken(token);
  if (!hasDatabaseConfig()) {
    const verification = demoVerifications.get(tokenHash);
    if (!isUsableVerification(verification)) return null;
    return publicVerification(verification);
  }

  const rows = await query(
    `select provider, provider_user_id as providerUserId, email, name, plan_code as planCode, expires_at as expiresAt, used_at as usedAt
     from social_signup_verifications
     where token_hash = :tokenHash
     limit 1`,
    { tokenHash }
  );
  const verification = rows?.[0];
  if (!isUsableVerification(verification)) return null;
  return publicVerification(verification);
}

async function completeSocialSignup({ token, businessName, ownerName, planCode }) {
  const tokenHash = hashToken(token);
  const verification = await getStoredVerification(tokenHash);
  if (!isUsableVerification(verification)) {
    const error = new Error('Social verification is invalid or expired');
    error.status = 400;
    throw error;
  }
  const name = String(ownerName || verification.name || '').trim();
  const business = String(businessName || '').trim();
  const plan = getPlan(planCode || verification.planCode || 'starter');
  if (!business) required('businessName');
  if (!name) required('ownerName');

  if (!hasDatabaseConfig()) {
    if (findDemoUserByEmail(verification.email)) throwConflict('A user with this email already exists');
    const demoBusiness = createDemoBusiness({ name: business, planCode: plan.code });
    const user = saveDemoUser({
      id: Date.now(),
      businessId: demoBusiness.id,
      name,
      email: verification.email,
      role: 'owner',
      status: 'active',
      passwordHash: await hashPassword(crypto.randomBytes(24).toString('base64url'))
    });
    demoIdentities.set(identityKey(verification.provider, verification.providerUserId), {
      userId: user.id,
      provider: verification.provider,
      providerUserId: verification.providerUserId,
      email: verification.email
    });
    verification.usedAt = new Date();
    const subscription = await createTrialSubscription({ businessId: demoBusiness.id, planCode: plan.code });
    return { business: demoBusiness, user: publicOwner(user), subscription };
  }

  return transaction(async (db) => {
    const existing = await db.query('select id from users where email = :email limit 1', { email: verification.email });
    if (existing?.length) throwConflict('A user with this email already exists');

    const businessResult = await db.query(
      `insert into businesses (name, plan)
       values (:name, :planCode)`,
      { name: business, planCode: plan.code }
    );
    const businessId = businessResult.insertId;
    const userResult = await db.query(
      `insert into users (name, email, password_hash, status)
       values (:name, :email, :passwordHash, 'active')`,
      {
        name,
        email: verification.email,
        passwordHash: await hashPassword(crypto.randomBytes(24).toString('base64url'))
      }
    );
    const userId = userResult.insertId;
    await db.query(
      `insert into business_memberships (business_id, user_id, role)
       values (:businessId, :userId, 'owner')`,
      { businessId, userId }
    );
    await db.query(
      `insert into social_identities (user_id, provider, provider_user_id, email)
       values (:userId, :provider, :providerUserId, :email)`,
      {
        userId,
        provider: verification.provider,
        providerUserId: verification.providerUserId,
        email: verification.email
      }
    );
    await db.query('update social_signup_verifications set used_at = current_timestamp where token_hash = :tokenHash', { tokenHash });
    const subscription = await createTrialSubscription({ businessId, planCode: plan.code, db });
    return {
      business: { id: businessId, name: business, planCode: plan.code },
      user: {
        id: userId,
        businessId,
        name,
        email: verification.email,
        role: 'owner',
        status: 'active'
      },
      subscription
    };
  });
}

async function createSocialSignupVerification({ provider, providerUserId, email, name, planCode = 'starter' }) {
  const providerConfig = getProvider(provider);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedProviderUserId = String(providerUserId || '').trim();
  if (!normalizedProviderUserId) required('providerUserId');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    const error = new Error('Social provider did not return a verified email address');
    error.status = 400;
    throw error;
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const verification = {
    token,
    tokenHash: hashToken(token),
    provider: providerConfig.id,
    providerUserId: normalizedProviderUserId,
    email: normalizedEmail,
    name: String(name || '').trim(),
    planCode: getPlan(planCode || 'starter').code,
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    usedAt: null
  };

  if (!hasDatabaseConfig()) {
    demoVerifications.set(verification.tokenHash, verification);
    return publicVerification(verification, token);
  }

  await query(
    `insert into social_signup_verifications
       (token_hash, provider, provider_user_id, email, name, plan_code, expires_at)
     values
       (:tokenHash, :provider, :providerUserId, :email, :name, :planCode, :expiresAt)`,
    verification
  );
  return publicVerification(verification, token);
}

async function fetchSocialProfile({ providerConfig, code }) {
  const credentials = providerCredentials(providerConfig.id);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(providerConfig.id),
    client_id: credentials.clientId
  });
  if (credentials.clientSecret) body.set('client_secret', credentials.clientSecret);

  const tokenResponse = await fetch(providerConfig.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    const error = new Error(`${providerConfig.name} verification failed`);
    error.status = 502;
    throw error;
  }

  if (providerConfig.userInfoUrl) {
    const userResponse = await fetch(providerConfig.userInfoUrl, {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok) {
      const error = new Error(`${providerConfig.name} profile lookup failed`);
      error.status = 502;
      throw error;
    }
    return normalizeProviderProfile(providerConfig.id, user);
  }

  return normalizeProviderProfile(providerConfig.id, decodeJwtPayload(token.id_token));
}

async function storeState({ state, provider, purpose, planCode, redirectTo }) {
  const stored = {
    stateHash: hashToken(state),
    provider,
    purpose,
    planCode,
    redirectTo,
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
    usedAt: null
  };
  if (!hasDatabaseConfig()) {
    demoStates.set(stored.stateHash, stored);
    return stored;
  }
  await query(
    `insert into social_auth_states (state_hash, provider, purpose, plan_code, redirect_to, expires_at)
     values (:stateHash, :provider, :purpose, :planCode, :redirectTo, :expiresAt)`,
    stored
  );
  return stored;
}

async function consumeState({ state, provider }) {
  const stateHash = hashToken(state);
  let stored;
  if (!hasDatabaseConfig()) {
    stored = demoStates.get(stateHash);
  } else {
    const rows = await query(
      `select provider, purpose, plan_code as planCode, redirect_to as redirectTo, expires_at as expiresAt, used_at as usedAt
       from social_auth_states
       where state_hash = :stateHash
       limit 1`,
      { stateHash }
    );
    stored = rows?.[0];
  }

  if (!stored || stored.provider !== provider || stored.usedAt || new Date(stored.expiresAt) < new Date()) {
    const error = new Error('Social sign in session is invalid or expired');
    error.status = 400;
    throw error;
  }
  if (!hasDatabaseConfig()) {
    stored.usedAt = new Date();
  } else {
    await query('update social_auth_states set used_at = current_timestamp where state_hash = :stateHash', { stateHash });
  }
  return stored;
}

async function getStoredVerification(tokenHash) {
  if (!hasDatabaseConfig()) return demoVerifications.get(tokenHash) || null;
  const rows = await query(
    `select provider, provider_user_id as providerUserId, email, name, plan_code as planCode, expires_at as expiresAt, used_at as usedAt
     from social_signup_verifications
     where token_hash = :tokenHash
     limit 1`,
    { tokenHash }
  );
  return rows?.[0] || null;
}

function normalizeProviderProfile(provider, profile = {}) {
  return {
    provider,
    providerUserId: String(profile.sub || profile.id || ''),
    email: String(profile.email || '').trim().toLowerCase(),
    name: String(profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || '').trim()
  };
}

function providerCredentials(provider) {
  const prefix = `SOCIAL_${provider.toUpperCase()}`;
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`],
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`]
  };
}

function callbackUrl(provider) {
  return `${appUrl()}/api/auth/social/${provider}/callback`;
}

function appUrl() {
  return String(process.env.APP_URL || brand.domain || 'http://localhost:3000').replace(/\/+$/, '');
}

function isProviderConfigured(provider) {
  return Boolean(providerCredentials(provider).clientId);
}

function getProvider(provider) {
  const id = String(provider || '').trim().toLowerCase();
  const config = providers[id];
  if (!config) {
    const error = new Error('Unsupported social sign in provider');
    error.status = 400;
    throw error;
  }
  return { id, ...config };
}

function decodeJwtPayload(token) {
  const payload = String(token || '').split('.')[1];
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

function publicVerification(verification, token = null) {
  return {
    token,
    provider: verification.provider,
    providerName: providers[verification.provider]?.name || verification.provider,
    email: verification.email,
    name: verification.name || '',
    planCode: verification.planCode || 'starter',
    expiresAt: verification.expiresAt
  };
}

function isUsableVerification(verification) {
  return Boolean(verification && !verification.usedAt && new Date(verification.expiresAt) > new Date());
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function identityKey(provider, providerUserId) {
  return `${provider}:${providerUserId}`;
}

function publicOwner(user) {
  return {
    id: user.id,
    businessId: user.businessId,
    name: user.name,
    email: user.email,
    role: 'owner',
    status: user.status || 'active'
  };
}

function required(field) {
  const error = new Error(`${field} is required`);
  error.status = 400;
  throw error;
}

function throwConflict(message) {
  const error = new Error(message);
  error.status = 409;
  throw error;
}

module.exports = {
  completeSocialSignup,
  createSocialAuthStart,
  createSocialSignupVerification,
  getSocialSignupVerification,
  handleSocialCallback,
  listSocialProviders
};
