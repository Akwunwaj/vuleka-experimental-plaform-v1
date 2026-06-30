const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');
const {
  findDemoUserByEmail,
  findDemoUserById,
  hashPassword,
  listDemoUsersByBusiness,
  saveDemoUser
} = require('./auth');
const { sendPasswordResetEmail, sendTeamInviteEmail } = require('./mailer');
const { enforcePlanLimit } = require('./subscriptionPolicy');

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;
const demoResetTokens = new Map();
const roles = new Set(['owner', 'admin', 'agent', 'viewer']);

async function listBusinessUsers(businessId) {
  if (!hasDatabaseConfig()) {
    return listDemoUsersByBusiness(businessId).map(publicUser);
  }

  const rows = await query(
    `select u.id, u.name, u.email, u.status, bm.role, u.created_at as createdAt
     from users u
     join business_memberships bm on bm.user_id = u.id
     where bm.business_id = :businessId
     order by bm.role = 'owner' desc, u.name asc`,
    { businessId }
  );

  return rows.map(publicUser);
}

async function createBusinessUser({ businessId, name, email, role = 'agent', password = null }) {
  const normalized = validateUserInput({ name, email, role });
  const temporaryPassword = password || generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  if (!hasDatabaseConfig()) {
    const existing = findDemoUserByEmail(normalized.email);
    if (existing && Number(existing.businessId) !== Number(businessId)) {
      throwConflict('A user with this email already belongs to another workspace');
    }
    if (!existing) await enforcePlanLimit({ businessId, resource: 'teamSeats', requested: 1 });
    const user = saveDemoUser({
      id: existing?.id || Date.now(),
      businessId,
      name: normalized.name,
      email: normalized.email,
      role: normalized.role,
      status: 'active',
      passwordHash
    });
    const delivery = await sendTeamInviteEmail({
      to: normalized.email,
      name: normalized.name,
      role: normalized.role,
      temporaryPassword
    });
    return withLocalSecret({ ...publicUser(user), emailDelivery: delivery }, temporaryPassword, 'temporaryPassword');
  }

  const existingRows = await query('select id from users where email = :email limit 1', { email: normalized.email });
  let userId = existingRows?.[0]?.id;
  let existingMembership = false;
  if (userId) {
    const membershipRows = await query(
      'select id from business_memberships where business_id = :businessId and user_id = :userId limit 1',
      { businessId, userId }
    );
    existingMembership = Boolean(membershipRows?.length);
  }

  if (!existingMembership) await enforcePlanLimit({ businessId, resource: 'teamSeats', requested: 1 });

  if (!userId) {
    const result = await query(
      `insert into users (name, email, password_hash, status)
       values (:name, :email, :passwordHash, 'active')`,
      { ...normalized, passwordHash }
    );
    userId = result.insertId;
  } else {
    await query(
      `update users
       set name = :name, password_hash = :passwordHash, status = 'active'
       where id = :userId`,
      { userId, name: normalized.name, passwordHash }
    );
  }

  await query(
    `insert into business_memberships (business_id, user_id, role)
     values (:businessId, :userId, :role)
     on duplicate key update role = values(role)`,
    { businessId, userId, role: normalized.role }
  );

  const delivery = await sendTeamInviteEmail({
    to: normalized.email,
    name: normalized.name,
    role: normalized.role,
    temporaryPassword
  });

  return withLocalSecret(
    {
      id: userId,
      businessId,
      name: normalized.name,
      email: normalized.email,
      role: normalized.role,
      status: 'active',
      emailDelivery: delivery
    },
    temporaryPassword,
    'temporaryPassword'
  );
}

async function updateBusinessUserRole({ businessId, userId, role, actorUserId }) {
  const normalizedRole = normalizeRole(role);
  if (Number(userId) === Number(actorUserId) && normalizedRole !== 'owner') {
    const error = new Error('Owners cannot demote their own account');
    error.status = 400;
    throw error;
  }

  if (!hasDatabaseConfig()) {
    const user = findDemoUserById(userId);
    if (!user || Number(user.businessId) !== Number(businessId)) notFound();
    user.role = normalizedRole;
    saveDemoUser(user);
    return publicUser(user);
  }

  const result = await query(
    `update business_memberships
     set role = :role
     where business_id = :businessId and user_id = :userId`,
    { businessId, userId, role: normalizedRole }
  );
  if (!result.affectedRows) notFound();
  return (await listBusinessUsers(businessId)).find((user) => Number(user.id) === Number(userId));
}

async function deactivateBusinessUser({ businessId, userId, actorUserId }) {
  if (Number(userId) === Number(actorUserId)) {
    const error = new Error('You cannot deactivate your own account');
    error.status = 400;
    throw error;
  }

  if (!hasDatabaseConfig()) {
    const user = findDemoUserById(userId);
    if (!user || Number(user.businessId) !== Number(businessId)) notFound();
    user.status = 'inactive';
    saveDemoUser(user);
    return publicUser(user);
  }

  const rows = await query(
    `select u.id
     from users u
     join business_memberships bm on bm.user_id = u.id
     where bm.business_id = :businessId and u.id = :userId
     limit 1`,
    { businessId, userId }
  );
  if (!rows?.length) notFound();

  await query('update users set status = "inactive" where id = :userId', { userId });
  await query('delete from sessions where user_id = :userId and business_id = :businessId', { userId, businessId });
  return (await listBusinessUsers(businessId)).find((user) => Number(user.id) === Number(userId)) || { id: Number(userId), status: 'inactive' };
}

async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  let user = null;

  if (!hasDatabaseConfig()) {
    user = findDemoUserByEmail(normalizedEmail);
    if (user) {
      demoResetTokens.set(tokenHash, {
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null
      });
      const delivery = await sendPasswordResetEmail({
        to: normalizedEmail,
        name: user.name,
        token
      });
      return withLocalSecret({ ok: true, emailDelivery: delivery }, token, 'resetToken');
    }
    return { ok: true };
  }

  const rows = await query('select id, name from users where email = :email and status = "active" limit 1', { email: normalizedEmail });
  user = rows?.[0];
  if (user) {
    await query(
      `insert into password_reset_tokens (user_id, token_hash, expires_at)
       values (:userId, :tokenHash, :expiresAt)`,
      { userId: user.id, tokenHash, expiresAt }
    );
    const delivery = await sendPasswordResetEmail({
      to: normalizedEmail,
      name: user.name,
      token
    });
    return withLocalSecret({ ok: true, emailDelivery: delivery }, token, 'resetToken');
  }

  return { ok: true };
}

async function resetPassword({ token, password }) {
  if (!isStrongEnoughPassword(password)) {
    const error = new Error('Password must be at least 10 characters');
    error.status = 400;
    throw error;
  }

  const tokenHash = hashResetToken(token);
  const passwordHash = await hashPassword(password);

  if (!hasDatabaseConfig()) {
    const reset = demoResetTokens.get(tokenHash);
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) invalidResetToken();
    const user = findDemoUserById(reset.userId);
    if (!user) invalidResetToken();
    user.passwordHash = passwordHash;
    user.status = 'active';
    saveDemoUser(user);
    reset.usedAt = new Date();
    return { ok: true };
  }

  const rows = await query(
    `select prt.id, prt.user_id as userId
     from password_reset_tokens prt
     join users u on u.id = prt.user_id
     where prt.token_hash = :tokenHash
       and prt.used_at is null
       and prt.expires_at > current_timestamp
       and u.status = 'active'
     limit 1`,
    { tokenHash }
  );
  const reset = rows?.[0];
  if (!reset) invalidResetToken();

  await query('update users set password_hash = :passwordHash where id = :userId', { userId: reset.userId, passwordHash });
  await query('update password_reset_tokens set used_at = current_timestamp where id = :id', { id: reset.id });
  await query('delete from sessions where user_id = :userId', { userId: reset.userId });
  return { ok: true };
}

function validateUserInput({ name, email, role }) {
  const normalized = {
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    role: normalizeRole(role)
  };

  if (!normalized.name) required('name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized.email)) {
    const error = new Error('A valid email is required');
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeRole(role) {
  const normalizedRole = String(role || 'agent').trim().toLowerCase();
  if (!roles.has(normalizedRole)) {
    const error = new Error('role must be owner, admin, agent, or viewer');
    error.status = 400;
    throw error;
  }
  return normalizedRole;
}

function isStrongEnoughPassword(password) {
  return String(password || '').length >= 10;
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function generateTemporaryPassword() {
  return `Cc-${crypto.randomBytes(9).toString('base64url')}!`;
}

function withLocalSecret(payload, secret, key) {
  if (!secret || process.env.NODE_ENV === 'production') return payload;
  return { ...payload, [key]: secret };
}

function publicUser(user) {
  return {
    id: user.id,
    businessId: user.businessId,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status || 'active',
    createdAt: user.createdAt || user.created_at || null
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

function notFound() {
  const error = new Error('User not found');
  error.status = 404;
  throw error;
}

function invalidResetToken() {
  const error = new Error('Password reset link is invalid or expired');
  error.status = 400;
  throw error;
}

module.exports = {
  createBusinessUser,
  deactivateBusinessUser,
  listBusinessUsers,
  requestPasswordReset,
  resetPassword,
  updateBusinessUserRole
};
