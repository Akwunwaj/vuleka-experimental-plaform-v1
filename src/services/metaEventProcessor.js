const {
  updateCampaignRecipientStatusByProviderMessageId
} = require('./campaignRecipients');
const { processChatbotInbound } = require('./chatbotRuntime');
const { isStopMessage, suppressContactByPhone } = require('./consent');
const { recordOrderFromMetaEvent } = require('./commerce');
const { recordInboundMessage, recordMessageStatus } = require('./inbox');
const { reconcileMetaMessageCost } = require('./metaCosts');
const { findBusinessIdByMetaPhoneNumberId } = require('./metaCredentials');
const { recordWebhookEvent } = require('./webhookEvents');

async function processMetaEvent(event) {
  const businessId = await findBusinessIdByMetaPhoneNumberId(event.phoneNumberId);
  let consent = null;
  let inbox = null;
  let campaignRecipient = null;
  let costEvent = null;
  let chatbot = null;
  let commerceOrder = null;

  if (businessId && event.type === 'message.received') {
    inbox = await recordInboundMessage({ businessId, event });
    if (event.messageType === 'order') {
      commerceOrder = await recordOrderFromMetaEvent({ businessId, event });
    } else if (isStopMessage(event.text)) {
      consent = await suppressContactByPhone({
        businessId,
        phone: event.from,
        metadata: {
          messageId: event.messageId,
          phoneNumberId: event.phoneNumberId
        }
      });
    } else {
      chatbot = await processChatbotInbound({ businessId, event, inbox });
    }
  }

  if (businessId && event.type === 'message.status') {
    const status = normalizeCampaignStatus(event.status);
    inbox = await recordMessageStatus({
      businessId,
      providerMessageId: event.messageId,
      status,
      metadata: event.raw || {}
    });
    campaignRecipient = await updateCampaignRecipientStatusByProviderMessageId({
      businessId,
      providerMessageId: event.messageId,
      status,
      errorMessage: status === 'failed' ? statusErrorMessage(event.raw) : null
    });
    costEvent = await reconcileMetaMessageCost({
      businessId,
      providerMessageId: event.messageId,
      status,
      rawPricing: event.raw?.pricing || {},
      occurredAt: new Date()
    });
  }

  await recordWebhookEvent({
    provider: 'meta',
    eventType: event.type,
    payload: {
      ...event,
      businessId,
      inbox,
      campaignRecipient,
      costEvent,
      commerceOrder,
      consent,
      chatbot
    },
    processedAt: new Date()
  });

  return { businessId, eventType: event.type, inbox, campaignRecipient, costEvent, commerceOrder, consent, chatbot };
}

function normalizeCampaignStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['sent', 'delivered', 'read', 'failed'].includes(normalized)) return normalized;
  return 'sent';
}

function statusErrorMessage(raw = {}) {
  const error = raw.errors?.[0] || {};
  return error.message || error.title || error.error_data?.details || null;
}

module.exports = { processMetaEvent };
