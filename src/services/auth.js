const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');

const SESSION_COOKIE = 'chatclan_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const demoSessions = new Map();

const demoUser = {
  id: 1,
  businessId: 1,
  name: 'Admin User',
  email: 'admin@chatclan.co.za',
  role: 'owner',
  passwordHash: null
};
const demoUsers = new Map([[demoUser.email, demoUser]]);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt);
  return `scrypt:${salt}:${hash}`;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [scheme, salt, expected] = storedHash.split(':');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = await scrypt(password, salt);
  return timingSafeEqual(actual, expected);
}

async function authenticateUser(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!hasDatabaseConfig()) {
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD || 'ChangeMe123!';
    const user = demoUsers.get(normalizedEmail);
    if (!user || user.status === 'inactive') return null;
    const passwordOk = user.passwordHash ? await verifyPassword(password, user.passwordHash) : user.email === demoUser.email && password === demoPassword;
    return passwordOk ? user : null;
  }

  const rows = await query(
    `select u.id, u.name, u.email, u.password_hash as passwordHash,
            bm.business_id as businessId, bm.role
     from users u
     join business_memberships bm on bm.user_id = u.id
     where u.email = :email and u.status = 'active'
     order by bm.created_at asc
     limit 1`,
    { email: normalizedEmail }
  );

  const user = rows?.[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return user;
}

function listDemoUsersByBusiness(businessId) {
  return [...demoUsers.values()].filter((user) => Number(user.businessId) === Number(businessId));
}

function findDemoUserByEmail(email) {
  return demoUsers.get(String(email || '').trim().toLowerCase()) || null;
}

function findDemoUserById(userId) {
  return [...demoUsers.values()].find((user) => Number(user.id) === Number(userId)) || null;
}

function saveDemoUser(user) {
  const normalized = {
    ...user,
    email: String(user.email || '').trim().toLowerCase()
  };
  demoUsers.set(normalized.email, normalized);
  return normalized;
}

async function createSession(user, userAgent, ipAddress) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  if (hasDatabaseConfig()) {
    await query(
      `insert into sessions (id, user_id, business_id, user_agent, ip_address, expires_at)
       values (:id, :userId, :businessId, :userAgent, :ipAddress, :expiresAt)`,
      {
        id: sessionId,
        userId: user.id,
        businessId: user.businessId,
        userAgent: String(userAgent || '').slice(0, 255),
        ipAddress: String(ipAddress || '').slice(0, 64),
        expiresAt
      }
    );
  } else {
    demoSessions.set(sessionId, {
      id: sessionId,
      userId: user.id,
      businessId: user.businessId,
      user,
      expiresAt
    });
  }

  return { id: sessionId, expiresAt };
}

async function getSession(sessionId) {
  if (!sessionId) return null;

  if (!hasDatabaseConfig()) {
    const session = demoSessions.get(sessionId);
    if (!session || session.expiresAt < new Date()) {
      demoSessions.delete(sessionId);
      return null;
    }
    return session;
  }

  const rows = await query(
    `select s.id, s.business_id as businessId, s.expires_at as expiresAt,
            u.id as userId, u.name, u.email, bm.role
     from sessions s
     join users u on u.id = s.user_id
     join business_memberships bm on bm.user_id = u.id and bm.business_id = s.business_id
     where s.id = :id and s.expires_at > current_timestamp and u.status = 'active'
     limit 1`,
    { id: sessionId }
  );

  const row = rows?.[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    businessId: row.businessId,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      businessId: row.businessId,
      name: row.name,
      email: row.email,
      role: row.role
    }
  };
}

async function destroySession(sessionId) {
  if (!sessionId) return;
  if (!hasDatabaseConfig()) {
    demoSessions.delete(sessionId);
    return;
  }
  await query('delete from sessions where id = :id', { id: sessionId });
}

function signSessionId(sessionId) {
  const secret = getSessionSecret();
  const signature = crypto.createHmac('sha256', secret).update(sessionId).digest('base64url');
  return `${sessionId}.${signature}`;
}

function unsignSessionId(value) {
  if (!value || !value.includes('.')) return null;
  const [sessionId, signature] = value.split('.');
  const expected = signSessionId(sessionId).split('.')[1];
  return timingSafeEqual(signature, expected) ? sessionId : null;
}

function serializeSessionCookie(signedSessionId, expiresAt) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${signedSessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

function serializeClearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function parseCookies(header) {
  return Object.fromEntries(
    String(header || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return index === -1 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }
  return 'chatclan-local-development-session-secret';
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString('hex'));
    });
  });
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = {
  SESSION_COOKIE,
  authenticateUser,
  createSession,
  destroySession,
  findDemoUserByEmail,
  findDemoUserById,
  getSession,
  hashPassword,
  listDemoUsersByBusiness,
  parseCookies,
  serializeClearSessionCookie,
  serializeSessionCookie,
  saveDemoUser,
  signSessionId,
  unsignSessionId,
  verifyPassword
};
