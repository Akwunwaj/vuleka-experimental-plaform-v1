const currency = 'ZAR';

const plans = [
  {
    code: 'starter',
    name: 'Starter',
    amountCents: 29900,
    bestFor: 'New small businesses',
    limits: {
      contacts: 2000,
      campaignsPerMonth: 5,
      teamSeats: 2,
      templates: 25,
      chatbotFlows: 3,
      whatsappNumbers: 1,
      dispatchPerMinute: 40
    },
    features: {
      apiAccess: false,
      advancedAutomations: false,
      prioritySupport: false
    }
  },
  {
    code: 'growth',
    name: 'Growth',
    amountCents: 79900,
    bestFor: 'Growing stores and service teams',
    limits: {
      contacts: 10000,
      campaignsPerMonth: null,
      teamSeats: 5,
      templates: 100,
      chatbotFlows: 15,
      whatsappNumbers: 3,
      dispatchPerMinute: 120
    },
    features: {
      apiAccess: false,
      advancedAutomations: true,
      prioritySupport: true
    }
  },
  {
    code: 'pro',
    name: 'Pro',
    amountCents: 199900,
    bestFor: 'Agencies and multi-branch teams',
    limits: {
      contacts: null,
      campaignsPerMonth: null,
      teamSeats: null,
      templates: null,
      chatbotFlows: null,
      whatsappNumbers: null,
      dispatchPerMinute: 300
    },
    features: {
      apiAccess: true,
      advancedAutomations: true,
      prioritySupport: true
    }
  }
];

function listPlans() {
  return plans.map((plan) => ({ ...plan, limits: { ...plan.limits }, features: { ...plan.features } }));
}

function getPlan(planCode) {
  const normalized = normalizePlanCode(planCode);
  const plan = plans.find((item) => item.code === normalized || item.name.toLowerCase() === normalized);
  if (!plan) {
    const error = new Error('Unknown billing plan');
    error.status = 400;
    throw error;
  }
  return { ...plan, limits: { ...plan.limits }, features: { ...plan.features } };
}

function publicPlan(plan) {
  const normalized = getPlan(plan.code || plan.name);
  return {
    ...normalized,
    amount: centsToRand(normalized.amountCents),
    currency,
    campaigns: limitLabel(normalized.limits.campaignsPerMonth, '/month'),
    contactsLimit: normalized.limits.contacts ?? 1000000
  };
}

function normalizePlanCode(planCode) {
  return String(planCode || 'starter').trim().toLowerCase();
}

function limitLabel(limit, suffix = '') {
  return limit === null ? 'Unlimited' : `${Number(limit).toLocaleString('en-ZA')}${suffix}`;
}

function centsToRand(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

module.exports = {
  currency,
  getPlan,
  limitLabel,
  listPlans,
  normalizePlanCode,
  publicPlan
};
