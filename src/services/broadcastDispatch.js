const {
  listQueuedCampaignRecipients,
  refreshCampaignSendCounts,
  updateCampaignRecipientStatus
} = require('./campaignRecipients');
const { consumeDispatchQuota } = require('./dispatchRateLimiter');
const { sendTextMessage } = require('./metaClient');
const { assertPlatformGuardrailAllows } = require('./platformGuardrails');
const { assertPlatformTenantCanOperate } = require('./platform');
const { getSubscriptionEntitlements } = require('./subscriptionPolicy');

async function dispatchCampaign(input) {
  const { businessId, campaignId, limit } = normalizeCampaignDispatchPayload(input);

  const batchLimit = limit;
  await assertPlatformTenantCanOperate(businessId, 'campaign_dispatch');
  await assertPlatformGuardrailAllows('campaign_dispatch');
  const entitlements = await getSubscriptionEntitlements(businessId);
  const quota = await consumeDispatchQuota({
    businessId,
    requested: batchLimit,
    tenantLimitOverride: entitlements.plan.limits.dispatchPerMinute
  });
  const recipients = await listQueuedCampaignRecipients({ businessId, campaignId, limit: quota.allowed });
  const results = [];

  for (const recipient of recipients) {
    results.push(await dispatchRecipient({ businessId, campaignId, recipient }));
  }

  await refreshCampaignSendCounts({ businessId, campaignId });
  const remaining = await listQueuedCampaignRecipients({ businessId, campaignId, limit: 1000 });

  const sent = results.filter((result) => result.status === 'sent').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  return {
    campaignId: Number(campaignId),
    attempted: results.length,
    sent,
    failed,
    remainingQueued: remaining.length,
    mode: results[0]?.mode || (results.length ? 'unknown' : 'none'),
    rateLimit: quota,
    results
  };
}

async function dispatchRecipient({ businessId, campaignId, recipient }) {
  try {
    const response = await sendTextMessage({
      businessId,
      to: recipient.phone,
      text: recipient.personalizedBody
    });
    await updateCampaignRecipientStatus({
      businessId,
      campaignId,
      recipientId: recipient.id,
      status: 'sent',
      providerMessageId: response.messageId
    });
    return {
      recipientId: recipient.id,
      contactId: recipient.contactId,
      status: 'sent',
      mode: response.mode,
      providerMessageId: response.messageId
    };
  } catch (err) {
    await updateCampaignRecipientStatus({
      businessId,
      campaignId,
      recipientId: recipient.id,
      status: 'failed',
      errorMessage: err.message
    });
    return {
      recipientId: recipient.id,
      contactId: recipient.contactId,
      status: 'failed',
      error: err.message
    };
  }
}

function normalizeLimit(limit) {
  const parsed = Number(limit || 100);
  if (!Number.isFinite(parsed) || parsed < 1) return 100;
  return Math.min(Math.floor(parsed), 1000);
}

function normalizeCampaignDispatchPayload(input = {}) {
  return {
    businessId: normalizeRequiredId(input.businessId, 'businessId'),
    campaignId: normalizeRequiredId(input.campaignId, 'campaignId'),
    limit: normalizeLimit(input.limit)
  };
}

function normalizeRequiredId(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || String(value).trim() === '') {
    const error = new Error(`${field} must be a positive integer`);
    error.status = 400;
    error.retryable = false;
    throw error;
  }
  return parsed;
}

module.exports = { dispatchCampaign, normalizeCampaignDispatchPayload };
