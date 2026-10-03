const crypto = require('node:crypto');
const { hasDatabaseConfig, query } = require('../db/pool');

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const STATE_TTL_MS = 10 * 60_000;
const demoStates = new Map();

function getGoogleDriveOAuthStatus() {
  const config = getOAuthConfig(false);
  const scopes = config?.scopes || configuredScopes();
  const restrictedScope = scopes.includes('https://www.googleapis.com/auth/drive.readonly');
  const appUrl = normalizedAppUrl();
  const expectedRedirectUri = `${appUrl}/auth/google-drive/callback`;
  const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || '').trim();
  const verificationStatus = normalizeReadinessStatus(process.env.GOOGLE_DRIVE_OAUTH_VERIFICATION_STATUS);
  const securityAssessmentStatus = normalizeReadinessStatus(process.env.GOOGLE_DRIVE_OAUTH_SECURITY_ASSESSMENT_STATUS);
  const testUsers = splitValues(process.env.GOOGLE_DRIVE_OAUTH_TEST_USERS);
  const checks = {
    clientId:Boolean(clientId), clientIdFormat:validGoogleClientId(clientId),
    clientSecret:Boolean(clientSecret), clientSecretSafety:validCredentialValue(clientSecret),
    redirectUri:Boolean(config?.redirectUri && validRedirectUri(config.redirectUri)),
    callbackPath:Boolean(config?.redirectUri && new URL(config.redirectUri).pathname === '/auth/google-drive/callback'),
    redirectMatchesAppUrl:Boolean(config?.redirectUri === expectedRedirectUri),
    scopes:scopes.length === 1 && restrictedScope,
    testUsers:testUsers.length > 0 && testUsers.every(validEmail),
    verification:!restrictedScope || verificationStatus === 'approved',
    securityAssessment:!restrictedScope || securityAssessmentStatus === 'approved'
  };
  const sandboxChecks = ['clientId', 'clientIdFormat', 'clientSecret', 'clientSecretSafety', 'redirectUri', 'callbackPath', 'redirectMatchesAppUrl', 'scopes', 'testUsers'];
  return {
    configured:Boolean(config),
    redirectUri:config?.redirectUri || null, expectedRedirectUri,
    scopes, restrictedScope, verificationRequired:restrictedScope, verificationStatus,
    securityAssessmentStatus, testUserCount:testUsers.length,
    sandboxReady:sandboxChecks.every((check) => checks[check]),
    productionReady:Object.values(checks).every(Boolean), checks
  };
}

async function beginGoogleDriveOAuth(input) {
  const config = getOAuthConfig(true);
  const state = crypto.randomBytes(32).toString('base64url');
  const stateHash = hashState(state);
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);
  const payload = {
    name:String(input.name || 'Google Drive').trim().slice(0, 220),
    folderId:String(input.folderId || '').trim().slice(0, 220) || null,
    defaultStatus:String(input.defaultStatus || 'draft') === 'approved' ? 'approved' : 'draft',
    syncIntervalMinutes:Number(input.syncIntervalMinutes || 360)
  };
  if (!payload.name) throw httpError('Connector name is required', 400);
  if (!hasDatabaseConfig()) {
    demoStates.set(stateHash, { stateHash, provider:'google_drive', businessId:Number(input.businessId), userId:Number(input.actorUser.id), payload, expiresAt, usedAt:null });
  } else {
    await query(
      `insert into knowledge_connector_oauth_states (state_hash,provider,business_id,user_id,payload,expires_at)
       values (:stateHash,'google_drive',:businessId,:userId,:payload,:expiresAt)`,
      { stateHash, businessId:input.businessId, userId:input.actorUser.id, payload:JSON.stringify(payload), expiresAt }
    );
  }
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return { authorizationUrl:url.toString(), expiresAt:expiresAt.toISOString() };
}

async function completeGoogleDriveOAuth(input, fetchImpl = global.fetch) {
  if (input.error) throw httpError(`Google authorization was not completed: ${String(input.error).slice(0, 120)}`, 400);
  const code = String(input.code || '').trim();
  const state = String(input.state || '').trim();
  if (!code || !state) throw httpError('Google OAuth callback requires code and state', 400);
  const stored = await consumeState(state, input.businessId, input.actorUser?.id);
  const config = getOAuthConfig(true);
  const token = await postForm(fetchImpl, TOKEN_URL, {
    code, client_id:config.clientId, client_secret:config.clientSecret,
    redirect_uri:config.redirectUri, grant_type:'authorization_code'
  });
  if (!token.access_token || !token.refresh_token) throw httpError('Google did not return offline credentials. Reconnect and grant consent again.', 502);
  return {
    payload:stored.payload,
    credentials:{
      authMode:'oauth', accessToken:token.access_token, refreshToken:token.refresh_token,
      expiresAt:token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
      scope:String(token.scope || config.scopes.join(' ')), tokenType:String(token.token_type || 'Bearer')
    }
  };
}

async function revokeGoogleDriveCredentials(credentials, fetchImpl = global.fetch) {
  const token = credentials?.refreshToken || credentials?.accessToken;
  if (!token) return { revoked:false, reason:'no_token' };
  const response = await fetchImpl(REVOKE_URL, {
    method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body:new URLSearchParams({ token }).toString()
  });
  if (!response.ok) throw httpError(`Google token revocation returned HTTP ${response.status}`, 502);
  return { revoked:true };
}

async function consumeState(state, businessId, userId) {
  const stateHash = hashState(state);
  let stored;
  if (!hasDatabaseConfig()) {
    stored = demoStates.get(stateHash);
  } else {
    const rows = await query(
      `select state_hash as stateHash,business_id as businessId,user_id as userId,payload,expires_at as expiresAt,used_at as usedAt
       from knowledge_connector_oauth_states where state_hash=:stateHash and provider='google_drive' limit 1`,
      { stateHash }
    );
    stored = rows[0];
  }
  if (!stored || stored.usedAt || new Date(stored.expiresAt).getTime() <= Date.now()) throw httpError('Google OAuth state is invalid, expired, or already used', 400);
  if (Number(stored.businessId) !== Number(businessId) || Number(stored.userId) !== Number(userId)) throw httpError('Google OAuth state does not belong to this workspace session', 403);
  if (!hasDatabaseConfig()) stored.usedAt = new Date();
  else {
    const result = await query(
      `update knowledge_connector_oauth_states set used_at=current_timestamp
       where state_hash=:stateHash and used_at is null and expires_at>current_timestamp`,
      { stateHash }
    );
    if (!result.affectedRows) throw httpError('Google OAuth state is invalid, expired, or already used', 400);
  }
  return { ...stored, payload:parseJson(stored.payload, {}) };
}

async function postForm(fetchImpl, url, values) {
  const response = await fetchImpl(url, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams(values).toString() });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(`Google OAuth token exchange failed${result.error_description ? `: ${result.error_description}` : ''}`, 502);
  return result;
}

function getOAuthConfig(required) {
  const clientId = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    if (required) throw httpError('Google Drive OAuth is not configured for this platform', 503);
    return null;
  }
  const appUrl = normalizedAppUrl();
  const redirectUri = String(process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI || `${appUrl}/auth/google-drive/callback`).trim();
  const scopes = configuredScopes();
  return { clientId, clientSecret, redirectUri, scopes };
}

function configuredScopes() { return splitValues(process.env.GOOGLE_DRIVE_OAUTH_SCOPES || 'https://www.googleapis.com/auth/drive.readonly'); }
function normalizedAppUrl() { return String(process.env.APP_URL || 'http://localhost:3000').trim().replace(/\/$/, ''); }
function splitValues(value) { return String(value || '').split(/[\s,]+/).map((item) => item.trim()).filter(Boolean); }
function normalizeReadinessStatus(value) {
  const status = String(value || 'not_started').trim().toLowerCase();
  return ['not_started', 'in_progress', 'approved', 'not_required'].includes(status) ? status : 'not_started';
}
function validRedirectUri(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname); }
  catch { return false; }
}
function validGoogleClientId(value) { return /^[a-z0-9][a-z0-9._-]*\.apps\.googleusercontent\.com$/i.test(String(value || '')); }
function validCredentialValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.length >= 16 && !['replace-with', 'example', 'placeholder', 'change-me', 'client-secret'].some((marker) => normalized.includes(marker));
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }

function hashState(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function parseJson(value, fallback) { if (value && typeof value === 'object') return value; try { return JSON.parse(value); } catch { return fallback; } }
function httpError(message, status) { const error=new Error(message); error.status=status; return error; }

module.exports = { beginGoogleDriveOAuth, completeGoogleDriveOAuth, getGoogleDriveOAuthStatus, revokeGoogleDriveCredentials };
