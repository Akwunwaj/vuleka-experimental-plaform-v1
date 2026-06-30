const express = require('express');
const { getDashboardData, createCampaign, createContact } = require('../services/repository');
const { importContacts } = require('../services/contactImport');
const { exportConsentEventsCsv, listConsentEvents, maskPhone } = require('../services/consent');
const { listCampaignRecipients, prepareCampaignRecipients } = require('../services/campaignRecipients');
const { hasDatabaseConfig } = require('../db/pool');
const { enqueueJob } = require('../services/jobQueue');
const { runOnce } = require('../worker');
const { sendTextMessage } = require('../services/metaClient');
const { getBusinessProfile, updateBusinessProfile } = require('../services/metaBusinessProfile');
const { getMaskedMetaCredentials, saveMetaCredentials } = require('../services/metaCredentials');
const {
  completeEmbeddedSignup,
  getMetaAssetHealth,
  getMetaOnboardingConfig,
  getMetaOnboardingStatus,
  registerPhoneNumber,
  subscribeWabaWebhooks
} = require('../services/metaOnboarding');
const {
  createBusinessUser,
  deactivateBusinessUser,
  listBusinessUsers,
  requestPasswordReset,
  resetPassword,
  updateBusinessUserRole
} = require('../services/users');
const {
  createTemplate,
  installLibraryTemplate,
  listTemplateLibrary,
  listTemplates,
  updateTemplateStatus
} = require('../services/templates');
const { submitTemplateToMeta, syncMetaTemplates } = require('../services/metaTemplates');
const { getCatalogSyncPreview, syncMetaCatalog } = require('../services/metaCatalogSync');
const {
  duplicateFlowTemplate,
  getChatbotFlow,
  listChatbotFlows,
  listFlowTemplates,
  publishChatbotFlow,
  simulateChatbotFlow,
  updateChatbotFlow
} = require('../services/chatbotFlows');
const { getAnalyticsOverview, getMetaCostReport } = require('../services/analytics');
const { listMetaRateCards, syncConfiguredMetaRateCard } = require('../services/metaCosts');
const { createPayFastCheckout, getBillingOverview, listBillingPlans } = require('../services/billing');
const { getPlanStatus } = require('../services/subscriptionPolicy');
const { registerProspect } = require('../services/registration');
const {
  completeSocialSignup,
  createSocialAuthStart,
  handleSocialCallback,
  listSocialProviders
} = require('../services/socialAuth');
const { createDataDeletionRequest, listDataDeletionRequests } = require('../services/dataDeletion');
const {
  applyCouponToOrder,
  archiveProduct,
  createOrder,
  createOrderPaymentLink,
  createCoupon,
  createProduct,
  createProductCollection,
  createProductVariant,
  createReturnRequest,
  applyCommerceAutomationRulesForOrder,
  getCommerceAnalytics,
  getCommerceAutomationInsights,
  getCommerceCustomerSegments,
  getInventoryAlerts,
  getOrderById,
  getProductCollectionById,
  importProducts,
  listCommerceAutomationRules,
  listAbandonedCarts,
  listCoupons,
  listProductCollections,
  listOrders,
  listProducts,
  listProductVariants,
  listReturnRequests,
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
} = require('../services/commerce');
const {
  addConversationNote,
  getConversation,
  listConversationNotes,
  listConversations,
  recordConversationCsat,
  recordOutboundReply,
  recordTypingIndicator,
  updateConversation
} = require('../services/inbox');
const { subscribeInboxEvents } = require('../services/inboxEvents');
const { verifyMailer } = require('../services/mailer');
const { getSetupWizardProgress, markSetupStep } = require('../services/setupWizard');
const {
  authenticateUser,
  createSession,
  destroySession,
  serializeClearSessionCookie,
  serializeSessionCookie,
  signSessionId
} = require('../services/auth');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, async (req, res, next) => {
  try {
    res.json(await getDashboardData(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/overview', requireAuth, async (req, res, next) => {
  try {
    res.json(await getAnalyticsOverview(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/costs', requireAuth, async (req, res, next) => {
  try {
    res.json(await getMetaCostReport(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/analytics/meta-rate-cards', requireAuth, async (req, res, next) => {
  try {
    res.json({ rates: await listMetaRateCards({ market: req.query.market, currency: req.query.currency }) });
  } catch (err) {
    next(err);
  }
});

router.post('/analytics/meta-rate-cards/sync', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await syncConfiguredMetaRateCard({
        market: req.body.market,
        currency: req.body.currency,
        source: req.body.source || 'environment'
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/billing', requireAuth, async (req, res, next) => {
  try {
    const overview = await getBillingOverview(req.businessId);
    res.json({ ...overview, entitlements: await getPlanStatus(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.get('/billing/plans', requireAuth, async (req, res, next) => {
  try {
    res.json({ plans: await listBillingPlans(), entitlements: await getPlanStatus(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.get('/setup/wizard', requireAuth, async (req, res, next) => {
  try {
    res.json(await getSetupWizardProgress(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.patch('/setup/wizard/steps/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await markSetupStep({
        businessId: req.businessId,
        stepId: req.params.id,
        status: req.body.status,
        metadata: req.body.metadata
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/billing/payfast/checkout', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(
      await createPayFastCheckout({
        businessId: req.businessId,
        planCode: req.body.planCode,
        user: req.user
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/compliance/deletion-requests', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json({ requests: await listDataDeletionRequests(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.post('/compliance/deletion-requests', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(202).json(
      await createDataDeletionRequest({
        businessId: req.businessId,
        phone: req.body.phone,
        reason: req.body.reason,
        requestedByUserId: req.user?.id || null
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/inbox/conversations', requireAuth, async (req, res, next) => {
  try {
    res.json({
      conversations: await listConversations(req.businessId, {
        status: req.query.status,
        assigned: req.query.assigned,
        assignedUserId: req.query.assignedUserId
      })
    });
  } catch (err) {
    next(err);
  }
});

router.get('/inbox/events', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.write(`event: ready\ndata: ${JSON.stringify({ businessId: req.businessId })}\n\n`);

  const unsubscribe = subscribeInboxEvents(req.businessId, (event) => {
    res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

router.get('/inbox/conversations/:id', requireAuth, async (req, res, next) => {
  try {
    res.json(await getConversation(req.businessId, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.patch('/inbox/conversations/:id', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await updateConversation({
        businessId: req.businessId,
        conversationId: req.params.id,
        assignedUserId: req.body.assignedUserId,
        status: req.body.status,
        markRead: req.body.markRead === true
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/replies', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(201).json(
      await recordOutboundReply({
        businessId: req.businessId,
        conversationId: req.params.id,
        body: req.body.body,
        actorUser: req.user
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/inbox/conversations/:id/notes', requireAuth, async (req, res, next) => {
  try {
    res.json({ notes: await listConversationNotes(req.businessId, req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/notes', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(201).json(
      await addConversationNote({
        businessId: req.businessId,
        conversationId: req.params.id,
        body: req.body.body,
        actorUser: req.user
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/typing', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await recordTypingIndicator({
        businessId: req.businessId,
        conversationId: req.params.id,
        actorUser: req.user,
        isTyping: req.body.isTyping
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/csat', requireAuth, async (req, res, next) => {
  try {
    res.json(
      await recordConversationCsat({
        businessId: req.businessId,
        conversationId: req.params.id,
        score: req.body.score,
        comment: req.body.comment
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/auth/me', (req, res) => {
  res.json({ user: req.user || null, businessId: req.businessId || null });
});

router.get('/auth/social/providers', (req, res) => {
  res.json({ providers: listSocialProviders() });
});

router.get('/auth/social/:provider/start', async (req, res, next) => {
  try {
    const start = await createSocialAuthStart({
      provider: req.params.provider,
      purpose: req.query.purpose,
      planCode: req.query.plan,
      redirectTo: req.query.redirectTo
    });
    res.redirect(start.authorizationUrl);
  } catch (err) {
    next(err);
  }
});

router.get('/auth/social/:provider/callback', async (req, res, next) => {
  try {
    const result = await handleSocialCallback({
      provider: req.params.provider,
      state: req.query.state,
      code: req.query.code
    });
    if (result.user) {
      const session = await createSession(result.user, req.get('user-agent'), req.ip);
      res.setHeader('Set-Cookie', serializeSessionCookie(signSessionId(session.id), session.expiresAt));
    }
    res.redirect(result.redirectTo);
  } catch (err) {
    next(err);
  }
});

router.post('/auth/social/:provider/callback', async (req, res, next) => {
  try {
    const result = await handleSocialCallback({
      provider: req.params.provider,
      state: req.body.state,
      code: req.body.code
    });
    if (result.user) {
      const session = await createSession(result.user, req.get('user-agent'), req.ip);
      res.setHeader('Set-Cookie', serializeSessionCookie(signSessionId(session.id), session.expiresAt));
    }
    res.redirect(result.redirectTo);
  } catch (err) {
    next(err);
  }
});

router.post('/auth/login', async (req, res) => {
  const user = await authenticateUser(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const session = await createSession(user, req.get('user-agent'), req.ip);
  res.setHeader('Set-Cookie', serializeSessionCookie(signSessionId(session.id), session.expiresAt));
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    businessId: user.businessId
  });
});

router.post('/auth/register', async (req, res, next) => {
  try {
    const signup = await registerProspect(req.body);
    const session = await createSession(signup.user, req.get('user-agent'), req.ip);
    res.setHeader('Set-Cookie', serializeSessionCookie(signSessionId(session.id), session.expiresAt));
    res.status(201).json({
      user: {
        id: signup.user.id,
        name: signup.user.name,
        email: signup.user.email,
        role: signup.user.role
      },
      business: signup.business,
      subscription: signup.subscription
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/social/complete', async (req, res, next) => {
  try {
    const signup = await completeSocialSignup(req.body);
    const session = await createSession(signup.user, req.get('user-agent'), req.ip);
    res.setHeader('Set-Cookie', serializeSessionCookie(signSessionId(session.id), session.expiresAt));
    res.status(201).json({
      user: {
        id: signup.user.id,
        name: signup.user.name,
        email: signup.user.email,
        role: signup.user.role
      },
      business: signup.business,
      subscription: signup.subscription
    });
  } catch (err) {
    next(err);
  }
});

router.post('/auth/logout', async (req, res) => {
  await destroySession(req.session?.id);
  res.setHeader('Set-Cookie', serializeClearSessionCookie());
  res.json({ ok: true });
});

router.post('/auth/password-reset/request', async (req, res, next) => {
  try {
    res.json(await requestPasswordReset(req.body.email));
  } catch (err) {
    next(err);
  }
});

router.post('/auth/password-reset/confirm', async (req, res, next) => {
  try {
    res.json(await resetPassword({ token: req.body.token, password: req.body.password }));
  } catch (err) {
    next(err);
  }
});

router.get('/users', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json({ users: await listBusinessUsers(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.post('/users', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(await createBusinessUser({ ...req.body, businessId: req.businessId }));
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/role', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await updateBusinessUserRole({
        businessId: req.businessId,
        userId: req.params.id,
        role: req.body.role,
        actorUserId: req.user.id
      })
    );
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await deactivateBusinessUser({
        businessId: req.businessId,
        userId: req.params.id,
        actorUserId: req.user.id
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/templates/library', requireAuth, (req, res) => {
  res.json({
    templates: listTemplateLibrary({
      industryId: req.query.industryId,
      category: req.query.category
    })
  });
});

router.get('/templates', requireAuth, async (req, res, next) => {
  try {
    res.json({ templates: await listTemplates(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const template = await createTemplate(req.businessId, req.body);
    await markSetupStep({ businessId: req.businessId, stepId: 'first_template', metadata: { templateId: template.id } });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

router.post('/templates/library/:id/install', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const template = await installLibraryTemplate(req.businessId, req.params.id);
    await markSetupStep({ businessId: req.businessId, stepId: 'first_template', metadata: { templateId: template.id } });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

router.patch('/templates/:id/status', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await updateTemplateStatus({
        businessId: req.businessId,
        templateId: req.params.id,
        status: req.body.status,
        rejectionReason: req.body.rejectionReason,
        metaTemplateId: req.body.metaTemplateId
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/templates/:id/submit-meta', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(202).json(await submitTemplateToMeta({ businessId: req.businessId, templateId: req.params.id }));
  } catch (err) {
    next(err);
  }
});

router.post('/templates/sync-meta', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await syncMetaTemplates(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/chatbot/templates', requireAuth, (req, res) => {
  res.json({ templates: listFlowTemplates({ industryId: req.query.industryId }) });
});

router.get('/chatbot/flows', requireAuth, async (req, res, next) => {
  try {
    res.json({ flows: await listChatbotFlows(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/products', requireAuth, async (req, res, next) => {
  try {
    res.json({ products: await listProducts(req.businessId, { status: req.query.status }) });
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/analytics', requireAuth, async (req, res, next) => {
  try {
    res.json(await getCommerceAnalytics(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/inventory-alerts', requireAuth, async (req, res, next) => {
  try {
    res.json(await getInventoryAlerts(req.businessId, { threshold: req.query.threshold }));
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/coupons', requireAuth, async (req, res, next) => {
  try {
    res.json({ coupons: await listCoupons(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/abandoned-carts', requireAuth, async (req, res, next) => {
  try {
    res.json({
      carts: await listAbandonedCarts(req.businessId, {
        olderThanMinutes: req.query.olderThanMinutes
      })
    });
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/returns', requireAuth, async (req, res, next) => {
  try {
    res.json({ returns: await listReturnRequests(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/customer-segments', requireAuth, async (req, res, next) => {
  try {
    res.json(await getCommerceCustomerSegments(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/automation-rules', requireAuth, async (req, res, next) => {
  try {
    res.json({ rules: await listCommerceAutomationRules(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/automation-insights', requireAuth, async (req, res, next) => {
  try {
    res.json(await getCommerceAutomationInsights(req.businessId, { attributionDays: req.query.attributionDays }));
  } catch (err) {
    next(err);
  }
});

router.patch('/commerce/automation-rules/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await updateCommerceAutomationRule({
        businessId: req.businessId,
        ruleId: req.params.id,
        enabled: req.body.enabled,
        delayValue: req.body.delayValue,
        delayUnit: req.body.delayUnit
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/coupons', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(await createCoupon(req.businessId, req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/products', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(await createProduct(req.businessId, req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/products/import', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(req.body.commit === true ? 201 : 200).json(
      await importProducts({
        businessId: req.businessId,
        csvText: req.body.csvText,
        commit: req.body.commit === true
      })
    );
  } catch (err) {
    next(err);
  }
});

router.patch('/commerce/products/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await updateProduct(req.businessId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/products/:id/archive', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await archiveProduct(req.businessId, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/collections', requireAuth, async (req, res, next) => {
  try {
    res.json({ collections: await listProductCollections(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/collections', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(await createProductCollection(req.businessId, req.body));
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/collections/:id', requireAuth, async (req, res, next) => {
  try {
    res.json(await getProductCollectionById(req.businessId, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/collections/:id/share', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await shareProductCollection({
        businessId: req.businessId,
        collectionId: req.params.id,
        to: req.body.to,
        body: req.body.body,
        footer: req.body.footer
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/products/:id/variants', requireAuth, async (req, res, next) => {
  try {
    res.json({ variants: await listProductVariants(req.businessId, req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/products/:id/variants', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(await createProductVariant(req.businessId, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/orders', requireAuth, async (req, res, next) => {
  try {
    res.json({ orders: await listOrders(req.businessId) });
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/orders/:id', requireAuth, async (req, res, next) => {
  try {
    res.json(await getOrderById(req.businessId, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(201).json(await createOrder(req.businessId, req.body));
  } catch (err) {
    next(err);
  }
});

router.patch('/commerce/orders/:id/status', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await updateOrderStatus({
        businessId: req.businessId,
        orderId: req.params.id,
        status: req.body.status,
        note: req.body.note,
        sendWhatsApp: req.body.sendWhatsApp === true
      })
    );
  } catch (err) {
    next(err);
  }
});

router.patch('/commerce/orders/:id/fulfilment', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await updateOrderFulfilment({
        businessId: req.businessId,
        orderId: req.params.id,
        provider: req.body.provider,
        trackingNumber: req.body.trackingNumber,
        trackingUrl: req.body.trackingUrl,
        note: req.body.note,
        sendWhatsApp: req.body.sendWhatsApp === true
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/coupon', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await applyCouponToOrder({
        businessId: req.businessId,
        orderId: req.params.id,
        code: req.body.code
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/payment-link', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(201).json(
      await createOrderPaymentLink({
        businessId: req.businessId,
        orderId: req.params.id,
        provider: req.body.provider,
        paymentLinkUrl: req.body.paymentLinkUrl
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/send-payment-link', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await sendOrderPaymentLink({
        businessId: req.businessId,
        orderId: req.params.id,
        body: req.body.body
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/recover-cart', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await sendAbandonedCartRecovery({
        businessId: req.businessId,
        orderId: req.params.id,
        body: req.body.body
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/reconcile-payment', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await reconcileOrderPayment({
        businessId: req.businessId,
        orderId: req.params.id,
        provider: req.body.provider,
        providerPaymentId: req.body.providerPaymentId,
        amount: req.body.amount,
        amountCents: req.body.amountCents,
        paymentStatus: req.body.paymentStatus || 'COMPLETE',
        raw: { source: 'manual', actorUserId: req.user?.id || null }
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/returns', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(201).json(
      await createReturnRequest({
        businessId: req.businessId,
        orderId: req.params.id,
        reason: req.body.reason,
        resolution: req.body.resolution,
        amount: req.body.amount,
        amountCents: req.body.amountCents,
        note: req.body.note,
        sendWhatsApp: req.body.sendWhatsApp === true
      })
    );
  } catch (err) {
    next(err);
  }
});

router.patch('/commerce/returns/:id', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await updateReturnRequest({
        businessId: req.businessId,
        returnId: req.params.id,
        status: req.body.status,
        note: req.body.note,
        refundReference: req.body.refundReference,
        amount: req.body.amount,
        amountCents: req.body.amountCents,
        sendWhatsApp: req.body.sendWhatsApp === true
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/send-status', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await sendOrderStatusMessage({
        businessId: req.businessId,
        orderId: req.params.id,
        body: req.body.body
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/post-purchase', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await sendPostPurchasePrompt({
        businessId: req.businessId,
        orderId: req.params.id,
        promptType: req.body.promptType,
        body: req.body.body
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/schedule-post-purchase', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await schedulePostPurchasePrompts({
        businessId: req.businessId,
        orderId: req.params.id,
        triggers: req.body.triggers
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/apply-automation-rules', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await applyCommerceAutomationRulesForOrder({
        businessId: req.businessId,
        orderId: req.params.id,
        source: 'manual'
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/share-catalog', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await shareCatalog({
        businessId: req.businessId,
        to: req.body.to,
        productIds: req.body.productIds,
        body: req.body.body,
        footer: req.body.footer
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/commerce/catalog-sync/preview', requireAuth, async (req, res, next) => {
  try {
    res.json(
      await getCatalogSyncPreview(req.businessId, {
        catalogId: req.query.catalogId,
        includeVariants: req.query.includeVariants !== 'false'
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/catalog-sync', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(202).json(
      await syncMetaCatalog(req.businessId, {
        catalogId: req.body.catalogId,
        includeVariants: req.body.includeVariants !== false
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/chatbot/templates/:id/duplicate', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(
      await duplicateFlowTemplate({
        businessId: req.businessId,
        templateId: req.params.id,
        name: req.body.name
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/chatbot/flows/:id', requireAuth, async (req, res, next) => {
  try {
    res.json(await getChatbotFlow(req.businessId, req.params.id));
  } catch (err) {
    next(err);
  }
});

router.put('/chatbot/flows/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await updateChatbotFlow({
        businessId: req.businessId,
        flowId: req.params.id,
        name: req.body.name,
        definition: req.body.definition
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/chatbot/flows/:id/publish', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await publishChatbotFlow({ businessId: req.businessId, flowId: req.params.id }));
  } catch (err) {
    next(err);
  }
});

router.post('/chatbot/flows/:id/simulate', requireAuth, async (req, res, next) => {
  try {
    res.json(
      await simulateChatbotFlow({
        businessId: req.businessId,
        flowId: req.params.id,
        input: req.body.input,
        contact: req.body.contact
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/campaigns', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(await createCampaign(req.body, req.businessId));
  } catch (err) {
    next(err);
  }
});

router.post('/campaigns/:id/recipients/prepare', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(
      await prepareCampaignRecipients({
        businessId: req.businessId,
        campaignId: req.params.id,
        audience: req.body.audience,
        body: req.body.body
      })
    );
  } catch (err) {
    next(err);
  }
});

router.get('/campaigns/:id/recipients', requireAuth, async (req, res, next) => {
  try {
    res.json({
      recipients: await listCampaignRecipients({
        businessId: req.businessId,
        campaignId: req.params.id
      })
    });
  } catch (err) {
    next(err);
  }
});

router.post('/campaigns/:id/dispatch', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const job = await enqueueJob({
      type: 'campaign.dispatch',
      payload: {
        businessId: req.businessId,
        campaignId: req.params.id,
        limit: req.body.limit
      },
      dedupeKey: `campaign.dispatch:${req.businessId}:${req.params.id}`
    });

    if (!hasDatabaseConfig()) {
      await runOnce({ limit: 1 });
    }

    res.status(202).json({ queued: true, ...job });
  } catch (err) {
    next(err);
  }
});

router.post('/contacts', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    if (!req.body.name || !req.body.phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }
    const contact = await createContact(req.body, req.businessId);
    await markSetupStep({ businessId: req.businessId, stepId: 'contacts', metadata: { source: 'manual' } });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

router.post('/contacts/import', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await importContacts({
        businessId: req.businessId,
        csvText: req.body.csvText,
        mapping: req.body.mapping,
        commit: req.body.commit === true
      });
    if (req.body.commit === true && result.imported > 0) {
      await markSetupStep({ businessId: req.businessId, stepId: 'contacts', metadata: { source: 'csv', imported: result.imported } });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/consent/events', requireAuth, async (req, res, next) => {
  try {
    const events = await listConsentEvents(req.businessId, { contactId: req.query.contactId });
    res.json({
      events: events.map(({ phone, ...event }) => ({
        ...event,
        phoneMasked: maskPhone(phone)
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.get('/consent/export.csv', requireAuth, async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chatclan-consent-events.csv"');
    res.send(await exportConsentEventsCsv(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/integrations/meta', requireAuth, async (req, res, next) => {
  try {
    res.json(await getMaskedMetaCredentials(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.get('/integrations/meta/onboarding', requireAuth, async (req, res, next) => {
  try {
    res.json(await getMetaOnboardingStatus({ businessId: req.businessId, origin: `${req.protocol}://${req.get('host')}` }));
  } catch (err) {
    next(err);
  }
});

router.get('/integrations/meta/onboarding/config', requireAuth, async (req, res, next) => {
  try {
    res.json(getMetaOnboardingConfig({ businessId: req.businessId, origin: `${req.protocol}://${req.get('host')}` }));
  } catch (err) {
    next(err);
  }
});

router.get('/integrations/meta/assets/health', requireAuth, async (req, res, next) => {
  try {
    res.json(await getMetaAssetHealth({ businessId: req.businessId }));
  } catch (err) {
    next(err);
  }
});

router.get('/integrations/meta/business-profile', requireAuth, async (req, res, next) => {
  try {
    res.json(await getBusinessProfile(req.businessId));
  } catch (err) {
    next(err);
  }
});

router.put('/integrations/meta/business-profile', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await updateBusinessProfile(req.businessId, req.body);
    await markSetupStep({ businessId: req.businessId, stepId: 'business_profile', metadata: { source: 'whatsapp_business_profile', mode: result.mode } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/integrations/meta/onboarding/complete', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await completeEmbeddedSignup({
      businessId: req.businessId,
      code: req.body.code,
      wabaId: req.body.wabaId,
      phoneNumberId: req.body.phoneNumberId,
      businessAccountId: req.body.businessAccountId,
      phoneNumber: req.body.phoneNumber,
      verifyToken: req.body.verifyToken
    });
    await markSetupStep({ businessId: req.businessId, stepId: 'meta_credentials', metadata: { provider: 'embedded_signup', mode: result.mode } });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/integrations/meta/webhooks/subscribe', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await subscribeWabaWebhooks({
      businessId: req.businessId,
      callbackUrl: req.body.callbackUrl || `${req.protocol}://${req.get('host')}/webhooks/meta`,
      verifyToken: req.body.verifyToken
    });
    await markSetupStep({ businessId: req.businessId, stepId: 'meta_webhook_subscription', metadata: { mode: result.mode, wabaId: result.wabaId } });
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/integrations/meta/phone/register', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await registerPhoneNumber({
      businessId: req.businessId,
      pin: req.body.pin,
      dataLocalizationRegion: req.body.dataLocalizationRegion
    });
    await markSetupStep({ businessId: req.businessId, stepId: 'meta_phone_registration', metadata: { mode: result.mode, phoneNumberId: result.phoneNumberId } });
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
});

router.put('/integrations/meta', requireAuth, async (req, res, next) => {
  try {
    const credentials = await saveMetaCredentials(req.businessId, req.body);
    await markSetupStep({ businessId: req.businessId, stepId: 'meta_credentials', metadata: { provider: 'meta_whatsapp' } });
    res.json(credentials);
  } catch (err) {
    next(err);
  }
});

router.get('/integrations/email/verify', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await verifyMailer());
  } catch (err) {
    next(err);
  }
});

router.post('/messages/send-test', requireAuth, async (req, res, next) => {
  try {
    if (!req.body.to || !req.body.text) {
      return res.status(400).json({ error: 'to and text are required' });
    }
    const result = await sendTextMessage({ ...req.body, businessId: req.businessId });
    await markSetupStep({ businessId: req.businessId, stepId: 'test_message', metadata: { mode: result.mode } });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
