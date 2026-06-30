const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { getMetaCostReport, metaRateConfig } = require('./metaCosts');

const costCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

async function getAnalyticsOverview(businessId) {
  const campaigns = await campaignRows(businessId);
  const recipients = await recipientRows(businessId);
  const replies = await replyCount(businessId);
  const summary = summarizeRecipients(recipients, campaigns);
  const campaignPerformance = campaigns.map((campaign) => campaignSummary(campaign, recipients));

  return {
    summary: {
      campaigns: campaigns.length,
      sent: summary.sent,
      delivered: summary.delivered,
      read: summary.read,
      failed: summary.failed,
      replies,
      deliveryRate: percentage(summary.delivered, summary.sent),
      readRate: percentage(summary.read, summary.delivered || summary.sent),
      replyRate: percentage(replies, summary.sent)
    },
    campaigns: campaignPerformance
  };
}

async function campaignRows(businessId) {
  if (!hasDatabaseConfig()) {
    return demo.campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      category: normalizeCategory(campaign.category || 'MARKETING'),
      status: campaign.status,
      sent: Number(campaign.sent || 0),
      delivered: Number(campaign.delivered || 0),
      read: parsePercentCount(campaign.readRate, campaign.delivered || campaign.sent || 0)
    }));
  }

  return query(
    `select id, name, category, status, sent, delivered
     from campaigns
     where business_id = :businessId
     order by created_at desc, id desc`,
    { businessId }
  );
}

async function recipientRows(businessId) {
  if (!hasDatabaseConfig()) return [];

  return query(
    `select campaign_id as campaignId, status
     from campaign_recipients
     where business_id = :businessId`,
    { businessId }
  );
}

async function replyCount(businessId) {
  if (!hasDatabaseConfig()) return demo.inbox.reduce((sum, item) => sum + Number(item.unread || 0), 0);

  const rows = await query(
    `select count(*) as replies
     from webhook_events
     where provider = 'meta'
       and event_type = 'message.received'
       and json_unquote(json_extract(payload, '$.businessId')) = :businessId`,
    { businessId: String(businessId) }
  );
  return Number(rows?.[0]?.replies || 0);
}

function summarizeRecipients(recipients, campaigns) {
  if (!recipients.length) {
    return campaigns.reduce(
      (summary, campaign) => ({
        sent: summary.sent + Number(campaign.sent || 0),
        delivered: summary.delivered + Number(campaign.delivered || 0),
        read: summary.read + Number(campaign.read || 0),
        failed: summary.failed
      }),
      { sent: 0, delivered: 0, read: 0, failed: 0 }
    );
  }

  return recipients.reduce(
    (summary, recipient) => {
      if (['sent', 'delivered', 'read'].includes(recipient.status)) summary.sent += 1;
      if (['delivered', 'read'].includes(recipient.status)) summary.delivered += 1;
      if (recipient.status === 'read') summary.read += 1;
      if (recipient.status === 'failed') summary.failed += 1;
      return summary;
    },
    { sent: 0, delivered: 0, read: 0, failed: 0 }
  );
}

function campaignSummary(campaign, recipients) {
  const scoped = recipients.filter((recipient) => Number(recipient.campaignId) === Number(campaign.id));
  const summary = summarizeRecipients(scoped, [campaign]);
  return {
    id: campaign.id,
    name: campaign.name,
    category: normalizeCategory(campaign.category || 'MARKETING'),
    status: campaign.status,
    sent: summary.sent,
    delivered: summary.delivered,
    read: summary.read,
    failed: summary.failed,
    deliveryRate: percentage(summary.delivered, summary.sent),
    readRate: percentage(summary.read, summary.delivered || summary.sent)
  };
}

function normalizeCategory(category) {
  const normalized = String(category || '').toUpperCase();
  return costCategories.includes(normalized) ? normalized : 'MARKETING';
}

function percentage(numerator, denominator) {
  if (!denominator) return '0%';
  return `${Math.round((Number(numerator || 0) / Number(denominator)) * 1000) / 10}%`;
}

function parsePercentCount(percent, denominator) {
  const value = Number(String(percent || '').replace('%', ''));
  if (!Number.isFinite(value) || !denominator) return 0;
  return Math.round((value / 100) * Number(denominator));
}

module.exports = {
  campaignRows,
  getAnalyticsOverview,
  getMetaCostReport,
  metaRateConfig,
  percentage,
  recipientRows
};
