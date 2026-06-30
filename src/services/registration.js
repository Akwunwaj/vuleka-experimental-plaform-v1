const { hasDatabaseConfig, query, transaction } = require('../db/pool');
const { createTrialSubscription } = require('./billing');
const { createDemoBusiness } = require('./demoStore');
const { findDemoUserByEmail, hashPassword, saveDemoUser } = require('./auth');
const { getPlan } = require('./planCatalog');

async function registerProspect({ businessName, ownerName, email, password, planCode = 'starter' }) {
  const input = validateSignupInput({ businessName, ownerName, email, password, planCode });
  const passwordHash = await hashPassword(input.password);

  if (!hasDatabaseConfig()) {
    if (findDemoUserByEmail(input.email)) throwConflict('A user with this email already exists');
    const business = createDemoBusiness({ name: input.businessName, planCode: input.plan.code });
    const user = saveDemoUser({
      id: Date.now(),
      businessId: business.id,
      name: input.ownerName,
      email: input.email,
      role: 'owner',
      status: 'active',
      passwordHash
    });
    const subscription = await createTrialSubscription({ businessId: business.id, planCode: input.plan.code });
    return { business, user: publicOwner(user), subscription };
  }

  return transaction(async (db) => {
    const existing = await db.query('select id from users where email = :email limit 1', { email: input.email });
    if (existing?.length) throwConflict('A user with this email already exists');

    const businessResult = await db.query(
      `insert into businesses (name, plan)
       values (:name, :planCode)`,
      { name: input.businessName, planCode: input.plan.code }
    );
    const businessId = businessResult.insertId;

    const userResult = await db.query(
      `insert into users (name, email, password_hash, status)
       values (:name, :email, :passwordHash, 'active')`,
      {
        name: input.ownerName,
        email: input.email,
        passwordHash
      }
    );
    const userId = userResult.insertId;

    await db.query(
      `insert into business_memberships (business_id, user_id, role)
       values (:businessId, :userId, 'owner')`,
      { businessId, userId }
    );

    const subscription = await createTrialSubscription({ businessId, planCode: input.plan.code, db });
    return {
      business: {
        id: businessId,
        name: input.businessName,
        planCode: input.plan.code
      },
      user: {
        id: userId,
        businessId,
        name: input.ownerName,
        email: input.email,
        role: 'owner',
        status: 'active'
      },
      subscription
    };
  });
}

function validateSignupInput({ businessName, ownerName, email, password, planCode }) {
  const normalized = {
    businessName: String(businessName || '').trim(),
    ownerName: String(ownerName || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
    plan: getPlan(planCode || 'starter')
  };

  if (!normalized.businessName) required('businessName');
  if (!normalized.ownerName) required('ownerName');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized.email)) {
    const error = new Error('A valid email is required');
    error.status = 400;
    throw error;
  }
  if (normalized.password.length < 10) {
    const error = new Error('Password must be at least 10 characters');
    error.status = 400;
    throw error;
  }
  return normalized;
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
  registerProspect
};
