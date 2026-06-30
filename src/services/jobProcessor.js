const { dispatchCampaign } = require('./broadcastDispatch');
const { reconcileOrderPayment, sendPostPurchasePrompt } = require('./commerce');
const { processMetaEvent } = require('./metaEventProcessor');
const { processPayFastItn } = require('./billing');
const { recordWebhookEvent } = require('./webhookEvents');

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
      body: payload.body
    });
  }

  const error = new Error(`Unknown job type: ${job.type}`);
  error.status = 400;
  throw error;
}

module.exports = { processJob };
