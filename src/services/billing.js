const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');
const { brand } = require('../config/app');
const { currency, getPlan, listPlans, publicPlan } = require('./planCatalog');
const { setDemoBusinessPlan } = require('./demoStore');
const { payFastProcessUrl, signPayFastData } = require('./payfast');

const payFastMonthlyFrequency = '3';
const demoSubscriptions = new Map();
const demoInvoices = new Map();
const demoBillingEvents = [];
let demoSubscriptionId = 1000;
let demoInvoiceId = 1000;

async function listBillingPlans() {
  return listPlans().map(publicPlan);
}

async function getBillingOverview(businessId) {
  const subscription = await getCurrentSubscription(businessId);
  const invoices = await listInvoices(businessId);
  return {
    plans: await listBillingPlans(),
    subscription,
    invoices
  };
}

async function createPayFastCheckout({ businessId, planCode, user }) {
  const plan = getPlan(planCode);
  const merchantPaymentId = `cc_${businessId}_${plan.code}_${crypto.randomBytes(6).toString('hex')}`;
  const billingDate = nextBillingDate();
  const amount = centsToRand(plan.amountCents);
  const fields = {
    merchant_id: merchantId(),
    merchant_key: merchantKey(),
    return_url: `${appUrl()}/billing/success`,
    cancel_url: `${appUrl()}/billing/cancel`,
    notify_url: `${appUrl()}/webhooks/payfast/itn`,
    name_first: firstName(user?.name),
    email_address: user?.email || '',
    m_payment_id: merchantPaymentId,
    amount,
    item_name: `${brand.name} ${plan.name} Plan`,
    item_description: `Monthly ${brand.name} ${plan.name} subscription`,
    subscription_type: '1',
    billing_date: billingDate,
    recurring_amount: amount,
    frequency: payFastMonthlyFrequency,
    cycles: '0',
    custom_int1: String(businessId),
    custom_str1: plan.code
  };
  fields.signature = signPayFastData(fields);

  const subscription = await upsertPendingSubscription({
    businessId,
    plan,
    merchantPaymentId,
    billingDate
  });

  return {
    provider: 'payfast',
    mode: process.env.PAYFAST_ENV === 'live' ? 'live' : 'sandbox',
    actionUrl: payFastProcessUrl(),
    method: 'POST',
    fields,
    subscription
  };
}

async function createTrialSubscription({ businessId, planCode = 'starter', days = 14, db = null }) {
  const plan = getPlan(planCode);
  const periodStart = new Date();
  const periodEnd = addDays(periodStart, days);
  const merchantPaymentId = `trial_${businessId}_${plan.code}_${crypto.randomBytes(6).toString('hex')}`;

  if (!hasDatabaseConfig()) {
    setDemoBusinessPlan(businessId, plan.code);
    const subscription = normalizeSubscription({
      id: nextDemoSubscriptionId(),
      businessId,
      planCode: plan.code,
      provider: 'trial',
      providerSubscriptionToken: null,
      merchantPaymentId,
      status: 'trialing',
      amountCents: plan.amountCents,
      currency,
      billingFrequency: 'monthly',
      nextBillingDate: isoDate(periodEnd),
      currentPeriodStartedAt: periodStart.toISOString(),
      currentPeriodEndsAt: periodEnd.toISOString(),
      createdAt: periodStart.toISOString(),
      updatedAt: periodStart.toISOString()
    });
    demoSubscriptions.set(String(businessId), subscription);
    return subscription;
  }

  const executor = db || { query };
  const result = await executor.query(
    `insert into business_subscriptions
       (business_id, plan_code, provider, merchant_payment_id, status, amount_cents, currency, billing_frequency, next_billing_date, current_period_started_at, current_period_ends_at)
     values
       (:businessId, :planCode, 'trial', :merchantPaymentId, 'trialing', :amountCents, :currency, 'monthly', :nextBillingDate, :periodStart, :periodEnd)`,
    {
      businessId,
      planCode: plan.code,
      merchantPaymentId,
      amountCents: plan.amountCents,
      currency,
      nextBillingDate: isoDate(periodEnd),
      periodStart,
      periodEnd
    }
  );

  return normalizeSubscription({
    id: result.insertId,
    businessId,
    planCode: plan.code,
    provider: 'trial',
    merchantPaymentId,
    status: 'trialing',
    amountCents: plan.amountCents,
    currency,
    billingFrequency: 'monthly',
    nextBillingDate: isoDate(periodEnd),
    currentPeriodStartedAt: periodStart,
    currentPeriodEndsAt: periodEnd
  });
}

async function processPayFastItn({ summary, checks = {}, raw = {} }) {
  const merchantPaymentId = summary?.merchantPaymentId || raw.m_payment_id;
  const planCode = raw.custom_str1;
  const businessId = Number(raw.custom_int1 || merchantPaymentIdParts(merchantPaymentId).businessId || 0);
  const plan = getPlan(planCode || merchantPaymentIdParts(merchantPaymentId).planCode);
  const amountCents = randToCents(summary?.amountGross || raw.amount_gross);
  const expectedAmountCents = plan.amountCents;
  const event = {
    provider: 'payfast',
    providerPaymentId: summary?.paymentId || raw.pf_payment_id || null,
    merchantPaymentId,
    eventType: summary?.paymentStatus || raw.payment_status || 'UNKNOWN',
    raw,
    checks,
    processedAt: new Date()
  };

  if (!merchantPaymentId || !businessId) {
    return recordBillingEvent({
      ...event,
      businessId: businessId || null,
      status: 'ignored',
      reason: 'missing business or merchant payment id'
    });
  }

  if (!checks.signature?.ok) {
    return recordBillingEvent({
      ...event,
      businessId,
      status: 'rejected',
      reason: 'invalid PayFast signature'
    });
  }

  if (process.env.PAYFAST_CONFIRM_SERVER === 'true' && checks.serverConfirmation?.ok !== true) {
    return recordBillingEvent({
      ...event,
      businessId,
      status: 'rejected',
      reason: 'PayFast server confirmation failed'
    });
  }

  if (amountCents !== expectedAmountCents) {
    await markSubscriptionStatus({ businessId, merchantPaymentId, status: 'past_due' });
    return recordBillingEvent({
      ...event,
      businessId,
      status: 'rejected',
      reason: `expected ${expectedAmountCents} cents, received ${amountCents} cents`
    });
  }

  const paymentStatus = String(summary?.paymentStatus || raw.payment_status || '').toUpperCase();
  if (paymentStatus === 'COMPLETE') {
    const subscription = await activateSubscription({
      businessId,
      plan,
      merchantPaymentId,
      providerPaymentId: summary?.paymentId || raw.pf_payment_id || null,
      token: summary?.token || raw.token || null
    });
    const invoice = await recordInvoice({
      businessId,
      plan,
      merchantPaymentId,
      providerPaymentId: summary?.paymentId || raw.pf_payment_id || null,
      amountCents,
      status: 'paid'
    });
    await recordBillingEvent({ ...event, businessId, status: 'processed', reason: 'payment complete' });
    return { status: 'processed', subscription, invoice };
  }

  const failedStatus = paymentStatus === 'FAILED' ? 'past_due' : 'canceled';
  const subscription = await markSubscriptionStatus({ businessId, merchantPaymentId, status: failedStatus });
  await recordInvoice({
    businessId,
    plan,
    merchantPaymentId,
    providerPaymentId: summary?.paymentId || raw.pf_payment_id || null,
    amountCents,
    status: failedStatus === 'past_due' ? 'failed' : 'void'
  });
  await recordBillingEvent({ ...event, businessId, status: 'processed', reason: `payment ${paymentStatus || 'not complete'}` });
  return { status: 'processed', subscription };
}

async function getCurrentSubscription(businessId) {
  if (!hasDatabaseConfig()) {
    seedDemoSubscription(businessId);
    return demoSubscriptions.get(String(businessId));
  }

  const rows = await query(
    `select id, business_id as businessId, plan_code as planCode, provider,
            provider_subscription_token as providerSubscriptionToken,
            merchant_payment_id as merchantPaymentId, status, amount_cents as amountCents,
            currency, billing_frequency as billingFrequency,
            next_billing_date as nextBillingDate, current_period_started_at as currentPeriodStartedAt,
            current_period_ends_at as currentPeriodEndsAt, created_at as createdAt, updated_at as updatedAt
     from business_subscriptions
     where business_id = :businessId
     order by case
                when status in ('active', 'trialing') then 0
                when status = 'pending' then 1
                else 2
              end,
              updated_at desc,
              id desc
     limit 1`,
    { businessId }
  );

  return rows?.[0] ? normalizeSubscription(rows[0]) : null;
}

async function listInvoices(businessId) {
  if (!hasDatabaseConfig()) {
    return [...(demoInvoices.get(String(businessId)) || [])].sort((a, b) => String(b.issuedOn).localeCompare(String(a.issuedOn)));
  }

  const rows = await query(
    `select id, business_id as businessId, invoice_number as invoiceNumber,
            provider, provider_payment_id as providerPaymentId,
            merchant_payment_id as merchantPaymentId, amount_cents as amountCents,
            currency, status, issued_on as issuedOn, due_on as dueOn, paid_at as paidAt
     from invoices
     where business_id = :businessId
     order by issued_on desc, id desc
     limit 100`,
    { businessId }
  );

  return rows.map(normalizeInvoice);
}

async function upsertPendingSubscription({ businessId, plan, merchantPaymentId, billingDate }) {
  if (!hasDatabaseConfig()) {
    const subscription = normalizeSubscription({
      id: nextDemoSubscriptionId(),
      businessId,
      planCode: plan.code,
      provider: 'payfast',
      providerSubscriptionToken: null,
      merchantPaymentId,
      status: 'pending',
      amountCents: plan.amountCents,
      currency,
      billingFrequency: 'monthly',
      nextBillingDate: billingDate,
      currentPeriodStartedAt: null,
      currentPeriodEndsAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    demoSubscriptions.set(String(businessId), subscription);
    return subscription;
  }

  const result = await query(
    `insert into business_subscriptions
       (business_id, plan_code, provider, merchant_payment_id, status, amount_cents, currency, billing_frequency, next_billing_date)
     values
       (:businessId, :planCode, 'payfast', :merchantPaymentId, 'pending', :amountCents, :currency, 'monthly', :nextBillingDate)`,
    {
      businessId,
      planCode: plan.code,
      merchantPaymentId,
      amountCents: plan.amountCents,
      currency,
      nextBillingDate: billingDate
    }
  );

  return normalizeSubscription({
    id: result.insertId,
    businessId,
    planCode: plan.code,
    provider: 'payfast',
    merchantPaymentId,
    status: 'pending',
    amountCents: plan.amountCents,
    currency,
    billingFrequency: 'monthly',
    nextBillingDate: billingDate
  });
}

async function activateSubscription({ businessId, plan, merchantPaymentId, providerPaymentId, token }) {
  const periodStart = new Date();
  const periodEnd = addMonths(periodStart, 1);
  const nextBilling = isoDate(periodEnd);

  if (!hasDatabaseConfig()) {
    const existing = demoSubscriptions.get(String(businessId));
    const subscription = normalizeSubscription({
      ...(existing || {}),
      id: existing?.id || nextDemoSubscriptionId(),
      businessId,
      planCode: plan.code,
      provider: 'payfast',
      providerSubscriptionToken: token,
      merchantPaymentId,
      providerPaymentId,
      status: 'active',
      amountCents: plan.amountCents,
      currency,
      billingFrequency: 'monthly',
      nextBillingDate: nextBilling,
      currentPeriodStartedAt: periodStart.toISOString(),
      currentPeriodEndsAt: periodEnd.toISOString(),
      updatedAt: new Date().toISOString()
    });
    demoSubscriptions.set(String(businessId), subscription);
    return subscription;
  }

  await query(
    `update business_subscriptions
     set status = 'active',
         plan_code = :planCode,
         provider_subscription_token = :token,
         amount_cents = :amountCents,
         next_billing_date = :nextBillingDate,
         current_period_started_at = :periodStart,
         current_period_ends_at = :periodEnd
     where business_id = :businessId and merchant_payment_id = :merchantPaymentId`,
    {
      businessId,
      merchantPaymentId,
      planCode: plan.code,
      token,
      amountCents: plan.amountCents,
      nextBillingDate: nextBilling,
      periodStart,
      periodEnd
    }
  );
  await query('update businesses set plan = :planName where id = :businessId', { businessId, planName: plan.name });
  return getCurrentSubscription(businessId);
}

async function markSubscriptionStatus({ businessId, merchantPaymentId, status }) {
  if (!hasDatabaseConfig()) {
    const subscription = demoSubscriptions.get(String(businessId));
    if (subscription) {
      subscription.status = status;
      subscription.updatedAt = new Date().toISOString();
    }
    return subscription || null;
  }

  await query(
    `update business_subscriptions
     set status = :status,
         canceled_at = case when :status = 'canceled' then current_timestamp else canceled_at end
     where business_id = :businessId and merchant_payment_id = :merchantPaymentId`,
    { businessId, merchantPaymentId, status }
  );
  return getCurrentSubscription(businessId);
}

async function recordInvoice({ businessId, plan, merchantPaymentId, providerPaymentId, amountCents, status }) {
  const issuedOn = isoDate(new Date());
  const invoice = normalizeInvoice({
    id: nextDemoInvoiceId(),
    businessId,
    invoiceNumber: `CC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    provider: 'payfast',
    providerPaymentId,
    merchantPaymentId,
    amountCents,
    currency,
    status,
    issuedOn,
    dueOn: issuedOn,
    paidAt: status === 'paid' ? new Date().toISOString() : null,
    metadata: { planCode: plan.code }
  });

  if (!hasDatabaseConfig()) {
    const invoices = demoInvoices.get(String(businessId)) || [];
    invoices.unshift(invoice);
    demoInvoices.set(String(businessId), invoices);
    return invoice;
  }

  const result = await query(
    `insert into invoices
       (business_id, invoice_number, provider, provider_payment_id, merchant_payment_id, amount_cents, currency, status, issued_on, due_on, paid_at, metadata)
     values
       (:businessId, :invoiceNumber, 'payfast', :providerPaymentId, :merchantPaymentId, :amountCents, :currency, :status, :issuedOn, :dueOn, :paidAt, :metadata)
     on duplicate key update
       status = values(status),
       paid_at = values(paid_at),
       metadata = values(metadata)`,
    {
      ...invoice,
      metadata: JSON.stringify(invoice.metadata || {})
    }
  );

  return { ...invoice, id: result.insertId || invoice.id };
}

async function recordBillingEvent(event) {
  const stored = {
    id: demoBillingEvents.length + 1,
    businessId: event.businessId,
    provider: event.provider || 'payfast',
    providerPaymentId: event.providerPaymentId || null,
    merchantPaymentId: event.merchantPaymentId || null,
    eventType: event.eventType || null,
    status: event.status || 'recorded',
    reason: event.reason || null,
    payload: event.raw || {},
    checks: event.checks || {},
    processedAt: (event.processedAt || new Date()).toISOString?.() || event.processedAt
  };

  if (!hasDatabaseConfig()) {
    demoBillingEvents.push(stored);
    return stored;
  }

  const result = await query(
    `insert into billing_events
       (business_id, provider, provider_payment_id, merchant_payment_id, event_type, status, reason, payload, checks, processed_at)
     values
       (:businessId, :provider, :providerPaymentId, :merchantPaymentId, :eventType, :status, :reason, :payload, :checks, current_timestamp)`,
    {
      ...stored,
      payload: JSON.stringify(stored.payload),
      checks: JSON.stringify(stored.checks)
    }
  );
  return { ...stored, id: result.insertId };
}

function seedDemoSubscription(businessId) {
  const key = String(businessId);
  if (demoSubscriptions.has(key)) return;
  const plan = getPlan('growth');
  demoSubscriptions.set(
    key,
    normalizeSubscription({
      id: nextDemoSubscriptionId(),
      businessId,
      planCode: plan.code,
      provider: 'payfast',
      providerSubscriptionToken: 'demo_token',
      merchantPaymentId: `demo_${businessId}_growth`,
      status: 'active',
      amountCents: plan.amountCents,
      currency,
      billingFrequency: 'monthly',
      nextBillingDate: '2026-07-01',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z'
    })
  );
}

function normalizeSubscription(subscription) {
  if (!subscription) return null;
  const plan = getPlan(subscription.planCode || subscription.plan_code || 'growth');
  return {
    id: subscription.id,
    businessId: Number(subscription.businessId || subscription.business_id),
    planCode: plan.code,
    planName: plan.name,
    provider: subscription.provider || 'payfast',
    providerSubscriptionToken: subscription.providerSubscriptionToken || subscription.provider_subscription_token || null,
    merchantPaymentId: subscription.merchantPaymentId || subscription.merchant_payment_id || null,
    status: subscription.status || 'pending',
    amountCents: Number(subscription.amountCents || subscription.amount_cents || plan.amountCents),
    amount: centsToRand(subscription.amountCents || subscription.amount_cents || plan.amountCents),
    currency: subscription.currency || currency,
    billingFrequency: subscription.billingFrequency || subscription.billing_frequency || 'monthly',
    nextBillingDate: subscription.nextBillingDate || subscription.next_billing_date || null,
    currentPeriodStartedAt: subscription.currentPeriodStartedAt || subscription.current_period_started_at || null,
    currentPeriodEndsAt: subscription.currentPeriodEndsAt || subscription.current_period_ends_at || null,
    createdAt: subscription.createdAt || subscription.created_at || null,
    updatedAt: subscription.updatedAt || subscription.updated_at || null
  };
}

function normalizeInvoice(invoice) {
  return {
    id: invoice.id,
    businessId: Number(invoice.businessId || invoice.business_id),
    invoiceNumber: invoice.invoiceNumber || invoice.invoice_number,
    provider: invoice.provider,
    providerPaymentId: invoice.providerPaymentId || invoice.provider_payment_id || null,
    merchantPaymentId: invoice.merchantPaymentId || invoice.merchant_payment_id || null,
    amountCents: Number(invoice.amountCents || invoice.amount_cents || 0),
    amount: centsToRand(invoice.amountCents || invoice.amount_cents || 0),
    currency: invoice.currency || currency,
    status: invoice.status,
    issuedOn: invoice.issuedOn || invoice.issued_on,
    dueOn: invoice.dueOn || invoice.due_on || null,
    paidAt: invoice.paidAt || invoice.paid_at || null,
    metadata: invoice.metadata || {}
  };
}

function merchantId() {
  if (process.env.PAYFAST_MERCHANT_ID) return process.env.PAYFAST_MERCHANT_ID;
  if (process.env.PAYFAST_ENV === 'live') {
    const error = new Error('PAYFAST_MERCHANT_ID is required when PAYFAST_ENV=live');
    error.status = 500;
    throw error;
  }
  return '10000100';
}

function merchantKey() {
  if (process.env.PAYFAST_MERCHANT_KEY) return process.env.PAYFAST_MERCHANT_KEY;
  if (process.env.PAYFAST_ENV === 'live') {
    const error = new Error('PAYFAST_MERCHANT_KEY is required when PAYFAST_ENV=live');
    error.status = 500;
    throw error;
  }
  return '46f0cd694581a';
}

function merchantPaymentIdParts(value) {
  const parts = String(value || '').split('_');
  return {
    businessId: parts[1],
    planCode: parts[2]
  };
}

function firstName(name) {
  return String(name || 'Customer').trim().split(/\s+/)[0] || 'Customer';
}

function appUrl() {
  return String(process.env.APP_URL || brand.domain || 'http://localhost:3000').replace(/\/+$/, '');
}

function nextBillingDate() {
  return isoDate(addMonths(new Date(), 1));
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function centsToRand(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function randToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function nextDemoSubscriptionId() {
  demoSubscriptionId += 1;
  return demoSubscriptionId;
}

function nextDemoInvoiceId() {
  demoInvoiceId += 1;
  return demoInvoiceId;
}

module.exports = {
  createPayFastCheckout,
  createTrialSubscription,
  getBillingOverview,
  getCurrentSubscription,
  getPlan,
  listBillingPlans,
  listInvoices,
  processPayFastItn
};
