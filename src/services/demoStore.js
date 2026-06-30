const demo = require('../data/demoData');

const demoBusinesses = new Map([[Number(demo.business.id), { ...demo.business, planCode: 'growth' }]]);
let nextBusinessId = 100;

function createDemoBusiness({ name, planCode = 'starter' }) {
  const business = {
    id: nextBusinessId++,
    name,
    plan: planCode,
    planCode,
    contactsLimit: 0,
    contactsUsed: 0,
    billingRenewal: 'Trial'
  };
  demoBusinesses.set(Number(business.id), business);
  return { ...business };
}

function getDemoBusiness(businessId) {
  const business = demoBusinesses.get(Number(businessId));
  return business ? { ...business } : null;
}

function setDemoBusinessPlan(businessId, planCode) {
  const business = demoBusinesses.get(Number(businessId));
  if (!business) return null;
  business.plan = planCode;
  business.planCode = planCode;
  demoBusinesses.set(Number(businessId), business);
  return { ...business };
}

module.exports = {
  createDemoBusiness,
  getDemoBusiness,
  setDemoBusinessPlan
};
