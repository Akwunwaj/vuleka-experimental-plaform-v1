const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { listConversations } = require('./inbox');
const { listOrders, listProducts } = require('./commerce');
const { enforcePlanLimit, getPlanStatus } = require('./subscriptionPolicy');
const { getDemoBusiness } = require('./demoStore');

const demoCampaigns = [...demo.campaigns];

async function getDashboardData(businessId = 1) {
  if (!businessId) {
    const error = new Error('businessId is required for tenant data');
    error.status = 401;
    throw error;
  }

  const business = await getBusinessProfile(businessId);
  const campaigns = (await byBusiness('campaigns', demoCampaigns, businessId, 'created_at desc')).map(normalizeCampaign);
  const contacts = (await byBusiness('contacts', demo.contacts, businessId, 'id')).map(normalizeContact);
  const templates = await byBusiness('message_templates', demo.templates, businessId, 'id');
  const inbox = await listConversations(businessId);
  const products = await listProducts(businessId);
  const orders = await listOrders(businessId);

  return {
    business,
    metrics: metricsFor({ campaigns, contacts }),
    campaigns,
    contacts,
    inbox,
    templates,
    products,
    orders,
    plans: demo.plans,
    providers: demo.providers
  };
}

function getPublicPreviewData() {
  return {
    business: demo.business,
    metrics: demo.metrics,
    campaigns: demoCampaigns.map(normalizeCampaign),
    contacts: demo.contacts.map(normalizeContact),
    inbox: demo.inbox,
    templates: demo.templates,
    products: demo.products,
    orders: demo.orders,
    plans: demo.plans,
    providers: demo.providers
  };
}

async function byBusiness(tableName, fallback, businessId, orderBy = 'id') {
  if (!hasDatabaseConfig()) {
    return fallback.filter((item) => Number(item.businessId || item.business_id || 1) === Number(businessId) && !item.deletedAt && !item.deleted_at);
  }
  const activeWhere = tableName === 'contacts' ? ' and deleted_at is null' : '';
  return query(`select * from ${tableName} where business_id = :businessId${activeWhere} order by ${orderBy}`, {
    businessId
  });
}

async function getBusinessProfile(businessId) {
  const planStatus = await getPlanStatus(businessId);
  if (!hasDatabaseConfig()) {
    const business = getDemoBusiness(businessId);
    if (!business) {
      const error = new Error('Business not found');
      error.status = 404;
      throw error;
    }
    const contactsUsed = demo.contacts.filter((contact) => Number(contact.businessId || 1) === Number(businessId)).length;
    return {
      id: business.id,
      name: business.name,
      plan: planStatus.plan.name,
      planCode: planStatus.plan.code,
      subscriptionStatus: planStatus.status,
      contactsUsed,
      contactsLimit: planStatus.plan.limits.contacts ?? 1000000,
      planUsage: planStatus.usage,
      planLimits: planStatus.plan.limits,
      billingRenewal: planStatus.subscription?.nextBillingDate || business.billingRenewal || 'Trial'
    };
  }

  const rows = await query(
    `select b.id, b.name, b.plan,
            count(c.id) as contactsUsed
     from businesses b
     left join contacts c on c.business_id = b.id and c.deleted_at is null
     where b.id = :businessId
     group by b.id, b.name, b.plan
     limit 1`,
    { businessId }
  );
  const business = rows?.[0];
  if (!business) {
    const error = new Error('Business not found');
    error.status = 404;
    throw error;
  }

  return {
    id: business.id,
    name: business.name,
    plan: planStatus.plan.name,
    planCode: planStatus.plan.code,
    subscriptionStatus: planStatus.status,
    contactsUsed: Number(business.contactsUsed || 0),
    contactsLimit: planStatus.plan.limits.contacts ?? 1000000,
    planUsage: planStatus.usage,
    planLimits: planStatus.plan.limits,
    billingRenewal: planStatus.subscription?.nextBillingDate || 'Not configured'
  };
}

function metricsFor({ campaigns, contacts }) {
  const sent = campaigns.reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0);
  const delivered = campaigns.reduce((sum, campaign) => sum + Number(campaign.delivered || 0), 0);
  const optedIn = contacts.filter((contact) => contact.optedIn).length;
  const deliveryRate = sent ? `${Math.round((delivered / sent) * 1000) / 10}%` : '-';

  return [
    { label: 'Messages sent', value: sent.toLocaleString('en-ZA'), change: 'Tenant scoped' },
    { label: 'Delivery rate', value: deliveryRate, change: 'From campaigns' },
    { label: 'Opted-in contacts', value: optedIn.toLocaleString('en-ZA'), change: `${contacts.length} total` },
    { label: 'Campaigns', value: campaigns.length.toLocaleString('en-ZA'), change: 'This workspace' }
  ];
}

function normalizeCampaign(campaign) {
  return {
    ...campaign,
    category: normalizeCampaignCategory(campaign.category || campaign.template_category || 'MARKETING'),
    readRate: campaign.readRate || campaign.read_rate || '-'
  };
}

function normalizeContact(contact) {
  return {
    ...contact,
    optedIn: contact.optedIn ?? Boolean(contact.opted_in)
  };
}

async function createCampaign(payload, businessId = 1) {
  await enforcePlanLimit({ businessId, resource: 'campaigns', requested: 1 });
  const category = normalizeCampaignCategory(payload.category || payload.templateCategory || 'MARKETING');
  const campaign = {
    id: Date.now(),
    businessId: Number(businessId),
    name: payload.name || 'Untitled campaign',
    status: 'Draft',
    audience: payload.audience || 'All contacts',
    category,
    sent: 0,
    delivered: 0,
    readRate: '-',
    revenue: '-'
  };

  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into campaigns (business_id, name, status, audience, category, body, schedule_type)
       values (:businessId, :name, 'Draft', :audience, :category, :body, :scheduleType)`,
      {
        businessId,
        name: campaign.name,
        audience: campaign.audience,
        category,
        body: payload.body || '',
        scheduleType: payload.scheduleType || 'now'
      }
    );
    campaign.id = result.insertId;
  } else {
    demoCampaigns.unshift(campaign);
  }

  return campaign;
}

async function createContact(payload, businessId = 1) {
  await enforcePlanLimit({ businessId, resource: 'contacts', requested: 1 });
  const contact = {
    id: Date.now(),
    businessId: Number(businessId),
    name: payload.name,
    phone: payload.phone,
    segment: payload.segment || 'Imported',
    optedIn: payload.optedIn !== false,
    lastSeen: 'New'
  };

  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into contacts (business_id, name, phone, segment, opted_in)
       values (:businessId, :name, :phone, :segment, :optedIn)`,
      { ...contact, businessId }
    );
    contact.id = result.insertId;
  } else {
    demo.contacts.push(contact);
  }

  return contact;
}

async function updateContact({ businessId, contactId, payload }) {
  const contact = normalizeContactPayload(payload);
  if (!hasDatabaseConfig()) {
    const stored = demo.contacts.find((item) => Number(item.id) === Number(contactId) && Number(item.businessId || 1) === Number(businessId) && !item.deletedAt);
    if (!stored) throw contactNotFound();
    Object.assign(stored, contact);
    return normalizeContact(stored);
  }
  const result = await query(
    `update contacts set name = :name, phone = :phone, segment = :segment, opted_in = :optedIn
     where id = :contactId and business_id = :businessId and deleted_at is null`,
    { ...contact, businessId, contactId }
  );
  if (!result.affectedRows) throw contactNotFound();
  return normalizeContact((await query(
    'select * from contacts where id = :contactId and business_id = :businessId limit 1', { contactId, businessId }
  ))[0]);
}

async function softDeleteContact({ businessId, contactId, actorUserId = null }) {
  if (!hasDatabaseConfig()) {
    const stored = demo.contacts.find((item) => Number(item.id) === Number(contactId) && Number(item.businessId || 1) === Number(businessId) && !item.deletedAt);
    if (!stored) throw contactNotFound();
    stored.deletedAt = new Date().toISOString();
    stored.deletedByUserId = actorUserId;
    return { id: Number(contactId), deletedAt: stored.deletedAt };
  }
  const result = await query(
    `update contacts set deleted_at = current_timestamp, deleted_by_user_id = :actorUserId
     where id = :contactId and business_id = :businessId and deleted_at is null`,
    { contactId, businessId, actorUserId }
  );
  if (!result.affectedRows) throw contactNotFound();
  return { id: Number(contactId), deletedAt: new Date().toISOString() };
}

function normalizeContactPayload(payload) {
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  if (!name || !phone) {
    const error = new Error('name and phone are required');
    error.status = 400;
    throw error;
  }
  return { name, phone, segment: String(payload.segment || 'Imported').trim() || 'Imported', optedIn: payload.optedIn !== false };
}

function contactNotFound() {
  const error = new Error('Contact not found');
  error.status = 404;
  return error;
}

function normalizeCampaignCategory(category) {
  const normalized = String(category || '').trim().toUpperCase();
  if (['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(normalized)) return normalized;
  return 'MARKETING';
}

module.exports = { getDashboardData, getPublicPreviewData, createCampaign, createContact, updateContact, softDeleteContact };
