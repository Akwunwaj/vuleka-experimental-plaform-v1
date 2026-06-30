const {
  listQueuedCampaignRecipients,
  refreshCampaignSendCounts,
  updateCampaignRecipientStatus
} = require('./campaignRecipients');
const { consumeDispatchQuota } = require('./dispatchRateLimiter');
const { sendTextMessage } = require('./metaClient');
const { getSubscriptionEntitlements } = require('./subscriptionPolicy');

async function dispatchCampaign({ businessId, campaignId, limit = 100 }) {
  if (!campaignId) {
    const error = new Error('campaignId is required');
    error.status = 400;
    throw error;
  }

  const batchLimit = normalizeLimit(limit);
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

module.exports = { dispatchCampaign };
