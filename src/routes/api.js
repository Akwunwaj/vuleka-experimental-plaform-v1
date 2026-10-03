const express = require('express');
const { getDashboardData, createCampaign, createContact, updateContact, softDeleteContact } = require('../services/repository');
const { importContacts } = require('../services/contactImport');
const { exportConsentEventsCsv, listConsentEvents, maskPhone } = require('../services/consent');
const { listCampaignRecipients, prepareCampaignRecipients } = require('../services/campaignRecipients');
const { hasDatabaseConfig } = require('../db/pool');
const { enqueueJob } = require('../services/jobQueue');
const { normalizeCampaignDispatchPayload } = require('../services/broadcastDispatch');
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
const { processFacebookDataDeletion } = require('../services/socialDataDeletion');
const { verifyRecaptcha } = require('../services/recaptcha');
const { createDataDeletionRequest, listDataDeletionRequests } = require('../services/dataDeletion');
const {
  applyCouponToOrder,
  archiveProduct,
  createOrder,
  createOrderPaymentLink,
  createCoupon,
  createProduct,
  createProductFromOrderItem,
  createProductCollection,
  createProductVariant,
  createReturnRequest,
  applyCommerceAutomationRuleToReadyOrders,
  applyCommerceAutomationRulesForOrder,
  getCommerceAnalytics,
  getCommerceAutomationInsights,
  getCommerceCustomerSegments,
  getInventoryAlerts,
  getOrderById,
  getProductCollectionById,
  importProducts,
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
const { generateInboxAiDraft, getInboxAiDraftMetrics, markInboxAiDraftOutcome, validateInboxAiDraftForUse } = require('../services/inboxAiDrafts');
const { createKnowledgeItem, getKnowledgeOverview, updateKnowledgeItem } = require('../services/tenantKnowledge');
const { createApiPushConnector, importKnowledgeContent, ingestApiConnectorRecords, listKnowledgeSources } = require('../services/knowledgeIngestion');
const { createKnowledgeConnector, deleteKnowledgeConnector, requestKnowledgeConnectorSync, updateKnowledgeConnector } = require('../services/knowledgeConnectors');
const { beginGoogleDriveOAuth, getGoogleDriveOAuthStatus } = require('../services/googleDriveOAuth');
const { getKnowledgeConnectorOperations } = require('../services/knowledgeConnectorOperations');
const { acknowledgeConnectorAlert, getConnectorAlertCenter, updateConnectorAlertPolicy } = require('../services/connectorAlerts');
const { createKnowledgeEvaluationCase, listKnowledgeEvaluationCases, listKnowledgeEvaluationRuns, runKnowledgeEvaluations } = require('../services/knowledgeEvaluations');
const { subscribeInboxEvents } = require('../services/inboxEvents');
const { verifyMailer } = require('../services/mailer');
const { sendPublicLeadEmails } = require('../services/mailer');
const { addPublicLeadEvent, createPublicLead, exportPublicLeadsCsv, getPublicLead, getPublicLeadSummary, listPublicLeadEvents, listPublicLeads, updatePublicLead } = require('../services/publicLeads');
const { getResolvedCrmStatus, queuePublicLeadCrmDelivery } = require('../services/publicLeadCrm');
const { getCrmConfiguration, saveCrmConfiguration, testCrmConfiguration } = require('../services/crmConfiguration');
const { beginTenantCrmOAuth, disconnectTenantCrm, getTenantCrmJobStatus, getTenantCrmOperations, requestTenantCrmSync, testTenantCrmConnection, updateTenantCrmConnection } = require('../services/tenantCrm');
const { queuePublicLeadSlaChecks } = require('../services/publicLeadSla');
const { listPlatformUsers } = require('../services/platformAuth');
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
const { publicFormRateLimit } = require('../middleware/security');
const {
  authenticatePlatformUser,
  createPlatformSession,
  destroyPlatformSession,
  serializeClearPlatformSessionCookie,
  serializePlatformSessionCookie,
  signPlatformSessionId
} = require('../services/platformAuth');
const { requirePlatformAuth, requirePlatformRole } = require('../middleware/platformAuth');
const {
  createPlatformTenantNote,
  getPlatformOverview,
  getPlatformTenant,
  listPlatformAuditEvents,
  listPlatformTenants,
  recordPlatformAuditEvent,
  updatePlatformTenantStatus
} = require('../services/platform');
const {
  listPlatformGuardrails,
  updatePlatformGuardrail
} = require('../services/platformGuardrails');
const {
  createPlatformIncident,
  createPlatformIncidentEvent,
  getPlatformIncident,
  listPlatformIncidents,
  updatePlatformIncident
} = require('../services/platformIncidents');
const {
  discardDeadLetterJob,
  getPlatformReliabilityOverview,
  retryDeadLetterJob
} = require('../services/platformReliability');
const {
  acknowledgePlatformReliabilityAlert,
  assignPlatformReliabilityAlert,
  evaluatePlatformReliabilityAlerts,
  getPlatformReliabilityAlertCenter,
  linkPlatformReliabilityAlertIncident,
  updatePlatformReliabilityAlertPolicy
} = require('../services/platformReliabilityAlerts');
const {
  checkAiProviderHealth,
  getAiOperationsOverview,
  getBusinessAiPolicy,
  listAiProviders,
  listAiUsage,
  orchestrateAiText,
  saveAiProviderConfig,
  saveBusinessAiPolicy
} = require('../services/aiControlPlane');

const router = express.Router();

function verifyAuthChallenge(req, expectedAction) {
  return verifyRecaptcha({
    token: req.body?.recaptchaToken,
    expectedAction,
    remoteIp: req.ip
  });
}

router.post('/public/leads', publicFormRateLimit, async (req, res, next) => {
  try {
    await verifyAuthChallenge(req, 'public_lead');
    const lead = await createPublicLead(req.body, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    if (!lead.filtered && !lead.duplicate) {
      try {
        await sendPublicLeadEmails({ lead });
      } catch (error) {
        console.error({ requestId: req.id, error: error.message, code: 'PUBLIC_LEAD_NOTIFICATION_FAILED', leadReference: lead.reference });
      }
      try {
        await queuePublicLeadCrmDelivery(lead.id);
      } catch (error) {
        console.error({ requestId:req.id, error:error.message, code:'PUBLIC_LEAD_CRM_QUEUE_FAILED', leadReference:lead.reference });
      }
      try {
        await queuePublicLeadSlaChecks(lead);
      } catch (error) {
        console.error({ requestId:req.id, error:error.message, code:'PUBLIC_LEAD_SLA_QUEUE_FAILED', leadReference:lead.reference });
      }
    }
    res.status(lead.duplicate ? 200 : 201).json({
      accepted: true,
      duplicate: Boolean(lead.duplicate),
      reference: lead.reference
    });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/leads', requirePlatformAuth, async (req, res, next) => {
  try {
    const [leads, summary] = await Promise.all([
      listPublicLeads({ status: req.query.status, limit: req.query.limit }),
      getPublicLeadSummary()
    ]);
    res.json({ leads, summary });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/leads/export.csv', requirePlatformAuth, async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="chatclan-public-leads.csv"');
    res.send(await exportPublicLeadsCsv());
  } catch (err) {
    next(err);
  }
});

router.get('/platform/leads/:id', requirePlatformAuth, async (req, res, next) => {
  try {
    const [lead, events, platformUsers] = await Promise.all([
      getPublicLead(req.params.id),
      listPublicLeadEvents(req.params.id),
      listPlatformUsers()
    ]);
    res.json({ lead, events, platformUsers, crm: await getResolvedCrmStatus() });
  } catch (err) {
    next(err);
  }
});

router.patch('/platform/leads/:id', requirePlatformAuth, async (req, res, next) => {
  try {
    const lead = await updatePublicLead({
      leadId: req.params.id,
      status: req.body.status,
      ownerPlatformUserId: req.body.ownerPlatformUserId,
      nextFollowUpAt: req.body.nextFollowUpAt,
      disqualificationReason: req.body.disqualificationReason,
      platformUser:req.platformUser
    });
    await recordPlatformAuditEvent({
      platformUser: req.platformUser,
      action: 'platform.lead.update',
      targetType: 'public_lead',
      targetId: lead.id,
      reason: `Lead status changed to ${lead.status}`,
      metadata: { reference: lead.reference, company: lead.company },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ lead });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/leads/:id/notes', requirePlatformAuth, async (req, res, next) => {
  try {
    const event = await addPublicLeadEvent({ leadId:req.params.id, platformUser:req.platformUser, eventType:'note', note:req.body.note });
    await recordPlatformAuditEvent({ platformUser:req.platformUser, action:'platform.lead.note.create', targetType:'public_lead', targetId:req.params.id, reason:'Lead activity note added', metadata:{ eventId:event.id }, ipAddress:req.ip, userAgent:req.get('user-agent') });
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/leads/:id/crm-deliver', requirePlatformAuth, async (req, res, next) => {
  try {
    const result = await queuePublicLeadCrmDelivery(req.params.id, { force:true });
    await recordPlatformAuditEvent({ platformUser:req.platformUser, action:'platform.lead.crm.retry', targetType:'public_lead', targetId:req.params.id, reason:'Manual CRM delivery requested', metadata:result, ipAddress:req.ip, userAgent:req.get('user-agent') });
    res.status(result.queued === false ? 409 : 202).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/platform/crm/configuration', requirePlatformAuth, async (req, res, next) => {
  try { res.json({ configuration:await getCrmConfiguration() }); } catch (err) { next(err); }
});

router.patch('/platform/crm/configuration', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const configuration = await saveCrmConfiguration({ ...req.body, platformUser:req.platformUser });
    await recordPlatformAuditEvent({ platformUser:req.platformUser, action:'platform.crm.configuration.update', targetType:'crm_provider', targetId:configuration.providerKey, reason:configuration.enabled ? 'CRM provider enabled' : 'CRM provider disabled', metadata:{ providerKey:configuration.providerKey, tokenRotated:Boolean(req.body.accessToken), webhookSecretRotated:Boolean(req.body.webhookSecret) }, ipAddress:req.ip, userAgent:req.get('user-agent') });
    res.json({ configuration });
  } catch (err) { next(err); }
});

router.post('/platform/crm/configuration/test', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const health = await testCrmConfiguration();
    await recordPlatformAuditEvent({ platformUser:req.platformUser, action:'platform.crm.configuration.test', targetType:'crm_provider', targetId:'hubspot', reason:health.status, metadata:{ latencyMs:health.latencyMs }, ipAddress:req.ip, userAgent:req.get('user-agent') });
    res.status(health.status === 'healthy' ? 200 : 502).json({ health });
  } catch (err) { next(err); }
});

router.get('/platform/overview', requirePlatformAuth, async (req, res, next) => {
  try {
    res.json(await getPlatformOverview());
  } catch (err) {
    next(err);
  }
});

router.get('/platform/reliability', requirePlatformAuth, async (req, res, next) => {
  try {
    const [reliability, alertCenter] = await Promise.all([getPlatformReliabilityOverview(),getPlatformReliabilityAlertCenter()]);
    res.json({ ...reliability, alertCenter });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/reliability/evaluate', requirePlatformRole(['owner']), async (req, res, next) => {
  try { res.json(await evaluatePlatformReliabilityAlerts({}, { skipSchedule:true })); } catch (err) { next(err); }
});

router.patch('/platform/reliability/alert-policy', requirePlatformRole(['owner']), async (req, res, next) => {
  try { res.json({ policy:await updatePlatformReliabilityAlertPolicy({ ...req.body,platformUser:req.platformUser,ipAddress:req.ip,userAgent:req.get('user-agent') }) }); } catch (err) { next(err); }
});

router.post('/platform/reliability/alerts/:id/acknowledge', requirePlatformAuth, async (req, res, next) => {
  try { res.json({ alert:await acknowledgePlatformReliabilityAlert({ alertId:req.params.id,ownerPlatformUserId:req.body.ownerPlatformUserId,platformUser:req.platformUser,ipAddress:req.ip,userAgent:req.get('user-agent') }) }); } catch (err) { next(err); }
});

router.patch('/platform/reliability/alerts/:id/assignment', requirePlatformRole(['owner']), async (req, res, next) => {
  try { res.json({ alert:await assignPlatformReliabilityAlert({ alertId:req.params.id,ownerPlatformUserId:req.body.ownerPlatformUserId,platformUser:req.platformUser,ipAddress:req.ip,userAgent:req.get('user-agent') }) }); } catch (err) { next(err); }
});

router.post('/platform/reliability/alerts/:id/incident', requirePlatformRole(['owner']), async (req, res, next) => {
  try { res.json({ alert:await linkPlatformReliabilityAlertIncident({ alertId:req.params.id,incidentId:req.body.incidentId,platformUser:req.platformUser,ipAddress:req.ip,userAgent:req.get('user-agent') }) }); } catch (err) { next(err); }
});

router.post('/platform/reliability/jobs/:id/retry', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const recovery = await retryDeadLetterJob({
      jobId: req.params.id,
      reason: req.body.reason,
      platformUser: req.platformUser,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json({ recovery });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/reliability/jobs/:id/discard', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const resolution = await discardDeadLetterJob({
      jobId:req.params.id,
      reason:req.body.reason,
      platformUser:req.platformUser,
      ipAddress:req.ip,
      userAgent:req.get('user-agent')
    });
    res.status(201).json({resolution});
  } catch (err) {
    next(err);
  }
});

router.get('/platform/tenants', requirePlatformAuth, async (req, res, next) => {
  try {
    res.json({ tenants: await listPlatformTenants({ search: req.query.search, limit: req.query.limit }) });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/tenants/:id', requirePlatformAuth, async (req, res, next) => {
  try {
    const tenant = await getPlatformTenant(req.params.id);
    await recordPlatformAuditEvent({
      platformUser: req.platformUser,
      action: 'platform.tenant.view',
      targetType: 'tenant',
      targetId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ tenant });
  } catch (err) {
    next(err);
  }
});

router.patch('/platform/tenants/:id/status', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const tenant = await updatePlatformTenantStatus({
      tenantId: req.params.id,
      status: req.body.status,
      reason: req.body.reason,
      platformUser: req.platformUser,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ tenant });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/tenants/:id/notes', requirePlatformAuth, async (req, res, next) => {
  try {
    const note = await createPlatformTenantNote({
      tenantId: req.params.id,
      note: req.body.note,
      category: req.body.category,
      platformUser: req.platformUser,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/audit-events', requirePlatformAuth, async (req, res, next) => {
  try {
    res.json({ events: await listPlatformAuditEvents({ limit: req.query.limit }) });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/guardrails', requirePlatformAuth, async (req, res, next) => {
  try {
    res.json({ guardrails: await listPlatformGuardrails() });
  } catch (err) {
    next(err);
  }
});

router.patch('/platform/guardrails/:key', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const guardrail = await updatePlatformGuardrail({
      key: req.params.key,
      enabled: req.body.enabled,
      reason: req.body.reason,
      platformUser: req.platformUser,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ guardrail });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/incidents', requirePlatformAuth, async (req, res, next) => {
  try {
    res.json({ incidents: await listPlatformIncidents({ status: req.query.status, limit: req.query.limit }) });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/incidents/:id', requirePlatformAuth, async (req, res, next) => {
  try {
    res.json({ incident: await getPlatformIncident(req.params.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/incidents', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const incident = await createPlatformIncident({
      ...req.body, platformUser: req.platformUser, ipAddress: req.ip, userAgent: req.get('user-agent')
    });
    res.status(201).json({ incident });
  } catch (err) {
    next(err);
  }
});

router.patch('/platform/incidents/:id', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    const incident = await updatePlatformIncident({
      ...req.body, incidentId: req.params.id, platformUser: req.platformUser, ipAddress: req.ip, userAgent: req.get('user-agent')
    });
    res.json({ incident });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/incidents/:id/events', requirePlatformAuth, async (req, res, next) => {
  try {
    const event = await createPlatformIncidentEvent({
      incidentId: req.params.id, eventType: req.body.eventType, note: req.body.note,
      platformUser: req.platformUser, ipAddress: req.ip, userAgent: req.get('user-agent')
    });
    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
});

router.get('/platform/ai/providers', requirePlatformAuth, async (req, res, next) => {
  try { res.json({ providers: await listAiProviders() }); } catch (err) { next(err); }
});

router.patch('/platform/ai/providers/:key', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    res.json({ provider: await saveAiProviderConfig({ ...req.body, providerKey:req.params.key, platformUser:req.platformUser, ipAddress:req.ip, userAgent:req.get('user-agent') }) });
  } catch (err) { next(err); }
});

router.post('/platform/ai/providers/:key/health', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    res.json({ health: await checkAiProviderHealth({ providerKey:req.params.key, platformUser:req.platformUser, ipAddress:req.ip, userAgent:req.get('user-agent') }) });
  } catch (err) { next(err); }
});

router.get('/platform/ai/usage', requirePlatformAuth, async (req, res, next) => {
  try { res.json({ usage:await listAiUsage({ businessId:req.query.businessId, limit:req.query.limit }) }); } catch (err) { next(err); }
});

router.get('/platform/tenants/:id/ai-policy', requirePlatformAuth, async (req, res, next) => {
  try { res.json({ policy:await getBusinessAiPolicy(req.params.id) }); } catch (err) { next(err); }
});

router.patch('/platform/tenants/:id/ai-policy', requirePlatformRole(['owner']), async (req, res, next) => {
  try {
    res.json({ policy:await saveBusinessAiPolicy({ ...req.body, businessId:req.params.id, platformUser:req.platformUser, ipAddress:req.ip, userAgent:req.get('user-agent') }) });
  } catch (err) { next(err); }
});

router.post('/ai/orchestrate', requireRole(['owner','admin']), async (req, res, next) => {
  try { res.json(await orchestrateAiText({ businessId:req.business.id, prompt:req.body.prompt, workflowKey:req.body.workflowKey })); } catch (err) { next(err); }
});

router.get('/platform/auth/me', (req, res) => {
  res.json({ user: req.platformUser || null });
});

router.post('/platform/auth/login', async (req, res, next) => {
  try {
    await verifyAuthChallenge(req, 'platform_login');
    const user = await authenticatePlatformUser(req.body.email, req.body.password);
    if (!user) return res.status(401).json({ error: 'Invalid platform email or password' });

    const session = await createPlatformSession(user, req.get('user-agent'), req.ip);
    res.setHeader('Set-Cookie', serializePlatformSessionCookie(signPlatformSessionId(session.id), session.expiresAt));
    await recordPlatformAuditEvent({
      platformUser: user,
      action: 'platform.auth.login',
      targetType: 'platform_user',
      targetId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post('/platform/auth/logout', async (req, res) => {
  await destroyPlatformSession(req.platformSession?.id);
  res.setHeader('Set-Cookie', serializeClearPlatformSessionCookie());
  res.json({ ok: true });
});

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
    if (req.body.aiDraftId) await validateInboxAiDraftForUse({ businessId:req.businessId, conversationId:req.params.id, draftId:req.body.aiDraftId });
    const reply = await recordOutboundReply({
      businessId: req.businessId,
      conversationId: req.params.id,
      body: req.body.body,
      actorUser: req.user
    });
    if (req.body.aiDraftId) {
      try {
        reply.aiDraft = await markInboxAiDraftOutcome({
          businessId:req.businessId, conversationId:req.params.id, draftId:req.body.aiDraftId,
          outcome:'used', finalBody:req.body.body, actorUser:req.user
        });
      } catch {
        reply.aiDraft = { id:Number(req.body.aiDraftId), status:'tracking_failed' };
      }
    }
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});

router.post('/inbox/conversations/:id/ai-drafts', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(201).json({ draft:await generateInboxAiDraft({
      businessId:req.businessId, conversationId:req.params.id, guidance:req.body.guidance,
      actorUser:req.user
    }) });
  } catch (err) { next(err); }
});

router.post('/inbox/conversations/:id/ai-drafts/:draftId/discard', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json({ draft:await markInboxAiDraftOutcome({
      businessId:req.businessId, conversationId:req.params.id, draftId:req.params.draftId,
      outcome:'discarded', actorUser:req.user
    }) });
  } catch (err) { next(err); }
});

router.get('/knowledge/overview', requireAuth, async (req, res, next) => {
  try { res.json(await getKnowledgeOverview(req.businessId)); } catch (err) { next(err); }
});

router.get('/crm/operations', requireAuth, async (req, res, next) => {
  try { res.json(await getTenantCrmOperations(req.businessId)); } catch (err) { next(err); }
});

router.get('/crm/jobs/:id', requireAuth, async (req, res, next) => {
  try { res.json({ job:await getTenantCrmJobStatus(req.businessId, req.params.id) }); } catch (err) { next(err); }
});

router.post('/crm/oauth/:provider/start', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json(await beginTenantCrmOAuth({ ...req.body, provider:req.params.provider, businessId:req.businessId, actorUser:req.user })); } catch (err) { next(err); }
});

router.patch('/crm/connections/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json({ connection:await updateTenantCrmConnection({ ...req.body, connectionId:req.params.id, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.post('/crm/connections/:id/test', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json({ health:await testTenantCrmConnection({ connectionId:req.params.id, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.post('/crm/connections/:id/sync', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.status(202).json({ job:await requestTenantCrmSync({ connectionId:req.params.id, businessId:req.businessId, triggerType:'manual' }) }); } catch (err) { next(err); }
});

router.delete('/crm/connections/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json(await disconnectTenantCrm({ connectionId:req.params.id, businessId:req.businessId, actorUser:req.user })); } catch (err) { next(err); }
});

router.get('/knowledge/operations', requireAuth, async (req, res, next) => {
  try {
    const [sources, evaluationCases, evaluationRuns] = await Promise.all([
      listKnowledgeSources(req.businessId),
      listKnowledgeEvaluationCases(req.businessId),
      listKnowledgeEvaluationRuns(req.businessId)
    ]);
    const [connectorOperations, connectorAlertCenter] = await Promise.all([
      getKnowledgeConnectorOperations(req.businessId, sources),
      getConnectorAlertCenter(req.businessId)
    ]);
    res.json({ sources, evaluationCases, evaluationRuns, connectorOperations, connectorAlertCenter, googleDriveOAuth:getGoogleDriveOAuthStatus() });
  } catch (err) { next(err); }
});

router.post('/knowledge/items', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.status(201).json({ item:await createKnowledgeItem({ ...req.body, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.patch('/knowledge/items/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json({ item:await updateKnowledgeItem({ ...req.body, itemId:req.params.id, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.post('/knowledge/imports', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.status(201).json(await importKnowledgeContent({ ...req.body, businessId:req.businessId, actorUser:req.user })); } catch (err) { next(err); }
});

router.post('/knowledge/connectors', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const create = String(req.body.provider || req.body.sourceType || 'api_push') === 'api_push' ? createApiPushConnector : createKnowledgeConnector;
    res.status(201).json({ source:await create({ ...req.body, businessId:req.businessId, actorUser:req.user }) });
  } catch (err) { next(err); }
});

router.get('/knowledge/connectors/google-drive/oauth/status', requireAuth, async (req, res) => {
  res.json(getGoogleDriveOAuthStatus());
});

router.post('/knowledge/connectors/google-drive/oauth/start', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json(await beginGoogleDriveOAuth({ ...req.body, businessId:req.businessId, actorUser:req.user })); } catch (err) { next(err); }
});

router.patch('/knowledge/connectors/alert-policy', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json({ policy:await updateConnectorAlertPolicy({ ...req.body, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.post('/knowledge/connectors/alerts/:id/acknowledge', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json({ alert:await acknowledgeConnectorAlert({ alertId:req.params.id, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.post('/knowledge/connectors/:id/records', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json(await ingestApiConnectorRecords({ ...req.body, sourceId:req.params.id, businessId:req.businessId, actorUser:req.user })); } catch (err) { next(err); }
});

router.patch('/knowledge/sources/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json({ source:await updateKnowledgeConnector({ ...req.body, sourceId:req.params.id, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.post('/knowledge/sources/:id/sync', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.status(202).json({ job:await requestKnowledgeConnectorSync({ sourceId:req.params.id, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.delete('/knowledge/sources/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.json(await deleteKnowledgeConnector({ sourceId:req.params.id, businessId:req.businessId, actorUser:req.user })); } catch (err) { next(err); }
});

router.post('/knowledge/evaluations/cases', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.status(201).json({ evaluationCase:await createKnowledgeEvaluationCase({ ...req.body, businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.post('/knowledge/evaluations/run', requireRole(['owner', 'admin']), async (req, res, next) => {
  try { res.status(201).json({ run:await runKnowledgeEvaluations({ businessId:req.businessId, actorUser:req.user }) }); } catch (err) { next(err); }
});

router.get('/ai/quality', requireAuth, async (req, res, next) => {
  try { res.json(await getInboxAiDraftMetrics(req.businessId)); } catch (err) { next(err); }
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

router.post('/auth/social/facebook/data-deletion', async (req, res, next) => {
  try {
    res.json(await processFacebookDataDeletion({ signedRequest: req.body.signed_request }));
  } catch (err) {
    next(err);
  }
});

router.post('/auth/social/facebook/deauthorize', async (req, res, next) => {
  try {
    await processFacebookDataDeletion({ signedRequest: req.body.signed_request });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/auth/social/:provider/start', (req, res) => {
  res.status(405).json({ error: 'Start social sign in from the ChatClan sign-in or registration page.' });
});

router.post('/auth/social/:provider/start', async (req, res, next) => {
  try {
    const purpose = req.body.purpose === 'signin' ? 'signin' : 'signup';
    await verifyAuthChallenge(req, purpose === 'signin' ? 'social_signin' : 'social_signup');
    const start = await createSocialAuthStart({
      provider: req.params.provider,
      purpose,
      planCode: req.body.plan,
      redirectTo: req.body.redirectTo
    });
    res.json(start);
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

router.post('/auth/login', async (req, res, next) => {
  try {
    await verifyAuthChallenge(req, 'tenant_login');
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
  } catch (err) {
    next(err);
  }
});

router.post('/auth/register', async (req, res, next) => {
  try {
    await verifyAuthChallenge(req, 'tenant_signup');
    const { recaptchaToken, ...registration } = req.body;
    const signup = await registerProspect(registration);
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
    await verifyAuthChallenge(req, 'social_signup_complete');
    const { recaptchaToken, ...completion } = req.body;
    const signup = await completeSocialSignup(completion);
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
    await verifyAuthChallenge(req, 'password_reset');
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

router.get('/commerce/automation-rules/:id/preview', requireAuth, async (req, res, next) => {
  try {
    res.json(await previewCommerceAutomationRule({ businessId: req.businessId, ruleId: req.params.id }));
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/automation-rules/:id/apply-ready', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.status(202).json(
      await applyCommerceAutomationRuleToReadyOrders({
        businessId: req.businessId,
        ruleId: req.params.id,
        source: 'manual_rule_apply'
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/automation-rules/:id/template', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(201).json(
      await installCommerceAutomationTemplate({
        businessId: req.businessId,
        ruleId: req.params.id
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/automation-rules/:id/template/submit', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.status(202).json(
      await submitCommerceAutomationTemplate({
        businessId: req.businessId,
        ruleId: req.params.id
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/automation-templates/sync', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await syncCommerceAutomationTemplates(req.businessId));
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

router.patch('/commerce/orders/:id/items/link-product', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    res.json(
      await linkOrderItemToProduct({
        businessId: req.businessId,
        orderId: req.params.id,
        itemId: req.body.itemId,
        retailerId: req.body.retailerId,
        productId: req.body.productId
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/commerce/orders/:id/items/create-product', requireRole(['owner', 'admin', 'agent']), async (req, res, next) => {
  try {
    const { itemId, retailerId, ...payload } = req.body || {};
    res.status(201).json(
      await createProductFromOrderItem({
        businessId: req.businessId,
        orderId: req.params.id,
        itemId,
        retailerId,
        payload
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
        body: req.body.body,
        templateName: req.body.templateName,
        templateLanguage: req.body.templateLanguage,
        templateParameters: req.body.templateParameters
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
    const payload = normalizeCampaignDispatchPayload({
      businessId: req.businessId,
      campaignId: req.params.id,
      limit: req.body.limit
    });
    const job = await enqueueJob({
      type: 'campaign.dispatch',
      payload,
      dedupeKey: `campaign.dispatch:${payload.businessId}:${payload.campaignId}`
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

router.patch('/contacts/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await updateContact({ businessId: req.businessId, contactId: req.params.id, payload: req.body }));
  } catch (err) {
    next(err);
  }
});

router.delete('/contacts/:id', requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    res.json(await softDeleteContact({ businessId: req.businessId, contactId: req.params.id, actorUserId: req.user.id }));
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
