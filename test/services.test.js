const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const fs = require('node:fs');

const {
  buildSignatureString,
  signPayFastData,
  verifyPayFastSignature,
  summarizePayFastEvent
} = require('../src/services/payfast');
const {
  createPayFastCheckout,
  getBillingOverview,
  getCurrentSubscription,
  listBillingPlans,
  processPayFastItn
} = require('../src/services/billing');
const { enforcePlanLimit, getPlanStatus } = require('../src/services/subscriptionPolicy');
const { registerProspect } = require('../src/services/registration');
const {
  completeSocialSignup,
  createSocialAuthStart,
  createSocialSignupVerification,
  listSocialProviders
} = require('../src/services/socialAuth');
const repository = require('../src/services/repository');
const { processJob } = require('../src/services/jobProcessor');
const {
  verifyMetaChallenge,
  verifyMetaSignature,
  extractMetaEvents
} = require('../src/services/metaWebhook');
const { requestId, securityHeaders } = require('../src/middleware/security');
const { requireAuth, requireRole } = require('../src/middleware/auth');
const {
  hashPassword,
  authenticateUser,
  signSessionId,
  unsignSessionId,
  verifyPassword
} = require('../src/services/auth');
const { decryptSecret, encryptSecret, maskSecret } = require('../src/services/encryption');
const {
  findBusinessIdByMetaPhoneNumberId,
  getMaskedMetaCredentials,
  getMetaCredentials,
  saveMetaCredentials
} = require('../src/services/metaCredentials');
const {
  completeEmbeddedSignup,
  getMetaAssetHealth,
  getMetaOnboardingConfig,
  getMetaOnboardingStatus,
  registerPhoneNumber,
  subscribeWabaWebhooks
} = require('../src/services/metaOnboarding');
const {
  getBusinessProfile,
  updateBusinessProfile,
  validateProfile
} = require('../src/services/metaBusinessProfile');
const { sendTextMessage } = require('../src/services/metaClient');
const { importContacts, normalizePhone } = require('../src/services/contactImport');
const {
  exportConsentEventsCsv,
  isStopMessage,
  listConsentEvents,
  suppressContactByPhone
} = require('../src/services/consent');
const {
  listCampaignRecipients,
  personalizeBody,
  prepareCampaignRecipients
} = require('../src/services/campaignRecipients');
const { dispatchCampaign } = require('../src/services/broadcastDispatch');
const { resetDispatchRateLimiterForTests } = require('../src/services/dispatchRateLimiter');
const { enqueueJob, listJobs } = require('../src/services/jobQueue');
const { runOnce } = require('../src/worker');
const {
  createBusinessUser,
  deactivateBusinessUser,
  listBusinessUsers,
  requestPasswordReset,
  resetPassword,
  updateBusinessUserRole
} = require('../src/services/users');
const { getMockOutbox, resetMailerForTests, verifyMailer } = require('../src/services/mailer');
const {
  createTemplate,
  getTemplateById,
  installLibraryTemplate,
  listTemplateLibrary,
  listTemplates,
  updateTemplateStatus,
  validateTemplatePayload
} = require('../src/services/templates');
const {
  buildMetaTemplatePayload,
  normalizeRemoteTemplate,
  submitTemplateToMeta,
  syncMetaTemplates
} = require('../src/services/metaTemplates');
const {
  getAnalyticsOverview,
  getMetaCostReport,
  metaRateConfig,
  percentage
} = require('../src/services/analytics');
const {
  listMessageCostEvents,
  syncConfiguredMetaRateCard
} = require('../src/services/metaCosts');
const {
  createChatbotFlow,
  duplicateFlowTemplate,
  listChatbotFlows,
  listFlowTemplates,
  publishChatbotFlow,
  simulateChatbotFlow,
  updateChatbotFlow,
  validateFlowDefinition
} = require('../src/services/chatbotFlows');
const { processMetaEvent } = require('../src/services/metaEventProcessor');
const {
  addConversationNote,
  getConversation,
  listConversationNotes,
  listConversations,
  normalizeInboxPhone,
  recordConversationCsat,
  recordInboundMessage,
  recordOutboundReply,
  recordTypingIndicator,
  updateConversation
} = require('../src/services/inbox');
const { subscribeInboxEvents } = require('../src/services/inboxEvents');
const {
  getSetupWizardProgress,
  markSetupStep,
  resetSetupWizardForTests
} = require('../src/services/setupWizard');
const {
  createDataDeletionRequest,
  listDataDeletionRequests,
  resetDataDeletionForTests
} = require('../src/services/dataDeletion');
const {
  buildCatalogItems,
  buildItemsBatchPayload,
  getCatalogSyncPreview,
  syncMetaCatalog
} = require('../src/services/metaCatalogSync');
const {
  archiveProduct,
  applyCouponToOrder,
  buildCommerceMessagePayload,
  buildOrderDetailsPayload,
  buildOrderStatusPayload,
  createOrder,
  createOrderPaymentLink,
  createCoupon,
  createProduct,
  createProductCollection,
  createProductVariant,
  createReturnRequest,
  getCommerceAnalytics,
  getCommerceAutomationInsights,
  getCommerceCustomerSegments,
  getInventoryAlerts,
  getOrderById,
  getProductCollectionById,
  importProducts,
  applyCommerceAutomationRulesForOrder,
  listCommerceAutomationRules,
  listAbandonedCarts,
  listCoupons,
  listProductCollections,
  listOrders,
  listProducts,
  listProductVariants,
  listReturnRequests,
  previewCommerceAutomationRule,
  reconcileOrderPayment,
  sendAbandonedCartRecovery,
  sendOrderPaymentLink,
  sendOrderStatusMessage,
  sendPostPurchasePrompt,
  schedulePostPurchasePrompts,
  shareCatalog,
  shareProductCollection,
  updateCommerceAutomationRule,
  updateOrderFulfilment,
  updateProduct,
  updateReturnRequest,
  updateOrderStatus
} = require('../src/services/commerce');
const { renderLoginPage, renderPage, renderPasswordResetPage, renderSignupPage, renderSocialSignupCompletionPage } = require('../src/views');

test('PayFast signature verification accepts matching signatures', () => {
  const data = {
    merchant_id: '10000100',
    amount_gross: '799.00',
    item_name: 'ChatClan Growth Plan'
  };
  const signature = crypto.createHash('md5').update(buildSignatureString(data)).digest('hex');

  assert.equal(verifyPayFastSignature({ ...data, signature }).ok, true);
});

test('PayFast summary keeps only operational fields', () => {
  const summary = summarizePayFastEvent({
    pf_payment_id: '123',
    m_payment_id: 'sub_1',
    payment_status: 'COMPLETE',
    amount_gross: '799.00',
    token: 'tok_123',
    item_name: 'ChatClan Growth Plan',
    signature: 'ignored'
  });

  assert.deepEqual(summary, {
    paymentId: '123',
    merchantPaymentId: 'sub_1',
    paymentStatus: 'COMPLETE',
    amountGross: '799.00',
    token: 'tok_123',
    itemName: 'ChatClan Growth Plan'
  });
});

test('PayFast checkout creates signed subscription fields', async () => {
  process.env.PAYFAST_ENV = 'sandbox';
  const checkout = await createPayFastCheckout({
    businessId: 1,
    planCode: 'growth',
    user: { name: 'Admin User', email: 'admin@chatclan.co.za' }
  });
  const overview = await getBillingOverview(1);

  assert.equal(checkout.provider, 'payfast');
  assert.equal(checkout.fields.subscription_type, '1');
  assert.equal(checkout.fields.frequency, '3');
  assert.equal(checkout.fields.amount, '799.00');
  assert.equal(verifyPayFastSignature(checkout.fields).ok, true);
  assert.equal(overview.subscription.status, 'pending');
  assert.equal(overview.subscription.planCode, 'growth');
});

test('billing plans expose dynamic limits and entitlements', async () => {
  const plans = await listBillingPlans();
  const growth = plans.find((plan) => plan.code === 'growth');
  const status = await getPlanStatus(777);

  assert.equal(growth.limits.contacts, 10000);
  assert.equal(growth.limits.teamSeats, 5);
  assert.equal(growth.features.advancedAutomations, true);
  assert.equal(status.plan.code, 'growth');
  assert.equal(status.plan.limits.contacts, 10000);
  assert.equal(Number.isFinite(status.usage.contacts), true);
});

test('subscription policy blocks writes above the active plan limit', async () => {
  await assert.rejects(
    () => enforcePlanLimit({ businessId: 777, resource: 'contacts', requested: 10001 }),
    /Growth plan limit reached for contacts/
  );
});

test('PayFast COMPLETE ITN activates subscription and records paid invoice', async () => {
  const checkout = await createPayFastCheckout({
    businessId: 1,
    planCode: 'starter',
    user: { name: 'Admin User', email: 'admin@chatclan.co.za' }
  });
  const raw = {
    pf_payment_id: 'pf_complete_1',
    m_payment_id: checkout.fields.m_payment_id,
    payment_status: 'COMPLETE',
    amount_gross: checkout.fields.amount,
    token: 'pf_token_1',
    item_name: checkout.fields.item_name,
    custom_int1: '1',
    custom_str1: 'starter'
  };
  raw.signature = signPayFastData(raw);

  const result = await processPayFastItn({
    summary: summarizePayFastEvent(raw),
    checks: { signature: verifyPayFastSignature(raw), serverConfirmation: { ok: true } },
    raw
  });
  const subscription = await getCurrentSubscription(1);
  const overview = await getBillingOverview(1);

  assert.equal(result.status, 'processed');
  assert.equal(subscription.status, 'active');
  assert.equal(subscription.planCode, 'starter');
  assert.equal(subscription.providerSubscriptionToken, 'pf_token_1');
  assert.equal(overview.invoices.some((invoice) => invoice.providerPaymentId === 'pf_complete_1' && invoice.status === 'paid'), true);
});

test('PayFast ITN rejects amount mismatch before activation', async () => {
  const checkout = await createPayFastCheckout({
    businessId: 1,
    planCode: 'pro',
    user: { name: 'Admin User', email: 'admin@chatclan.co.za' }
  });
  const raw = {
    pf_payment_id: 'pf_bad_amount_1',
    m_payment_id: checkout.fields.m_payment_id,
    payment_status: 'COMPLETE',
    amount_gross: '1.00',
    token: 'pf_token_bad',
    item_name: checkout.fields.item_name,
    custom_int1: '1',
    custom_str1: 'pro'
  };
  raw.signature = signPayFastData(raw);

  const result = await processPayFastItn({
    summary: summarizePayFastEvent(raw),
    checks: { signature: verifyPayFastSignature(raw), serverConfirmation: { ok: true } },
    raw
  });
  const subscription = await getCurrentSubscription(1);

  assert.equal(result.status, 'rejected');
  assert.match(result.reason, /expected 199900 cents/);
  assert.equal(subscription.status, 'past_due');
});

test('Meta challenge verification compares verify token', () => {
  process.env.META_VERIFY_TOKEN = 'verify_me';
  const result = verifyMetaChallenge({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'verify_me',
    'hub.challenge': 'challenge_123'
  });

  assert.equal(result.ok, true);
  assert.equal(result.challenge, 'challenge_123');
});

test('Meta signature verification validates app secret when configured', () => {
  process.env.META_APP_SECRET = 'secret';
  const rawBody = Buffer.from('{"ok":true}');
  const signature = `sha256=${crypto.createHmac('sha256', 'secret').update(rawBody).digest('hex')}`;

  assert.equal(verifyMetaSignature(rawBody, signature).ok, true);
});

test('Meta webhook event extraction handles messages and statuses', () => {
  const events = extractMetaEvents({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone_1' },
              messages: [{ from: '27821234567', id: 'wamid.1', type: 'text', text: { body: 'Hi' } }],
              statuses: [{ recipient_id: '27821234567', id: 'wamid.1', status: 'delivered' }]
            }
          }
        ]
      }
    ]
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'message.received');
  assert.equal(events[1].type, 'message.status');
});

test('security middleware sets request id and core hardening headers', () => {
  const headers = {};
  const req = {
    get(name) {
      return name === 'x-request-id' ? 'req_test' : undefined;
    }
  };
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    }
  };

  requestId(req, res, () => {});
  securityHeaders(req, res, () => {});

  assert.equal(req.id, 'req_test');
  assert.equal(headers['x-request-id'], 'req_test');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.match(headers['content-security-policy'], /default-src 'self'/);
});

test('auth middleware blocks anonymous users and non-admin write roles', () => {
  const anonymous = mockResponse();
  requireAuth({ id: 'req_auth', user: null, businessId: null }, anonymous.res, () => {
    throw new Error('anonymous request should not pass');
  });

  const missingTenant = mockResponse();
  requireAuth({ id: 'req_tenant', user: { role: 'owner' }, businessId: null }, missingTenant.res, () => {
    throw new Error('request without tenant context should not pass');
  });

  const forbidden = mockResponse();
  requireRole(['owner', 'admin'])({ id: 'req_role', user: { role: 'agent' }, businessId: 1 }, forbidden.res, () => {
    throw new Error('agent request should not pass admin gate');
  });

  let ownerPassed = false;
  requireRole(['owner', 'admin'])({ id: 'req_owner', user: { role: 'owner' }, businessId: 1 }, mockResponse().res, () => {
    ownerPassed = true;
  });

  assert.equal(anonymous.statusCode, 401);
  assert.equal(missingTenant.statusCode, 401);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(ownerPassed, true);
});

test('auth middleware reports database outage separately from anonymous access', () => {
  const unavailable = mockResponse();
  const authError = Object.assign(new Error('Database unavailable at localhost:3306: connect ECONNREFUSED'), {
    status: 503,
    code: 'DATABASE_UNAVAILABLE'
  });

  requireAuth({ id: 'req_db_down', user: null, businessId: null, authError }, unavailable.res, () => {
    throw new Error('request with unavailable database should not pass');
  });

  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.error, 'Database unavailable at localhost:3306: connect ECONNREFUSED');
});

test('landing CTAs route prospects to signup and auth pages do not render dashboard shell', () => {
  const publicPage = renderPage(repository.getPublicPreviewData(), { authenticated: false });
  const socialProviders = listSocialProviders();
  const loginPage = renderLoginPage({ authenticated: true, socialProviders });
  const signupPage = renderSignupPage({ planCode: 'growth', socialProviders });
  const resetPage = renderPasswordResetPage({ authenticated: false });

  assert.match(publicPage, /class="btn-hero" href="\/signup"/);
  assert.match(publicPage, /class="nav-trial" href="\/signup"/);
  assert.match(publicPage, /class="btn-hero-outline" href="\/login"/);
  assert.match(publicPage, /href="\/signup\?plan=growth"/);
  assert.doesNotMatch(publicPage, /data-open-app/);
  assert.doesNotMatch(publicPage, /<main class="app"/);
  assert.match(loginPage, /Continue to dashboard/);
  assert.match(loginPage, /href="\/password-reset"/);
  assert.match(loginPage, /Continue with/);
  assert.match(loginPage, /password-toggle/);
  assert.match(loginPage, /aria-label="LinkedIn"/);
  assert.match(loginPage, /social-linkedin/);
  assert.match(loginPage, /<svg viewBox="0 0 24 24" aria-hidden="true">/);
  assert.doesNotMatch(loginPage, /id="passwordResetRequestForm"/);
  assert.doesNotMatch(loginPage, /<main class="app"/);
  assert.match(signupPage, /id="signupForm"/);
  assert.match(signupPage, /value="growth" selected/);
  assert.match(signupPage, /\/api\/auth\/social\/google\/start/);
  assert.match(signupPage, /\/api\/auth\/social\/linkedin\/start/);
  assert.match(signupPage, /password-toggle/);
  assert.doesNotMatch(signupPage, /<main class="app"/);
  assert.match(resetPage, /id="passwordResetRequestForm"/);
  assert.match(resetPage, /Back to sign in/);
});

test('authenticated dashboard escapes tenant-controlled server-rendered content', () => {
  const page = renderPage(
    {
      business: {
        name: '<img src=x onerror=alert(1)>',
        plan: 'Growth<script>alert(2)</script>',
        contactsUsed: 1,
        contactsLimit: 10,
        billingRenewal: '<b>tomorrow</b>'
      },
      metrics: [{ label: '<svg/onload=alert(1)>', value: '<script>bad()</script>', change: '<b>up</b>' }],
      campaigns: [{ name: '<script>campaign()</script>', status: 'Draft', audience: '<i>All</i>', readRate: '0%', revenue: 'R 0' }],
      contacts: [{ name: '<script>contact()</script>', phone: '+27821234567', segment: '<b>VIP</b>', optedIn: true, lastSeen: '<i>now</i>' }],
      inbox: [{ id: 1, customerName: '<script>inbox()</script>', lastMessagePreview: '<b>Hello</b>', slaStatus: 'open' }],
      templates: [{ category: 'MARKETING', status: 'Draft', name: '<script>template()</script>', body: '<b>Promo</b>' }],
      plans: [],
      providers: [{ name: '<script>Pay</script>', strength: '<b>fast</b>', fees: '<i>fees</i>', status: '<u>ready</u>' }]
    },
    { authenticated: true }
  );

  assert.doesNotMatch(page, /<img src=x/);
  assert.doesNotMatch(page, /<script>bad\(\)<\/script>/);
  assert.doesNotMatch(page, /<script>campaign\(\)<\/script>/);
  assert.doesNotMatch(page, /<script>contact\(\)<\/script>/);
  assert.doesNotMatch(page, /<script>inbox\(\)<\/script>/);
  assert.doesNotMatch(page, /<script>template\(\)<\/script>/);
  assert.match(page, /&lt;script&gt;campaign\(\)&lt;\/script&gt;/);
});

test('Insights page renders live analytics hydration targets', () => {
  const page = renderPage(repository.getPublicPreviewData(), { authenticated: true });

  assert.match(page, /id="insightSummary"/);
  assert.match(page, /id="insightChart"/);
  assert.match(page, /id="insightActions"/);
  assert.match(page, /id="insightCampaigns"/);
  assert.doesNotMatch(page, /Mon','Tue','Wed'/);
});

test('Commerce page renders automation insight hydration targets', () => {
  const page = renderPage(repository.getPublicPreviewData(), { authenticated: true });
  const appSource = fs.readFileSync(require.resolve('../public/js/app'), 'utf8');

  assert.match(page, /id="commerceAutomationInsightStrip"/);
  assert.match(page, /id="commerceAutomationRecommendationList"/);
  assert.match(page, /id="commerceAutomationActivityList"/);
  assert.match(appSource, /function renderAutomationActivity/);
  assert.match(appSource, /automationActivityLabel/);
});

test('critical campaign and contact write routes require owner or admin role', () => {
  const apiSource = fs.readFileSync(require.resolve('../src/routes/api'), 'utf8');
  const protectedRoutePatterns = [
    /router\.post\('\/campaigns', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/campaigns\/:id\/recipients\/prepare', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/campaigns\/:id\/dispatch', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/contacts', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/contacts\/import', requireRole\(\['owner', 'admin'\]\)/,
    /router\.put\('\/integrations\/meta\/business-profile', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/integrations\/meta\/onboarding\/complete', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/integrations\/meta\/webhooks\/subscribe', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/integrations\/meta\/phone\/register', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/products', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/products\/import', requireRole\(\['owner', 'admin'\]\)/,
    /router\.patch\('\/commerce\/products\/:id', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/products\/:id\/archive', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/products\/:id\/variants', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/collections', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/collections\/:id\/share', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/coupons', requireRole\(\['owner', 'admin'\]\)/,
    /router\.get\('\/commerce\/abandoned-carts', requireAuth/,
    /router\.get\('\/commerce\/returns', requireAuth/,
    /router\.get\('\/commerce\/customer-segments', requireAuth/,
    /router\.get\('\/commerce\/automation-rules', requireAuth/,
    /router\.get\('\/commerce\/automation-insights', requireAuth/,
    /router\.get\('\/commerce\/automation-rules\/:id\/preview', requireAuth/,
    /router\.patch\('\/commerce\/automation-rules\/:id', requireRole\(\['owner', 'admin'\]\)/,
    /router\.patch\('\/commerce\/orders\/:id\/status', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.patch\('\/commerce\/orders\/:id\/fulfilment', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/coupon', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/recover-cart', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/reconcile-payment', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/returns', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.patch\('\/commerce\/returns\/:id', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/post-purchase', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/schedule-post-purchase', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/apply-automation-rules', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/payment-link', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/send-payment-link', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/send-status', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/share-catalog', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/catalog-sync', requireRole\(\['owner', 'admin'\]\)/
  ];

  for (const pattern of protectedRoutePatterns) {
    assert.match(apiSource, pattern);
  }
});

test('auth password hashing verifies valid passwords and rejects invalid ones', async () => {
  const hash = await hashPassword('CorrectHorseBatteryStaple!');

  assert.equal(await verifyPassword('CorrectHorseBatteryStaple!', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('auth signed session ids reject tampering', () => {
  const signed = signSessionId('session_123');

  assert.equal(unsignSessionId(signed), 'session_123');
  assert.equal(unsignSessionId(`${signed}tampered`), null);
});

test('prospect registration creates owner, workspace, and trial subscription', async () => {
  const email = `owner-${Date.now()}@example.test`;
  const signup = await registerProspect({
    businessName: 'Prospect Smoke Store',
    ownerName: 'Prospect Owner',
    email,
    password: 'StrongPass123!',
    planCode: 'starter'
  });
  const authenticated = await authenticateUser(email, 'StrongPass123!');
  const dashboard = await repository.getDashboardData(signup.business.id);
  const status = await getPlanStatus(signup.business.id);

  assert.equal(signup.user.role, 'owner');
  assert.equal(signup.subscription.status, 'trialing');
  assert.equal(signup.subscription.planCode, 'starter');
  assert.equal(authenticated.email, email);
  assert.equal(authenticated.businessId, signup.business.id);
  assert.equal(dashboard.business.name, 'Prospect Smoke Store');
  assert.equal(status.plan.code, 'starter');
});

test('social signup completion collects business details after provider verification', async () => {
  const email = `social-owner-${Date.now()}@example.test`;
  const verification = await createSocialSignupVerification({
    provider: 'google',
    providerUserId: `google-${Date.now()}`,
    email,
    name: 'Social Owner',
    planCode: 'growth'
  });
  const page = renderSocialSignupCompletionPage({ verification, token: verification.token });
  const signup = await completeSocialSignup({
    token: verification.token,
    businessName: 'Social Smoke Store',
    ownerName: 'Social Owner',
    planCode: 'growth'
  });
  const authenticated = await authenticateUser(email, 'anything');

  assert.match(page, /id="socialSignupCompletionForm"/);
  assert.match(page, /Google verified/);
  assert.equal(signup.user.email, email);
  assert.equal(signup.subscription.status, 'trialing');
  assert.equal(signup.subscription.planCode, 'growth');
  assert.equal(authenticated, null);
});

test('social auth start exposes configured provider authorization URLs', async () => {
  const previous = process.env.SOCIAL_GOOGLE_CLIENT_ID;
  process.env.SOCIAL_GOOGLE_CLIENT_ID = 'google-client-id';
  try {
    const start = await createSocialAuthStart({ provider: 'google', purpose: 'signup', planCode: 'starter' });

    assert.equal(start.provider, 'google');
    assert.match(start.authorizationUrl, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    assert.match(start.authorizationUrl, /client_id=google-client-id/);
    assert.match(start.authorizationUrl, /state=/);
  } finally {
    if (previous === undefined) delete process.env.SOCIAL_GOOGLE_CLIENT_ID;
    else process.env.SOCIAL_GOOGLE_CLIENT_ID = previous;
  }
});

test('LinkedIn social auth start exposes OpenID authorization URL', async () => {
  const previous = process.env.SOCIAL_LINKEDIN_CLIENT_ID;
  process.env.SOCIAL_LINKEDIN_CLIENT_ID = 'linkedin-client-id';
  try {
    const start = await createSocialAuthStart({ provider: 'linkedin', purpose: 'signup', planCode: 'growth' });

    assert.equal(start.provider, 'linkedin');
    assert.match(start.authorizationUrl, /^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization/);
    assert.match(start.authorizationUrl, /client_id=linkedin-client-id/);
    assert.match(start.authorizationUrl, /scope=openid\+profile\+email/);
  } finally {
    if (previous === undefined) delete process.env.SOCIAL_LINKEDIN_CLIENT_ID;
    else process.env.SOCIAL_LINKEDIN_CLIENT_ID = previous;
  }
});

test('business users can be created, listed, updated, and deactivated in demo mode', async () => {
  resetMailerForTests();
  const created = await createBusinessUser({
    businessId: 1,
    name: 'Support Agent',
    email: 'support-agent@example.test',
    role: 'agent',
    password: 'AgentPass123!'
  });
  const updated = await updateBusinessUserRole({
    businessId: 1,
    userId: created.id,
    role: 'admin',
    actorUserId: 1
  });
  const users = await listBusinessUsers(1);
  const deactivated = await deactivateBusinessUser({
    businessId: 1,
    userId: created.id,
    actorUserId: 1
  });

  assert.equal(created.email, 'support-agent@example.test');
  assert.equal(created.temporaryPassword, 'AgentPass123!');
  assert.equal(created.emailDelivery.mode, 'mock');
  assert.equal(getMockOutbox().at(-1).message.subject, 'You have been invited to ChatClan');
  assert.match(getMockOutbox().at(-1).message.text, /AgentPass123!/);
  assert.equal(updated.role, 'admin');
  assert.equal(users.some((user) => user.email === 'support-agent@example.test'), true);
  assert.equal(deactivated.status, 'inactive');
});

test('password reset token updates demo user login password once', async () => {
  resetMailerForTests();
  await createBusinessUser({
    businessId: 1,
    name: 'Reset Agent',
    email: 'reset-agent@example.test',
    role: 'agent',
    password: 'OldPass123!'
  });
  const requested = await requestPasswordReset('reset-agent@example.test');

  assert.ok(requested.resetToken);
  assert.equal(requested.emailDelivery.mode, 'mock');
  assert.match(getMockOutbox().at(-1).message.subject, /Reset your ChatClan password/);
  assert.match(getMockOutbox().at(-1).message.text, new RegExp(requested.resetToken));
  assert.equal(await authenticateUser('reset-agent@example.test', 'OldPass123!') !== null, true);
  assert.equal(await resetPassword({ token: requested.resetToken, password: 'NewPass123!' }).then((result) => result.ok), true);
  assert.equal(await authenticateUser('reset-agent@example.test', 'OldPass123!'), null);
  assert.equal((await authenticateUser('reset-agent@example.test', 'NewPass123!')).email, 'reset-agent@example.test');
  await assert.rejects(
    () => resetPassword({ token: requested.resetToken, password: 'AnotherPass123!' }),
    /invalid or expired/
  );
});

test('mailer mock mode verifies and production reset responses do not expose tokens', async () => {
  resetMailerForTests();
  await createBusinessUser({
    businessId: 1,
    name: 'Production Reset',
    email: 'production-reset@example.test',
    role: 'agent',
    password: 'OldPass123!'
  });

  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const verification = await verifyMailer();
    const requested = await requestPasswordReset('production-reset@example.test');
    const resetEmail = getMockOutbox().at(-1).message;

    assert.deepEqual(verification, { mode: 'mock', ok: true });
    assert.equal(requested.ok, true);
    assert.equal(requested.resetToken, undefined);
    assert.equal(requested.emailDelivery.mode, 'mock');
    assert.match(resetEmail.text, /resetToken=/);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test('credential encryption round-trips and masks secrets', () => {
  const encrypted = encryptSecret('secret-token-value');

  assert.notEqual(encrypted, 'secret-token-value');
  assert.equal(decryptSecret(encrypted), 'secret-token-value');
  assert.equal(maskSecret('secret-token-value'), '**************alue');
});

test('Meta credentials save encrypted demo credentials and expose masked reads', async () => {
  const saved = await saveMetaCredentials(999, {
    wabaId: 'waba_123',
    phoneNumberId: 'phone_123',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_123'
  });
  const raw = await getMetaCredentials(999);
  const masked = await getMaskedMetaCredentials(999);

  assert.equal(saved.connected, true);
  assert.equal(raw.accessToken, 'EAA_SECRET_TOKEN');
  assert.equal(masked.accessTokenMasked.endsWith('OKEN'), true);
  assert.equal(masked.verifyTokenMasked.endsWith('_123'), true);
});

test('Meta credentials map phone number ids back to a demo business', async () => {
  await saveMetaCredentials(998, {
    wabaId: 'waba_998',
    phoneNumberId: 'phone_998',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_998'
  });

  assert.equal(await findBusinessIdByMetaPhoneNumberId('phone_998'), 998);
});

test('Meta client stays in mock mode unless live sending is explicitly enabled', async () => {
  const result = await sendTextMessage({
    businessId: 999,
    to: '27821234567',
    text: 'Hello'
  });

  assert.equal(result.mode, 'mock-configured');
  assert.match(result.note, /META_SEND_MODE=live/);
});

test('Meta onboarding exposes Embedded Signup config and saves completed signup credentials in mock mode', async () => {
  process.env.META_APP_ID = 'app_123';
  process.env.META_EMBEDDED_SIGNUP_CONFIG_ID = 'config_123';
  process.env.META_VERIFY_TOKEN = 'verify_onboarding';
  delete process.env.META_ONBOARDING_MODE;

  const config = getMetaOnboardingConfig({ businessId: 981, origin: 'https://app.example.test' });
  const completed = await completeEmbeddedSignup({
    businessId: 981,
    code: 'embedded_code',
    wabaId: 'waba_onboard',
    phoneNumberId: 'phone_onboard',
    phoneNumber: '27821234567'
  });
  const status = await getMetaOnboardingStatus({ businessId: 981, origin: 'https://app.example.test' });

  assert.equal(config.configured, true);
  assert.equal(config.launchParams.response_type, 'code');
  assert.equal(config.launchParams.extras.featureType, 'whatsapp_business_app_onboarding');
  assert.equal(completed.mode, 'mock');
  assert.equal(completed.credentials.connected, true);
  assert.equal(status.credentials.wabaId, 'waba_onboard');
  assert.equal(status.checks.find((check) => check.id === 'business_token').ok, true);
});

test('Meta phone registration is mock-safe and requires a six digit PIN', async () => {
  await saveMetaCredentials(980, {
    wabaId: 'waba_register',
    phoneNumberId: 'phone_register',
    accessToken: 'EAA_REGISTER_TOKEN',
    verifyToken: 'verify_register'
  });

  await assert.rejects(
    () => registerPhoneNumber({ businessId: 980, pin: '123' }),
    /6 digit/
  );

  const registered = await registerPhoneNumber({ businessId: 980, pin: '123456', dataLocalizationRegion: 'za' });

  assert.equal(registered.mode, 'mock');
  assert.equal(registered.registered, true);
  assert.equal(registered.payload.pin, '******');
  assert.equal(registered.payload.data_localization_region, 'ZA');
});

test('Meta asset health and webhook subscription are mock-safe during onboarding', async () => {
  process.env.META_VERIFY_TOKEN = 'verify_health';
  await saveMetaCredentials(979, {
    wabaId: 'waba_health',
    phoneNumberId: 'phone_health',
    accessToken: 'EAA_HEALTH_TOKEN',
    verifyToken: 'verify_health'
  });

  const health = await getMetaAssetHealth({ businessId: 979 });
  const subscribed = await subscribeWabaWebhooks({
    businessId: 979,
    callbackUrl: 'https://app.example.test/webhooks/meta'
  });
  const status = await getMetaOnboardingStatus({ businessId: 979, origin: 'https://app.example.test' });

  assert.equal(health.mode, 'mock');
  assert.equal(health.phone.quality_rating, 'GREEN');
  assert.equal(health.checks.some((check) => check.id === 'messaging_health' && check.ok), true);
  assert.equal(subscribed.mode, 'mock');
  assert.equal(subscribed.subscribed, true);
  assert.deepEqual(subscribed.subscribedFields, ['messages', 'message_template_status']);
  assert.equal(status.assetHealth.available, true);
});

test('WhatsApp Business Profile can be validated, saved, and read in mock mode', async () => {
  assert.throws(
    () => validateProfile({ vertical: 'NOT_REAL' }),
    /vertical must be one of/
  );
  assert.throws(
    () => validateProfile({ email: 'bad-email' }),
    /valid email/
  );

  await saveMetaCredentials(978, {
    wabaId: 'waba_profile',
    phoneNumberId: 'phone_profile',
    accessToken: 'EAA_PROFILE_TOKEN',
    verifyToken: 'verify_profile'
  });
  const updated = await updateBusinessProfile(978, {
    about: 'Boutique WhatsApp store',
    description: 'Curated fashion, fast support, and secure WhatsApp checkout.',
    email: 'shop@example.co.za',
    address: 'Johannesburg, South Africa',
    websites: 'https://example.co.za\nhttps://instagram.com/example',
    vertical: 'RETAIL'
  });
  const loaded = await getBusinessProfile(978);

  assert.equal(updated.mode, 'mock-configured');
  assert.equal(updated.profile.vertical, 'RETAIL');
  assert.equal(updated.profile.websites.length, 2);
  assert.equal(updated.completeness.percent >= 80, true);
  assert.equal(loaded.profile.email, 'shop@example.co.za');
});

test('setup wizard derives completed steps and resumes manual progress', async () => {
  resetSetupWizardForTests();
  const initial = await getSetupWizardProgress(987);

  assert.equal(initial.totalSteps, 8);
  assert.equal(initial.steps.find((step) => step.id === 'business_profile').completed, true);
  assert.equal(initial.steps.find((step) => step.id === 'meta_credentials').completed, false);
  assert.equal(initial.nextStepId, 'business_verification');

  await markSetupStep({
    businessId: 987,
    stepId: 'business_verification',
    metadata: { source: 'manual-beta-check' }
  });
  await saveMetaCredentials(987, {
    wabaId: 'waba_setup',
    phoneNumberId: 'phone_setup',
    accessToken: 'EAA_SETUP_TOKEN',
    verifyToken: 'verify_setup'
  });
  const progressed = await getSetupWizardProgress(987);

  assert.equal(progressed.steps.find((step) => step.id === 'business_verification').completed, true);
  assert.equal(progressed.steps.find((step) => step.id === 'meta_credentials').completed, true);
  assert.equal(progressed.steps.find((step) => step.id === 'business_verification').metadata.source, 'manual-beta-check');
  assert.equal(progressed.completedCount >= 3, true);
});

test('setup wizard can mark the test message step complete', async () => {
  resetSetupWizardForTests();
  const progress = await markSetupStep({
    businessId: 986,
    stepId: 'test_message',
    metadata: { mode: 'mock-configured' }
  });
  const testStep = progress.steps.find((step) => step.id === 'test_message');

  assert.equal(testStep.completed, true);
  assert.equal(testStep.metadata.mode, 'mock-configured');
});

test('contact import requires opt-in mapping for POPIA compliance', async () => {
  await assert.rejects(
    () =>
      importContacts({
        businessId: 1,
        csvText: 'name,phone\nNomsa,+27821234567',
        mapping: { name: 'name', phone: 'phone' }
      }),
    /Opt-in consent column is required/
  );
});

test('contact import flags South African numbers without +27 country code', async () => {
  const result = await importContacts({
    businessId: 1,
    csvText: 'name,phone,opt_in\nNomsa,0821234567,yes',
    mapping: { name: 'name', phone: 'phone', optIn: 'opt_in' }
  });

  assert.equal(result.validRows, 0);
  assert.equal(result.errors[0].message, 'Missing country code — please add +27 for South Africa');
});

test('contact import validates, imports, and counts duplicate rows in demo mode', async () => {
  const result = await importContacts({
    businessId: 1,
    commit: true,
    csvText: [
      'name,phone,opt_in,email',
      'Nomsa,+27821234567,yes,nomsa@example.test',
      'Nomsa Duplicate,+27821234567,yes,dupe@example.test',
      'Thabo,+27712345678,true,thabo@example.test'
    ].join('\n'),
    mapping: { name: 'name', phone: 'phone', optIn: 'opt_in', email: 'email' }
  });

  assert.equal(result.totalRows, 3);
  assert.equal(result.validRows, 2);
  assert.equal(result.imported, 2);
  assert.equal(result.duplicates, 1);
});

test('normalizePhone accepts valid +27 mobile numbers', () => {
  assert.deepEqual(normalizePhone('+27 82 123 4567'), {
    ok: true,
    value: '+27821234567'
  });
});

test('STOP message detection accepts opt-out keywords only', () => {
  assert.equal(isStopMessage('STOP'), true);
  assert.equal(isStopMessage(' unsubscribe '), true);
  assert.equal(isStopMessage('opt out'), true);
  assert.equal(isStopMessage('please stop by tomorrow'), false);
});

test('consent suppression records opt-out event and masks CSV export', async () => {
  const result = await suppressContactByPhone({
    businessId: 777,
    phone: '27821234567',
    metadata: { messageId: 'wamid.stop' }
  });
  const events = await listConsentEvents(777);
  const csv = await exportConsentEventsCsv(777);

  assert.equal(result.suppressed, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, 'opt_out');
  assert.match(csv, /"opt_out"/);
  assert.doesNotMatch(csv, /27821234567/);
  assert.match(csv, /\*+4567/);
});

test('campaign recipient preparation excludes opted-out contacts', async () => {
  const summary = await prepareCampaignRecipients({
    businessId: 1,
    campaignId: 12345,
    audience: 'All contacts',
    body: 'Hi {{first_name}}, sale is live.'
  });
  const recipients = await listCampaignRecipients({ businessId: 1, campaignId: 12345 });

  assert.equal(summary.totalContacts, 4);
  assert.equal(summary.eligible, 3);
  assert.equal(summary.excludedOptOut, 1);
  assert.equal(recipients.length, 3);
  assert.equal(recipients.some((recipient) => recipient.contactId === 4), false);
  assert.equal(recipients[0].personalizedBody, 'Hi Nomsa, sale is live.');
});

test('campaign recipient preparation can target a segment', async () => {
  const summary = await prepareCampaignRecipients({
    businessId: 1,
    campaignId: 12346,
    audience: 'VIP customers',
    body: 'Hi {{first_name}}'
  });

  assert.equal(summary.totalContacts, 1);
  assert.equal(summary.eligible, 1);
});

test('campaign body personalization uses first name fallback', () => {
  assert.equal(personalizeBody('Hello {{first_name}}', { name: '' }), 'Hello there');
});

test('campaign dispatch sends only prepared queued recipients in mock mode', async () => {
  resetDispatchRateLimiterForTests();
  delete process.env.DISPATCH_TENANT_PER_MINUTE;
  delete process.env.DISPATCH_PHONE_PER_MINUTE;
  await prepareCampaignRecipients({
    businessId: 1,
    campaignId: 12347,
    audience: 'All contacts',
    body: 'Hi {{first_name}}, dispatch smoke.'
  });

  const summary = await dispatchCampaign({ businessId: 1, campaignId: 12347, limit: 10 });
  const recipients = await listCampaignRecipients({ businessId: 1, campaignId: 12347 });

  assert.equal(summary.attempted, 3);
  assert.equal(summary.sent, 3);
  assert.equal(summary.failed, 0);
  assert.equal(summary.remainingQueued, 0);
  assert.equal(recipients.every((recipient) => recipient.status === 'sent'), true);
  assert.equal(recipients.some((recipient) => recipient.contactId === 4), false);
});

test('campaign dispatch respects tenant and phone rate limits', async () => {
  resetDispatchRateLimiterForTests();
  process.env.DISPATCH_TENANT_PER_MINUTE = '2';
  process.env.DISPATCH_PHONE_PER_MINUTE = '10';
  await prepareCampaignRecipients({
    businessId: 1,
    campaignId: 12350,
    audience: 'All contacts',
    body: 'Hi {{first_name}}, rate limit smoke.'
  });

  const summary = await dispatchCampaign({ businessId: 1, campaignId: 12350, limit: 10 });
  const recipients = await listCampaignRecipients({ businessId: 1, campaignId: 12350 });

  assert.equal(summary.attempted, 2);
  assert.equal(summary.rateLimit.limited, true);
  assert.equal(summary.rateLimit.allowed, 2);
  assert.equal(summary.remainingQueued, 1);
  assert.equal(recipients.filter((recipient) => recipient.status === 'sent').length, 2);
  assert.equal(recipients.filter((recipient) => recipient.status === 'queued').length, 1);

  delete process.env.DISPATCH_TENANT_PER_MINUTE;
  delete process.env.DISPATCH_PHONE_PER_MINUTE;
});

test('Meta status webhooks update campaign recipient delivery state', async () => {
  resetDispatchRateLimiterForTests();
  await saveMetaCredentials(997, {
    wabaId: 'waba_delivery',
    phoneNumberId: 'phone_delivery',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_delivery'
  });
  await prepareCampaignRecipients({
    businessId: 997,
    campaignId: 12351,
    audience: 'VIP customers',
    body: 'Hi {{first_name}}, delivery smoke.'
  });
  const dispatched = await dispatchCampaign({ businessId: 997, campaignId: 12351, limit: 1 });
  const providerMessageId = dispatched.results[0].providerMessageId;

  const delivered = await processMetaEvent({
    type: 'message.status',
    phoneNumberId: 'phone_delivery',
    recipient: '27821234567',
    messageId: providerMessageId,
    status: 'delivered',
    raw: { id: providerMessageId, status: 'delivered' }
  });
  let recipients = await listCampaignRecipients({ businessId: 997, campaignId: 12351 });
  assert.equal(delivered.campaignRecipient.status, 'delivered');
  assert.equal(recipients[0].status, 'delivered');

  await processMetaEvent({
    type: 'message.status',
    phoneNumberId: 'phone_delivery',
    recipient: '27821234567',
    messageId: providerMessageId,
    status: 'read',
    raw: { id: providerMessageId, status: 'read' }
  });
  recipients = await listCampaignRecipients({ businessId: 997, campaignId: 12351 });

  assert.equal(recipients[0].status, 'read');
  assert.ok(recipients[0].readAt);
});

test('Meta delivered statuses create reconciled cost ledger entries', async () => {
  resetDispatchRateLimiterForTests();
  process.env.META_COST_MARKETING_ZAR_CENTS = '25';
  process.env.META_COST_UTILITY_ZAR_CENTS = '5';
  process.env.META_COST_AUTHENTICATION_ZAR_CENTS = '4';
  await syncConfiguredMetaRateCard({ market: 'ZA', currency: 'ZAR', source: 'test-rate-card' });
  await saveMetaCredentials(994, {
    wabaId: 'waba_cost',
    phoneNumberId: 'phone_cost',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_cost'
  });
  await prepareCampaignRecipients({
    businessId: 994,
    campaignId: 12352,
    audience: 'VIP customers',
    body: 'Hi {{first_name}}, cost smoke.'
  });
  const dispatched = await dispatchCampaign({ businessId: 994, campaignId: 12352, limit: 1 });
  const providerMessageId = dispatched.results[0].providerMessageId;

  const delivered = await processMetaEvent({
    type: 'message.status',
    phoneNumberId: 'phone_cost',
    recipient: '27821234567',
    messageId: providerMessageId,
    status: 'delivered',
    raw: {
      id: providerMessageId,
      status: 'delivered',
      pricing: {
        billable: true,
        pricing_model: 'PMP',
        category: 'marketing',
        type: 'regular'
      }
    }
  });
  const read = await processMetaEvent({
    type: 'message.status',
    phoneNumberId: 'phone_cost',
    recipient: '27821234567',
    messageId: providerMessageId,
    status: 'read',
    raw: { id: providerMessageId, status: 'read', pricing: { billable: true, category: 'marketing' } }
  });
  const events = await listMessageCostEvents(994);
  const report = await getMetaCostReport(994);

  assert.equal(delivered.costEvent.amountCents, 25);
  assert.equal(read.costEvent.deduped, true);
  assert.equal(events.length, 1);
  assert.equal(report.reconciled, true);
  assert.equal(report.estimatedCostCents, 25);
  assert.equal(report.categories.find((item) => item.category === 'MARKETING').billableDelivered, 1);
});

test('worker processes queued campaign dispatch jobs', async () => {
  resetDispatchRateLimiterForTests();
  await prepareCampaignRecipients({
    businessId: 1,
    campaignId: 12348,
    audience: 'VIP customers',
    body: 'Hi {{first_name}}, worker dispatch.'
  });
  const queued = await enqueueJob({
    type: 'campaign.dispatch',
    payload: { businessId: 1, campaignId: 12348, limit: 10 },
    dedupeKey: 'test:campaign.dispatch:12348'
  });

  const result = await runOnce({ limit: 1 });
  const recipients = await listCampaignRecipients({ businessId: 1, campaignId: 12348 });

  assert.equal(queued.deduped, false);
  assert.equal(result.processed, 1);
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].status, 'sent');
});

test('worker processes queued Meta STOP webhook events', async () => {
  await enqueueJob({
    type: 'webhook.meta.event',
    payload: {
      event: {
        type: 'message.received',
        phoneNumberId: 'phone_worker',
        from: '27821239999',
        messageId: 'wamid.worker.stop',
        messageType: 'text',
        text: 'STOP'
      }
    },
    dedupeKey: 'test:webhook.meta.stop'
  });

  const result = await runOnce({ limit: 1 });
  const events = await listConsentEvents(1);

  assert.equal(result.processed, 1);
  assert.equal(events.some((event) => event.eventType === 'opt_out' && event.phone === '+27821239999'), true);
});

test('job queue deduplicates queued work', async () => {
  const first = await enqueueJob({
    type: 'campaign.dispatch',
    payload: { businessId: 1, campaignId: 12349 },
    dedupeKey: 'test:dedupe:12349'
  });
  const second = await enqueueJob({
    type: 'campaign.dispatch',
    payload: { businessId: 1, campaignId: 12349 },
    dedupeKey: 'test:dedupe:12349'
  });
  const queued = await listJobs({ status: 'queued' });

  assert.equal(first.deduped, false);
  assert.equal(second.deduped, true);
  assert.equal(queued.some((job) => job.id === first.jobId), true);
});

test('template library includes 19 South African industry templates', () => {
  const library = listTemplateLibrary();
  const industries = new Set(library.map((template) => template.industryId));

  assert.equal(library.length, 19);
  assert.equal(industries.size, 19);
  assert.equal(library.every((template) => ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(template.category)), true);
});

test('template validation rejects non-sequential variables', () => {
  assert.throws(
    () =>
      validateTemplatePayload({
        name: 'Bad Template',
        category: 'MARKETING',
        body: 'Hi {{2}}, sale is live.'
      }),
    /sequential/
  );
});

test('templates can be created, installed from library, and status-updated', async () => {
  const created = await createTemplate(1, {
    name: 'Smoke Utility',
    category: 'UTILITY',
    industry: 'ecommerce',
    body: 'Hi {{1}}, your order {{2}} is ready.'
  });
  const installed = await installLibraryTemplate(1, 'restaurant_weekly_special');
  const updated = await updateTemplateStatus({
    businessId: 1,
    templateId: created.id,
    status: 'Submitted',
    metaTemplateId: 'meta_tpl_123'
  });
  const templates = await listTemplates(1);

  assert.equal(created.slug, 'smoke_utility');
  assert.equal(installed.industry, 'restaurant');
  assert.equal(updated.status, 'Submitted');
  assert.equal(templates.some((template) => template.id === created.id), true);
});

test('Meta template payload includes body examples for variables', async () => {
  const template = await createTemplate(1, {
    name: 'Meta Payload Smoke',
    category: 'MARKETING',
    body: 'Hi {{1}}, our {{2}} sale is live.',
    footer: 'Reply STOP to opt out.'
  });
  const payload = buildMetaTemplatePayload(template);

  assert.equal(payload.name, 'meta_payload_smoke');
  assert.equal(payload.category, 'MARKETING');
  assert.deepEqual(payload.components[0].example.body_text, [['Sample 1', 'Sample 2']]);
  assert.equal(payload.components[1].type, 'FOOTER');
});

test('Meta template submission is mock-safe by default', async () => {
  delete process.env.META_TEMPLATE_MODE;
  const template = await createTemplate(1, {
    name: 'Meta Submit Smoke',
    category: 'UTILITY',
    body: 'Hi {{1}}, your order {{2}} is ready.'
  });
  const submitted = await submitTemplateToMeta({ businessId: 1, templateId: template.id });
  const stored = await getTemplateById(1, template.id);

  assert.equal(submitted.mode, 'mock');
  assert.equal(submitted.template.status, 'Submitted');
  assert.match(submitted.template.metaTemplateId, /^mock_tpl_/);
  assert.equal(stored.status, 'Submitted');
});

test('Meta template sync maps remote statuses and imports missing templates', async () => {
  const local = await createTemplate(1, {
    name: 'Meta Sync Local',
    slug: 'meta_sync_local',
    category: 'UTILITY',
    body: 'Hi {{1}}, your update is ready.',
    status: 'Submitted'
  });
  await updateTemplateStatus({
    businessId: 1,
    templateId: local.id,
    status: 'Submitted',
    metaTemplateId: 'remote_sync_1'
  });

  const normalized = normalizeRemoteTemplate({
    id: 'remote_import_1',
    name: 'remote_imported_notice',
    status: 'REJECTED',
    category: 'MARKETING',
    language: 'en_ZA',
    components: [{ type: 'BODY', text: 'Hi {{1}}, imported template.' }],
    rejected_reason: 'POLICY'
  });
  const result = await syncMetaTemplates(1, {
    remoteTemplates: [
      {
        id: 'remote_sync_1',
        name: 'meta_sync_local',
        status: 'APPROVED',
        category: 'UTILITY',
        language: 'en_ZA',
        components: [{ type: 'BODY', text: 'Hi {{1}}, your update is ready.' }]
      },
      {
        id: 'remote_import_1',
        name: 'remote_imported_notice',
        status: 'REJECTED',
        category: 'MARKETING',
        language: 'en_ZA',
        components: [{ type: 'BODY', text: 'Hi {{1}}, imported template.' }],
        rejected_reason: 'POLICY'
      }
    ]
  });
  const templates = await listTemplates(1);

  assert.equal(normalized.status, 'Rejected');
  assert.equal(result.mode, 'provided');
  assert.equal(result.synced, 2);
  assert.equal(templates.find((template) => template.id === local.id).status, 'Approved');
  assert.equal(templates.find((template) => template.slug === 'remote_imported_notice').status, 'Rejected');
});

test('chatbot flow library covers 19 industries and can duplicate templates', async () => {
  const templates = listFlowTemplates();
  const industries = new Set(templates.map((template) => template.industryId));
  const duplicated = await duplicateFlowTemplate({
    businessId: 993,
    templateId: 'restaurant_starter_flow',
    name: 'Restaurant Booking Bot'
  });
  const flows = await listChatbotFlows(993);

  assert.equal(templates.length, 19);
  assert.equal(industries.size, 19);
  assert.equal(duplicated.name, 'Restaurant Booking Bot');
  assert.equal(duplicated.validation.valid, true);
  assert.equal(flows.some((flow) => flow.id === duplicated.id), true);
});

test('chatbot flow validation blocks broken branches before publish', async () => {
  const brokenDefinition = {
    version: 1,
    startNodeId: 'start',
    nodes: [
      { id: 'start', type: 'trigger', name: 'Start', config: { keywords: ['hi'] } },
      {
        id: 'branch',
        type: 'condition',
        name: 'Branch',
        config: { branches: [{ label: 'Missing', match: 'missing', targetNodeId: 'missing_node' }] }
      }
    ],
    edges: [{ from: 'start', to: 'branch' }]
  };
  const validation = validateFlowDefinition(brokenDefinition);
  const flow = await createChatbotFlow(993, {
    name: 'Broken Flow',
    industryId: 'custom',
    industryName: 'Custom',
    definition: brokenDefinition
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /must target an existing node/);
  await assert.rejects(
    () => publishChatbotFlow({ businessId: 993, flowId: flow.id }),
    /cannot be published/
  );
});

test('chatbot flows publish and simulate customer branches', async () => {
  const flow = await duplicateFlowTemplate({
    businessId: 992,
    templateId: 'ecommerce_starter_flow',
    name: 'E-commerce Product Bot'
  });
  const published = await publishChatbotFlow({ businessId: 992, flowId: flow.id });
  const productSimulation = await simulateChatbotFlow({
    businessId: 992,
    flowId: flow.id,
    input: 'Product discovery',
    contact: { firstName: 'Nomsa' }
  });
  const handoffSimulation = await simulateChatbotFlow({
    businessId: 992,
    flowId: flow.id,
    input: 'agent',
    contact: { firstName: 'Nomsa' }
  });
  assert.equal(published.status, 'Published');
  assert.equal(productSimulation.transcript.some((line) => /Nomsa/.test(line.body)), true);
  assert.equal(productSimulation.visitedNodeIds.includes('primary_response'), true);
  assert.equal(handoffSimulation.handoff, true);
  assert.equal(handoffSimulation.visitedNodeIds.includes('handoff_agent'), true);

  const updated = await updateChatbotFlow({
    businessId: 992,
    flowId: flow.id,
    name: 'E-commerce Product Bot v2'
  });

  assert.equal(updated.status, 'Draft');
  assert.equal(updated.version, 2);
});

test('commerce products can be created, shared as WhatsApp catalog payloads, and converted into orders', async () => {
  const businessId = 987;
  const dress = await createProduct(businessId, {
    name: 'Summer Dress',
    sku: 'summer-dress',
    price: '499.00',
    inventoryCount: 12,
    metaCatalogId: 'catalog_987',
    metaProductRetailerId: 'summer-dress'
  });
  const bag = await createProduct(businessId, {
    name: 'Market Bag',
    sku: 'market-bag',
    price: '249.00',
    inventoryCount: 7,
    metaCatalogId: 'catalog_987',
    metaProductRetailerId: 'market-bag'
  });
  const products = await listProducts(businessId);
  const payload = buildCommerceMessagePayload({
    to: '27821234567',
    products: [dress, bag],
    body: 'Browse our products.',
    footer: 'ChatClan commerce'
  });
  const shared = await shareCatalog({
    businessId,
    to: '27821234567',
    productIds: [dress.id, bag.id],
    body: 'Browse our products.'
  });
  const order = await createOrder(businessId, {
    customerName: 'Commerce Buyer',
    customerPhone: '+27821234567',
    items: [{ productId: dress.id, quantity: 2 }]
  });
  const orders = await listOrders(businessId);

  assert.equal(products.length, 2);
  assert.equal(dress.priceCents, 49900);
  assert.equal(payload.interactive.type, 'carousel');
  assert.equal(payload.interactive.action.cards.length, 2);
  assert.match(shared.messageId, /^mock_/);
  assert.equal(order.totalCents, 99800);
  assert.equal(orders.some((item) => item.id === order.id), true);
});

test('commerce product CSV import previews, commits, and skips duplicate SKUs', async () => {
  const businessId = 982;
  const csvText = [
    'name,sku,price,stock,image_url,catalog_id,retailer_id,url,description',
    'Import Hat,import-hat,149,12,https://example.co.za/hat.jpg,catalog_982,import-hat,https://example.co.za/products/hat,Sun hat',
    'Import Hat Duplicate,import-hat,179,4,https://example.co.za/hat2.jpg,catalog_982,import-hat-2,https://example.co.za/products/hat2,Duplicate sku',
    'Broken Product,broken-product,0,3,https://example.co.za/broken.jpg,catalog_982,broken-product,https://example.co.za/products/broken,No price'
  ].join('\n');

  const preview = await importProducts({ businessId, csvText, commit: false });
  const committed = await importProducts({ businessId, csvText, commit: true });
  const products = await listProducts(businessId);

  assert.equal(preview.totalRows, 3);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.imported, 0);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.errors.length, 1);
  assert.equal(committed.imported, 1);
  assert.equal(committed.products[0].sku, 'import-hat');
  assert.equal(products.some((product) => product.sku === 'import-hat'), true);
});

test('commerce products can be updated and archived without deleting history', async () => {
  const businessId = 981;
  const product = await createProduct(businessId, {
    name: 'Manageable Product',
    sku: 'manageable-product',
    price: 120,
    inventoryCount: 8,
    metaCatalogId: 'catalog_981',
    metaProductRetailerId: 'manageable-product'
  });

  const updated = await updateProduct(businessId, product.id, {
    name: 'Managed Product',
    sku: 'manageable-product',
    price: 135,
    inventoryCount: 14,
    imageUrl: 'https://example.co.za/managed.jpg',
    paymentLinkUrl: 'https://example.co.za/products/managed',
    status: 'active'
  });
  const archived = await archiveProduct(businessId, product.id);
  const products = await listProducts(businessId);

  assert.equal(updated.name, 'Managed Product');
  assert.equal(updated.price, '135.00');
  assert.equal(updated.inventoryCount, 14);
  assert.equal(updated.metaProductRetailerId, 'manageable-product');
  assert.equal(archived.status, 'archived');
  assert.equal(products.some((item) => item.id === product.id && item.status === 'archived'), true);
});

test('commerce product collections group products and share focused WhatsApp catalog payloads', async () => {
  const businessId = 980;
  const first = await createProduct(businessId, {
    name: 'Collection Dress',
    sku: 'collection-dress',
    price: 320,
    inventoryCount: 9,
    metaCatalogId: 'catalog_980',
    metaProductRetailerId: 'collection-dress'
  });
  const second = await createProduct(businessId, {
    name: 'Collection Bag',
    sku: 'collection-bag',
    price: 180,
    inventoryCount: 11,
    metaCatalogId: 'catalog_980',
    metaProductRetailerId: 'collection-bag'
  });

  const collection = await createProductCollection(businessId, {
    name: 'Weekend Picks',
    description: 'A focused product set.',
    productIds: `${first.id},${second.id}`
  });
  const collections = await listProductCollections(businessId);
  const loaded = await getProductCollectionById(businessId, collection.id);
  const shared = await shareProductCollection({
    businessId,
    collectionId: collection.id,
    to: '27821234567'
  });

  assert.equal(collection.productCount, 2);
  assert.deepEqual(collection.retailerIds, ['collection-dress', 'collection-bag']);
  assert.equal(collections.some((item) => item.id === collection.id), true);
  assert.equal(loaded.products.length, 2);
  assert.equal(shared.collection.name, 'Weekend Picks');
  assert.equal(shared.payload.interactive.type, 'carousel');
  assert.match(shared.messageId, /^mock_/);
});

test('commerce coupons discount orders before payment links are created', async () => {
  const businessId = 979;
  const product = await createProduct(businessId, {
    name: 'Coupon Jacket',
    sku: 'coupon-jacket',
    price: 500,
    inventoryCount: 6,
    metaCatalogId: 'catalog_979',
    metaProductRetailerId: 'coupon-jacket'
  });
  const order = await createOrder(businessId, {
    customerName: 'Coupon Buyer',
    customerPhone: '+27821230001',
    items: [{ productId: product.id, quantity: 1 }]
  });
  const coupon = await createCoupon(businessId, {
    code: 'SAVE10',
    name: 'Save ten percent',
    discountType: 'percent',
    discountValue: 10
  });

  const discounted = await applyCouponToOrder({ businessId, orderId: order.id, code: 'save10' });
  const withPayment = await createOrderPaymentLink({ businessId, orderId: order.id, provider: 'payfast' });
  const coupons = await listCoupons(businessId);

  assert.equal(coupon.code, 'SAVE10');
  assert.equal(discounted.subtotal, '500.00');
  assert.equal(discounted.discount, '50.00');
  assert.equal(discounted.total, '450.00');
  assert.equal(discounted.discountCode, 'SAVE10');
  assert.equal(discounted.events.some((event) => event.eventType === 'coupon.applied'), true);
  assert.match(withPayment.paymentLinkUrl, /amount=450\.00/);
  assert.equal(coupons.find((item) => item.code === 'SAVE10').redeemedCount, 1);
});

test('abandoned cart recovery sends unpaid order payment prompts', async () => {
  const businessId = 978;
  const product = await createProduct(businessId, {
    name: 'Recovery Coat',
    sku: 'recovery-coat',
    price: 720,
    inventoryCount: 3,
    metaCatalogId: 'catalog_978',
    metaProductRetailerId: 'recovery-coat'
  });
  const order = await createOrder(businessId, {
    customerName: 'Recovery Buyer',
    customerPhone: '+27821230002',
    items: [{ productId: product.id, quantity: 1 }]
  });

  const carts = await listAbandonedCarts(businessId, { olderThanMinutes: 0 });
  const sent = await sendAbandonedCartRecovery({ businessId, orderId: order.id });
  const recovered = await getOrderById(businessId, order.id);
  const afterSend = await listAbandonedCarts(businessId, { olderThanMinutes: 0 });

  assert.equal(carts.some((cart) => cart.id === order.id), true);
  assert.match(sent.messageId, /^mock_/);
  assert.equal(sent.payload.interactive.type, 'order_details');
  assert.match(sent.payload.interactive.body.text, /still waiting for payment/i);
  assert.equal(sent.order.paymentReady, true);
  assert.equal(recovered.events.some((event) => event.eventType === 'cart_recovery.sent'), true);
  assert.equal(afterSend.find((cart) => cart.id === order.id).recoveryCount, 1);
});

test('commerce payments reconcile orders manually and from PayFast ITNs', async () => {
  const businessId = 977;
  const manualProduct = await createProduct(businessId, {
    name: 'Manual Payment Item',
    sku: 'manual-payment-item',
    price: 315,
    inventoryCount: 4,
    metaCatalogId: 'catalog_977',
    metaProductRetailerId: 'manual-payment-item'
  });
  const webhookProduct = await createProduct(businessId, {
    name: 'Webhook Payment Item',
    sku: 'webhook-payment-item',
    price: 480,
    inventoryCount: 4,
    metaCatalogId: 'catalog_977',
    metaProductRetailerId: 'webhook-payment-item'
  });
  const manualOrder = await createOrder(businessId, {
    customerName: 'Manual Paid Buyer',
    customerPhone: '+27821230003',
    items: [{ productId: manualProduct.id, quantity: 1 }]
  });
  const webhookOrder = await createOrder(businessId, {
    customerName: 'Webhook Paid Buyer',
    customerPhone: '+27821230004',
    items: [{ productId: webhookProduct.id, quantity: 1 }]
  });

  const manual = await reconcileOrderPayment({
    businessId,
    orderId: manualOrder.id,
    provider: 'payfast',
    providerPaymentId: 'manual_pf_1',
    amount: '315.00',
    paymentStatus: 'COMPLETE'
  });
  const raw = {
    pf_payment_id: 'pf_commerce_1',
    m_payment_id: webhookOrder.paymentReference,
    payment_status: 'COMPLETE',
    amount_gross: webhookOrder.total,
    item_name: `Order ${webhookOrder.id}`,
    custom_int1: String(businessId)
  };
  raw.signature = signPayFastData(raw);
  const webhook = await processJob({
    type: 'webhook.payfast.itn',
    payload: {
      eventType: raw.payment_status,
      summary: summarizePayFastEvent(raw),
      checks: { signature: verifyPayFastSignature(raw), serverConfirmation: { ok: true } },
      raw
    }
  });
  const paidByWebhook = await getOrderById(businessId, webhookOrder.id);
  const mismatch = await reconcileOrderPayment({
    businessId,
    orderId: manualOrder.id,
    provider: 'payfast',
    providerPaymentId: 'manual_bad_amount',
    amount: '1.00',
    paymentStatus: 'COMPLETE'
  });

  assert.equal(manual.status, 'processed');
  assert.equal(manual.order.status, 'paid');
  assert.equal(manual.order.events.some((event) => event.eventType === 'payment.reconciled'), true);
  assert.equal(webhook.kind, 'commerce');
  assert.equal(webhook.result.status, 'processed');
  assert.equal(paidByWebhook.status, 'paid');
  assert.equal(paidByWebhook.events.some((event) => event.eventType === 'payment.reconciled'), true);
  assert.equal(mismatch.status, 'rejected');
});

test('commerce returns track refund requests and update order status', async () => {
  const businessId = 976;
  const product = await createProduct(businessId, {
    name: 'Refundable Dress',
    sku: 'refundable-dress',
    price: 640,
    inventoryCount: 5,
    metaCatalogId: 'catalog_976',
    metaProductRetailerId: 'refundable-dress'
  });
  const order = await createOrder(businessId, {
    customerName: 'Refund Buyer',
    customerPhone: '+27821230005',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: order.id,
    provider: 'payfast',
    providerPaymentId: 'return_paid_1',
    amount: '640.00',
    paymentStatus: 'COMPLETE'
  });

  const request = await createReturnRequest({
    businessId,
    orderId: order.id,
    reason: 'Wrong size',
    resolution: 'refund',
    amount: '640.00'
  });
  const approved = await updateReturnRequest({
    businessId,
    returnId: request.id,
    status: 'approved',
    note: 'Approved by support'
  });
  const refunded = await updateReturnRequest({
    businessId,
    returnId: request.id,
    status: 'refunded',
    refundReference: 'PF-REF-976',
    note: 'Refund processed'
  });
  const returns = await listReturnRequests(businessId);
  const detail = await getOrderById(businessId, order.id);

  assert.equal(request.status, 'requested');
  assert.equal(request.amount, '640.00');
  assert.equal(approved.status, 'approved');
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.refundReference, 'PF-REF-976');
  assert.equal(returns.some((item) => item.id === request.id), true);
  assert.equal(detail.status, 'refunded');
  assert.equal(detail.events.some((event) => event.eventType === 'return.requested'), true);
  assert.equal(detail.events.some((event) => event.eventType === 'return.status_updated'), true);
});

test('commerce customer segments power post-purchase WhatsApp prompts', async () => {
  const businessId = 975;
  const product = await createProduct(businessId, {
    name: 'Segment Basket',
    sku: 'segment-basket',
    price: 550,
    inventoryCount: 9,
    metaCatalogId: 'catalog_975',
    metaProductRetailerId: 'segment-basket'
  });
  const firstOrder = await createOrder(businessId, {
    customerName: 'Segment Buyer',
    customerPhone: '+27821230006',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: firstOrder.id,
    provider: 'payfast',
    providerPaymentId: 'segment_paid_1',
    amount: '550.00',
    paymentStatus: 'COMPLETE'
  });
  const secondOrder = await createOrder(businessId, {
    customerName: 'Segment Buyer',
    customerPhone: '+27821230006',
    items: [{ productId: product.id, quantity: 2 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: secondOrder.id,
    provider: 'payfast',
    providerPaymentId: 'segment_paid_2',
    amount: '1100.00',
    paymentStatus: 'COMPLETE'
  });
  await createOrder(businessId, {
    customerName: 'Follow Up Buyer',
    customerPhone: '+27821230007',
    items: [{ productId: product.id, quantity: 1 }]
  });

  const segments = await getCommerceCustomerSegments(businessId);
  const prompt = await sendPostPurchasePrompt({ businessId, orderId: firstOrder.id, promptType: 'review' });
  const detail = await getOrderById(businessId, firstOrder.id);

  assert.equal(segments.summary.customers, 2);
  assert.equal(segments.segments.find((segment) => segment.id === 'repeat_buyer').count, 1);
  assert.equal(segments.segments.find((segment) => segment.id === 'vip_customer').count, 1);
  assert.equal(segments.segments.find((segment) => segment.id === 'needs_follow_up').count, 1);
  assert.match(prompt.messageId, /^mock_/);
  assert.equal(prompt.promptType, 'review');
  assert.match(prompt.body, /How was your experience/i);
  assert.equal(detail.events.some((event) => event.eventType === 'post_purchase.review.sent'), true);
});

test('commerce post-purchase prompts can be scheduled through the worker', async () => {
  const previousDelay = process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS;
  process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS = '0';
  try {
    const businessId = 974;
    const product = await createProduct(businessId, {
      name: 'Scheduled Prompt Product',
      sku: 'scheduled-prompt-product',
      price: 275,
      inventoryCount: 6,
      metaCatalogId: 'catalog_974',
      metaProductRetailerId: 'scheduled-prompt-product'
    });
    const order = await createOrder(businessId, {
      customerName: 'Scheduled Buyer',
      customerPhone: '+27821230008',
      items: [{ productId: product.id, quantity: 1 }]
    });
    await reconcileOrderPayment({
      businessId,
      orderId: order.id,
      provider: 'payfast',
      providerPaymentId: 'scheduled_paid_1',
      amount: '275.00',
      paymentStatus: 'COMPLETE'
    });

    const scheduled = await schedulePostPurchasePrompts({
      businessId,
      orderId: order.id,
      triggers: ['follow_up']
    });
    const worker = await runOnce({ limit: 10 });
    const detail = await getOrderById(businessId, order.id);

    assert.equal(scheduled.scheduled.length, 1);
    assert.equal(scheduled.scheduled[0].promptType, 'follow_up');
    assert.equal(worker.processed >= 1, true);
    assert.equal(detail.events.some((event) => event.eventType === 'post_purchase.scheduled'), true);
    assert.equal(detail.events.some((event) => event.eventType === 'post_purchase.follow_up.sent'), true);
  } finally {
    if (previousDelay === undefined) delete process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS;
    else process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS = previousDelay;
  }
});

test('commerce automation rules tune automatic post-purchase scheduling', async () => {
  const businessId = 973;
  const product = await createProduct(businessId, {
    name: 'Automation Rule Product',
    sku: 'automation-rule-product',
    price: 325,
    inventoryCount: 6,
    metaCatalogId: 'catalog_973',
    metaProductRetailerId: 'automation-rule-product'
  });
  const rules = await listCommerceAutomationRules(businessId);
  assert.equal(rules.some((rule) => rule.ruleKey === 'follow_up_after_payment'), true);

  const disabled = await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: false,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  assert.equal(disabled.enabled, false);

  const order = await createOrder(businessId, {
    customerName: 'Automation Buyer',
    customerPhone: '+27821230009',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: order.id,
    provider: 'payfast',
    providerPaymentId: 'automation_paid_1',
    amount: '325.00',
    paymentStatus: 'COMPLETE'
  });

  const skipped = await applyCommerceAutomationRulesForOrder({ businessId, orderId: order.id, source: 'test_disabled' });
  assert.equal(skipped.scheduled.length, 0);
  assert.equal(skipped.skipped.some((item) => item.ruleKey === 'follow_up_after_payment' && item.reason === 'disabled'), true);

  const enabled = await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const applied = await applyCommerceAutomationRulesForOrder({ businessId, orderId: order.id, source: 'test_enabled' });
  const worker = await runOnce({ limit: 10 });
  const detail = await getOrderById(businessId, order.id);

  assert.equal(enabled.enabled, true);
  assert.equal(applied.scheduled.length, 1);
  assert.equal(applied.scheduled[0].ruleKey, 'follow_up_after_payment');
  assert.equal(worker.processed >= 1, true);
  assert.equal(detail.events.some((event) => event.eventType === 'automation.rules_applied'), true);
  assert.equal(detail.events.some((event) => event.eventType === 'post_purchase.follow_up.sent'), true);
});

test('commerce automation rule preview shows ready and already scheduled orders', async () => {
  const businessId = 969;
  const product = await createProduct(businessId, {
    name: 'Automation Preview Product',
    sku: 'automation-preview-product',
    price: 380,
    inventoryCount: 5,
    metaCatalogId: 'catalog_969',
    metaProductRetailerId: 'automation-preview-product'
  });
  const order = await createOrder(businessId, {
    customerName: 'Preview Buyer',
    customerPhone: '+27821230012',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: order.id,
    provider: 'payfast',
    providerPaymentId: 'automation_preview_paid_1',
    amount: '380.00',
    paymentStatus: 'COMPLETE'
  });

  const preview = await previewCommerceAutomationRule({ businessId, ruleId: 'follow_up_after_payment' });

  assert.equal(preview.rule.ruleKey, 'follow_up_after_payment');
  assert.equal(preview.summary.matchingOrders, 1);
  assert.equal(preview.summary.alreadyScheduled, 1);
  assert.equal(preview.summary.readyToSchedule, 0);
  assert.equal(preview.orders[0].alreadyScheduled, true);
});

test('commerce automation insights attribute scheduled and sent prompts to rules', async () => {
  const businessId = 972;
  const product = await createProduct(businessId, {
    name: 'Automation Insight Product',
    sku: 'automation-insight-product',
    price: 410,
    inventoryCount: 6,
    metaCatalogId: 'catalog_972',
    metaProductRetailerId: 'automation-insight-product'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const order = await createOrder(businessId, {
    customerName: 'Insight Buyer',
    customerPhone: '+27821230010',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: order.id,
    provider: 'payfast',
    providerPaymentId: 'automation_insight_paid_1',
    amount: '410.00',
    paymentStatus: 'COMPLETE'
  });
  await runOnce({ limit: 10 });

  const insights = await getCommerceAutomationInsights(businessId);
  const followUp = insights.rules.find((rule) => rule.ruleKey === 'follow_up_after_payment');

  assert.equal(insights.summary.scheduled >= 1, true);
  assert.equal(insights.summary.sent >= 1, true);
  assert.equal(insights.summary.estimatedCostCents >= 0, true);
  assert.equal(followUp.metrics.scheduled, 1);
  assert.equal(followUp.metrics.sent, 1);
  assert.equal(followUp.metrics.estimatedCostCents >= 0, true);
  assert.equal(followUp.metrics.sendRate, 100);
  assert.equal(followUp.recommendation.action, 'Monitor');
  assert.equal(insights.recommendations.length >= 1, true);
  assert.equal(insights.recent.some((event) => event.ruleKey === 'follow_up_after_payment' && event.type === 'sent'), true);
});

test('commerce automation insights attribute later paid orders as rule revenue', async () => {
  const businessId = 971;
  const product = await createProduct(businessId, {
    name: 'Automation Revenue Product',
    sku: 'automation-revenue-product',
    price: 610,
    inventoryCount: 8,
    metaCatalogId: 'catalog_971',
    metaProductRetailerId: 'automation-revenue-product'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'reorder_after_completion',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const firstOrder = await createOrder(businessId, {
    customerName: 'Revenue Buyer',
    customerPhone: '+27821230011',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: firstOrder.id,
    provider: 'payfast',
    providerPaymentId: 'automation_revenue_paid_1',
    amount: '610.00',
    paymentStatus: 'COMPLETE'
  });
  await updateOrderStatus({ businessId, orderId: firstOrder.id, status: 'completed' });
  await runOnce({ limit: 10 });

  const secondOrder = await createOrder(businessId, {
    customerName: 'Revenue Buyer',
    customerPhone: '+27821230011',
    items: [{ productId: product.id, quantity: 2 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: secondOrder.id,
    provider: 'payfast',
    providerPaymentId: 'automation_revenue_paid_2',
    amount: '1220.00',
    paymentStatus: 'COMPLETE'
  });

  const insights = await getCommerceAutomationInsights(businessId);
  const expiredInsights = await getCommerceAutomationInsights(businessId, { attributionDays: 0 });
  const reorder = insights.rules.find((rule) => rule.ruleKey === 'reorder_after_completion');
  const expiredReorder = expiredInsights.rules.find((rule) => rule.ruleKey === 'reorder_after_completion');

  assert.equal(reorder.metrics.sent, 1);
  assert.equal(reorder.metrics.attributedOrders, 1);
  assert.equal(reorder.metrics.attributedRevenue, '1220.00');
  assert.equal(reorder.metrics.estimatedCostCents >= 0, true);
  assert.equal(reorder.metrics.roi === null || reorder.metrics.roi >= 0, true);
  assert.equal(['Scale', 'Keep running'].includes(reorder.recommendation.action), true);
  assert.equal(insights.summary.attributedRevenue, '1220.00');
  assert.equal(insights.summary.roi === null || insights.summary.roi >= 0, true);
  assert.equal(insights.attribution.windowDays, 30);
  assert.equal(insights.recent.some((event) => event.type === 'attributed_order' && event.orderId === secondOrder.id), true);
  assert.equal(expiredInsights.attribution.windowDays, 1);
  assert.equal(expiredReorder.metrics.attributedOrders, 1);
});

test('commerce automation insights recommend setup checks for idle rules', async () => {
  const insights = await getCommerceAutomationInsights(970);
  const idleRule = insights.rules.find((rule) => rule.ruleKey === 'follow_up_after_payment');

  assert.equal(idleRule.recommendation.action, 'Watch setup');
  assert.equal(insights.recommendations.some((item) => item.action === 'Watch setup'), true);
});

test('Meta catalog sync builds readiness checks and items_batch payloads in mock mode', async () => {
  const businessId = 984;
  const product = await createProduct(businessId, {
    name: 'Catalog Sync Dress',
    sku: 'catalog-sync-dress',
    description: 'Ready for Meta catalog sync.',
    price: 459,
    inventoryCount: 7,
    imageUrl: 'https://example.co.za/catalog-sync-dress.jpg',
    paymentLinkUrl: 'https://example.co.za/products/catalog-sync-dress',
    metaCatalogId: 'catalog_sync_984',
    metaProductRetailerId: 'catalog-sync-dress'
  });
  await createProductVariant(businessId, product.id, {
    optionName: 'Size',
    optionValue: 'Large',
    sku: 'catalog-sync-dress-large',
    price: 479,
    inventoryCount: 3,
    metaProductRetailerId: 'catalog-sync-dress-large'
  });

  const preview = await getCatalogSyncPreview(businessId);
  const payload = buildItemsBatchPayload(preview.items);
  const synced = await syncMetaCatalog(businessId);

  assert.equal(preview.ready, true);
  assert.equal(preview.catalogId, 'catalog_sync_984');
  assert.equal(preview.itemCount, 2);
  assert.equal(preview.items[0].retailer_id, 'catalog-sync-dress');
  assert.equal(preview.items[0].price, '459.00 ZAR');
  assert.equal(payload.item_type, 'PRODUCT_ITEM');
  assert.equal(payload.requests[0].method, 'UPDATE');
  assert.equal(synced.mode, 'mock');
  assert.equal(synced.synced, 2);
});

test('Meta catalog sync preview blocks live readiness when catalog basics are missing', async () => {
  const businessId = 983;
  await createProduct(businessId, {
    name: 'Drafty Catalog Item',
    sku: 'drafty-catalog-item',
    description: 'Missing image and URL.',
    price: 99,
    inventoryCount: 2,
    metaCatalogId: 'catalog_sync_983'
  });

  const preview = await getCatalogSyncPreview(businessId);
  const items = buildCatalogItems({ products: await listProducts(businessId, { status: 'active' }), includeVariants: false });

  assert.equal(preview.ready, false);
  assert.equal(items.length, 1);
  assert.equal(preview.checks.find((check) => check.id === 'images').ok, false);
  assert.equal(preview.checks.find((check) => check.id === 'urls').ok, false);
  await assert.rejects(() => syncMetaCatalog(businessId), /Catalog is not ready/);
});

test('commerce variants, payment links, order status messages, and analytics support WhatsApp selling', async () => {
  const businessId = 985;
  const product = await createProduct(businessId, {
    name: 'Linen Shirt',
    sku: 'linen-shirt',
    price: '350.00',
    inventoryCount: 4,
    metaCatalogId: 'catalog_985',
    metaProductRetailerId: 'linen-shirt'
  });
  const variant = await createProductVariant(businessId, product.id, {
    optionName: 'Size',
    optionValue: 'Large',
    sku: 'linen-shirt-large',
    inventoryCount: 2
  });
  const order = await createOrder(businessId, {
    customerName: 'Variant Buyer',
    customerPhone: '+27821235551',
    items: [{ productId: product.id, quantity: 1 }]
  });
  const withPayment = await createOrderPaymentLink({ businessId, orderId: order.id, provider: 'yoco' });
  const detailPayload = buildOrderDetailsPayload({
    to: withPayment.customerPhone,
    order: withPayment,
    body: 'Please review and pay.'
  });
  const paymentMessage = await sendOrderPaymentLink({ businessId, orderId: order.id });
  const updated = await updateOrderStatus({
    businessId,
    orderId: order.id,
    status: 'paid',
    note: 'Paid during service test'
  });
  const fulfilled = await updateOrderFulfilment({
    businessId,
    orderId: order.id,
    provider: 'Fast Courier',
    trackingNumber: 'TRACK-985',
    trackingUrl: 'https://track.example.co.za/TRACK-985'
  });
  const statusMessage = await sendOrderStatusMessage({ businessId, orderId: order.id });
  const paid = await getOrderById(businessId, order.id);
  const statusPayload = buildOrderStatusPayload({ to: paid.customerPhone, order: paid });
  const variants = await listProductVariants(businessId, product.id);
  const analytics = await getCommerceAnalytics(businessId);
  const inventoryAlerts = await getInventoryAlerts(businessId, { threshold: 5 });

  assert.equal(variant.optionValue, 'Large');
  assert.equal(variants.some((item) => item.sku === 'linen-shirt-large'), true);
  assert.match(withPayment.paymentLinkUrl, /provider|order=|ref=/);
  assert.equal(detailPayload.interactive.type, 'order_details');
  assert.equal(detailPayload.interactive.action.parameters.payment_type, 'payment_link');
  assert.match(paymentMessage.messageId, /^mock_/);
  assert.equal(statusPayload.interactive.type, 'order_status');
  assert.match(statusMessage.messageId, /^mock_/);
  assert.equal(updated.status, 'paid');
  assert.equal(fulfilled.status, 'out_for_delivery');
  assert.equal(fulfilled.trackingNumber, 'TRACK-985');
  assert.match(JSON.stringify(statusPayload), /TRACK-985/);
  assert.equal(updated.events.some((event) => event.eventType === 'order.status_updated'), true);
  assert.equal(fulfilled.events.some((event) => event.eventType === 'order.fulfilment_updated'), true);
  assert.equal(analytics.summary.lowStock >= 1, true);
  assert.equal(inventoryAlerts.summary.alertCount >= 1, true);
  assert.equal(analytics.summary.paidOrders >= 1, true);
});

test('Meta order webhooks are extracted and recorded as commerce orders', async () => {
  await saveMetaCredentials(986, {
    wabaId: 'waba_commerce',
    phoneNumberId: 'phone_commerce',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_commerce'
  });
  await createProduct(986, {
    name: 'Webhook Dress',
    sku: 'webhook-dress',
    price: '399.00',
    metaCatalogId: 'catalog_986',
    metaProductRetailerId: 'webhook-dress'
  });
  const events = extractMetaEvents({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone_commerce' },
              contacts: [{ wa_id: '27821234444', profile: { name: 'Order Buyer' } }],
              messages: [
                {
                  from: '27821234444',
                  id: 'wamid.order.1',
                  type: 'order',
                  order: {
                    catalog_id: 'catalog_986',
                    text: 'Please process this order',
                    product_items: [
                      { product_retailer_id: 'webhook-dress', quantity: 1, item_price: 399, currency: 'ZAR' }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  });
  const processed = await processMetaEvent(events[0]);
  const orders = await listOrders(986);

  assert.equal(events[0].messageType, 'order');
  assert.equal(events[0].profileName, 'Order Buyer');
  assert.equal(processed.commerceOrder.totalCents, 39900);
  assert.equal(processed.chatbot, null);
  assert.equal(orders.some((order) => order.paymentReference === 'wamid.order.1'), true);
});

test('published chatbot flows respond to matching inbound Meta messages', async () => {
  await saveMetaCredentials(991, {
    wabaId: 'waba_bot',
    phoneNumberId: 'phone_bot',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_bot'
  });
  const flow = await duplicateFlowTemplate({
    businessId: 991,
    templateId: 'ecommerce_starter_flow',
    name: 'Runtime E-commerce Bot'
  });
  await publishChatbotFlow({ businessId: 991, flowId: flow.id });

  const processed = await processMetaEvent({
    type: 'message.received',
    phoneNumberId: 'phone_bot',
    from: '27821238888',
    messageId: 'wamid.bot.runtime.1',
    messageType: 'text',
    text: 'Product discovery'
  });
  const detail = await getConversation(991, processed.inbox.conversation.id);
  const outboundMessages = detail.messages.filter((message) => message.direction === 'outbound');

  assert.equal(processed.chatbot.matched, true);
  assert.equal(processed.chatbot.flowName, 'Runtime E-commerce Bot');
  assert.equal(processed.chatbot.session.status, 'completed');
  assert.equal(processed.chatbot.replies.length >= 2, true);
  assert.equal(outboundMessages.length >= 2, true);
  assert.equal(outboundMessages.some((message) => /welcome to E-commerce/i.test(message.body)), true);
});

test('chatbot runtime records handoff notes for agent escalation', async () => {
  await saveMetaCredentials(990, {
    wabaId: 'waba_handoff',
    phoneNumberId: 'phone_handoff',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_handoff'
  });
  const flow = await createChatbotFlow(990, {
    name: 'Runtime Handoff Bot',
    industryId: 'custom',
    industryName: 'Custom',
    definition: {
      version: 1,
      startNodeId: 'start',
      nodes: [
        { id: 'start', type: 'trigger', name: 'Start', config: { keywords: ['agent'] } },
        { id: 'welcome', type: 'message', name: 'Welcome', config: { body: 'I can connect you to the team now.' } },
        {
          id: 'branch',
          type: 'condition',
          name: 'Intent',
          config: { branches: [{ label: 'Agent', match: 'agent', targetNodeId: 'handoff' }] }
        },
        { id: 'handoff', type: 'action', name: 'Handoff', config: { action: 'assign_to_agent' } },
        { id: 'end', type: 'end', name: 'End', config: { outcome: 'handoff' } }
      ],
      edges: [
        { from: 'start', to: 'welcome' },
        { from: 'welcome', to: 'branch' },
        { from: 'handoff', to: 'end' }
      ]
    }
  });
  await publishChatbotFlow({ businessId: 990, flowId: flow.id });

  const processed = await processMetaEvent({
    type: 'message.received',
    phoneNumberId: 'phone_handoff',
    from: '27821237777',
    messageId: 'wamid.bot.handoff.1',
    messageType: 'text',
    text: 'agent'
  });
  const detail = await getConversation(990, processed.inbox.conversation.id);

  assert.equal(processed.chatbot.handoff, true);
  assert.equal(processed.chatbot.session.status, 'handoff');
  assert.equal(detail.notes.some((note) => /Bot escalation/.test(note.body)), true);
});

test('STOP inbound messages suppress contacts without starting chatbot automation', async () => {
  await saveMetaCredentials(989, {
    wabaId: 'waba_stop_bot',
    phoneNumberId: 'phone_stop_bot',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_stop_bot'
  });
  const flow = await duplicateFlowTemplate({
    businessId: 989,
    templateId: 'ecommerce_starter_flow',
    name: 'Runtime Stop Guard Bot'
  });
  await publishChatbotFlow({ businessId: 989, flowId: flow.id });

  const processed = await processMetaEvent({
    type: 'message.received',
    phoneNumberId: 'phone_stop_bot',
    from: '27821236666',
    messageId: 'wamid.bot.stop.1',
    messageType: 'text',
    text: 'STOP'
  });

  assert.equal(processed.consent.suppressed, true);
  assert.equal(processed.chatbot, null);
});

test('analytics overview summarizes demo campaign performance', async () => {
  const overview = await getAnalyticsOverview(1);

  assert.equal(overview.summary.campaigns >= 3, true);
  assert.equal(overview.summary.sent > 0, true);
  assert.match(overview.summary.deliveryRate, /%$/);
  assert.equal(percentage(50, 100), '50%');
});

test('Meta cost report uses configurable ZAR category rates', async () => {
  process.env.META_COST_MARKETING_ZAR_CENTS = '25';
  process.env.META_COST_UTILITY_ZAR_CENTS = '5';
  process.env.META_COST_AUTHENTICATION_ZAR_CENTS = '4';
  const rates = metaRateConfig();
  const report = await getMetaCostReport(1);

  assert.deepEqual(rates, { MARKETING: 25, UTILITY: 5, AUTHENTICATION: 4, AUTHENTICATION_INTERNATIONAL: 4, SERVICE: 0 });
  assert.equal(report.currency, 'ZAR');
  assert.equal(report.categories.length, 5);
  assert.equal(report.estimatedCostCents > 0, true);
  assert.equal(report.reconciled, false);
  assert.match(report.source, /Configured estimate/);
});

test('created campaigns preserve template category for reporting', async () => {
  const campaign = await repository.createCampaign({
    name: 'Utility Smoke',
    category: 'UTILITY',
    audience: 'VIP customers',
    body: 'Hi {{first_name}}, utility smoke.'
  });

  assert.equal(campaign.category, 'UTILITY');
});

test('Meta inbound messages are persisted into the unassigned inbox', async () => {
  await saveMetaCredentials(996, {
    wabaId: 'waba_inbox',
    phoneNumberId: 'phone_inbox',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_inbox'
  });

  const processed = await processMetaEvent({
    type: 'message.received',
    phoneNumberId: 'phone_inbox',
    from: '27821230000',
    messageId: 'wamid.inbox.1',
    messageType: 'text',
    text: 'Can you help with a booking?'
  });
  const conversations = await listConversations(996, { assigned: 'unassigned' });
  const conversation = conversations.find((item) => item.customerPhone === '+27821230000');
  const detail = await getConversation(996, conversation.id);

  assert.equal(processed.businessId, 996);
  assert.equal(processed.inbox.message.body, 'Can you help with a booking?');
  assert.equal(conversation.status, 'open');
  assert.equal(conversation.unreadCount, 1);
  assert.equal(detail.messages.length, 1);
  assert.equal(detail.messages[0].direction, 'inbound');
  assert.equal(normalizeInboxPhone('082 123 0000'), '+27821230000');
});

test('agents can assign, resolve, reopen, and reply to persisted conversations', async () => {
  const agent = await createBusinessUser({
    businessId: 1,
    name: 'Inbox Agent',
    email: 'inbox-agent@example.test',
    role: 'agent',
    password: 'AgentPass123!'
  });
  const inbound = await recordInboundMessage({
    businessId: 1,
    event: {
      type: 'message.received',
      from: '27821230001',
      messageId: 'wamid.inbox.2',
      messageType: 'text',
      text: 'Is the dress available?'
    }
  });

  const assigned = await updateConversation({
    businessId: 1,
    conversationId: inbound.conversation.id,
    assignedUserId: agent.id,
    status: 'resolved',
    markRead: true
  });
  assert.equal(assigned.assignedUserId, agent.id);
  assert.equal(assigned.status, 'resolved');
  assert.equal(assigned.unreadCount, 0);

  const reopened = await recordInboundMessage({
    businessId: 1,
    event: {
      type: 'message.received',
      from: '27821230001',
      messageId: 'wamid.inbox.3',
      messageType: 'text',
      text: 'Actually, what colours do you have?'
    }
  });
  const reply = await recordOutboundReply({
    businessId: 1,
    conversationId: inbound.conversation.id,
    body: 'We have green and black in stock.',
    actorUser: agent
  });
  const detail = await getConversation(1, inbound.conversation.id);

  assert.equal(reopened.conversation.status, 'open');
  assert.equal(reply.message.direction, 'outbound');
  assert.equal(reply.conversation.unreadCount, 0);
  assert.equal(detail.messages.some((message) => message.body === 'We have green and black in stock.'), true);
});

test('inbox notes, SLA, CSAT, and typing events are tracked', async () => {
  const events = [];
  const unsubscribe = subscribeInboxEvents(995, (event) => events.push(event));
  try {
    const agent = await createBusinessUser({
      businessId: 995,
      name: 'SLA Agent',
      email: 'sla-agent@example.test',
      role: 'agent',
      password: 'AgentPass123!'
    });
    const inbound = await recordInboundMessage({
      businessId: 995,
      event: {
        type: 'message.received',
        from: '27821235555',
        messageId: 'wamid.inbox.sla.1',
        messageType: 'text',
        text: 'I need help with my order.'
      }
    });

    const note = await addConversationNote({
      businessId: 995,
      conversationId: inbound.conversation.id,
      body: 'Customer has a paid order waiting for collection.',
      actorUser: agent
    });
    const typing = await recordTypingIndicator({
      businessId: 995,
      conversationId: inbound.conversation.id,
      actorUser: agent,
      isTyping: true
    });
    const resolved = await updateConversation({
      businessId: 995,
      conversationId: inbound.conversation.id,
      status: 'resolved',
      markRead: true
    });
    const csat = await recordConversationCsat({
      businessId: 995,
      conversationId: inbound.conversation.id,
      score: 5,
      comment: 'Fast and helpful'
    });
    const notes = await listConversationNotes(995, inbound.conversation.id);
    const detail = await getConversation(995, inbound.conversation.id);

    assert.equal(inbound.conversation.slaStatus, 'on_track');
    assert.equal(note.authorUserId, agent.id);
    assert.equal(typing.type, 'conversation.typing');
    assert.equal(resolved.slaStatus, 'resolved');
    assert.ok(resolved.csatRequestedAt);
    assert.equal(csat.csatScore, 5);
    assert.equal(notes.length, 1);
    assert.equal(detail.notes[0].body, 'Customer has a paid order waiting for collection.');
    assert.equal(events.some((event) => event.type === 'conversation.note.created'), true);
    assert.equal(events.some((event) => event.type === 'conversation.csat.received'), true);
  } finally {
    unsubscribe();
  }
});

test('POPIA data deletion request redacts contact inbox data and removes campaign recipients', async () => {
  resetDataDeletionForTests();
  await prepareCampaignRecipients({
    businessId: 1,
    campaignId: 12999,
    audience: 'VIP customers',
    body: 'Hi {{first_name}}, deletion smoke.'
  });
  const beforeRecipients = await listCampaignRecipients({ businessId: 1, campaignId: 12999 });
  const inbound = await recordInboundMessage({
    businessId: 1,
    event: {
      type: 'message.received',
      from: '27821234567',
      messageId: 'wamid.deletion.1',
      messageType: 'text',
      text: 'Please delete my data'
    }
  });

  const request = await createDataDeletionRequest({
    businessId: 1,
    phone: '+27 82 123 4567',
    requestedByUserId: 1,
    reason: 'Customer requested deletion'
  });
  const afterRecipients = await listCampaignRecipients({ businessId: 1, campaignId: 12999 });
  const detail = await getConversation(1, inbound.conversation.id);
  const requests = await listDataDeletionRequests(1);

  assert.equal(beforeRecipients.length, 1);
  assert.equal(request.status, 'completed');
  assert.equal(request.affectedCounts.contacts, 1);
  assert.equal(request.affectedCounts.campaignRecipients >= 1, true);
  assert.equal(request.affectedCounts.conversations >= 1, true);
  assert.equal(request.affectedCounts.messages >= 1, true);
  assert.equal(afterRecipients.length, 0);
  assert.equal(detail.conversation.customerName, 'Deleted contact');
  assert.match(detail.conversation.customerPhone, /^deleted:/);
  assert.equal(detail.messages[0].body, '[deleted by POPIA request]');
  assert.equal(requests.some((item) => item.id === request.id && item.phoneMasked.endsWith('4567')), true);
});

test('public preview data remains available without tenant context', () => {
  const preview = repository.getPublicPreviewData();

  assert.equal(preview.business.name, 'ChatClan Demo Store');
  assert.ok(preview.campaigns.length > 0);
});

function mockResponse() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
  return { res: response, get statusCode() { return response.statusCode; }, get body() { return response.body; } };
}
