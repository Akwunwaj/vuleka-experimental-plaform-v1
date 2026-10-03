const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');
const { parseCookies, verifyPassword } = require('./auth');

const PLATFORM_SESSION_COOKIE = 'chatclan_platform_session';
const PLATFORM_SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const demoPlatformSessions = new Map();

const demoPlatformUser = {
  id: 1,
  name: 'Platform Owner',
  email: 'owner@chatclan.co.za',
  role: 'owner',
  status: 'active',
  passwordHash: null
};

async function authenticatePlatformUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!hasDatabaseConfig()) {
    const passwordOk = normalizedEmail === demoPlatformUser.email && password === demoPlatformPassword();
    return passwordOk ? { ...demoPlatformUser } : null;
  }

  const rows = await query(
    `select id, name, email, password_hash as passwordHash, role, status
     from platform_users
     where email = :email and status = 'active'
     limit 1`,
    { email: normalizedEmail }
  );
  const user = rows?.[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return normalizePlatformUser(user);
}

async function createPlatformSession(user, userAgent, ipAddress) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PLATFORM_SESSION_TTL_MS);

  if (!hasDatabaseConfig()) {
    demoPlatformSessions.set(sessionId, {
      id: sessionId,
      platformUserId: user.id,
      user: normalizePlatformUser(user),
      expiresAt
    });
    return { id: sessionId, expiresAt };
  }

  await query(
    `insert into platform_sessions (id, platform_user_id, user_agent, ip_address, expires_at)
     values (:id, :platformUserId, :userAgent, :ipAddress, :expiresAt)`,
    {
      id: sessionId,
      platformUserId: user.id,
      userAgent: String(userAgent || '').slice(0, 255),
      ipAddress: String(ipAddress || '').slice(0, 64),
      expiresAt
    }
  );

  return { id: sessionId, expiresAt };
}

async function getPlatformSession(sessionId) {
  if (!sessionId) return null;

  if (!hasDatabaseConfig()) {
    const session = demoPlatformSessions.get(sessionId);
    if (!session || session.expiresAt < new Date()) {
      demoPlatformSessions.delete(sessionId);
      return null;
    }
    return session;
  }

  const rows = await query(
    `select s.id, s.expires_at as expiresAt,
            u.id as platformUserId, u.name, u.email, u.role
     from platform_sessions s
     join platform_users u on u.id = s.platform_user_id
     where s.id = :id and s.expires_at > current_timestamp and u.status = 'active'
     limit 1`,
    { id: sessionId }
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    id: row.id,
    platformUserId: row.platformUserId,
    expiresAt: row.expiresAt,
    user: normalizePlatformUser({
      id: row.platformUserId,
      name: row.name,
      email: row.email,
      role: row.role
    })
  };
}

async function destroyPlatformSession(sessionId) {
  if (!sessionId) return;
  if (!hasDatabaseConfig()) {
    demoPlatformSessions.delete(sessionId);
    return;
  }
  await query('delete from platform_sessions where id = :id', { id: sessionId });
}

async function listPlatformUsers() {
  if (!hasDatabaseConfig()) return [{ ...demoPlatformUser, passwordHash:undefined }];
  const rows = await query(
    `select id, name, email, role, status from platform_users
     where status = 'active' order by case role when 'owner' then 0 else 1 end, name asc`
  );
  return rows.map(normalizePlatformUser);
}

function signPlatformSessionId(sessionId) {
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(sessionId).digest('base64url');
  return `${sessionId}.${signature}`;
}

function unsignPlatformSessionId(value) {
  if (!value || !value.includes('.')) return null;
  const [sessionId, signature] = value.split('.');
  const expected = signPlatformSessionId(sessionId).split('.')[1];
  return timingSafeEqual(signature, expected) ? sessionId : null;
}

function serializePlatformSessionCookie(signedSessionId, expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${PLATFORM_SESSION_COOKIE}=${signedSessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

function serializeClearPlatformSessionCookie() {
  return `${PLATFORM_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function readSignedPlatformSessionId(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  return unsignPlatformSessionId(cookies[PLATFORM_SESSION_COOKIE]);
}

function normalizePlatformUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'operator'
  };
}

function demoPlatformPassword() {
  return process.env.PLATFORM_OWNER_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || 'ChangeMe123!';
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }
  return 'chatclan-local-development-session-secret';
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = {
  PLATFORM_SESSION_COOKIE,
  authenticatePlatformUser,
  createPlatformSession,
  destroyPlatformSession,
  getPlatformSession,
  listPlatformUsers,
  readSignedPlatformSessionId,
  serializeClearPlatformSessionCookie,
  serializePlatformSessionCookie,
  signPlatformSessionId,
  unsignPlatformSessionId
};
