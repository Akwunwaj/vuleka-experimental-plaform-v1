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
const { getRecaptchaClientConfig, verifyRecaptcha } = require('../src/services/recaptcha');
const {
  getSocialDataDeletionStatus,
  parseFacebookSignedRequest,
  processFacebookDataDeletion
} = require('../src/services/socialDataDeletion');
const repository = require('../src/services/repository');
const { processJob } = require('../src/services/jobProcessor');
const {
  verifyMetaChallenge,
  verifyMetaSignature,
  extractMetaEvents
} = require('../src/services/metaWebhook');
const { requestId, securityHeaders } = require('../src/middleware/security');
const { requireAuth, requireRole } = require('../src/middleware/auth');
const { requirePlatformAuth, requirePlatformRole } = require('../src/middleware/platformAuth');
const {
  hashPassword,
  authenticateUser,
  signSessionId,
  unsignSessionId,
  verifyPassword
} = require('../src/services/auth');
const {
  authenticatePlatformUser,
  createPlatformSession,
  destroyPlatformSession,
  getPlatformSession,
  signPlatformSessionId,
  unsignPlatformSessionId
} = require('../src/services/platformAuth');
const {
  calculateMrrCents,
  getPlatformOverview,
  getPlatformTenant,
  listPlatformAuditEvents,
  listPlatformTenantNotes,
  listPlatformTenants,
  recordPlatformAuditEvent,
  updatePlatformTenantStatus,
  createPlatformTenantNote
} = require('../src/services/platform');
const {
  assertPlatformGuardrailAllows,
  listPlatformGuardrails,
  updatePlatformGuardrail
} = require('../src/services/platformGuardrails');
const {
  createPlatformIncident,
  createPlatformIncidentEvent,
  getPlatformIncident,
  listPlatformIncidents,
  updatePlatformIncident
} = require('../src/services/platformIncidents');
const {
  checkAiProviderHealth,
  getAiOperationsOverview,
  getBusinessAiPolicy,
  listAiProviders,
  listAiUsage,
  orchestrateAiText,
  saveAiProviderConfig,
  saveBusinessAiPolicy
} = require('../src/services/aiControlPlane');
const { callAiProvider } = require('../src/services/aiProviderAdapters');
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
const { buildTemplateMessagePayload, sendTextMessage } = require('../src/services/metaClient');
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
const { enqueueJob, failJob, listJobs } = require('../src/services/jobQueue');
const { runOnce } = require('../src/worker');
const {
  buildReliabilityOverview,
  discardDeadLetterJob,
  getPlatformReliabilityOverview,
  recordWorkerHeartbeat,
  resetPlatformReliabilityForTests,
  retryDeadLetterJob,
  summarizeProviderReliability
} = require('../src/services/platformReliability');
const {
  acknowledgePlatformReliabilityAlert,
  assignPlatformReliabilityAlert,
  buildPlatformReliabilitySignals,
  evaluatePlatformReliabilityAlerts,
  getPlatformReliabilityAlertCenter,
  resetPlatformReliabilityAlertsForTests,
  updatePlatformReliabilityAlertPolicy
} = require('../src/services/platformReliabilityAlerts');
const {
  createBusinessUser,
  deactivateBusinessUser,
  listBusinessUsers,
  requestPasswordReset,
  resetPassword,
  updateBusinessUserRole
} = require('../src/services/users');
const { getMockOutbox, resetMailerForTests, sendPublicLeadEmails, verifyMailer } = require('../src/services/mailer');
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
const {
  evaluateDraftSafety,
  generateInboxAiDraft,
  getInboxAiDraftMetrics,
  markInboxAiDraftOutcome,
  redactConversationText,
  validateInboxAiDraftForUse
} = require('../src/services/inboxAiDrafts');
const {
  createKnowledgeItem,
  getKnowledgeOverview,
  retrieveTenantKnowledge,
  updateKnowledgeItem
} = require('../src/services/tenantKnowledge');
const {
  archiveKnowledgeSource,
  createApiPushConnector,
  importKnowledgeContent,
  ingestApiConnectorRecords,
  listKnowledgeSources,
  parseImportRecords
} = require('../src/services/knowledgeIngestion');
const { extractDocumentText } = require('../src/services/documentExtraction');
const {
  createKnowledgeConnector,
  deleteKnowledgeConnector,
  fetchGoogleDriveRecords,
  fetchShopifyRecords,
  fetchWooCommerceRecords
} = require('../src/services/knowledgeConnectors');
const {
  beginGoogleDriveOAuth,
  completeGoogleDriveOAuth,
  getGoogleDriveOAuthStatus,
  revokeGoogleDriveCredentials
} = require('../src/services/googleDriveOAuth');
const {
  beginTenantCrmOAuth,
  completeTenantCrmOAuth,
  getTenantCrmProviderStatus,
  providerProperties,
  PROVIDER_MAPPINGS
} = require('../src/services/tenantCrm');
const {
  beginConnectorSyncRun,
  completeConnectorSyncRun,
  getKnowledgeConnectorOperations,
  listConnectorSyncRuns
} = require('../src/services/knowledgeConnectorOperations');
const {
  acknowledgeConnectorAlert,
  evaluateConnectorAlerts,
  getConnectorAlertCenter,
  updateConnectorAlertPolicy
} = require('../src/services/connectorAlerts');
const {
  createKnowledgeEvaluationCase,
  listKnowledgeEvaluationRuns,
  runKnowledgeEvaluations,
  unsupportedClaimRisk
} = require('../src/services/knowledgeEvaluations');
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
  createProductFromOrderItem,
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
  applyCommerceAutomationRuleToReadyOrders,
  applyCommerceAutomationRulesForOrder,
  installCommerceAutomationTemplate,
  listCommerceAutomationRules,
  listAbandonedCarts,
  listCoupons,
  listProductCollections,
  listOrders,
  listProducts,
  listProductVariants,
  listReturnRequests,
  linkOrderItemToProduct,
  previewCommerceAutomationRule,
  reconcileOrderPayment,
  sendAbandonedCartRecovery,
  sendOrderPaymentLink,
  sendOrderStatusMessage,
  sendPostPurchasePrompt,
  schedulePostPurchasePrompts,
  shareCatalog,
  shareProductCollection,
  submitCommerceAutomationTemplate,
  syncCommerceAutomationTemplates,
  updateCommerceAutomationRule,
  updateOrderFulfilment,
  updateProduct,
  updateReturnRequest,
  updateOrderStatus
} = require('../src/services/commerce');
const {
  renderLoginPage,
  renderPage,
  renderPasswordResetPage,
  renderPublicInformationPage,
  renderPublicLeadPage,
  renderMarketingPage,
  renderPlatformDashboardPage,
  renderPlatformLoginPage,
  renderSignupPage,
  renderSocialSignupCompletionPage
} = require('../src/views');
const { publicInformationPages } = require('../src/data/publicPolicies');
const { publicMarketingPages } = require('../src/data/publicSite');
const { addPublicLeadEvent, createPublicLead, exportPublicLeadsCsv, getPublicLead, getPublicLeadSummary, listPublicLeadEvents, listPublicLeads, updatePublicLead } = require('../src/services/publicLeads');
const { crmLeadPayload, deliverPublicLeadToHubSpot, deliverPublicLeadWebhook, getPublicLeadCrmStatus } = require('../src/services/publicLeadCrm');
const { processPublicLeadSla, queuePublicLeadSlaChecks } = require('../src/services/publicLeadSla');
const { getCrmConfiguration, saveCrmConfiguration, testCrmConfiguration } = require('../src/services/crmConfiguration');

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
  assert.match(headers['content-security-policy'], /google\.com\/recaptcha/);
  assert.match(headers['content-security-policy'], /frame-src/);
  assert.match(headers['content-security-policy'], /script-src 'self' 'nonce-/);
});

test('reCAPTCHA validates action, score, hostname, and token age', async () => {
  const keys = ['RECAPTCHA_MODE', 'RECAPTCHA_SITE_KEY', 'RECAPTCHA_SECRET_KEY', 'RECAPTCHA_MIN_SCORE', 'RECAPTCHA_ALLOWED_HOSTNAMES'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const now = Date.now();
  process.env.RECAPTCHA_MODE = 'enforced';
  process.env.RECAPTCHA_SITE_KEY = 'site-key';
  process.env.RECAPTCHA_SECRET_KEY = 'secret-key';
  process.env.RECAPTCHA_MIN_SCORE = '0.5';
  process.env.RECAPTCHA_ALLOWED_HOSTNAMES = 'chatclan.example,localhost';
  const assessment = {
    success: true,
    score: 0.9,
    action: 'tenant_login',
    challenge_ts: new Date(now - 20_000).toISOString(),
    hostname: 'chatclan.example'
  };
  const fetchAssessment = (overrides = {}) => async (url, options) => {
    assert.equal(url, 'https://www.google.com/recaptcha/api/siteverify');
    assert.match(String(options.body), /secret=secret-key/);
    return { ok: true, json: async () => ({ ...assessment, ...overrides }) };
  };

  try {
    assert.deepEqual(getRecaptchaClientConfig(), { enabled: true, siteKey: 'site-key' });
    const verified = await verifyRecaptcha({ token: 'valid-token', expectedAction: 'tenant_login', remoteIp: '127.0.0.1', fetchImpl: fetchAssessment(), now });
    assert.equal(verified.ok, true);
    assert.equal(verified.score, 0.9);

    for (const overrides of [
      { action: 'tenant_signup' },
      { score: 0.2 },
      { hostname: 'attacker.example' },
      { challenge_ts: new Date(now - 180_000).toISOString() }
    ]) {
      await assert.rejects(
        verifyRecaptcha({ token: 'invalid-token', expectedAction: 'tenant_login', fetchImpl: fetchAssessment(overrides), now }),
        (error) => error.code === 'RECAPTCHA_FAILED' && error.status === 403
      );
    }
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test('all account entry forms render action-specific reCAPTCHA and protected social starts', () => {
  const recaptcha = { enabled: true, siteKey: 'public-site-key' };
  const socialProviders = [
    { id: 'google', name: 'Google', configured: true },
    { id: 'facebook', name: 'Facebook', configured: true }
  ];
  const login = renderLoginPage({ socialProviders, recaptcha });
  const signup = renderSignupPage({ socialProviders, recaptcha });
  const reset = renderPasswordResetPage({ recaptcha });
  const platform = renderPlatformLoginPage({ recaptcha });
  const socialCompletion = renderSocialSignupCompletionPage({
    recaptcha,
    token: 'social-token',
    verification: { providerName: 'Google', email: 'owner@example.co.za', name: 'Owner', planCode: 'starter' }
  });

  assert.match(login, /data-recaptcha-action="tenant_login"/);
  assert.match(signup, /data-recaptcha-action="tenant_signup"/);
  assert.match(signup, /data-plan-code="starter"/);
  assert.match(signup, /data-plan-code="growth"/);
  assert.match(signup, /data-plan-code="pro"/);
  assert.match(signup, /aria-pressed="true"/);
  assert.match(reset, /data-recaptcha-action="password_reset"/);
  assert.match(platform, /data-recaptcha-action="platform_login"/);
  assert.match(socialCompletion, /data-recaptcha-action="social_signup_complete"/);
  assert.match(login, /api\.js\?render=public-site-key/);
  assert.match(login, /data-provider="google"/);
  assert.match(login, /data-provider="facebook"/);
  assert.match(login, /data-purpose="signin"/);
  assert.doesNotMatch(login, /auth\/social\/google\/start\?/);
});

test('Facebook data deletion verifies signed requests and returns a traceable completion', async () => {
  const originalSecret = process.env.SOCIAL_FACEBOOK_CLIENT_SECRET;
  process.env.SOCIAL_FACEBOOK_CLIENT_SECRET = 'facebook-test-secret';
  try {
    const payload = Buffer.from(JSON.stringify({
      algorithm: 'HMAC-SHA256',
      issued_at: Math.floor(Date.now() / 1000),
      user_id: `facebook-delete-${Date.now()}`
    })).toString('base64url');
    const signature = crypto
      .createHmac('sha256', process.env.SOCIAL_FACEBOOK_CLIENT_SECRET)
      .update(payload)
      .digest('base64url');
    const signedRequest = `${signature}.${payload}`;

    assert.equal(parseFacebookSignedRequest(signedRequest).user_id.startsWith('facebook-delete-'), true);
    assert.throws(
      () => parseFacebookSignedRequest(`tampered.${payload}`),
      (error) => error.code === 'INVALID_FACEBOOK_SIGNED_REQUEST' && error.status === 400
    );

    const response = await processFacebookDataDeletion({ signedRequest });
    assert.match(response.confirmation_code, /^[a-f0-9]{24}$/);
    assert.match(response.url, /\/data-deletion\/status\?code=/);
    const status = await getSocialDataDeletionStatus(response.confirmation_code);
    assert.equal(status.status, 'completed');
  } finally {
    if (originalSecret === undefined) delete process.env.SOCIAL_FACEBOOK_CLIENT_SECRET;
    else process.env.SOCIAL_FACEBOOK_CLIENT_SECRET = originalSecret;
  }
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

test('platform auth uses a separate session and middleware boundary', async () => {
  const user = await authenticatePlatformUser('owner@chatclan.co.za', process.env.PLATFORM_OWNER_PASSWORD || process.env.DEMO_ADMIN_PASSWORD || 'ChangeMe123!');
  assert.equal(user.email, 'owner@chatclan.co.za');
  assert.equal(user.role, 'owner');

  const session = await createPlatformSession(user, 'node-test', '127.0.0.1');
  const signed = signPlatformSessionId(session.id);
  assert.equal(unsignPlatformSessionId(signed), session.id);

  const stored = await getPlatformSession(session.id);
  assert.equal(stored.user.email, user.email);

  const anonymous = mockResponse();
  requirePlatformAuth({ id: 'platform_anon', platformUser: null }, anonymous.res, () => {
    throw new Error('anonymous platform request should not pass');
  });

  const forbidden = mockResponse();
  requirePlatformRole(['owner'])({ id: 'platform_role', platformUser: { role: 'operator' } }, forbidden.res, () => {
    throw new Error('operator should not pass owner-only gate');
  });

  let ownerPassed = false;
  requirePlatformRole(['owner'])({ id: 'platform_owner', platformUser: user }, mockResponse().res, () => {
    ownerPassed = true;
  });

  await destroyPlatformSession(session.id);
  assert.equal(await getPlatformSession(session.id), null);
  assert.equal(anonymous.statusCode, 401);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(ownerPassed, true);
});

test('landing CTAs route prospects to signup and auth pages do not render dashboard shell', () => {
  const publicPage = renderPage(repository.getPublicPreviewData(), { authenticated: false });
  const socialProviders = listSocialProviders();
  const loginPage = renderLoginPage({ authenticated: true, socialProviders });
  const signupPage = renderSignupPage({ planCode: 'growth', socialProviders });
  const resetPage = renderPasswordResetPage({ authenticated: false });

  assert.match(publicPage, /class="btn-hero" href="\/signup"/);
  assert.match(publicPage, /class="nav-trial" href="\/signup"/);
  assert.match(publicPage, /class="main-nav" aria-label="Primary navigation"/);
  assert.match(publicPage, /data-landing-nav-toggle/);
  assert.match(publicPage, /class="journey-band"/);
  assert.match(publicPage, /Move every conversation forward/);
  assert.match(publicPage, /class="btn-hero-outline" href="\/login"/);
  assert.match(publicPage, /href="\/signup\?plan=growth"/);
  assert.doesNotMatch(publicPage, /data-open-app/);
  assert.doesNotMatch(publicPage, /<main class="app"/);
  assert.match(loginPage, /Continue to dashboard/);
  assert.match(loginPage, /href="\/password-reset"/);
  assert.match(loginPage, /password-toggle/);
  assert.doesNotMatch(loginPage, /ChangeMe123!/);
  assert.doesNotMatch(loginPage, /social-button disabled/);
  assert.doesNotMatch(loginPage, /id="passwordResetRequestForm"/);
  assert.doesNotMatch(loginPage, /<main class="app"/);
  assert.match(signupPage, /id="signupForm"/);
  assert.match(signupPage, /value="growth" selected/);
  assert.match(signupPage, /password-toggle/);
  assert.doesNotMatch(signupPage, /<main class="app"/);
  assert.doesNotMatch(publicPage, /1,200\+/);
  assert.doesNotMatch(publicPage, /4\.9\/5/);
  assert.doesNotMatch(publicPage, /Cloud API v21\.0/);
  assert.doesNotMatch(publicPage, /href="#"/);
  assert.match(publicPage, /href="\/privacy"/);
  assert.match(publicPage, /href="\/terms"/);
  assert.match(publicPage, /href="\/popia"/);
  assert.match(publicPage, /href="https:\/\/whatsappbusiness\.com\/policy\/"/);
  assert.match(publicPage, /href="\/contact"/);
  assert.match(resetPage, /id="passwordResetRequestForm"/);
  assert.match(resetPage, /Back to sign in/);
});

test('public marketing catalogue renders product, solution, pricing, and trust pages honestly', () => {
  const expectedPaths = [
    '/product/team-inbox',
    '/product/campaigns',
    '/product/automation',
    '/product/ai-assist',
    '/product/commerce',
    '/product/analytics',
    '/solutions/retail',
    '/solutions/services',
    '/solutions/agencies',
    '/solutions/customer-support',
    '/pricing',
    '/integrations',
    '/security',
    '/subprocessors'
  ];

  expectedPaths.forEach((path) => {
    const page = publicMarketingPages[path];
    assert.ok(page, `missing public marketing page for ${path}`);
    const html = renderMarketingPage({ ...page, path });
    assert.match(html, /class="main-nav" aria-label="Primary navigation"/);
    assert.match(html, /class="availability-label/);
    assert.match(html, /class="footer public-footer"/);
    assert.doesNotMatch(html, /href="#"/);
  });

  const aiPage = renderMarketingPage({ ...publicMarketingPages['/product/ai-assist'], path: '/product/ai-assist' });
  assert.match(aiPage, /OpenAI, Google, Anthropic, DeepSeek, or xAI/);
  assert.match(aiPage, /ChatClan owns the workflow; providers supply models/);
  assert.match(aiPage, /availability-label beta/);

  const agencyPage = renderMarketingPage({ ...publicMarketingPages['/solutions/agencies'], path: '/solutions/agencies' });
  assert.match(agencyPage, /availability-label planned/);
  assert.match(agencyPage, /white-label controls remain roadmap items/);

  const pricingPage = renderMarketingPage({ ...publicMarketingPages['/pricing'], path: '/pricing' });
  assert.match(pricingPage, /R 299/);
  assert.match(pricingPage, /R 799/);
  assert.match(pricingPage, /R 1(?:&nbsp;|\u00a0)999/);
  assert.match(pricingPage, /Meta message charges are separate/);
  assert.match(pricingPage, /Optional services/);
  assert.doesNotMatch(pricingPage, /White-label option|Dedicated account manager/);

  const securityPage = renderMarketingPage({ ...publicMarketingPages['/security'], path: '/security' });
  assert.match(securityPage, /does not currently claim ISO 27001, SOC 2, PCI DSS/);
  assert.doesNotMatch(securityPage, /ISO 27001 certified|official Meta partner/);
});

test('public conversion pages render protected forms, SEO evidence, and separate consent choices', () => {
  const page = renderPublicLeadPage({
    leadType: 'demo',
    nonce: 'test-csp-nonce',
    recaptcha: { enabled: true, siteKey: 'public-site-key' }
  });

  assert.match(page, /id="publicLeadForm"/);
  assert.match(page, /data-recaptcha-action="public_lead"/);
  assert.match(page, /name="consentToContact"/);
  assert.match(page, /name="marketingOptIn"/);
  assert.match(page, /Submitting this form does not create a WhatsApp marketing opt-in/);
  assert.match(page, /rel="canonical"/);
  assert.match(page, /application\/ld\+json" nonce="test-csp-nonce"/);
  assert.match(page, /id="publicConsentBanner"/);
  assert.match(page, /Optional analytics stays off unless you allow it/);
});

test('public leads validate consent, route high intent, deduplicate, notify, and progress', async () => {
  const email = `lead-${Date.now()}@example.co.za`;
  await assert.rejects(
    createPublicLead({ leadType: 'sales', name: 'No Consent', workEmail: email, company: 'Example', message: 'Please contact me.' }),
    /allow ChatClan to respond/
  );

  const lead = await createPublicLead({
    leadType: 'demo',
    name: 'Lerato Nkosi',
    workEmail: email,
    company: 'Nkosi Retail',
    roleTitle: 'Operations Director',
    phone: '+27821234567',
    preferredContact: 'whatsapp',
    teamSize: '21-50',
    monthlyConversations: '10000+',
    useCase: 'commerce',
    message: 'We need governed commerce and support workflows.',
    consentToContact: true,
    marketingOptIn: false,
    sourcePath: '/demo?utm_source=partner',
    utmSource: 'partner'
  }, { ipAddress: '127.0.0.1', userAgent: 'node-test' });

  assert.equal(lead.priority, 'high');
  assert.equal(lead.routeKey, 'sales_growth');
  assert.equal(lead.marketingOptIn, false);
  assert.equal(lead.responseDueAt > lead.createdAt, true);
  assert.match(lead.reference, /^CCL-\d{8}-[A-F0-9]{8}$/);
  assert.match(lead.ipHash, /^[a-f0-9]{64}$/);

  const duplicate = await createPublicLead({
    leadType: 'demo', name: 'Lerato Nkosi', workEmail: email, company: 'Nkosi Retail',
    message: 'Adding another workflow detail.', consentToContact: true
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.reference, lead.reference);

  resetMailerForTests();
  await sendPublicLeadEmails({ lead });
  const outbox = getMockOutbox();
  assert.equal(outbox.length, 2);
  assert.match(outbox[0].message.subject, /High-intent ChatClan demo enquiry/);
  assert.match(outbox[1].message.subject, new RegExp(lead.reference));

  const followUpAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const updated = await updatePublicLead({ leadId: lead.id, status: 'contacted', nextFollowUpAt:followUpAt });
  assert.equal(updated.status, 'contacted');
  assert.equal(updated.slaStatus, 'met');
  assert.equal(new Date(updated.nextFollowUpAt).toISOString(), followUpAt);
  assert.equal(updated.followUpStatus, 'scheduled');
  await addPublicLeadEvent({ leadId:lead.id, platformUser:{ id:1, name:'Platform Owner', email:'owner@chatclan.co.za' }, note:'Discovery call booked.' });
  const detail = await getPublicLead(lead.id);
  assert.equal(detail.reference, lead.reference);
  const events = await listPublicLeadEvents(lead.id);
  assert.equal(events.some((event) => event.note === 'Discovery call booked.'), true);
  await assert.rejects(updatePublicLead({ leadId:lead.id, status:'disqualified', disqualificationReason:'' }), /disqualification reason/);
  const leads = await listPublicLeads({ limit: 250 });
  assert.equal(leads.some((item) => item.reference === lead.reference), true);
  const summary = await getPublicLeadSummary();
  assert.equal(summary.demoRequests >= 1, true);
  assert.match(await exportPublicLeadsCsv(), /"Reference","Type","Status","Priority","SLA"/);
});

test('public lead CRM delivery signs a privacy-scoped payload and records delivery', async () => {
  const previous = { provider:process.env.CRM_LEAD_PROVIDER, enabled:process.env.CRM_LEAD_WEBHOOK_ENABLED, url:process.env.CRM_LEAD_WEBHOOK_URL, secret:process.env.CRM_LEAD_WEBHOOK_SECRET };
  process.env.CRM_LEAD_PROVIDER = 'webhook';
  process.env.CRM_LEAD_WEBHOOK_ENABLED = 'true';
  process.env.CRM_LEAD_WEBHOOK_URL = 'https://crm.example.test/chatclan-leads';
  process.env.CRM_LEAD_WEBHOOK_SECRET = 'test-webhook-secret';
  try {
    const lead = await createPublicLead({ leadType:'sales', name:'CRM Prospect', workEmail:`crm-${Date.now()}@example.co.za`, company:'CRM Test', message:'Connect this request.', consentToContact:true });
    assert.deepEqual(getPublicLeadCrmStatus(), { configured:true, destination:'crm.example.test', provider:'webhook' });
    const payload = crmLeadPayload(lead);
    assert.equal(payload.prospect.workEmail, lead.email);
    assert.equal('ipHash' in payload, false);
    let request;
    const result = await deliverPublicLeadWebhook({ leadId:lead.id }, { fetchImpl:async (url, options) => { request = { url, options }; return new Response('', { status:202 }); } });
    assert.equal(result.delivered, true);
    assert.equal(request.url, process.env.CRM_LEAD_WEBHOOK_URL);
    assert.match(request.options.headers['X-ChatClan-Signature'], /^sha256=[a-f0-9]{64}$/);
    const stored = await getPublicLead(lead.id);
    assert.equal(stored.crmDeliveryStatus, 'delivered');
  } finally {
    if (previous.provider === undefined) delete process.env.CRM_LEAD_PROVIDER; else process.env.CRM_LEAD_PROVIDER = previous.provider;
    if (previous.enabled === undefined) delete process.env.CRM_LEAD_WEBHOOK_ENABLED; else process.env.CRM_LEAD_WEBHOOK_ENABLED = previous.enabled;
    if (previous.url === undefined) delete process.env.CRM_LEAD_WEBHOOK_URL; else process.env.CRM_LEAD_WEBHOOK_URL = previous.url;
    if (previous.secret === undefined) delete process.env.CRM_LEAD_WEBHOOK_SECRET; else process.env.CRM_LEAD_WEBHOOK_SECRET = previous.secret;
  }
});

test('HubSpot CRM delivery upserts a contact and creates one associated lead', async () => {
  const previous = { provider:process.env.CRM_LEAD_PROVIDER, token:process.env.CRM_HUBSPOT_ACCESS_TOKEN, mode:process.env.CRM_HUBSPOT_DELIVERY_MODE };
  process.env.CRM_LEAD_PROVIDER = 'hubspot';
  process.env.CRM_HUBSPOT_ACCESS_TOKEN = 'private-test-token';
  process.env.CRM_HUBSPOT_DELIVERY_MODE = 'contacts_and_leads';
  try {
    const lead = await createPublicLead({ leadType:'demo', name:'Nandi Molefe', workEmail:`hubspot-${Date.now()}@example.co.za`, company:'Molefe Foods', roleTitle:'Director', phone:'+27821234567', message:'We need a CRM handover.', consentToContact:true });
    const requests = [];
    const responses = [{ results:[{ id:'contact-101' }] }, { results:[] }, { id:'lead-202' }];
    const result = await deliverPublicLeadToHubSpot({ leadId:lead.id }, { fetchImpl:async (url, options) => {
      requests.push({ url, options, body:JSON.parse(options.body) });
      return new Response(JSON.stringify(responses.shift()), { status:200, headers:{ 'Content-Type':'application/json' } });
    } });
    assert.equal(result.delivered, true);
    assert.equal(result.contactId, 'contact-101');
    assert.equal(result.hubspotLeadId, 'lead-202');
    assert.equal(requests[0].body.inputs[0].idProperty, 'email');
    assert.equal(requests[2].body.associations[0].types[0].associationTypeId, 578);
    assert.equal(requests[2].body.properties.hs_lead_name, `ChatClan ${lead.reference}`);
    assert.equal(requests.every((request) => request.options.headers.Authorization === 'Bearer private-test-token'), true);
  } finally {
    if (previous.provider === undefined) delete process.env.CRM_LEAD_PROVIDER; else process.env.CRM_LEAD_PROVIDER = previous.provider;
    if (previous.token === undefined) delete process.env.CRM_HUBSPOT_ACCESS_TOKEN; else process.env.CRM_HUBSPOT_ACCESS_TOKEN = previous.token;
    if (previous.mode === undefined) delete process.env.CRM_HUBSPOT_DELIVERY_MODE; else process.env.CRM_HUBSPOT_DELIVERY_MODE = previous.mode;
  }
});

test('HubSpot CRM delivery supports contacts-only accounts', async () => {
  const lead = await createPublicLead({ leadType:'sales', name:'Contact Only', workEmail:`hubspot-contact-${Date.now()}@example.co.za`, company:'Contact CRM', message:'Sync this contact.', consentToContact:true });
  const requests = [];
  const result = await deliverPublicLeadToHubSpot({ leadId:lead.id }, {
    runtimeConfig:{ configured:true, provider:'hubspot', hubspotDeliveryMode:'contacts_only', accessToken:'service-key' },
    fetchImpl:async (url, options) => {
      requests.push({ url, options });
      return new Response(JSON.stringify({ results:[{ id:'contact-only-101' }] }), { status:200, headers:{ 'Content-Type':'application/json' } });
    }
  });
  assert.equal(result.delivered, true);
  assert.equal(result.mode, 'contacts_only');
  assert.equal(result.contactId, 'contact-only-101');
  assert.equal(requests.length, 1);
});

test('lead SLA jobs notify once and preserve the in-app activity record', async () => {
  const lead = await createPublicLead({ leadType:'sales', name:'SLA Prospect', workEmail:`sla-${Date.now()}@example.co.za`, company:'SLA Test', message:'Please respond.', consentToContact:true });
  const queued = await queuePublicLeadSlaChecks(lead);
  assert.equal(queued.queued, true);
  resetMailerForTests();
  const first = await processPublicLeadSla({ leadId:lead.id });
  const second = await processPublicLeadSla({ leadId:lead.id });
  assert.equal(first.notified, true);
  assert.equal(second.reason, 'already_notified');
  assert.equal(getMockOutbox().length, 1);
  const events = await listPublicLeadEvents(lead.id);
  assert.equal(events.some((event) => event.eventType === 'sla_reminder'), true);
});

test('Platform Owner CRM configuration encrypts service keys, masks reads, and tests HubSpot access', async () => {
  const saved = await saveCrmConfiguration({ providerKey:'hubspot', hubspotDeliveryMode:'contacts_and_leads', enabled:true, accessToken:'hubspot-secret-token', timeoutMs:5000, platformUser:{ id:1 } });
  assert.equal(saved.configured, true);
  assert.equal(saved.providerKey, 'hubspot');
  assert.equal(saved.hubspotDeliveryMode, 'contacts_and_leads');
  assert.match(saved.accessTokenMasked, /oken$/);
  assert.equal('accessToken' in saved, false);
  const runtime = await getCrmConfiguration({ includeSecrets:true });
  assert.equal(runtime.accessToken, 'hubspot-secret-token');
  let authorization;
  const health = await testCrmConfiguration({ fetchImpl:async (_url, options) => { authorization=options.headers.Authorization; return new Response(JSON.stringify({ results:[] }), { status:200, headers:{'Content-Type':'application/json'} }); } });
  assert.equal(authorization, 'Bearer hubspot-secret-token');
  assert.equal(health.status, 'healthy');
});

test('public information pages escape copy and render the configured support link', () => {
  const page = renderPublicInformationPage({
    title: 'Privacy <Notice>',
    label: 'Policy',
    introduction: 'A clear notice.',
    sections: [{ title: 'Contact', paragraphs: ['Email {{supportEmail}} about <private> data.'] }]
  });

  assert.match(page, /Privacy &lt;Notice&gt;/);
  assert.match(page, /mailto:support@chatclan\.co\.za/);
  assert.match(page, /about &lt;private&gt; data/);
  assert.doesNotMatch(page, /<private>/);
});

test('public policies contain detailed South African, Meta, and platform-specific obligations', () => {
  const privacy = renderPublicInformationPage({ ...publicInformationPages['/privacy'], path: '/privacy' });
  const terms = renderPublicInformationPage({ ...publicInformationPages['/terms'], path: '/terms' });
  const popia = renderPublicInformationPage({ ...publicInformationPages['/popia'], path: '/popia' });
  const contact = renderPublicInformationPage({ ...publicInformationPages['/contact'], path: '/contact' });

  assert.match(privacy, /AI-assisted workflows/);
  assert.match(privacy, /Cross-border processing/);
  assert.match(privacy, /Customer WhatsApp content is not used by ChatClan to train a general-purpose AI model/);
  assert.match(terms, /Acceptable use/);
  assert.match(terms, /Consumer Protection Act/);
  assert.match(terms, /WhatsApp Business Terms of Service/);
  assert.match(popia, /The eight POPIA conditions/);
  assert.match(popia, /POPIA section 72/);
  assert.match(popia, /does not prescribe a general 72-hour threshold/);
  assert.doesNotMatch(popia, /within 72 hours/);
  assert.match(contact, /Registration number/);
  assert.match(contact, /Information Officer/);
  assert.doesNotMatch(`${privacy}${terms}${popia}${contact}`, /\{\{[a-zA-Z]+\}\}/);
});

test('platform pages render owner login and operational dashboard', async () => {
  await recordPlatformAuditEvent({
    platformUser: { id: 1, email: 'owner@chatclan.co.za' },
    action: 'platform.test.event',
    targetType: 'tenant',
    targetId: '1',
    reason: 'test coverage'
  });
  const overview = await getPlatformOverview();
  const loginPage = renderPlatformLoginPage({ authenticated: false });
  const dashboard = renderPlatformDashboardPage({ overview, user: { name: 'Platform Owner' } });

  assert.equal(overview.summary.tenants >= 1, true);
  assert.match(loginPage, /id="platformLoginForm"/);
  assert.match(loginPage, /\/api\/platform\/auth\/login/);
  assert.match(dashboard, /Platform control plane/);
  assert.match(dashboard, /Tenant Health/);
  assert.match(dashboard, /Vendor & Dependency Health/);
  assert.match(dashboard, /Recent Platform Audit/);
});

test('platform MRR excludes trials and non-paying subscriptions', () => {
  const tenants = [
    { billing: { status: 'active', recurringAmountCents: 79900 } },
    { billing: { status: 'trialing', recurringAmountCents: 29900 } },
    { billing: { status: 'pending', recurringAmountCents: 29900 } },
    { billing: { status: 'canceled', recurringAmountCents: 199900 } }
  ];

  assert.equal(calculateMrrCents(tenants), 79900);
});

test('platform service exposes tenant and audit read models', async () => {
  const tenants = await listPlatformTenants({ search: 'demo' });
  assert.equal(tenants.length >= 1, true);
  assert.equal(tenants[0].name, 'ChatClan Demo Store');
  assert.equal(tenants[0].billing.status, 'active');
  assert.equal(Array.isArray(tenants[0].health.checks), true);

  const event = await recordPlatformAuditEvent({
    platformUser: { id: 1, email: 'owner@chatclan.co.za' },
    action: 'platform.tenant.view',
    targetType: 'tenant',
    targetId: tenants[0].id
  });
  const events = await listPlatformAuditEvents({ limit: 10 });
  assert.equal(events.some((item) => item.id === event.id && item.action === 'platform.tenant.view'), true);
});

test('platform owner can update tenant status and create support notes with audit trail', async () => {
  const platformUser = { id: 1, email: 'owner@chatclan.co.za', role: 'owner' };
  const suspended = await updatePlatformTenantStatus({
    tenantId: 1,
    status: 'suspended',
    reason: 'Compliance review during test',
    platformUser
  });
  assert.equal(suspended.platform.status, 'suspended');
  assert.equal(suspended.health.overall, 'blocked');

  const note = await createPlatformTenantNote({
    tenantId: 1,
    note: 'Customer needs help completing Meta verification.',
    category: 'onboarding',
    platformUser
  });
  assert.equal(note.category, 'onboarding');

  const detail = await getPlatformTenant(1);
  const notes = await listPlatformTenantNotes(1);
  const events = await listPlatformAuditEvents({ limit: 20 });
  assert.equal(detail.notes.some((item) => item.id === note.id), true);
  assert.equal(notes.some((item) => item.note.includes('Meta verification')), true);
  assert.equal(events.some((item) => item.action === 'platform.tenant.status.update' && item.targetId === '1'), true);
  assert.equal(events.some((item) => item.action === 'platform.tenant.note.create' && item.targetId === '1'), true);

  await updatePlatformTenantStatus({
    tenantId: 1,
    status: 'active',
    reason: 'Test cleanup',
    platformUser
  });
});

test('platform guardrails can pause campaign dispatch and Meta outbound sends', async () => {
  const platformUser = { id: 1, email: 'owner@chatclan.co.za', role: 'owner' };
  const guardrails = await listPlatformGuardrails();
  assert.equal(guardrails.some((guardrail) => guardrail.key === 'campaign_dispatch'), true);

  try {
    const pausedCampaigns = await updatePlatformGuardrail({
      key: 'campaign_dispatch',
      enabled: true,
      reason: 'Smoke pause during test',
      platformUser
    });
    assert.equal(pausedCampaigns.enabled, true);
    await assert.rejects(
      () => assertPlatformGuardrailAllows('campaign_dispatch'),
      /Campaign dispatch is paused/
    );
    await assert.rejects(
      () => dispatchCampaign({ businessId: 1, campaignId: 1, limit: 1 }),
      /Campaign dispatch is paused/
    );

    await updatePlatformGuardrail({
      key: 'meta_live_sends',
      enabled: true,
      reason: 'Outbound freeze during test',
      platformUser
    });
    await assert.rejects(
      () => sendTextMessage({ businessId: 1, to: '27821234567', text: 'Guardrail smoke' }),
      /Meta outbound sends is paused/
    );
  } finally {
    await updatePlatformGuardrail({
      key: 'campaign_dispatch',
      enabled: false,
      reason: 'Test cleanup',
      platformUser
    });
    await updatePlatformGuardrail({
      key: 'meta_live_sends',
      enabled: false,
      reason: 'Test cleanup',
      platformUser
    });
  }
});

test('platform incidents preserve ownership, timeline, guardrail context, and resolution evidence', async () => {
  const platformUser = { id: 1, name: 'Platform Owner', email: 'owner@chatclan.co.za', role: 'owner' };
  const incident = await createPlatformIncident({
    title: 'Meta delivery latency',
    summary: 'Outbound delivery acknowledgements are delayed.',
    customerImpact: 'Some customer messages remain queued longer than expected.',
    severity: 'sev2',
    linkedGuardrailKey: 'meta_live_sends',
    platformUser
  });
  assert.equal(incident.status, 'open');
  assert.equal(incident.ownerEmail, platformUser.email);
  assert.equal(incident.events.some((event) => event.eventType === 'created'), true);

  await createPlatformIncidentEvent({
    incidentId: incident.id,
    note: 'Meta status and queue depth reviewed.',
    platformUser
  });
  const monitoring = await updatePlatformIncident({
    incidentId: incident.id,
    status: 'monitoring',
    severity: 'sev2',
    linkedGuardrailKey: 'meta_live_sends',
    platformUser
  });
  assert.equal(monitoring.status, 'monitoring');
  assert.equal(monitoring.events.some((event) => event.note.includes('Meta status')), true);
  await assert.rejects(
    () => updatePlatformIncident({ incidentId: incident.id, status: 'resolved', platformUser }),
    /resolutionNote is required/
  );

  const resolved = await updatePlatformIncident({
    incidentId: incident.id,
    status: 'resolved',
    resolutionNote: 'Queue depth returned to baseline and delivery acknowledgements recovered.',
    platformUser
  });
  assert.equal(resolved.status, 'resolved');
  assert.match(resolved.resolutionNote, /returned to baseline/);
  assert.equal((await getPlatformIncident(incident.id)).events.length >= 4, true);
  assert.equal((await listPlatformIncidents()).some((item) => item.id === incident.id), true);
});

test('AI control plane encrypts provider keys and exposes only masked configuration', async () => {
  const platformUser = { id:1, name:'Platform Owner', email:'owner@chatclan.co.za', role:'owner' };
  const provider = await saveAiProviderConfig({
    providerKey:'openai', enabled:true, apiKey:'sk-test-control-plane-secret',
    baseUrl:'https://api.openai.com/v1', defaultModel:'test-model', timeoutMs:25000, platformUser
  });
  assert.equal(provider.enabled, true);
  assert.equal(provider.defaultModel, 'test-model');
  assert.match(provider.apiKeyMasked, /cret$/);
  assert.equal(JSON.stringify(await listAiProviders()).includes('sk-test-control-plane-secret'), false);

  const rotatedWithoutPlaintext = await saveAiProviderConfig({
    providerKey:'openai', enabled:true, baseUrl:'https://api.openai.com/v1', defaultModel:'test-model-2', timeoutMs:25000, platformUser
  });
  assert.equal(rotatedWithoutPlaintext.apiKeyMasked, provider.apiKeyMasked);
});

test('tenant AI policy governs fallback, limits, mock inference, telemetry, and guardrails', async () => {
  const platformUser = { id:1, name:'Platform Owner', email:'owner@chatclan.co.za', role:'owner' };
  const policy = await saveBusinessAiPolicy({
    businessId:1, enabled:true, autonomyMode:'draft', providerChain:['openai','google'],
    monthlyBudgetCents:5000, monthlyTokenLimit:10000, maxResponseTokens:600,
    humanHandoffEnabled:true, platformUser
  });
  assert.deepEqual(policy.providerChain, ['openai','google']);
  assert.equal((await getBusinessAiPolicy(1)).autonomyMode, 'draft');

  const result = await orchestrateAiText({ businessId:1, prompt:'Help the customer track an order.', workflowKey:'inbox_assist' });
  assert.equal(result.mode, 'mock');
  assert.equal(result.provider, 'openai');
  assert.equal(result.autonomyMode, 'draft');
  const usage = await listAiUsage({ businessId:1 });
  assert.equal(usage.some((item) => item.workflowKey === 'inbox_assist' && item.status === 'succeeded'), true);
  assert.equal((await getAiOperationsOverview()).summary.configuredProviders >= 1, true);

  try {
    await updatePlatformGuardrail({ key:'ai_auto_replies', enabled:true, reason:'AI safety pause test', platformUser });
    await assert.rejects(() => orchestrateAiText({ businessId:1, prompt:'Blocked request' }), /AI and bot auto-replies is paused/);
  } finally {
    await updatePlatformGuardrail({ key:'ai_auto_replies', enabled:false, reason:'Test cleanup', platformUser });
  }
});

test('live AI adapters normalize OpenAI, Anthropic, Gemini, and OpenAI-compatible responses', async () => {
  const requests = [];
  const fixtures = {
    openai_responses: { id:'resp_1', output:[{ content:[{ type:'output_text', text:'OpenAI ready' }] }], usage:{ input_tokens:11, output_tokens:4 } },
    anthropic_messages: { id:'msg_1', content:[{ type:'text', text:'Anthropic ready' }], usage:{ input_tokens:12, output_tokens:5 } },
    google_generate_content: { candidates:[{ content:{ parts:[{ text:'Gemini ready' }] } }], usageMetadata:{ promptTokenCount:13, candidatesTokenCount:6 } },
    openai_compatible: { id:'chatcmpl_1', choices:[{ message:{ content:'Compatible ready' } }], usage:{ prompt_tokens:14, completion_tokens:7 } }
  };
  const providers = [
    { key:'openai', label:'OpenAI', protocol:'openai_responses', baseUrl:'https://api.openai.com/v1', defaultModel:'test-openai', apiKey:'secret', timeoutMs:1000 },
    { key:'anthropic', label:'Anthropic', protocol:'anthropic_messages', baseUrl:'https://api.anthropic.com/v1', defaultModel:'test-anthropic', apiKey:'secret', timeoutMs:1000 },
    { key:'google', label:'Google Gemini', protocol:'google_generate_content', baseUrl:'https://generativelanguage.googleapis.com/v1beta', defaultModel:'test-gemini', apiKey:'secret', timeoutMs:1000 },
    { key:'deepseek', label:'DeepSeek', protocol:'openai_compatible', baseUrl:'https://example.ai/v1', defaultModel:'test-compatible', apiKey:'secret', timeoutMs:1000 }
  ];
  for (const provider of providers) {
    const result = await callAiProvider(provider, {
      prompt:'Connection test', systemPrompt:'Be concise', maxOutputTokens:20,
      fetchImpl:async (url, options) => {
        requests.push({ provider:provider.key, url, options });
        return new Response(JSON.stringify(fixtures[provider.protocol]), { status:200, headers:{ 'content-type':'application/json', 'x-request-id':`${provider.key}-request` } });
      }
    });
    assert.match(result.text, /ready/i);
    assert.equal(result.providerRequestId, `${provider.key}-request`);
    assert.equal(result.inputTokens > 0, true);
    assert.equal(result.outputTokens > 0, true);
  }
  assert.match(requests.find((item) => item.provider === 'openai').url, /\/responses$/);
  assert.match(requests.find((item) => item.provider === 'anthropic').url, /\/messages$/);
  assert.match(requests.find((item) => item.provider === 'google').url, /models\/test-gemini:generateContent$/);
  assert.match(requests.find((item) => item.provider === 'deepseek').url, /\/chat\/completions$/);
  assert.equal(requests.some((item) => String(item.options.body).includes('secret')), false);
});

test('live AI orchestration falls back, records each attempt, and preserves provider health', async () => {
  const platformUser = { id:1, name:'Platform Owner', email:'owner@chatclan.co.za', role:'owner' };
  await saveAiProviderConfig({ providerKey:'google', enabled:true, apiKey:'gemini-test-secret', baseUrl:'https://generativelanguage.googleapis.com/v1beta', defaultModel:'test-gemini', timeoutMs:1000, platformUser });
  await saveBusinessAiPolicy({ businessId:1, enabled:true, autonomyMode:'draft', providerChain:['openai','google'], monthlyBudgetCents:5000, monthlyTokenLimit:10000, maxResponseTokens:400, humanHandoffEnabled:true, platformUser });
  const previousMode = process.env.AI_MODE;
  process.env.AI_MODE = 'live';
  try {
    const result = await orchestrateAiText({
      businessId:1, prompt:'Help with an order', workflowKey:'live_fallback_test',
      fetchImpl:async (url) => {
        if (url.endsWith('/responses')) return new Response(JSON.stringify({ error:{ type:'rate_limit_error' } }), { status:429, headers:{ 'content-type':'application/json' } });
        return new Response(JSON.stringify({ candidates:[{ content:{ parts:[{ text:'Your order is being checked.' }] } }], usageMetadata:{ promptTokenCount:8, candidatesTokenCount:7 } }), { status:200, headers:{ 'content-type':'application/json' } });
      }
    });
    assert.equal(result.provider, 'google');
    assert.equal(result.mode, 'live');
    const attempts = (await listAiUsage({ businessId:1 })).filter((item) => item.workflowKey === 'live_fallback_test');
    assert.equal(attempts.some((item) => item.providerKey === 'openai' && item.status === 'failed'), true);
    assert.equal(attempts.some((item) => item.providerKey === 'google' && item.status === 'succeeded'), true);

    const healthy = await checkAiProviderHealth({
      providerKey:'openai', platformUser,
      fetchImpl:async () => new Response(JSON.stringify({ id:'resp_health', output:[{ content:[{ type:'output_text', text:'OK' }] }], usage:{ input_tokens:5, output_tokens:1 } }), { status:200, headers:{ 'content-type':'application/json' } })
    });
    assert.equal(healthy.status, 'healthy');
    await assert.rejects(() => checkAiProviderHealth({
      providerKey:'openai', platformUser,
      fetchImpl:async () => new Response(JSON.stringify({ error:{ type:'authentication_error' } }), { status:401, headers:{ 'content-type':'application/json' } })
    }), /connection check failed/i);
    const openai = (await listAiProviders()).find((item) => item.key === 'openai');
    assert.equal(openai.enabled, true);
    assert.equal(openai.status, 'degraded');
    assert.equal(openai.lastHealthStatus, 'unhealthy');
  } finally {
    if (previousMode === undefined) delete process.env.AI_MODE;
    else process.env.AI_MODE = previousMode;
  }
});

test('platform tenant suspension blocks outbound Meta sends', async () => {
  const platformUser = { id: 1, email: 'owner@chatclan.co.za', role: 'owner' };
  try {
    await updatePlatformTenantStatus({
      tenantId: 1,
      status: 'suspended',
      reason: 'Suspension guardrail test',
      platformUser
    });
    await assert.rejects(
      () => sendTextMessage({ businessId: 1, to: '27821234567', text: 'Suspension smoke' }),
      /Tenant is suspended by Platform Owner/
    );
  } finally {
    await updatePlatformTenantStatus({
      tenantId: 1,
      status: 'active',
      reason: 'Test cleanup',
      platformUser
    });
  }
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
  const cssSource = fs.readFileSync(require.resolve('../public/css/app.css'), 'utf8');

  assert.match(page, /id="commerceAutomationInsightStrip"/);
  assert.match(page, /Suppressed 0/);
  assert.match(page, /id="commerceAutomationReadiness"/);
  assert.match(page, /id="commerceAutomationRecommendationList"/);
  assert.match(page, /id="commerceAutomationActivityList"/);
  assert.match(page, /id="commerceAutomationPreviewPanel"/);
  assert.match(page, /id="syncCommerceAutomationTemplatesBtn"/);
  assert.match(appSource, /function renderAutomationActivity/);
  assert.match(appSource, /automationActivityLabel/);
  assert.match(appSource, /function renderAutomationPreview/);
  assert.match(appSource, /function renderAutomationReadiness/);
  assert.match(appSource, /function renderAutomationRecommendations/);
  assert.match(appSource, /function automationRecommendationAction/);
  assert.match(appSource, /function automationReadinessNextAction/);
  assert.match(appSource, /function setAutomationActionBusy/);
  assert.match(appSource, /function refreshAutomationPreviewIfOpen/);
  assert.match(appSource, /function renderOrderDiagnostics/);
  assert.match(appSource, /WhatsApp catalog diagnostics/);
  assert.match(appSource, /Catalog issues/);
  assert.match(appSource, /order-issue-badge/);
  assert.match(appSource, /order-row-needs-attention/);
  assert.match(appSource, /product-readiness/);
  assert.match(appSource, /data-product-activate/);
  assert.match(appSource, /function activateProductFromCard/);
  assert.match(appSource, /metadata\.catalogId/);
  assert.match(appSource, /metadata\.messageId/);
  assert.match(appSource, /metaProductRetailerId/);
  assert.match(appSource, /order-item-unmatched/);
  assert.match(appSource, /data-order-item-link/);
  assert.match(appSource, /function openOrderItemProductPicker/);
  assert.match(appSource, /Create draft product/);
  assert.match(appSource, /function createProductFromOrderItem/);
  assert.match(appSource, /items\/create-product/);
  assert.match(appSource, /function renderOrderProductPickerList/);
  assert.match(appSource, /data-product-picker-search/);
  assert.match(appSource, /data-product-picker-choice/);
  assert.match(appSource, /items\/link-product/);
  assert.doesNotMatch(appSource, /Local product ID to link/);
  assert.match(appSource, /currentAutomationPreviewRuleKey/);
  assert.match(appSource, /data-recommendation-template/);
  assert.match(appSource, /data-recommendation-preview/);
  assert.match(appSource, /data-readiness-template/);
  assert.match(appSource, /Template readiness/);
  assert.match(appSource, /function renderAutomationApplyResult/);
  assert.match(appSource, /function installAutomationTemplate/);
  assert.match(appSource, /function submitAutomationTemplate/);
  assert.match(appSource, /function syncAutomationTemplates/);
  assert.match(appSource, /automation-templates\/sync/);
  assert.match(appSource, /data-automation-template/);
  assert.match(appSource, /data-automation-template-submit/);
  assert.match(appSource, /automation-template-pill/);
  assert.doesNotMatch(appSource, /window\.alert\(\[/);
  assert.doesNotMatch(appSource, /window\.confirm\('Schedule this automation/);
  assert.match(cssSource, /\.automation-preview-panel/);
  assert.match(cssSource, /\.automation-apply-result/);
  assert.match(cssSource, /\.automation-template-pill/);
  assert.match(cssSource, /\.automation-readiness/);
  assert.match(cssSource, /\.order-diagnostics/);
  assert.match(cssSource, /\.order-item-unmatched/);
  assert.match(cssSource, /\.order-product-picker/);
  assert.match(cssSource, /\.order-issue-badge/);
  assert.match(cssSource, /\.order-row-needs-attention/);
  assert.match(cssSource, /\.product-readiness/);
});

test('critical campaign and contact write routes require owner or admin role', () => {
  const apiSource = fs.readFileSync(require.resolve('../src/routes/api'), 'utf8');
  const protectedRoutePatterns = [
    /router\.post\('\/campaigns', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/campaigns\/:id\/recipients\/prepare', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/campaigns\/:id\/dispatch', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/automation-rules\/:id\/template', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/automation-rules\/:id\/template\/submit', requireRole\(\['owner', 'admin'\]\)/,
    /router\.post\('\/commerce\/automation-templates\/sync', requireRole\(\['owner', 'admin'\]\)/,
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
    /router\.post\('\/commerce\/automation-rules\/:id\/apply-ready', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.patch\('\/commerce\/automation-rules\/:id', requireRole\(\['owner', 'admin'\]\)/,
    /router\.patch\('\/commerce\/orders\/:id\/status', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.patch\('\/commerce\/orders\/:id\/fulfilment', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.patch\('\/commerce\/orders\/:id\/items\/link-product', requireRole\(\['owner', 'admin', 'agent'\]\)/,
    /router\.post\('\/commerce\/orders\/:id\/items\/create-product', requireRole\(\['owner', 'admin', 'agent'\]\)/,
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

test('vendor check can enforce commerce automation template readiness', () => {
  const vendorCheckSource = fs.readFileSync(require.resolve('../scripts/vendor-check'), 'utf8');

  assert.match(vendorCheckSource, /'commerce'/);
  assert.match(vendorCheckSource, /\/api\/commerce\/automation-insights/);
  assert.match(vendorCheckSource, /VENDOR_REQUIRE_COMMERCE_AUTOMATION_READY/);
  assert.match(vendorCheckSource, /templateReadiness/);
  assert.match(vendorCheckSource, /commerce automation template readiness/);
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
  const previous = [process.env.SOCIAL_GOOGLE_CLIENT_ID, process.env.SOCIAL_GOOGLE_CLIENT_SECRET];
  process.env.SOCIAL_GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.SOCIAL_GOOGLE_CLIENT_SECRET = 'google-client-secret';
  try {
    const start = await createSocialAuthStart({ provider: 'google', purpose: 'signup', planCode: 'starter' });

    assert.equal(start.provider, 'google');
    assert.match(start.authorizationUrl, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    assert.match(start.authorizationUrl, /client_id=google-client-id/);
    assert.match(start.authorizationUrl, /state=/);
  } finally {
    if (previous[0] === undefined) delete process.env.SOCIAL_GOOGLE_CLIENT_ID;
    else process.env.SOCIAL_GOOGLE_CLIENT_ID = previous[0];
    if (previous[1] === undefined) delete process.env.SOCIAL_GOOGLE_CLIENT_SECRET;
    else process.env.SOCIAL_GOOGLE_CLIENT_SECRET = previous[1];
  }
});

test('LinkedIn social auth start exposes OpenID authorization URL', async () => {
  const previous = [process.env.SOCIAL_LINKEDIN_CLIENT_ID, process.env.SOCIAL_LINKEDIN_CLIENT_SECRET];
  process.env.SOCIAL_LINKEDIN_CLIENT_ID = 'linkedin-client-id';
  process.env.SOCIAL_LINKEDIN_CLIENT_SECRET = 'linkedin-client-secret';
  try {
    const start = await createSocialAuthStart({ provider: 'linkedin', purpose: 'signup', planCode: 'growth' });

    assert.equal(start.provider, 'linkedin');
    assert.match(start.authorizationUrl, /^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization/);
    assert.match(start.authorizationUrl, /client_id=linkedin-client-id/);
    assert.match(start.authorizationUrl, /scope=openid\+profile\+email/);
  } finally {
    if (previous[0] === undefined) delete process.env.SOCIAL_LINKEDIN_CLIENT_ID;
    else process.env.SOCIAL_LINKEDIN_CLIENT_ID = previous[0];
    if (previous[1] === undefined) delete process.env.SOCIAL_LINKEDIN_CLIENT_SECRET;
    else process.env.SOCIAL_LINKEDIN_CLIENT_SECRET = previous[1];
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
  await saveMetaCredentials(999, {
    wabaId: 'waba_999',
    phoneNumberId: 'phone_999',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_999'
  });
  const result = await sendTextMessage({
    businessId: 999,
    to: '27821234567',
    text: 'Hello'
  });

  assert.equal(result.mode, 'mock-configured');
  assert.match(result.note, /META_SEND_MODE=live/);
});

test('Meta template payloads follow WhatsApp Cloud API message shape', () => {
  const payload = buildTemplateMessagePayload({
    to: '27821234567',
    templateName: 'wazify_review_prompt',
    language: 'en_ZA',
    parameters: ['Nomsa', 2001, 'review']
  });

  assert.equal(payload.messaging_product, 'whatsapp');
  assert.equal(payload.type, 'template');
  assert.equal(payload.template.name, 'wazify_review_prompt');
  assert.equal(payload.template.language.code, 'en_ZA');
  assert.deepEqual(payload.template.components[0].parameters.map((item) => item.text), ['Nomsa', '2001', 'review']);
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
  assert.equal(config.launchParams.extras.featureType, undefined);
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

test('campaign dispatch rejects malformed identifiers before queue or SQL work', async () => {
  await assert.rejects(
    () => dispatchCampaign({ businessId:1, campaignId:'null', limit:1 }),
    (error) => error.status === 400 && error.retryable === false && /campaignId must be a positive integer/.test(error.message)
  );
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

  assert.equal(product.catalogReadiness.ready, false);
  assert.deepEqual(product.catalogReadiness.missing, ['Image', 'Checkout link']);

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
  assert.equal(updated.catalogReadiness.ready, true);
  assert.equal(updated.catalogReadiness.score, 4);
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

test('commerce post-purchase prompts can use approved WhatsApp templates', async () => {
  const businessId = 967;
  const product = await createProduct(businessId, {
    name: 'Template Prompt Product',
    sku: 'template-prompt-product',
    price: 640,
    inventoryCount: 5,
    metaCatalogId: 'catalog_967',
    metaProductRetailerId: 'template-prompt-product'
  });
  const order = await createOrder(businessId, {
    customerName: 'Template Buyer',
    customerPhone: '+27821230067',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: order.id,
    provider: 'payfast',
    providerPaymentId: 'template_prompt_paid_1',
    amount: '640.00',
    paymentStatus: 'COMPLETE'
  });

  const prompt = await sendPostPurchasePrompt({
    businessId,
    orderId: order.id,
    promptType: 'review',
    templateName: 'wazify_review_prompt',
    templateLanguage: 'en_ZA',
    templateParameters: ['Template Buyer', order.id, 'review']
  });
  const detail = await getOrderById(businessId, order.id);
  const sentEvent = detail.events.find((event) => event.eventType === 'post_purchase.review.sent');

  assert.equal(prompt.messageType, 'template');
  assert.equal(prompt.template.name, 'wazify_review_prompt');
  assert.equal(sentEvent.metadata.messageType, 'template');
  assert.equal(sentEvent.metadata.templateName, 'wazify_review_prompt');
  assert.deepEqual(sentEvent.metadata.templateParameters, ['Template Buyer', order.id, 'review']);
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

test('commerce automation rules surface approved template readiness', async () => {
  const previousDelay = process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS;
  process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS = '0';
  try {
    const businessId = 964;
    const product = await createProduct(businessId, {
      name: 'Automation Template Product',
      sku: 'automation-template-product',
      price: 715,
      inventoryCount: 4,
      metaCatalogId: 'catalog_964',
      metaProductRetailerId: 'automation-template-product'
    });
    await createTemplate(businessId, {
      name: 'Wazify Follow Up Prompt',
      category: 'UTILITY',
      industry: 'ecommerce',
      language: 'en_ZA',
      status: 'Approved',
      body: 'Hi {{1}}, checking in on order {{2}}. Reply {{3}} if you need help.'
    });
    await updateCommerceAutomationRule({
      businessId,
      ruleId: 'follow_up_after_payment',
      enabled: true,
      delayValue: 0,
      delayUnit: 'minutes'
    });

    const rules = await listCommerceAutomationRules(businessId);
    const followUp = rules.find((rule) => rule.ruleKey === 'follow_up_after_payment');
    const order = await createOrder(businessId, {
      customerName: 'Automation Template Buyer',
      customerPhone: '+27821230066',
      items: [{ productId: product.id, quantity: 1 }]
    });
    await reconcileOrderPayment({
      businessId,
      orderId: order.id,
      provider: 'payfast',
      providerPaymentId: 'automation_template_paid_1',
      amount: '715.00',
      paymentStatus: 'COMPLETE'
    });
    await runOnce({ limit: 10 });
    const detail = await getOrderById(businessId, order.id);
    const sentEvent = detail.events.find((event) => event.eventType === 'post_purchase.follow_up.sent');

    assert.equal(followUp.templateReadiness.ready, true);
    assert.equal(followUp.templateReadiness.templateName, 'wazify_follow_up_prompt');
    assert.equal(followUp.templateReadiness.status, 'Approved');
    assert.equal(sentEvent.metadata.messageType, 'template');
    assert.equal(sentEvent.metadata.templateName, 'wazify_follow_up_prompt');
  } finally {
    if (previousDelay === undefined) delete process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS;
    else process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS = previousDelay;
  }
});

test('commerce automation template installer creates recommended drafts', async () => {
  const businessId = 963;

  const installed = await installCommerceAutomationTemplate({
    businessId,
    ruleId: 'reorder_after_completion'
  });
  const rules = await listCommerceAutomationRules(businessId);
  const reorder = rules.find((rule) => rule.ruleKey === 'reorder_after_completion');
  const secondInstall = await installCommerceAutomationTemplate({
    businessId,
    ruleId: 'reorder_after_completion'
  });

  assert.equal(installed.created, true);
  assert.equal(installed.template.slug, 'wazify_reorder_prompt');
  assert.equal(installed.template.category, 'MARKETING');
  assert.equal(installed.template.status, 'Draft');
  assert.match(installed.template.body, /\{\{1\}\}/);
  assert.equal(reorder.templateReadiness.status, 'Draft');
  assert.equal(reorder.templateReadiness.reason, 'template_not_approved');
  assert.equal(secondInstall.created, false);
  assert.equal(secondInstall.template.id, installed.template.id);
});

test('commerce automation template submitter sends drafts to Meta review', async () => {
  const businessId = 962;

  const installed = await installCommerceAutomationTemplate({
    businessId,
    ruleId: 'review_after_completion'
  });
  const installedTemplateId = installed.template.id;
  const installedStatus = installed.template.status;
  const submitted = await submitCommerceAutomationTemplate({
    businessId,
    ruleId: 'review_after_completion'
  });
  const rules = await listCommerceAutomationRules(businessId);
  const review = rules.find((rule) => rule.ruleKey === 'review_after_completion');

  assert.equal(installedStatus, 'Draft');
  assert.equal(submitted.mode, 'mock');
  assert.equal(submitted.template.status, 'Submitted');
  assert.match(submitted.template.metaTemplateId, /^mock_tpl_/);
  assert.equal(submitted.rule.templateReadiness.templateId, installedTemplateId);
  assert.equal(review.templateReadiness.status, 'Submitted');
  assert.equal(review.templateReadiness.templateId, installedTemplateId);
});

test('commerce automation template sync refreshes rule readiness', async () => {
  const businessId = 961;

  const submitted = await submitCommerceAutomationTemplate({
    businessId,
    ruleId: 'follow_up_after_payment'
  });
  const synced = await syncCommerceAutomationTemplates(businessId, {
    remoteTemplates: [
      {
        id: submitted.template.metaTemplateId,
        name: submitted.template.slug,
        status: 'APPROVED',
        category: submitted.template.category,
        language: submitted.template.language,
        components: [{ type: 'BODY', text: submitted.template.body }]
      }
    ]
  });
  const followUp = synced.rules.find((rule) => rule.ruleKey === 'follow_up_after_payment');

  assert.equal(synced.sync.mode, 'provided');
  assert.equal(synced.sync.synced, 1);
  assert.equal(followUp.templateReadiness.ready, true);
  assert.equal(followUp.templateReadiness.status, 'Approved');
  assert.equal(followUp.templateReadiness.metaTemplateId, submitted.template.metaTemplateId);
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

test('commerce automation rules can bulk apply to ready orders', async () => {
  const businessId = 968;
  const product = await createProduct(businessId, {
    name: 'Automation Bulk Product',
    sku: 'automation-bulk-product',
    price: 445,
    inventoryCount: 5,
    metaCatalogId: 'catalog_968',
    metaProductRetailerId: 'automation-bulk-product'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: false,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const order = await createOrder(businessId, {
    customerName: 'Bulk Automation Buyer',
    customerPhone: '+27821230013',
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: order.id,
    provider: 'payfast',
    providerPaymentId: 'automation_bulk_paid_1',
    amount: '445.00',
    paymentStatus: 'COMPLETE'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });

  const before = await previewCommerceAutomationRule({ businessId, ruleId: 'follow_up_after_payment' });
  const applied = await applyCommerceAutomationRuleToReadyOrders({
    businessId,
    ruleId: 'follow_up_after_payment',
    source: 'test_bulk_rule_apply'
  });
  const after = await previewCommerceAutomationRule({ businessId, ruleId: 'follow_up_after_payment' });
  const worker = await runOnce({ limit: 10 });
  const detail = await getOrderById(businessId, order.id);

  assert.equal(before.summary.readyToSchedule, 1);
  assert.equal(applied.summary.scheduled, 1);
  assert.equal(applied.scheduled[0].orderId, order.id);
  assert.equal(after.summary.readyToSchedule, 0);
  assert.equal(after.summary.alreadyScheduled, 1);
  assert.equal(worker.processed >= 1, true);
  assert.equal(detail.events.some((event) => event.eventType === 'automation.rules_applied'), true);
  assert.equal(detail.events.some((event) => event.eventType === 'post_purchase.follow_up.sent'), true);
});

test('commerce automation holds live scheduling until the WhatsApp template is approved', async () => {
  const businessId = 958;
  const previousStrictMode = process.env.COMMERCE_AUTOMATION_REQUIRE_APPROVED_TEMPLATES;
  process.env.COMMERCE_AUTOMATION_REQUIRE_APPROVED_TEMPLATES = 'true';
  try {
    const product = await createProduct(businessId, {
      name: 'Template Guard Product',
      sku: 'template-guard-product',
      price: 375,
      inventoryCount: 5,
      metaCatalogId: 'catalog_958',
      metaProductRetailerId: 'template-guard-product'
    });
    await updateCommerceAutomationRule({
      businessId,
      ruleId: 'follow_up_after_payment',
      enabled: true,
      delayValue: 0,
      delayUnit: 'minutes'
    });
    const order = await createOrder(businessId, {
      customerName: 'Template Guard Buyer',
      customerPhone: '+27821230016',
      items: [{ productId: product.id, quantity: 1 }]
    });
    await reconcileOrderPayment({
      businessId,
      orderId: order.id,
      provider: 'payfast',
      providerPaymentId: 'automation_template_guard_paid_1',
      amount: '375.00',
      paymentStatus: 'COMPLETE'
    });

    const preview = await previewCommerceAutomationRule({ businessId, ruleId: 'follow_up_after_payment' });
    const applied = await applyCommerceAutomationRuleToReadyOrders({
      businessId,
      ruleId: 'follow_up_after_payment',
      source: 'test_template_guard'
    });
    const queued = (await listJobs({ status: 'queued', limit: 1000 }))
      .filter((job) => job.type === 'commerce.post_purchase_prompt' && Number(job.payload?.businessId) === businessId);

    assert.equal(preview.summary.matchingOrders, 1);
    assert.equal(preview.summary.sendableToSchedule, 0);
    assert.equal(preview.summary.suppressedByTemplate, 1);
    assert.equal(preview.orders[0].suppressionReason, 'template_missing');
    assert.equal(preview.orders[0].suppressionLabel, 'Approved template required');
    assert.equal(applied.summary.scheduled, 0);
    assert.equal(applied.summary.suppressedByTemplate, 1);
    assert.equal(applied.skipped[0].reason, 'template_missing');
    assert.equal(queued.length, 0);
  } finally {
    if (previousStrictMode === undefined) {
      delete process.env.COMMERCE_AUTOMATION_REQUIRE_APPROVED_TEMPLATES;
    } else {
      process.env.COMMERCE_AUTOMATION_REQUIRE_APPROVED_TEMPLATES = previousStrictMode;
    }
  }
});

test('commerce automation suppresses opted-out post-purchase prompts', async () => {
  const businessId = 967;
  const phone = '+27821230014';
  const product = await createProduct(businessId, {
    name: 'Suppressed Automation Product',
    sku: 'suppressed-automation-product',
    price: 515,
    inventoryCount: 5,
    metaCatalogId: 'catalog_967',
    metaProductRetailerId: 'suppressed-automation-product'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const order = await createOrder(businessId, {
    customerName: 'Suppressed Buyer',
    customerPhone: phone,
    items: [{ productId: product.id, quantity: 1 }]
  });
  await suppressContactByPhone({
    businessId,
    phone,
    channel: 'WhatsApp reply',
    source: 'STOP keyword'
  });
  await reconcileOrderPayment({
    businessId,
    orderId: order.id,
    provider: 'payfast',
    providerPaymentId: 'automation_suppressed_paid_1',
    amount: '515.00',
    paymentStatus: 'COMPLETE'
  });

  const worker = await runOnce({ limit: 10 });
  const detail = await getOrderById(businessId, order.id);
  const insights = await getCommerceAutomationInsights(businessId);
  const followUp = insights.rules.find((rule) => rule.ruleKey === 'follow_up_after_payment');

  assert.equal(worker.processed >= 1, true);
  assert.equal(detail.events.some((event) => event.eventType === 'post_purchase.follow_up.suppressed'), true);
  assert.equal(detail.events.some((event) => event.eventType === 'post_purchase.follow_up.sent'), false);
  assert.equal(insights.summary.suppressed, 1);
  assert.equal(followUp.metrics.suppressed, 1);
  assert.equal(followUp.recommendation.action, 'Check consent');
  assert.equal(insights.recent.some((event) => event.type === 'suppressed' && event.ruleKey === 'follow_up_after_payment'), true);
});

test('commerce automation cooldown suppresses repeat buyer prompts', async () => {
  const businessId = 966;
  const phone = '+27821230015';
  const product = await createProduct(businessId, {
    name: 'Cooldown Automation Product',
    sku: 'cooldown-automation-product',
    price: 265,
    inventoryCount: 5,
    metaCatalogId: 'catalog_966',
    metaProductRetailerId: 'cooldown-automation-product'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const firstOrder = await createOrder(businessId, {
    customerName: 'Cooldown Buyer',
    customerPhone: phone,
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: firstOrder.id,
    provider: 'payfast',
    providerPaymentId: 'automation_cooldown_paid_1',
    amount: '265.00',
    paymentStatus: 'COMPLETE'
  });
  await runOnce({ limit: 10 });

  const secondOrder = await createOrder(businessId, {
    customerName: 'Cooldown Buyer',
    customerPhone: phone,
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: secondOrder.id,
    provider: 'payfast',
    providerPaymentId: 'automation_cooldown_paid_2',
    amount: '265.00',
    paymentStatus: 'COMPLETE'
  });
  await runOnce({ limit: 10 });

  const firstDetail = await getOrderById(businessId, firstOrder.id);
  const secondDetail = await getOrderById(businessId, secondOrder.id);
  const insights = await getCommerceAutomationInsights(businessId);
  const followUp = insights.rules.find((rule) => rule.ruleKey === 'follow_up_after_payment');

  assert.equal(firstDetail.events.some((event) => event.eventType === 'post_purchase.follow_up.sent'), true);
  assert.equal(secondDetail.events.some((event) => event.eventType === 'post_purchase.follow_up.suppressed' && event.metadata.reason === 'automation_cooldown'), true);
  assert.equal(secondDetail.events.some((event) => event.eventType === 'post_purchase.follow_up.sent'), false);
  const cooldownEvent = secondDetail.events.find((event) => event.eventType === 'post_purchase.follow_up.suppressed' && event.metadata.reason === 'automation_cooldown');
  const queuedRetry = (await listJobs({ status: 'queued', limit: 1000 }))
    .find((job) => job.type === 'commerce.post_purchase_prompt' && Number(job.payload?.businessId) === businessId && Number(job.payload?.orderId) === Number(secondOrder.id));
  assert.ok(cooldownEvent.metadata.retryAt);
  assert.equal(cooldownEvent.metadata.retry?.deduped, false);
  assert.ok(queuedRetry);
  assert.equal(new Date(queuedRetry.runAt).getTime() > Date.now(), true);
  assert.equal(insights.summary.sent, 1);
  assert.equal(insights.summary.suppressed, 1);
  assert.equal(followUp.metrics.suppressedReasons.automation_cooldown, 1);
  assert.equal(followUp.recommendation.action, 'Check frequency');
  assert.equal(insights.recent.some((event) => event.type === 'suppressed' && event.reason === 'automation_cooldown' && event.retryAt), true);
});

test('commerce automation preview and bulk apply skip non-sendable orders', async () => {
  const businessId = 965;
  const cooldownPhone = '+27821230016';
  const optedOutPhone = '+27821230017';
  const product = await createProduct(businessId, {
    name: 'Preflight Automation Product',
    sku: 'preflight-automation-product',
    price: 330,
    inventoryCount: 6,
    metaCatalogId: 'catalog_965',
    metaProductRetailerId: 'preflight-automation-product'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const firstOrder = await createOrder(businessId, {
    customerName: 'Preflight Cooldown Buyer',
    customerPhone: cooldownPhone,
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: firstOrder.id,
    provider: 'payfast',
    providerPaymentId: 'automation_preflight_paid_1',
    amount: '330.00',
    paymentStatus: 'COMPLETE'
  });
  await runOnce({ limit: 10 });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: false,
    delayValue: 0,
    delayUnit: 'minutes'
  });
  const optedOutOrder = await createOrder(businessId, {
    customerName: 'Preflight Opted Out Buyer',
    customerPhone: optedOutPhone,
    items: [{ productId: product.id, quantity: 1 }]
  });
  await suppressContactByPhone({
    businessId,
    phone: optedOutPhone,
    channel: 'WhatsApp reply',
    source: 'STOP keyword'
  });
  await reconcileOrderPayment({
    businessId,
    orderId: optedOutOrder.id,
    provider: 'payfast',
    providerPaymentId: 'automation_preflight_paid_2',
    amount: '330.00',
    paymentStatus: 'COMPLETE'
  });
  const cooldownOrder = await createOrder(businessId, {
    customerName: 'Preflight Cooldown Buyer',
    customerPhone: cooldownPhone,
    items: [{ productId: product.id, quantity: 1 }]
  });
  await reconcileOrderPayment({
    businessId,
    orderId: cooldownOrder.id,
    provider: 'payfast',
    providerPaymentId: 'automation_preflight_paid_3',
    amount: '330.00',
    paymentStatus: 'COMPLETE'
  });
  await updateCommerceAutomationRule({
    businessId,
    ruleId: 'follow_up_after_payment',
    enabled: true,
    delayValue: 0,
    delayUnit: 'minutes'
  });

  const preview = await previewCommerceAutomationRule({ businessId, ruleId: 'follow_up_after_payment' });
  const applied = await applyCommerceAutomationRuleToReadyOrders({
    businessId,
    ruleId: 'follow_up_after_payment',
    source: 'test_preflight_bulk'
  });
  const optedOutDetail = await getOrderById(businessId, optedOutOrder.id);
  const cooldownDetail = await getOrderById(businessId, cooldownOrder.id);

  assert.equal(preview.summary.matchingOrders, 3);
  assert.equal(preview.summary.alreadyScheduled, 1);
  assert.equal(preview.summary.readyToSchedule, 2);
  assert.equal(preview.summary.sendableToSchedule, 0);
  assert.equal(preview.summary.suppressedByConsent, 1);
  assert.equal(preview.summary.suppressedByCooldown, 1);
  assert.equal(preview.orders.some((order) => order.id === optedOutOrder.id && order.suppressionReason === 'customer_opted_out'), true);
  assert.equal(preview.orders.some((order) => order.id === cooldownOrder.id && order.suppressionReason === 'automation_cooldown'), true);
  assert.equal(applied.summary.scheduled, 0);
  assert.equal(applied.summary.skipped, 3);
  assert.equal(applied.skipped.some((item) => item.orderId === optedOutOrder.id && item.reason === 'customer_opted_out'), true);
  assert.equal(applied.skipped.some((item) => item.orderId === cooldownOrder.id && item.reason === 'automation_cooldown'), true);
  assert.equal(optedOutDetail.events.some((event) => event.eventType === 'automation.rules_applied'), false);
  assert.equal(cooldownDetail.events.some((event) => event.eventType === 'automation.rules_applied'), false);
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
  assert.equal(followUp.metrics.templateReady, false);
  assert.equal(followUp.recommendation.action, 'Create template');
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
  assert.equal(reorder.metrics.templateReady, false);
  assert.equal(reorder.recommendation.action, 'Create template');
  assert.equal(insights.summary.attributedRevenue, '1220.00');
  assert.equal(insights.summary.roi === null || insights.summary.roi >= 0, true);
  assert.equal(insights.attribution.windowDays, 30);
  assert.equal(insights.recent.some((event) => event.type === 'attributed_order' && event.orderId === secondOrder.id), true);
  assert.equal(expiredInsights.attribution.windowDays, 1);
  assert.equal(expiredReorder.metrics.attributedOrders, 1);
});

test('commerce automation insights recommend template setup before idle checks', async () => {
  const insights = await getCommerceAutomationInsights(970);
  const idleRule = insights.rules.find((rule) => rule.ruleKey === 'follow_up_after_payment');

  assert.equal(insights.summary.templateReadiness.total, 3);
  assert.equal(insights.summary.templateReadiness.missing, 3);
  assert.equal(insights.summary.templateReadiness.blocked, 3);
  assert.equal(idleRule.metrics.templateReady, false);
  assert.equal(idleRule.metrics.templateStatus, 'Missing');
  assert.equal(idleRule.metrics.templateBlocker, 'template_missing');
  assert.equal(idleRule.recommendation.action, 'Create template');
  assert.equal(insights.recommendations.some((item) => item.action === 'Create template'), true);
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
  const duplicate = await processMetaEvent(events[0]);
  const orders = await listOrders(986);
  const recorded = orders.find((order) => order.paymentReference === 'wamid.order.1');
  const detail = await getOrderById(986, recorded.id);

  assert.equal(events[0].messageType, 'order');
  assert.equal(events[0].profileName, 'Order Buyer');
  assert.equal(processed.commerceOrder.totalCents, 39900);
  assert.equal(processed.commerceOrder.metadata.catalogId, 'catalog_986');
  assert.deepEqual(processed.commerceOrder.metadata.unmatchedItems, []);
  assert.equal(duplicate.commerceOrder.duplicate, true);
  assert.equal(processed.chatbot, null);
  assert.equal(orders.filter((order) => order.paymentReference === 'wamid.order.1').length, 1);
  assert.equal(detail.events.some((event) => event.eventType === 'order.webhook_duplicate'), true);
});

test('Meta order webhooks flag unmatched catalog retailer IDs for merchant follow-up', async () => {
  await saveMetaCredentials(987, {
    wabaId: 'waba_commerce_unmatched',
    phoneNumberId: 'phone_commerce_unmatched',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_commerce_unmatched'
  });
  const events = extractMetaEvents({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone_commerce_unmatched' },
              contacts: [{ wa_id: '27825550000', profile: { name: 'Catalog Buyer' } }],
              messages: [
                {
                  from: '27825550000',
                  id: 'wamid.order.unmatched.1',
                  type: 'order',
                  order: {
                    catalog_id: 'catalog_unmatched',
                    product_items: [
                      { product_retailer_id: 'missing-retailer-id', quantity: 2, item_price: 125, currency: 'ZAR' }
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
  const detail = await getOrderById(987, processed.commerceOrder.id);
  const analyticsBeforeLink = await getCommerceAnalytics(987);
  assert.equal(processed.commerceOrder.totalCents, 25000);
  assert.equal(processed.commerceOrder.metadata.unmatchedItems[0].productRetailerId, 'missing-retailer-id');
  assert.equal(processed.commerceOrder.catalogIssueCount, 1);
  assert.equal(analyticsBeforeLink.summary.catalogIssues, 1);
  assert.equal(analyticsBeforeLink.catalogIssues[0].catalogIssueCount, 1);
  assert.equal(detail.items[0].productId, undefined);
  assert.equal(detail.events.some((event) => event.eventType === 'order.catalog_item_unmatched'), true);

  const product = await createProduct(987, {
    name: 'Resolved Catalog Item',
    sku: 'resolved-catalog-item',
    price: '125.00',
    metaCatalogId: 'catalog_unmatched',
    metaProductRetailerId: 'missing-retailer-id'
  });
  const linked = await linkOrderItemToProduct({
    businessId: 987,
    orderId: processed.commerceOrder.id,
    retailerId: 'missing-retailer-id',
    productId: product.id
  });
  const analyticsAfterLink = await getCommerceAnalytics(987);

  assert.equal(linked.items[0].productId, product.id);
  assert.equal(linked.metadata.unmatchedItems.length, 0);
  assert.equal(linked.catalogIssueCount, 0);
  assert.equal(analyticsAfterLink.summary.catalogIssues, 0);
  assert.equal(linked.events.some((event) => event.eventType === 'order.catalog_item_linked'), true);
});

test('unmatched Meta order items can create draft products and link immediately', async () => {
  await saveMetaCredentials(988, {
    wabaId: 'waba_commerce_create_product',
    phoneNumberId: 'phone_commerce_create_product',
    accessToken: 'EAA_SECRET_TOKEN',
    verifyToken: 'verify_commerce_create_product'
  });
  const [event] = extractMetaEvents({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone_commerce_create_product' },
              contacts: [{ wa_id: '27825550001', profile: { name: 'Draft Buyer' } }],
              messages: [
                {
                  from: '27825550001',
                  id: 'wamid.order.create-product.1',
                  type: 'order',
                  order: {
                    catalog_id: 'catalog_create_product',
                    product_items: [
                      { product_retailer_id: 'draft-retailer-id', quantity: 1, item_price: 219, currency: 'ZAR' }
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
  const processed = await processMetaEvent(event);
  const created = await createProductFromOrderItem({
    businessId: 988,
    orderId: processed.commerceOrder.id,
    retailerId: 'draft-retailer-id'
  });
  const analytics = await getCommerceAnalytics(988);

  assert.equal(created.product.status, 'draft');
  assert.equal(created.product.metaCatalogId, 'catalog_create_product');
  assert.equal(created.product.metaProductRetailerId, 'draft-retailer-id');
  assert.equal(created.order.items[0].productId, created.product.id);
  assert.equal(created.order.catalogIssueCount, 0);
  assert.equal(created.order.events.some((orderEvent) => orderEvent.eventType === 'order.catalog_product_created'), true);
  assert.equal(analytics.summary.catalogIssues, 0);
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

test('inbox AI drafting redacts identifiers and blocks sensitive authentication requests', () => {
  const redacted = redactConversationText('Call 082 123 4567 or mail person@example.co.za. ID 9001015009087 card 4111 1111 1111 1111.');
  assert.doesNotMatch(redacted, /082 123 4567|person@example\.co\.za|9001015009087|4111 1111/);
  const assessment = evaluateDraftSafety({
    body:'Please send your password and OTP so I can help.',
    context:[{ direction:'inbound', body:'I cannot access my account.' }],
    mode:'live',
    humanHandoffEnabled:true
  });
  assert.equal(assessment.canUse, false);
  assert.equal(assessment.confidence, 0.2);
  assert.equal(assessment.flags.includes('requests_sensitive_auth'), true);
});

test('tenant knowledge approval gates retrieval and keeps customer orders scoped', async () => {
  const businessId = 910;
  const actorUser = { id:91, name:'Knowledge Manager', email:'knowledge@example.test', role:'admin' };
  const draftItem = await createKnowledgeItem({
    businessId,
    actorUser,
    itemType:'policy',
    title:'Returns policy',
    content:'Unused products may be returned within 14 days with proof of purchase.',
    keywords:'returns, refunds',
    status:'draft'
  });
  const beforeApproval = await retrieveTenantKnowledge({ businessId, queryText:'What is your returns policy?', customerPhone:'0821234000' });
  assert.equal(beforeApproval.sources.some((source) => source.ref.startsWith(`knowledge:${draftItem.id}:`)), false);

  const approvedItem = await updateKnowledgeItem({ businessId, itemId:draftItem.id, actorUser, status:'approved' });
  const product = await createProduct(businessId, {
    name:'Cape Town Weekender Bag',
    sku:'ct-weekender',
    description:'A durable locally made travel bag.',
    price:799,
    inventoryCount:6
  });
  const matchingOrder = await createOrder(businessId, {
    customerName:'Knowledge Customer',
    customerPhone:'+27821234000',
    items:[{ productId:product.id, quantity:1 }]
  });
  const otherOrder = await createOrder(businessId, {
    customerName:'Other Customer',
    customerPhone:'+27829999999',
    items:[{ productId:product.id, quantity:1 }]
  });
  const retrieval = await retrieveTenantKnowledge({
    businessId,
    queryText:'What is the Weekender Bag price and can you track my order delivery or return it?',
    customerPhone:'082 123 4000'
  });
  const overview = await getKnowledgeOverview(businessId);
  const otherTenant = await retrieveTenantKnowledge({ businessId:911, queryText:'returns policy', customerPhone:'0821234000' });

  assert.equal(approvedItem.version, 2);
  assert.equal(approvedItem.approvedByUserId, actorUser.id);
  assert.equal(overview.summary.approved, 1);
  assert.equal(retrieval.sources.some((source) => source.ref === `knowledge:${approvedItem.id}:v2`), true);
  assert.equal(retrieval.sources.some((source) => source.ref === `product:${product.id}`), true);
  assert.equal(retrieval.sources.some((source) => source.ref === `order:${matchingOrder.id}`), true);
  assert.equal(retrieval.sources.some((source) => source.ref === `order:${otherOrder.id}`), false);
  assert.equal(otherTenant.sources.some((source) => source.ref.startsWith('knowledge:')), false);
});

test('knowledge imports and API connectors preserve provenance and deduplicate records', async () => {
  const businessId = 912;
  const actorUser = { id:92, name:'Source Manager', email:'sources@example.test', role:'admin' };
  const csv = [
    'title,content,type,keywords,external_ref',
    'Collection times,Collections are available Monday to Friday from 09:00 to 16:00,faq,"collection,hours",collection-hours',
    'Returns policy,Unused products may be returned within 14 days with proof of purchase,policy,"returns,refunds",returns-policy'
  ].join('\n');
  const preview = parseImportRecords({ content:csv, filename:'support.csv', formatType:'csv' });
  const imported = await importKnowledgeContent({ businessId, actorUser, filename:'support.csv', formatType:'csv', content:csv, defaultStatus:'approved' });
  const connector = await createApiPushConnector({ businessId, actorUser, name:'Commerce knowledge feed', defaultStatus:'draft' });
  const firstPush = await ingestApiConnectorRecords({
    businessId, actorUser, sourceId:connector.id, defaultStatus:'approved',
    records:[{ externalRef:'delivery-policy', itemType:'policy', title:'Delivery policy', content:'Delivery takes 2 to 4 business days.', keywords:['delivery'] }]
  });
  const secondPush = await ingestApiConnectorRecords({
    businessId, actorUser, sourceId:connector.id, defaultStatus:'approved',
    records:[{ externalRef:'delivery-policy', itemType:'policy', title:'Delivery policy', content:'Delivery takes 2 to 3 business days.', keywords:['delivery'] }]
  });
  const sources = await listKnowledgeSources(businessId);
  const items = await getKnowledgeOverview(businessId);
  const delivery = items.items.find((item) => item.externalRef === 'delivery-policy');

  assert.equal(preview.length, 2);
  assert.equal(imported.created, 2);
  assert.equal(imported.source.itemCount, 2);
  assert.equal(firstPush.created, 1);
  assert.equal(secondPush.updated, 1);
  assert.equal(delivery.version, 2);
  assert.equal(delivery.sourceId, connector.id);
  assert.equal(delivery.contentHash.length, 64);
  assert.equal(sources.length, 2);
});

test('DOCX imports extract readable text into source-owned knowledge records', async () => {
  const businessId = 913;
  const actorUser = { id:93, name:'Document Manager', email:'documents@example.test', role:'admin' };
  const buffer = fs.readFileSync('node_modules/mammoth/test/test-data/single-paragraph.docx');
  const text = await extractDocumentText({ buffer, formatType:'docx' });
  const imported = await importKnowledgeContent({
    businessId, actorUser, filename:'single-paragraph.docx', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    contentBase64:buffer.toString('base64'), defaultStatus:'draft'
  });

  assert.match(text, /Walking on imported air/);
  assert.equal(imported.created, 1);
  assert.equal(imported.source.formatType, 'docx');
  assert.match(imported.items[0].content, /Walking on imported air/);
});

test('live connectors expose masked credentials, schedule sync, and archive records on deletion', async () => {
  const businessId = 914;
  const actorUser = { id:94, name:'Connector Manager', email:'connectors@example.test', role:'admin' };
  const source = await createKnowledgeConnector({
    businessId, actorUser, provider:'shopify', name:'Store products', shopDomain:'example-store.myshopify.com',
    accessToken:'shpat_secret-token-value', syncIntervalMinutes:60, defaultStatus:'approved'
  });
  const sources = await listKnowledgeSources(businessId);
  const visible = sources.find((candidate) => candidate.id === source.id);
  const pushed = await importKnowledgeContent({ businessId, actorUser, filename:'temporary.txt', content:'Temporary connector-adjacent knowledge', defaultStatus:'approved' });
  await archiveKnowledgeSource({ businessId, actorUser, sourceId:pushed.source.id });
  const deleted = await deleteKnowledgeConnector({ businessId, actorUser, sourceId:source.id });

  assert.equal(visible.sourceType, 'shopify');
  assert.match(visible.credentialsMasked.accessToken, /\*+alue$/);
  assert.equal('credentialsEncrypted' in visible, false);
  assert.equal(visible.syncIntervalMinutes, 60);
  assert.equal(Boolean(visible.nextSyncAt), true);
  assert.equal(deleted.deleted, true);
  assert.equal((await listKnowledgeSources(businessId)).some((candidate) => candidate.id === source.id), false);
});

test('Shopify and WooCommerce adapters authenticate and normalize product knowledge', async () => {
  const calls = [];
  const shopifyFetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ data:{ products:{ nodes:[{ id:'gid://shopify/Product/1', title:'Cape Tote', handle:'cape-tote', status:'ACTIVE', descriptionHtml:'<p>Locally made.</p>', variants:{ nodes:[{ title:'Default', sku:'CAPE-1', price:'249.00', inventoryQuantity:8 }] } }] } } }), { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  const wooFetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify([{ id:2, name:'Jozi Mug', description:'<p>Stoneware mug.</p>', price:'129.00', stock_quantity:12, sku:'JHB-MUG', permalink:'https://shop.example.co.za/product/jozi-mug' }]), { status:200, headers:{ 'Content-Type':'application/json' } });
  };
  const shopify = await fetchShopifyRecords({ shopDomain:'example.myshopify.com' }, { accessToken:'shpat_test' }, shopifyFetch);
  const woo = await fetchWooCommerceRecords({ storeUrl:'https://shop.example.co.za' }, { consumerKey:'ck_test', consumerSecret:'cs_test' }, wooFetch);

  assert.equal(calls[0].url, 'https://example.myshopify.com/admin/api/2026-07/graphql.json');
  assert.equal(calls[0].options.headers['X-Shopify-Access-Token'], 'shpat_test');
  assert.match(shopify[0].content, /CAPE-1/);
  assert.match(calls[1].options.headers.Authorization, /^Basic /);
  assert.match(calls[1].url, /\/wp-json\/wc\/v3\/products/);
  assert.equal(woo[0].externalRef, 'woocommerce:product:2');
  assert.match(woo[0].content, /Stoneware mug/);
});

test('Google Drive adapter scopes file listing and downloads supported knowledge files', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/drive/v3/files?')) {
      return new Response(JSON.stringify({ files:[{ id:'drive-file-1', name:'Returns policy.txt', mimeType:'text/plain', capabilities:{ canDownload:true } }] }), { status:200, headers:{ 'Content-Type':'application/json' } });
    }
    return new Response('Returns are accepted within 14 days with proof of purchase.', { status:200, headers:{ 'Content-Type':'text/plain' } });
  };
  const result = await fetchGoogleDriveRecords({ folderId:'folder-123' }, { accessToken:'google-access-token' }, fetchImpl);

  const listUrl = new URL(calls[0].url);
  assert.match(listUrl.searchParams.get('q'), /'folder-123' in parents/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer google-access-token');
  assert.match(calls[1].url, /drive-file-1\?alt=media/);
  assert.equal(result.records[0].externalRef, 'google-drive:drive-file-1');
  assert.match(result.records[0].content, /14 days/);
});

test('Google Drive OAuth uses offline consent, tenant-bound one-time state, exchange, and revocation', async () => {
  const previous = {
    appUrl:process.env.APP_URL,
    clientId:process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
    clientSecret:process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET,
    redirectUri:process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI,
    testUsers:process.env.GOOGLE_DRIVE_OAUTH_TEST_USERS,
    verification:process.env.GOOGLE_DRIVE_OAUTH_VERIFICATION_STATUS,
    assessment:process.env.GOOGLE_DRIVE_OAUTH_SECURITY_ASSESSMENT_STATUS
  };
  process.env.APP_URL = 'https://app.example.test';
  process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = '123456789-example.apps.googleusercontent.com';
  process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = 'GOCSPX-production-shaped-test-secret';
  process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI = 'https://app.example.test/auth/google-drive/callback';
  process.env.GOOGLE_DRIVE_OAUTH_TEST_USERS = 'qa@example.test';
  process.env.GOOGLE_DRIVE_OAUTH_VERIFICATION_STATUS = 'approved';
  process.env.GOOGLE_DRIVE_OAUTH_SECURITY_ASSESSMENT_STATUS = 'approved';
  const actorUser = { id:95, businessId:915, role:'owner' };
  try {
    const started = await beginGoogleDriveOAuth({ businessId:915, actorUser, name:'Policies Drive', folderId:'folder-1', syncIntervalMinutes:60 });
    const authorization = new URL(started.authorizationUrl);
    const state = authorization.searchParams.get('state');
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      if (url.includes('/token')) return new Response(JSON.stringify({ access_token:'access-1', refresh_token:'refresh-1', expires_in:3600, token_type:'Bearer', scope:'https://www.googleapis.com/auth/drive.readonly' }), { status:200, headers:{ 'Content-Type':'application/json' } });
      return new Response('', { status:200 });
    };
    const completed = await completeGoogleDriveOAuth({ businessId:915, actorUser, code:'authorization-code', state }, fetchImpl);
    const revoked = await revokeGoogleDriveCredentials(completed.credentials, fetchImpl);

    assert.equal(authorization.searchParams.get('access_type'), 'offline');
    assert.equal(authorization.searchParams.get('prompt'), 'consent');
    assert.equal(authorization.searchParams.get('include_granted_scopes'), 'true');
    assert.match(authorization.searchParams.get('scope'), /drive\.readonly/);
    assert.equal(completed.payload.folderId, 'folder-1');
    assert.equal(completed.credentials.refreshToken, 'refresh-1');
    assert.equal(getGoogleDriveOAuthStatus().verificationRequired, true);
    assert.equal(getGoogleDriveOAuthStatus().checks.redirectMatchesAppUrl, true);
    assert.equal(getGoogleDriveOAuthStatus().sandboxReady, true);
    assert.equal(getGoogleDriveOAuthStatus().productionReady, true);
    assert.match(requests[0].options.body, /grant_type=authorization_code/);
    assert.equal(revoked.revoked, true);
    await assert.rejects(() => completeGoogleDriveOAuth({ businessId:915, actorUser, code:'another-code', state }, fetchImpl), /already used/);
  } finally {
    if (previous.appUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = previous.appUrl;
    if (previous.clientId === undefined) delete process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID; else process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = previous.clientId;
    if (previous.clientSecret === undefined) delete process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET; else process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = previous.clientSecret;
    if (previous.redirectUri === undefined) delete process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI; else process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI = previous.redirectUri;
    if (previous.testUsers === undefined) delete process.env.GOOGLE_DRIVE_OAUTH_TEST_USERS; else process.env.GOOGLE_DRIVE_OAUTH_TEST_USERS = previous.testUsers;
    if (previous.verification === undefined) delete process.env.GOOGLE_DRIVE_OAUTH_VERIFICATION_STATUS; else process.env.GOOGLE_DRIVE_OAUTH_VERIFICATION_STATUS = previous.verification;
    if (previous.assessment === undefined) delete process.env.GOOGLE_DRIVE_OAUTH_SECURITY_ASSESSMENT_STATUS; else process.env.GOOGLE_DRIVE_OAUTH_SECURITY_ASSESSMENT_STATUS = previous.assessment;
  }
});

test('Google Drive OAuth readiness rejects placeholders and callback drift', () => {
  const keys = ['APP_URL', 'GOOGLE_DRIVE_OAUTH_CLIENT_ID', 'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET', 'GOOGLE_DRIVE_OAUTH_REDIRECT_URI', 'GOOGLE_DRIVE_OAUTH_SCOPES', 'GOOGLE_DRIVE_OAUTH_TEST_USERS'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.APP_URL = 'https://app.chatclan.co.za';
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = 'example-client-id';
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = 'replace-with-client-secret';
    process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI = 'https://other.example/auth/google-drive/callback';
    process.env.GOOGLE_DRIVE_OAUTH_SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
    process.env.GOOGLE_DRIVE_OAUTH_TEST_USERS = 'not-an-email';
    const status = getGoogleDriveOAuthStatus();
    assert.equal(status.checks.clientIdFormat, false);
    assert.equal(status.checks.clientSecretSafety, false);
    assert.equal(status.checks.redirectMatchesAppUrl, false);
    assert.equal(status.checks.testUsers, false);
    assert.equal(status.sandboxReady, false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test('tenant CRM OAuth builds provider-specific consent requests and workspace-bound callbacks', async () => {
  const providers = ['hubspot', 'salesforce', 'zoho', 'pipedrive'];
  const keys = ['APP_URL', ...providers.flatMap((provider) => [`CRM_${provider.toUpperCase()}_OAUTH_CLIENT_ID`, `CRM_${provider.toUpperCase()}_OAUTH_CLIENT_SECRET`])];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.APP_URL = 'https://app.example.test';
  for (const provider of providers) {
    process.env[`CRM_${provider.toUpperCase()}_OAUTH_CLIENT_ID`] = `${provider}-client-id`;
    process.env[`CRM_${provider.toUpperCase()}_OAUTH_CLIENT_SECRET`] = `${provider}-client-secret`;
  }
  try {
    const statuses = getTenantCrmProviderStatus();
    assert.equal(statuses.every((provider) => provider.configured), true);
    for (const provider of providers) {
      const started = await beginTenantCrmOAuth({ businessId:921, actorUser:{ id:101, businessId:921, role:'owner' }, provider, syncIntervalMinutes:60 });
      const authorization = new URL(started.authorizationUrl);
      assert.equal(authorization.searchParams.get('client_id'), `${provider}-client-id`);
      assert.equal(authorization.searchParams.get('redirect_uri'), `https://app.example.test/auth/crm/${provider}/callback`);
      assert.ok(authorization.searchParams.get('state'));
      if (provider === 'salesforce') assert.match(authorization.searchParams.get('scope'), /refresh_token/);
      if (provider === 'zoho') {
        assert.equal(authorization.searchParams.get('access_type'), 'offline');
        assert.equal(authorization.searchParams.get('prompt'), 'consent');
      }
    }
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test('tenant CRM OAuth reports a provider token network failure without exposing raw fetch errors', async () => {
  const keys = ['CRM_PIPEDRIVE_OAUTH_CLIENT_ID','CRM_PIPEDRIVE_OAUTH_CLIENT_SECRET'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.CRM_PIPEDRIVE_OAUTH_CLIENT_ID = 'pipedrive-client-id';
  process.env.CRM_PIPEDRIVE_OAUTH_CLIENT_SECRET = 'pipedrive-client-secret';
  try {
    const started = await beginTenantCrmOAuth({ businessId:922, actorUser:{ id:102, businessId:922, role:'owner' }, provider:'pipedrive', syncIntervalMinutes:60 });
    const state = new URL(started.authorizationUrl).searchParams.get('state');
    await assert.rejects(
      completeTenantCrmOAuth({ businessId:922, actorUser:{ id:102, businessId:922, role:'owner' }, provider:'pipedrive', code:'test-code', state }, async () => { throw new TypeError('fetch failed'); }),
      (error) => error.status === 502 && /could not reach oauth\.pipedrive\.com/.test(error.message) && !/fetch failed/.test(error.message)
    );
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test('tenant HubSpot sync uses email upsert and phone lookup instead of invalid phone upsert', async () => {
  const { syncHubSpotContact } = require('../src/services/tenantCrm');
  const requests = [];
  const responses = [
    { results:[{ id:'email-contact' }] },
    { results:[] },
    { id:'phone-contact' },
    { results:[{ id:'phone-contact' }] },
    { id:'phone-contact' }
  ];
  const fetchImpl=async (url,options)=>{requests.push({url,options,body:JSON.parse(options.body)});return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'Content-Type':'application/json'}});};
  const common={fetchImpl,base:'https://api.hubapi.com',credentials:{accessToken:'access-token'},properties:{firstname:'Naledi'}};
  const emailResult=await syncHubSpotContact({...common,contact:{email:'naledi@example.test',phone:'+27821234567'}});
  const createdResult=await syncHubSpotContact({...common,contact:{email:null,phone:'+27821234567'}});
  const updatedResult=await syncHubSpotContact({...common,contact:{email:null,phone:'+27821234567'}});
  assert.equal(emailResult.id,'email-contact');
  assert.equal(createdResult.id,'phone-contact');
  assert.equal(updatedResult.id,'phone-contact');
  assert.match(requests[0].url,/batch\/upsert$/);
  assert.equal(requests[0].body.inputs[0].idProperty,'email');
  assert.match(requests[1].url,/contacts\/search$/);
  assert.equal(requests[1].body.filterGroups[0].filters[0].propertyName,'phone');
  assert.equal(requests[2].options.method,'POST');
  assert.match(requests[2].url,/crm\/v3\/objects\/contacts$/);
  assert.equal(requests[4].options.method,'PATCH');
  assert.match(requests[4].url,/contacts\/phone-contact$/);
});

test('tenant HubSpot sync rejects ambiguous phone matches without creating a duplicate', async () => {
  const { syncHubSpotContact } = require('../src/services/tenantCrm');
  const requests=[];
  await assert.rejects(
    syncHubSpotContact({
      fetchImpl:async (url,options)=>{requests.push({url,options});return new Response(JSON.stringify({results:[{id:'one'},{id:'two'}]}),{status:200,headers:{'Content-Type':'application/json'}});},
      base:'https://api.hubapi.com',
      credentials:{accessToken:'access-token'},
      contact:{email:null,phone:'+27821234567'},
      properties:{firstname:'Naledi'}
    }),
    (error)=>error.status===409&&/multiple contacts/.test(error.message)
  );
  assert.equal(requests.length,1);
  assert.match(requests[0].url,/contacts\/search$/);
});

test('tenant Pipedrive sync searches exact identity before create and updates existing people', async () => {
  const { syncPipedrivePerson } = require('../src/services/tenantCrm');
  const requests=[];
  const responses=[
    {success:true,data:{items:[]}},
    {success:true,data:{id:301}},
    {success:true,data:{items:[{item:{id:301}}]}},
    {success:true,data:{id:301}}
  ];
  const fetchImpl=async (url,options={})=>{requests.push({url,options,body:options.body?JSON.parse(options.body):null});return new Response(JSON.stringify(responses.shift()),{status:200,headers:{'Content-Type':'application/json'}});};
  const common={fetchImpl,base:'https://sandbox.pipedrive.com',credentials:{accessToken:'access-token'},contact:{email:null,phone:'+27821234567'},properties:{name:'Naledi',phones:[{value:'+27821234567',primary:true}]}};
  const created=await syncPipedrivePerson(common);
  const updated=await syncPipedrivePerson(common);
  assert.equal(created.data.id,301);
  assert.equal(updated.data.id,301);
  const search=new URL(requests[0].url);
  assert.equal(search.pathname,'/api/v2/persons/search');
  assert.equal(search.searchParams.get('term'),'+27821234567');
  assert.equal(search.searchParams.get('fields'),'phone');
  assert.equal(search.searchParams.get('exact_match'),'true');
  assert.equal(requests[1].options.method,'POST');
  assert.equal(requests[3].options.method,'PATCH');
  assert.match(requests[3].url,/persons\/301$/);
});

test('tenant Pipedrive sync rejects ambiguous exact identity matches', async () => {
  const { syncPipedrivePerson } = require('../src/services/tenantCrm');
  await assert.rejects(
    syncPipedrivePerson({
      fetchImpl:async ()=>new Response(JSON.stringify({success:true,data:{items:[{item:{id:1}},{item:{id:2}}]}}),{status:200,headers:{'Content-Type':'application/json'}}),
      base:'https://sandbox.pipedrive.com',
      credentials:{accessToken:'access-token'},
      contact:{email:'duplicate@example.test',phone:null},
      properties:{name:'Duplicate'}
    }),
    (error)=>error.status===409&&/multiple people/.test(error.message)
  );
});

test('tenant CRM field mappings produce provider-safe contact payloads', () => {
  const contact = { name:'Naledi Dlamini', email:'naledi@example.test', phone:'+27821234567', segment:'VIP', optedIn:true };
  assert.deepEqual(providerProperties('hubspot', contact, PROVIDER_MAPPINGS.hubspot), { firstname:'Naledi', lastname:'Dlamini', email:'naledi@example.test', phone:'+27821234567' });
  assert.deepEqual(providerProperties('salesforce', contact, PROVIDER_MAPPINGS.salesforce), { FirstName:'Naledi', LastName:'Dlamini', Email:'naledi@example.test', Phone:'+27821234567' });
  assert.deepEqual(providerProperties('zoho', contact, PROVIDER_MAPPINGS.zoho), { First_Name:'Naledi', Last_Name:'Dlamini', Email:'naledi@example.test', Phone:'+27821234567' });
  assert.deepEqual(providerProperties('pipedrive', contact, PROVIDER_MAPPINGS.pipedrive), { name:'Naledi Dlamini', emails:[{value:'naledi@example.test',primary:true}], phones:[{value:'+27821234567',primary:true}] });
  assert.deepEqual(providerProperties('hubspot', contact, { ...PROVIDER_MAPPINGS.hubspot, segment:'customer_segment', optedIn:'whatsapp_opt_in' }), { firstname:'Naledi', lastname:'Dlamini', email:'naledi@example.test', phone:'+27821234567', customer_segment:'VIP', whatsapp_opt_in:true });
});

test('tenant CRM mapping validation accepts Pipedrive defaults and identifies malformed fields', () => {
  const { validateFieldMapping } = require('../src/services/tenantCrm');
  assert.deepEqual(validateFieldMapping(PROVIDER_MAPPINGS.pipedrive, 'pipedrive'), PROVIDER_MAPPINGS.pipedrive);
  assert.deepEqual(
    validateFieldMapping({ ...PROVIDER_MAPPINGS.pipedrive, name:'Contact name', email:'Email address', phone:'Phone number' }, 'pipedrive'),
    PROVIDER_MAPPINGS.pipedrive
  );
  assert.throws(
    () => validateFieldMapping({ ...PROVIDER_MAPPINGS.pipedrive, segment:'customer segment' }, 'pipedrive'),
    (error) => error.status === 400 && /invalid target for segment/.test(error.message)
  );
  assert.throws(
    () => validateFieldMapping({ ...PROVIDER_MAPPINGS.pipedrive, optedIn:'opt-in?' }, 'pipedrive'),
    (error) => error.status === 400 && /invalid target for optedIn/.test(error.message)
  );
});

test('connector operations report attempts, durations, failures, freshness, and alerts', async () => {
  const businessId = 916;
  const actorUser = { id:96, businessId, role:'admin' };
  const source = await createKnowledgeConnector({ businessId, actorUser, provider:'shopify', name:'Operations Store', shopDomain:'operations.myshopify.com', accessToken:'shpat_operations', syncIntervalMinutes:60 });
  const failed = await beginConnectorSyncRun({ businessId, sourceId:source.id, provider:'shopify', jobId:100, triggerType:'manual', attempt:1, maxAttempts:4 });
  await completeConnectorSyncRun(failed, { status:'failed', errorMessage:'Provider unavailable' });
  const succeeded = await beginConnectorSyncRun({ businessId, sourceId:source.id, provider:'shopify', jobId:100, triggerType:'manual', attempt:2, maxAttempts:4 });
  await completeConnectorSyncRun(succeeded, { status:'succeeded', fetchedCount:3, createdCount:2, updatedCount:1 });
  const operations = await getKnowledgeConnectorOperations(businessId);
  const runs = await listConnectorSyncRuns(businessId);

  assert.equal(operations.summary.total, 1);
  assert.equal(operations.summary.healthy, 1);
  assert.equal(operations.summary.failed24h, 1);
  assert.equal(operations.sources[0].successRate, 0.5);
  assert.equal(operations.sources[0].lastRun.status, 'succeeded');
  assert.equal(runs[0].attempt, 2);
  assert.equal(runs[1].errorMessage, 'Provider unavailable');
});

test('connector alerts deliver, acknowledge, preserve history, and auto-resolve on recovery', async () => {
  const businessId = 918;
  const actorUser = { id:98, businessId, role:'owner' };
  const source = await createKnowledgeConnector({ businessId, actorUser, provider:'shopify', name:'Alert Store', shopDomain:'alerts.myshopify.com', accessToken:'shpat_alerts', syncIntervalMinutes:60 });
  await updateConnectorAlertPolicy({ businessId, actorUser, emailEnabled:true, minimumEmailSeverity:'info', notifyRoles:['owner'], additionalEmails:'ops@example.test', escalationMinutes:15 });
  const deliveries = [];
  await evaluateConnectorAlerts({ businessId, sourceId:source.id }, {
    skipSchedule:true,
    resolveRecipients:async () => ['ops@example.test'],
    sendEmail:async (message) => { deliveries.push(message); return { messageId:'alert-mail-1' }; }
  });
  let center = await getConnectorAlertCenter(businessId);
  assert.equal(center.summary.open, 1);
  assert.equal(center.alerts[0].alertKey, 'never_synced');
  assert.equal(center.alerts[0].notificationCount, 1);
  assert.equal(deliveries.length, 1);

  await acknowledgeConnectorAlert({ businessId, alertId:center.alerts[0].id, actorUser });
  center = await getConnectorAlertCenter(businessId);
  assert.equal(center.summary.acknowledged, 1);
  assert.equal(center.alerts[0].events[0].eventType, 'acknowledged');

  const recovered = await beginConnectorSyncRun({ businessId, sourceId:source.id, provider:'shopify', triggerType:'manual' });
  await completeConnectorSyncRun(recovered, { status:'succeeded', fetchedCount:1, createdCount:1 });
  await evaluateConnectorAlerts({ businessId, sourceId:source.id }, { skipSchedule:true });
  center = await getConnectorAlertCenter(businessId);
  assert.equal(center.alerts[0].status, 'resolved');
  assert.equal(center.alerts[0].events[0].eventType, 'resolved');
});

test('knowledge evaluations score retrieval, completeness, isolation, and unsupported claim risk', async () => {
  const businessId = 912;
  const actorUser = { id:92, name:'Source Manager', email:'sources@example.test', role:'admin' };
  const overview = await getKnowledgeOverview(businessId);
  const returns = overview.items.find((item) => item.externalRef === 'returns-policy');
  await createKnowledgeEvaluationCase({
    businessId,
    actorUser,
    name:'Returns answer is grounded',
    queryText:'How many days do I have to return an unused product?',
    expectedSourceRefs:[`knowledge:${returns.id}:v${returns.version}`],
    requiredTerms:['14 days','proof of purchase'],
    forbiddenSourceRefs:['order:999999'],
    candidateAnswer:'Unused products may be returned within 14 days with proof of purchase.'
  });
  const run = await runKnowledgeEvaluations({ businessId, actorUser });
  const runs = await listKnowledgeEvaluationRuns(businessId);

  assert.equal(run.caseCount, 1);
  assert.equal(run.sourceRecall, 1);
  assert.equal(run.completeness, 1);
  assert.equal(run.isolationPassRate, 1);
  assert.equal(run.unsupportedClaimRisk, 0);
  assert.equal(run.results[0].returnedRefs.includes(`knowledge:${returns.id}:v${returns.version}`), true);
  assert.equal(runs[0].id, run.id);
  assert.equal(unsupportedClaimRisk('Your refund is R999 today.', 'Returns require proof of purchase.'), 1);
});

test('inbox AI drafts remain human-reviewed and track agent edits without sending', async () => {
  const platformUser = { id:1, name:'Platform Owner', email:'owner@chatclan.co.za', role:'owner' };
  const agent = { id:91, name:'Draft Reviewer', email:'reviewer@example.test', role:'agent' };
  await saveAiProviderConfig({ providerKey:'openai', enabled:true, apiKey:'draft-test-secret', baseUrl:'https://api.openai.com/v1', defaultModel:'draft-test-model', timeoutMs:1000, platformUser });
  await saveBusinessAiPolicy({ businessId:993, enabled:true, autonomyMode:'draft', providerChain:['openai'], monthlyBudgetCents:5000, monthlyTokenLimit:10000, maxResponseTokens:300, humanHandoffEnabled:true, platformUser });
  await createKnowledgeItem({
    businessId:993,
    actorUser:agent,
    itemType:'faq',
    title:'Order tracking',
    content:'Agents can confirm that the fulfilment team will check the latest tracking event.',
    keywords:'order, tracking, delivery',
    status:'approved'
  });
  const inbound = await recordInboundMessage({
    businessId:993,
    event:{ type:'message.received', from:'27821234455', messageId:'wamid.inbox.ai.draft.1', messageType:'text', text:'Can you track my order? Email me at buyer@example.co.za.' }
  });
  const before = await getConversation(993, inbound.conversation.id);
  const draft = await generateInboxAiDraft({ businessId:993, conversationId:inbound.conversation.id, actorUser:agent });
  const after = await getConversation(993, inbound.conversation.id);
  assert.equal(draft.status, 'generated');
  assert.equal(draft.canUse, true);
  assert.equal(draft.autonomyMode, 'draft');
  assert.equal(draft.knowledgeSourceCount > 0, true);
  assert.equal(draft.knowledgeRefs.some((source) => source.type === 'faq'), true);
  assert.doesNotMatch(draft.body, /buyer@example\.co\.za/);
  assert.equal(after.messages.length, before.messages.length);
  assert.equal((await validateInboxAiDraftForUse({ businessId:993, conversationId:inbound.conversation.id, draftId:draft.id })).id, draft.id);
  const outcome = await markInboxAiDraftOutcome({
    businessId:993, conversationId:inbound.conversation.id, draftId:draft.id,
    outcome:'used', finalBody:`${draft.body} Thank you.`, actorUser:agent
  });
  assert.equal(outcome.status, 'used');
  assert.equal(outcome.wasEdited, true);
  const metrics = await getInboxAiDraftMetrics(993);
  assert.equal(metrics.summary.totalDrafts >= 1, true);
  assert.equal(metrics.summary.groundedRate > 0, true);
  assert.equal(metrics.recent.some((item) => item.id === draft.id), true);
  assert.equal(Object.hasOwn(metrics.recent[0], 'body'), false);
  await assert.rejects(
    () => validateInboxAiDraftForUse({ businessId:993, conversationId:inbound.conversation.id, draftId:draft.id }),
    /blocked, expired, or already completed/
  );
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

test('platform reliability classifies stale workers, stuck jobs, and dead letters', () => {
  const now = new Date('2026-07-17T10:00:00.000Z');
  const overview = buildReliabilityOverview({
    now,
    staleSeconds: 45,
    stuckSeconds: 300,
    heartbeats: [
      { workerId:'worker-live', role:'job-worker', status:'idle', lastSeenAt:'2026-07-17T09:59:45.000Z' },
      { workerId:'worker-stale', role:'job-worker', status:'working', lastSeenAt:'2026-07-17T09:55:00.000Z' }
    ],
    jobs: [
      { id:1, type:'knowledge.source.sync', status:'running', attempts:1, maxAttempts:3, updatedAt:'2026-07-17T09:50:00.000Z' },
      { id:2, type:'knowledge.source.sync', status:'failed', attempts:3, maxAttempts:3, updatedAt:'2026-07-17T09:58:00.000Z' }
    ],
    sources: [], runs: [], alerts: [], incidents: [], recoveryEvents: []
  });
  assert.equal(overview.summary.healthyWorkers, 1);
  assert.equal(overview.summary.staleWorkers, 1);
  assert.equal(overview.summary.stuckJobs, 1);
  assert.equal(overview.summary.deadLetters, 1);
  assert.equal(overview.summary.status, 'attention');
});

test('connector reliability correlates provider failures across tenants', () => {
  const providers = summarizeProviderReliability({
    sources: [
      { id:11, businessId:1, provider:'shopify', status:'error', consecutiveFailures:2 },
      { id:12, businessId:2, provider:'shopify', status:'ready', consecutiveFailures:0 }
    ],
    runs: [
      { sourceId:11, businessId:1, provider:'shopify', status:'failed' },
      { sourceId:12, businessId:2, provider:'shopify', status:'failed' },
      { sourceId:12, businessId:2, provider:'shopify', status:'succeeded', durationMs:1200 }
    ],
    alerts: [{ sourceId:12, businessId:2, severity:'critical', status:'open' }],
    incidents: []
  });
  const shopify = providers.find((provider) => provider.key === 'shopify');
  assert.equal(shopify.affectedTenants, 2);
  assert.equal(shopify.incidentCandidate, true);
  assert.equal(shopify.successRate, 33);
  assert.equal(shopify.health, 'attention');
});

test('dead-letter recovery creates a linked job and keeps the failed job intact', async () => {
  resetPlatformReliabilityForTests();
  const queued = await enqueueJob({ type:'test.reliability.failure', payload:{ testId:crypto.randomUUID() }, maxAttempts:1 });
  await failJob({ id:queued.jobId, attempts:1, maxAttempts:1 }, new Error('Synthetic exhausted failure'));
  const failed = (await listJobs({ status:'failed', limit:1000 })).find((job) => Number(job.id) === Number(queued.jobId));
  assert.ok(failed);
  const recovery = await retryDeadLetterJob({
    jobId:queued.jobId,
    reason:'Dependency configuration corrected; retry under observation.',
    platformUser:{ id:1, email:'owner@chatclan.co.za', role:'owner' }
  });
  const allJobs = await listJobs({ limit:1000 });
  assert.equal(allJobs.find((job) => Number(job.id) === Number(queued.jobId)).status, 'failed');
  assert.equal(allJobs.find((job) => Number(job.id) === Number(recovery.recoveryJobId)).status, 'queued');
  const overview = await getPlatformReliabilityOverview();
  assert.equal(overview.recoveryEvents[0].originalJobId, queued.jobId);
});

test('invalid campaign dead letters cannot be retried and can be discarded with audit evidence', async () => {
  resetPlatformReliabilityForTests();
  const queued = await enqueueJob({ type:'campaign.dispatch', payload:{ businessId:1, campaignId:'null', limit:1 }, maxAttempts:1 });
  const invalid = new Error('campaignId must be a positive integer');
  invalid.retryable = false;
  await failJob({ id:queued.jobId, attempts:1, maxAttempts:1 }, invalid);
  await assert.rejects(
    () => retryDeadLetterJob({ jobId:queued.jobId, reason:'Retry malformed historical payload.', platformUser:{id:1,email:'owner@chatclan.co.za',role:'owner'} }),
    /cannot be retried/
  );
  const resolution = await discardDeadLetterJob({
    jobId:queued.jobId,
    reason:'Historical smoke request had no campaign; preserve evidence and discard invalid work.',
    platformUser:{id:1,email:'owner@chatclan.co.za',role:'owner'}
  });
  const overview = await getPlatformReliabilityOverview();
  assert.equal(resolution.action,'discarded');
  assert.equal(overview.deadLetters.some((job)=>job.id===queued.jobId),false);
  assert.equal(overview.resolutionEvents[0].jobId,queued.jobId);
});

test('worker heartbeat exposes healthy liveness before the stale threshold', async () => {
  resetPlatformReliabilityForTests();
  const now = new Date('2026-07-17T10:00:00.000Z');
  await recordWorkerHeartbeat({ workerId:'worker-test', status:'idle', jobsProcessed:4, now, force:true });
  const overview = await getPlatformReliabilityOverview({ now:new Date('2026-07-17T10:00:20.000Z') });
  const worker = overview.workers.find((item) => item.workerId === 'worker-test');
  assert.equal(worker.health, 'healthy');
  assert.equal(worker.jobsProcessed, 4);
});

test('platform reliability alerts deliver, acknowledge, assign, and auto-resolve', async () => {
  resetPlatformReliabilityAlertsForTests();
  const platformUser={id:1,name:'Platform Owner',email:'owner@chatclan.co.za',role:'owner'};
  await updatePlatformReliabilityAlertPolicy({emailEnabled:true,inAppEnabled:true,minimumEmailSeverity:'warning',notifyRoles:['owner'],additionalEmails:'oncall@example.test',onCallPlatformUserId:1,escalationMinutes:15,repeatMinutes:30,platformUser});
  const deliveries=[];
  const failingOverview={workers:[],stuckJobs:[],deadLetters:[{id:44,type:'knowledge.source.sync',attempts:3,maxAttempts:3,lastError:'Provider unavailable'}],providers:[]};
  await evaluatePlatformReliabilityAlerts({}, {overview:failingOverview,skipSchedule:true,resolveRecipients:async()=>['oncall@example.test'],sendEmail:async(message)=>{deliveries.push(message);return{messageId:'platform-alert-1'};},now:new Date('2026-07-18T08:00:00Z')});
  let center=await getPlatformReliabilityAlertCenter();
  assert.equal(center.summary.open,1);
  assert.equal(center.alerts[0].notificationCount,1);
  assert.equal(deliveries.length,1);
  await acknowledgePlatformReliabilityAlert({alertId:center.alerts[0].id,platformUser});
  await assignPlatformReliabilityAlert({alertId:center.alerts[0].id,ownerPlatformUserId:1,platformUser});
  center=await getPlatformReliabilityAlertCenter();
  assert.equal(center.summary.acknowledged,1);
  assert.equal(center.alerts[0].events.some((event)=>event.eventType==='assigned'),true);
  await evaluatePlatformReliabilityAlerts({}, {overview:{workers:[],stuckJobs:[],deadLetters:[],providers:[]},skipSchedule:true,now:new Date('2026-07-18T08:20:00Z')});
  center=await getPlatformReliabilityAlertCenter();
  assert.equal(center.summary.open,0);
  assert.equal(center.alerts.length,0);
});

test('platform reliability alerts escalate unresolved signals on policy cadence', async () => {
  resetPlatformReliabilityAlertsForTests();
  const platformUser={id:1,email:'owner@chatclan.co.za',role:'owner'};
  await updatePlatformReliabilityAlertPolicy({emailEnabled:true,inAppEnabled:true,minimumEmailSeverity:'warning',notifyRoles:['owner'],onCallPlatformUserId:1,escalationMinutes:15,repeatMinutes:30,platformUser});
  const overview={workers:[{workerId:'worker-stale',role:'job-worker',health:'stale',status:'idle',secondsSinceSeen:400}],stuckJobs:[],deadLetters:[],providers:[]};
  const deliveries=[];const dependencies={overview,skipSchedule:true,resolveRecipients:async()=>['owner@example.test'],sendEmail:async(message)=>{deliveries.push(message);return{};}};
  await evaluatePlatformReliabilityAlerts({}, {...dependencies,now:new Date('2026-07-18T08:00:00Z')});
  await evaluatePlatformReliabilityAlerts({}, {...dependencies,now:new Date('2026-07-18T08:16:00Z')});
  const center=await getPlatformReliabilityAlertCenter();
  assert.equal(center.summary.escalated,1);
  assert.equal(deliveries.length,2);
  assert.equal(buildPlatformReliabilitySignals(overview)[0].severity,'warning');
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
