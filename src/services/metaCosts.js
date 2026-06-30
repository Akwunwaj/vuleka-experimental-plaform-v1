const { hasDatabaseConfig, query } = require('../db/pool');
const { findCampaignRecipientByProviderMessageId } = require('./campaignRecipients');

const costCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'AUTHENTICATION_INTERNATIONAL', 'SERVICE'];
const defaultCurrency = 'ZAR';
const demoRateCards = new Map();
const demoCostEvents = new Map();
let demoCostEventId = 1000;

async function syncConfiguredMetaRateCard({ market = process.env.META_COST_MARKET || 'ZA', currency = defaultCurrency, source = 'environment' } = {}) {
  const rates = metaRateConfig();
  const synced = [];
  for (const category of costCategories) {
    synced.push(
      await upsertRateCard({
        market,
        currency,
        category,
        pricingType: category === 'SERVICE' ? 'free_customer_service' : 'regular',
        rateCents: rates[category],
        source
      })
    );
  }
  return { market, currency, source, rates: synced };
}

async function listMetaRateCards({ market = process.env.META_COST_MARKET || 'ZA', currency = defaultCurrency } = {}) {
  if (!hasDatabaseConfig()) {
    ensureDemoRateCards(market, currency);
    return [...demoRateCards.values()]
      .filter((item) => item.market === market && item.currency === currency && item.isActive)
      .sort((a, b) => a.category.localeCompare(b.category));
  }

  const rows = await query(
    `select id, market, currency, category, pricing_type as pricingType,
            volume_tier_from as volumeTierFrom, volume_tier_to as volumeTierTo,
            rate_cents as rateCents, source, effective_from as effectiveFrom,
            is_active as isActive, updated_at as updatedAt
     from meta_rate_cards
     where market = :market and currency = :currency and is_active = 1
     order by category asc, volume_tier_from asc`,
    { market, currency }
  );
  return rows.map(normalizeRateCard);
}

async function getMetaCostReport(businessId) {
  const ledger = await listMessageCostEvents(businessId);
  if (ledger.length) return summarizeLedger(ledger);
  return estimateMetaCosts(businessId);
}

async function reconcileMetaMessageCost({ businessId, providerMessageId, status, rawPricing = {}, occurredAt = new Date() }) {
  if (!businessId || !providerMessageId) return null;
  const normalizedStatus = String(status || '').toLowerCase();
  if (!['delivered', 'read'].includes(normalizedStatus)) return null;

  const existing = await findMessageCostEvent(businessId, providerMessageId);
  if (existing) return { ...existing, deduped: true };

  const recipient = await findCampaignRecipientByProviderMessageId({ businessId, providerMessageId });
  if (!recipient) return null;

  const pricing = normalizePricing(rawPricing);
  const market = pricing.market || marketForPhone(recipient.phone) || process.env.META_COST_MARKET || 'ZA';
  const currency = pricing.currency || defaultCurrency;
  const category = pricing.category || normalizeCategory(recipient.campaignCategory || 'MARKETING');
  const pricingType = pricing.type || (category === 'SERVICE' ? 'free_customer_service' : 'regular');
  const billable = pricing.billable !== null ? pricing.billable : pricingType === 'regular' && category !== 'SERVICE';
  const rate = billable ? await resolveRate({ market, currency, category, pricingType }) : { rateCents: 0, source: 'free-pricing-type' };
  const amountCents = billable ? rate.rateCents : 0;

  const event = normalizeCostEvent({
    id: nextDemoCostEventId(),
    businessId,
    providerMessageId,
    campaignRecipientId: recipient.id,
    campaignId: recipient.campaignId,
    market,
    category,
    pricingType,
    billable,
    currency,
    rateCents: amountCents,
    amountCents,
    statusEvent: normalizedStatus,
    source: rate.source,
    rawPricing: rawPricing || {},
    occurredAt
  });

  if (!hasDatabaseConfig()) {
    demoCostEvents.set(costKey(businessId, providerMessageId), event);
    return event;
  }

  const result = await query(
    `insert into message_cost_events
       (business_id, provider_message_id, campaign_recipient_id, campaign_id, market, category,
        pricing_type, billable, currency, rate_cents, amount_cents, status_event, source, raw_pricing, occurred_at)
     values
       (:businessId, :providerMessageId, :campaignRecipientId, :campaignId, :market, :category,
        :pricingType, :billable, :currency, :rateCents, :amountCents, :statusEvent, :source, :rawPricing, :occurredAt)
     on duplicate key update
       status_event = values(status_event),
       raw_pricing = values(raw_pricing)`,
    {
      ...event,
      billable: event.billable ? 1 : 0,
      rawPricing: JSON.stringify(event.rawPricing || {})
    }
  );
  return { ...event, id: result.insertId || event.id };
}

async function listMessageCostEvents(businessId) {
  if (!hasDatabaseConfig()) {
    return [...demoCostEvents.values()]
      .filter((event) => Number(event.businessId) === Number(businessId))
      .sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0));
  }

  const rows = await query(
    `select id, business_id as businessId, provider_message_id as providerMessageId,
            campaign_recipient_id as campaignRecipientId, campaign_id as campaignId,
            market, category, pricing_type as pricingType, billable, currency,
            rate_cents as rateCents, amount_cents as amountCents,
            status_event as statusEvent, source, raw_pricing as rawPricing,
            occurred_at as occurredAt, created_at as createdAt
     from message_cost_events
     where business_id = :businessId
     order by occurred_at desc, id desc
     limit 5000`,
    { businessId }
  );
  return rows.map(normalizeCostEvent);
}

async function estimateMetaCosts(businessId) {
  const { campaignRows, recipientRows } = require('./analytics');
  const campaigns = await campaignRows(businessId);
  const recipients = await recipientRows(businessId);
  const rates = metaRateConfig();
  const byCategory = emptyCategorySummary(rates);

  if (recipients.length) {
    for (const recipient of recipients) {
      if (!['sent', 'delivered', 'read'].includes(recipient.status)) continue;
      const campaign = campaigns.find((item) => Number(item.id) === Number(recipient.campaignId));
      addCategoryCost(byCategory, campaign?.category || 'MARKETING', 1, rates[normalizeCategory(campaign?.category || 'MARKETING')], true);
    }
  } else {
    for (const campaign of campaigns) {
      addCategoryCost(byCategory, campaign.category || 'MARKETING', Number(campaign.delivered || campaign.sent || 0), rates[normalizeCategory(campaign.category || 'MARKETING')], true);
    }
  }

  return costReportResponse({
    source: 'Configured estimate. Reconciled delivery-cost ledger has no entries yet.',
    pricingModel: 'per delivered message',
    market: process.env.META_COST_MARKET || 'ZA',
    currency: defaultCurrency,
    categories: Object.values(byCategory),
    events: [],
    ratesConfigured: rates,
    reconciled: false
  });
}

function summarizeLedger(events) {
  const rates = metaRateConfig();
  const byCategory = emptyCategorySummary(rates);
  for (const event of events) {
    addCategoryCost(byCategory, event.category, 1, event.amountCents, false, event.billable);
  }
  const first = events[0] || {};
  return costReportResponse({
    source: 'Reconciled from Meta status webhook pricing and active ChatClan rate cards.',
    pricingModel: 'per delivered message',
    market: first.market || process.env.META_COST_MARKET || 'ZA',
    currency: first.currency || defaultCurrency,
    categories: Object.values(byCategory),
    events,
    ratesConfigured: rates,
    reconciled: true
  });
}

async function upsertRateCard({ market, currency, category, pricingType = 'regular', rateCents, source = 'manual', volumeTierFrom = 0, volumeTierTo = null }) {
  const rate = normalizeRateCard({
    id: `${market}:${currency}:${category}:${pricingType}:${volumeTierFrom}`,
    market,
    currency,
    category: normalizeCategory(category),
    pricingType,
    volumeTierFrom,
    volumeTierTo,
    rateCents,
    source,
    effectiveFrom: new Date().toISOString(),
    isActive: true,
    updatedAt: new Date().toISOString()
  });

  if (!hasDatabaseConfig()) {
    demoRateCards.set(rateCardKey(rate), rate);
    return rate;
  }

  const result = await query(
    `insert into meta_rate_cards
       (market, currency, category, pricing_type, volume_tier_from, volume_tier_to, rate_cents, source, effective_from, is_active)
     values
       (:market, :currency, :category, :pricingType, :volumeTierFrom, :volumeTierTo, :rateCents, :source, current_timestamp, 1)
     on duplicate key update
       rate_cents = values(rate_cents),
       source = values(source),
       effective_from = values(effective_from),
       is_active = 1`,
    rate
  );
  return { ...rate, id: result.insertId || rate.id };
}

async function resolveRate({ market, currency, category, pricingType }) {
  const cards = await listMetaRateCards({ market, currency });
  const normalizedCategory = normalizeCategory(category);
  const exact = cards.find((card) => card.category === normalizedCategory && card.pricingType === pricingType);
  const categoryCard = cards.find((card) => card.category === normalizedCategory);
  if (exact || categoryCard) return exact || categoryCard;
  const rates = metaRateConfig();
  return {
    rateCents: rates[normalizedCategory],
    source: 'environment-fallback'
  };
}

async function findMessageCostEvent(businessId, providerMessageId) {
  if (!hasDatabaseConfig()) return demoCostEvents.get(costKey(businessId, providerMessageId)) || null;
  const rows = await query(
    `select id, business_id as businessId, provider_message_id as providerMessageId,
            campaign_recipient_id as campaignRecipientId, campaign_id as campaignId,
            market, category, pricing_type as pricingType, billable, currency,
            rate_cents as rateCents, amount_cents as amountCents,
            status_event as statusEvent, source, raw_pricing as rawPricing,
            occurred_at as occurredAt, created_at as createdAt
     from message_cost_events
     where business_id = :businessId and provider_message_id = :providerMessageId
     limit 1`,
    { businessId, providerMessageId }
  );
  return rows?.[0] ? normalizeCostEvent(rows[0]) : null;
}

function ensureDemoRateCards(market, currency) {
  const hasCards = [...demoRateCards.values()].some((item) => item.market === market && item.currency === currency);
  if (!hasCards) {
    for (const [category, rateCents] of Object.entries(metaRateConfig())) {
      demoRateCards.set(
        rateCardKey({ market, currency, category, pricingType: category === 'SERVICE' ? 'free_customer_service' : 'regular', volumeTierFrom: 0 }),
        normalizeRateCard({ market, currency, category, pricingType: category === 'SERVICE' ? 'free_customer_service' : 'regular', rateCents, source: 'environment', isActive: true })
      );
    }
  }
}

function metaRateConfig() {
  return {
    MARKETING: centsFromEnv('META_COST_MARKETING_ZAR_CENTS', 0),
    UTILITY: centsFromEnv('META_COST_UTILITY_ZAR_CENTS', 0),
    AUTHENTICATION: centsFromEnv('META_COST_AUTHENTICATION_ZAR_CENTS', 0),
    AUTHENTICATION_INTERNATIONAL: centsFromEnv('META_COST_AUTHENTICATION_INTERNATIONAL_ZAR_CENTS', centsFromEnv('META_COST_AUTHENTICATION_ZAR_CENTS', 0)),
    SERVICE: centsFromEnv('META_COST_SERVICE_ZAR_CENTS', 0)
  };
}

function normalizePricing(pricing = {}) {
  return {
    billable: pricing.billable === undefined ? null : Boolean(pricing.billable),
    category: pricing.category ? normalizeCategory(pricing.category) : null,
    type: pricing.type || null,
    market: pricing.market || pricing.region || null,
    currency: pricing.currency || null,
    pricingModel: pricing.pricing_model || pricing.pricingModel || null
  };
}

function normalizeCategory(category) {
  const normalized = String(category || '').trim().toUpperCase().replace(/-/g, '_');
  if (normalized === 'FREE_CUSTOMER_SERVICE') return 'SERVICE';
  if (normalized === 'AUTHENTICATION INTERNATIONAL') return 'AUTHENTICATION_INTERNATIONAL';
  return costCategories.includes(normalized) ? normalized : 'MARKETING';
}

function emptyCategorySummary(rates) {
  return Object.fromEntries(
    costCategories.map((category) => [
      category,
      {
        category,
        delivered: 0,
        billableDelivered: 0,
        rateCents: rates[category] || 0,
        estimatedCostCents: 0
      }
    ])
  );
}

function addCategoryCost(byCategory, category, delivered, amountOrRateCents, estimateMode, billable = true) {
  const normalizedCategory = normalizeCategory(category);
  byCategory[normalizedCategory].delivered += delivered;
  if (billable) byCategory[normalizedCategory].billableDelivered += delivered;
  byCategory[normalizedCategory].estimatedCostCents += estimateMode ? delivered * amountOrRateCents : amountOrRateCents;
}

function costReportResponse({ source, pricingModel, market, currency, categories, events, ratesConfigured, reconciled }) {
  const estimatedCostCents = categories.reduce((sum, item) => sum + item.estimatedCostCents, 0);
  return {
    currency,
    market,
    pricingModel,
    source,
    reconciled,
    estimatedCostCents,
    estimatedCost: money(estimatedCostCents),
    categories: categories.map((item) => ({
      ...item,
      rate: money(item.rateCents),
      estimatedCost: money(item.estimatedCostCents)
    })),
    events,
    ratesConfigured
  };
}

function normalizeRateCard(card) {
  return {
    id: card.id,
    market: card.market || process.env.META_COST_MARKET || 'ZA',
    currency: card.currency || defaultCurrency,
    category: normalizeCategory(card.category),
    pricingType: card.pricingType || card.pricing_type || 'regular',
    volumeTierFrom: Number(card.volumeTierFrom || card.volume_tier_from || 0),
    volumeTierTo: card.volumeTierTo || card.volume_tier_to || null,
    rateCents: Number(card.rateCents || card.rate_cents || 0),
    source: card.source || 'manual',
    effectiveFrom: card.effectiveFrom || card.effective_from || null,
    isActive: card.isActive === undefined ? Boolean(card.is_active ?? true) : Boolean(card.isActive),
    updatedAt: card.updatedAt || card.updated_at || null
  };
}

function normalizeCostEvent(event) {
  return {
    id: event.id,
    businessId: Number(event.businessId || event.business_id),
    providerMessageId: event.providerMessageId || event.provider_message_id,
    campaignRecipientId: event.campaignRecipientId || event.campaign_recipient_id || null,
    campaignId: event.campaignId || event.campaign_id || null,
    market: event.market || process.env.META_COST_MARKET || 'ZA',
    category: normalizeCategory(event.category),
    pricingType: event.pricingType || event.pricing_type || 'regular',
    billable: Boolean(event.billable),
    currency: event.currency || defaultCurrency,
    rateCents: Number(event.rateCents || event.rate_cents || 0),
    amountCents: Number(event.amountCents || event.amount_cents || 0),
    statusEvent: event.statusEvent || event.status_event || null,
    source: event.source || 'unknown',
    rawPricing: parseJson(event.rawPricing || event.raw_pricing),
    occurredAt: event.occurredAt || event.occurred_at || null,
    createdAt: event.createdAt || event.created_at || null
  };
}

function marketForPhone(phone) {
  return String(phone || '').replace(/\s+/g, '').startsWith('+27') ? 'ZA' : 'OTHER';
}

function centsFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

function money(cents) {
  return `R ${(Number(cents || 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function costKey(businessId, providerMessageId) {
  return `${businessId}:${providerMessageId}`;
}

function rateCardKey(rate) {
  return `${rate.market}:${rate.currency}:${rate.category}:${rate.pricingType}:${rate.volumeTierFrom || 0}`;
}

function nextDemoCostEventId() {
  demoCostEventId += 1;
  return demoCostEventId;
}

function parseJson(value) {
  if (!value || typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

module.exports = {
  getMetaCostReport,
  listMessageCostEvents,
  listMetaRateCards,
  metaRateConfig,
  reconcileMetaMessageCost,
  syncConfiguredMetaRateCard
};
