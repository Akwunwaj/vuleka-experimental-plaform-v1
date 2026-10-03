const { dispatchCampaign } = require('./broadcastDispatch');
const { reconcileOrderPayment, sendPostPurchasePrompt } = require('./commerce');
const { processMetaEvent } = require('./metaEventProcessor');
const { processPayFastItn } = require('./billing');
const { recordWebhookEvent } = require('./webhookEvents');
const { syncKnowledgeConnector } = require('./knowledgeConnectors');
const { evaluateConnectorAlerts } = require('./connectorAlerts');
const { evaluatePlatformReliabilityAlerts } = require('./platformReliabilityAlerts');
const { deliverPublicLeadToCrm } = require('./publicLeadCrm');
const { processPublicLeadSla } = require('./publicLeadSla');
const { syncTenantCrmConnection } = require('./tenantCrm');

async function processJob(job) {
  if (job.type === 'campaign.dispatch') {
    return dispatchCampaign(job.payload);
  }

  if (job.type === 'webhook.meta.event') {
    return processMetaEvent(job.payload.event || job.payload);
  }

  if (job.type === 'webhook.payfast.itn') {
    const payload = job.payload || {};
    const merchantPaymentId = payload.summary?.merchantPaymentId || payload.raw?.m_payment_id || '';
    const businessId = Number(payload.raw?.custom_int1 || 0);
    const isCommercePayment = businessId && !String(merchantPaymentId).startsWith('cc_') && !String(merchantPaymentId).startsWith('trial_');
    const result = isCommercePayment
      ? await reconcileOrderPayment({
        businessId,
        paymentReference: merchantPaymentId,
        provider: 'payfast',
        providerPaymentId: payload.summary?.paymentId || payload.raw?.pf_payment_id,
        amount: payload.summary?.amountGross || payload.raw?.amount_gross,
        paymentStatus: payload.summary?.paymentStatus || payload.raw?.payment_status,
        raw: payload.raw,
        checks: payload.checks
      })
      : await processPayFastItn(payload);
    await recordWebhookEvent({
      provider: 'payfast',
      eventType: payload.eventType || 'itn',
      payload: { ...payload, result, kind: isCommercePayment ? 'commerce' : 'billing' },
      processedAt: new Date()
    });
    return { recorded: true, kind: isCommercePayment ? 'commerce' : 'billing', result };
  }

  if (job.type === 'commerce.post_purchase_prompt') {
    const payload = job.payload || {};
    return sendPostPurchasePrompt({
      businessId: payload.businessId,
      orderId: payload.orderId,
      promptType: payload.promptType,
      body: payload.body,
      ruleId: payload.ruleId,
      source: payload.source || 'worker',
      templateName: payload.templateName,
      templateLanguage: payload.templateLanguage,
      templateParameters: payload.templateParameters
    });
  }

  if (job.type === 'knowledge.source.sync') {
    return syncKnowledgeConnector({ ...job.payload, jobId:job.id, attempt:job.attempts, maxAttempts:job.maxAttempts });
  }

  if (job.type === 'knowledge.connector.alert.evaluate') {
    return evaluateConnectorAlerts(job.payload);
  }

  if (job.type === 'platform.reliability.alert.evaluate') {
    return evaluatePlatformReliabilityAlerts(job.payload);
  }

  if (job.type === 'public.lead.crm_deliver') {
    return deliverPublicLeadToCrm(job.payload);
  }

  if (job.type === 'tenant.crm.sync') {
    return syncTenantCrmConnection({ ...job.payload, jobId:job.id, attempt:job.attempts, maxAttempts:job.maxAttempts });
  }

  if (job.type === 'public.lead.sla_reminder') return processPublicLeadSla(job.payload, { escalated:false });
  if (job.type === 'public.lead.sla_escalation') return processPublicLeadSla(job.payload, { escalated:true });

  const error = new Error(`Unknown job type: ${job.type}`);
  error.status = 400;
  throw error;
}

module.exports = { processJob };
