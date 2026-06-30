const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { getCurrentSubscription } = require('./billing');
const { getPlan, limitLabel, normalizePlanCode } = require('./planCatalog');
const { listDemoUsersByBusiness } = require('./auth');
const { getDemoBusiness } = require('./demoStore');

const activeSubscriptionStatuses = new Set(['active', 'trialing']);
const resourceLimits = {
  contacts: 'contacts',
  campaigns: 'campaignsPerMonth',
  teamSeats: 'teamSeats',
  templates: 'templates',
  chatbotFlows: 'chatbotFlows'
};

async function getSubscriptionEntitlements(businessId) {
  const subscription = await getCurrentSubscription(businessId);
  const fallbackPlanCode = await getBusinessPlanCode(businessId);
  const plan = getPlan(subscription?.planCode || fallbackPlanCode || 'starter');
  const status = subscription?.status || (hasDatabaseConfig() ? 'not_subscribed' : 'active');
  const canUsePaidFeatures = !hasDatabaseConfig() || activeSubscriptionStatuses.has(status);

  return {
    businessId: Number(businessId),
    subscription,
    status,
    canUsePaidFeatures,
    plan: {
      code: plan.code,
      name: plan.name,
      amountCents: plan.amountCents,
      currency: 'ZAR',
      limits: plan.limits,
      features: plan.features
    }
  };
}

async function getPlanUsage(businessId) {
  const [contacts, campaignsThisMonth, teamSeats, templates, chatbotFlows] = await Promise.all([
    countResource(businessId, 'contacts'),
    countResource(businessId, 'campaigns'),
    countResource(businessId, 'teamSeats'),
    countResource(businessId, 'templates'),
    countResource(businessId, 'chatbotFlows')
  ]);
  return { contacts, campaignsThisMonth, teamSeats, templates, chatbotFlows };
}

async function getPlanStatus(businessId) {
  const entitlements = await getSubscriptionEntitlements(businessId);
  return {
    ...entitlements,
    usage: await getPlanUsage(businessId)
  };
}

async function enforcePlanLimit({ businessId, resource, requested = 1 }) {
  const entitlements = await getSubscriptionEntitlements(businessId);
  if (!entitlements.canUsePaidFeatures) {
    throwPlanError(
      `Subscription is ${entitlements.status}. Activate a plan before creating ${resource}.`,
      { resource, status: entitlements.status, plan: entitlements.plan }
    );
  }

  const limitKey = resourceLimits[resource];
  if (!limitKey) return entitlements;
  const limit = entitlements.plan.limits[limitKey];
  if (limit === null || limit === undefined) return entitlements;

  const used = await countResource(businessId, resource);
  const nextUsage = used + Number(requested || 0);
  if (nextUsage > limit) {
    throwPlanError(
      `${entitlements.plan.name} plan limit reached for ${humanResource(resource)} (${used}/${limitLabel(limit)} used). Upgrade to continue.`,
      { resource, used, requested: Number(requested || 0), limit, plan: entitlements.plan }
    );
  }
  return entitlements;
}

async function getBusinessPlanCode(businessId) {
  if (!hasDatabaseConfig()) return getDemoBusiness(businessId)?.planCode || 'growth';
  const rows = await query('select plan from businesses where id = :businessId limit 1', { businessId });
  return rows?.[0]?.plan ? normalizePlanCode(rows[0].plan) : 'starter';
}

async function countResource(businessId, resource) {
  if (!hasDatabaseConfig()) return countDemoResource(businessId, resource);
  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);

  const queries = {
    contacts: ['select count(*) as total from contacts where business_id = :businessId', {}],
    campaigns: ['select count(*) as total from campaigns where business_id = :businessId and created_at >= :monthStart', { monthStart: currentMonthStart }],
    teamSeats: [
      `select count(*) as total
       from business_memberships bm
       join users u on u.id = bm.user_id
       where bm.business_id = :businessId and u.status = 'active'`,
      {}
    ],
    templates: ['select count(*) as total from message_templates where business_id = :businessId', {}],
    chatbotFlows: ['select count(*) as total from chatbot_flows where business_id = :businessId', {}]
  };
  const queryDef = queries[resource];
  if (!queryDef) return 0;
  const [sql, params] = queryDef;
  const rows = await query(sql, { businessId, ...params });
  return Number(rows?.[0]?.total || 0);
}

function countDemoResource(businessId, resource) {
  const normalizedBusinessId = Number(businessId);
  if (resource === 'contacts') return demo.contacts.filter((item) => Number(item.businessId || 1) === normalizedBusinessId).length;
  if (resource === 'campaigns') return demo.campaigns.filter((item) => Number(item.businessId || 1) === normalizedBusinessId).length;
  if (resource === 'teamSeats') return listDemoUsersByBusiness(businessId).filter((item) => item.status !== 'inactive').length;
  if (resource === 'templates') return demo.templates.filter((item) => Number(item.businessId || 1) === normalizedBusinessId).length;
  if (resource === 'chatbotFlows') return 0;
  return 0;
}

function humanResource(resource) {
  return {
    contacts: 'contacts',
    campaigns: 'campaigns this month',
    teamSeats: 'team seats',
    templates: 'message templates',
    chatbotFlows: 'chatbot flows'
  }[resource] || resource;
}

function throwPlanError(message, details) {
  const error = new Error(message);
  error.status = 402;
  error.code = 'PLAN_LIMIT_REACHED';
  error.details = details;
  throw error;
}

module.exports = {
  enforcePlanLimit,
  getPlanStatus,
  getPlanUsage,
  getSubscriptionEntitlements
};
