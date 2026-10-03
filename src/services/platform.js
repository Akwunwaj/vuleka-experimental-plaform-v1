const { hasDatabaseConfig, query, ping } = require('../db/pool');
const demo = require('../data/demoData');
const { listJobs } = require('./jobQueue');
const { listPlatformGuardrails } = require('./platformGuardrails');
const { listPlatformIncidents } = require('./platformIncidents');

const demoPlatformAuditLogs = [];
const demoTenantStatuses = new Map();
const demoTenantNotes = [];
let nextDemoAuditId = 1;
let nextDemoNoteId = 1;

async function getPlatformOverview() {
  const { getAiOperationsOverview } = require('./aiControlPlane');
  const { getPlatformReliabilityOverview } = require('./platformReliability');
  const { getPlatformReliabilityAlertCenter } = require('./platformReliabilityAlerts');
  const { getPublicLeadSummary, listPublicLeads } = require('./publicLeads');
  const { getResolvedCrmStatus } = require('./publicLeadCrm');
  const { listPlatformUsers } = require('./platformAuth');
  const [tenants, queue, database, audits, guardrails, incidents, ai, reliability, reliabilityAlerts, leads, leadSummary, platformUsers, leadCrm] = await Promise.all([
    listPlatformTenants({ limit: 200 }),
    getQueueHealth(),
    ping(),
    listPlatformAuditEvents({ limit: 5 }),
    listPlatformGuardrails(),
    listPlatformIncidents({ limit: 50 }),
    getAiOperationsOverview(),
    getPlatformReliabilityOverview(),
    getPlatformReliabilityAlertCenter(),
    listPublicLeads({ limit: 100 }),
    getPublicLeadSummary(),
    listPlatformUsers(),
    getResolvedCrmStatus()
  ]);

  const activeTenants = tenants.filter((tenant) => tenant.health.overall !== 'blocked').length;
  const connectedMeta = tenants.filter((tenant) => tenant.meta.connected).length;
  const pastDue = tenants.filter((tenant) => ['past_due', 'canceled', 'unpaid'].includes(tenant.billing.status)).length;
  const mrrCents = calculateMrrCents(tenants);

  return {
    summary: {
      tenants: tenants.length,
      activeTenants,
      metaConnected: connectedMeta,
      pastDueSubscriptions: pastDue,
      mrrCents,
      mrrLabel: formatMoney(mrrCents)
    },
    health: {
      overall: database.ok && queue.failed === 0 ? 'healthy' : 'attention',
      database,
      queue,
      vendors: [
        vendorStatus('Meta Cloud API', connectedMeta > 0 || tenants.length === 0, `${connectedMeta}/${tenants.length} tenants connected`),
        vendorStatus('PayFast', tenants.some((tenant) => tenant.billing.provider === 'payfast'), 'Subscription provider configured'),
        vendorStatus('SMTP', process.env.MAIL_MODE === 'smtp', process.env.MAIL_MODE === 'smtp' ? 'SMTP mode' : 'Mock/local mode'),
        vendorStatus('AI providers', ai.summary.configuredProviders > 0, `${ai.summary.configuredProviders}/${ai.providers.length} providers configured`)
      ]
    },
    tenants: tenants.slice(0, 10),
    guardrails,
    incidents,
    leads,
    leadSummary,
    platformUsers,
    leadCrm,
    ai,
    reliability: { ...reliability, alertCenter:reliabilityAlerts },
    recentAuditEvents: audits
  };
}

async function listPlatformTenants({ search = '', limit = 50 } = {}) {
  if (!hasDatabaseConfig()) return listDemoTenants(search).slice(0, normalizeLimit(limit));

  const where = search ? 'where b.name like :search or u.email like :search or b.meta_waba_id like :search or b.meta_phone_number_id like :search' : '';
  const rows = await query(
    `select b.id, b.name, b.plan, b.platform_status as platformStatus, b.platform_status_reason as platformStatusReason,
            b.platform_status_updated_at as platformStatusUpdatedAt,
            b.meta_waba_id as metaWabaId, b.meta_phone_number_id as metaPhoneNumberId, b.created_at as createdAt,
            owner.name as ownerName, owner.email as ownerEmail,
            coalesce(contact_stats.contactsTotal, 0) as contactsTotal,
            coalesce(contact_stats.optedInContacts, 0) as optedInContacts,
            coalesce(campaign_stats.campaignsTotal, 0) as campaignsTotal,
            coalesce(campaign_stats.sentMessages, 0) as sentMessages,
            sub.plan_code as subscriptionPlanCode, sub.status as subscriptionStatus, sub.provider as subscriptionProvider,
            sub.amount_cents as subscriptionAmountCents, sub.next_billing_date as nextBillingDate
     from businesses b
     left join (
       select bm.business_id, min(u.id) as owner_user_id
       from business_memberships bm
       join users u on u.id = bm.user_id
       where bm.role = 'owner'
       group by bm.business_id
     ) owner_link on owner_link.business_id = b.id
     left join users owner on owner.id = owner_link.owner_user_id
     left join users u on u.id = owner.id
     left join (
       select business_id, count(*) as contactsTotal, sum(case when opted_in = 1 then 1 else 0 end) as optedInContacts
       from contacts
       group by business_id
     ) contact_stats on contact_stats.business_id = b.id
     left join (
       select business_id, count(*) as campaignsTotal, sum(coalesce(sent, 0)) as sentMessages
       from campaigns
       group by business_id
     ) campaign_stats on campaign_stats.business_id = b.id
     left join business_subscriptions sub on sub.id = (
       select s.id
       from business_subscriptions s
       where s.business_id = b.id
       order by case s.status when 'active' then 0 when 'trialing' then 1 when 'pending' then 2 else 3 end, s.created_at desc
       limit 1
     )
     ${where}
     order by b.created_at desc, b.id desc
     limit ${normalizeLimit(limit)}`,
    { search: `%${search}%` }
  );

  return rows.map(normalizeTenant);
}

async function getPlatformTenant(tenantId) {
  const tenants = await listPlatformTenants({ limit: 500 });
  const tenant = tenants.find((item) => Number(item.id) === Number(tenantId));
  if (!tenant) {
    const error = new Error('Tenant not found');
    error.status = 404;
    throw error;
  }

  const jobs = await listJobs({ limit: 100 });
  const notes = await listPlatformTenantNotes(tenant.id);
  return {
    ...tenant,
    jobs: jobs
      .filter((job) => job.payload?.businessId === Number(tenant.id) || job.payload?.businessId === String(tenant.id))
      .slice(0, 10),
    notes
  };
}

async function assertPlatformTenantCanOperate(businessId, operation = 'operate') {
  let tenant;
  try {
    tenant = await getPlatformTenant(businessId);
  } catch (err) {
    if (!hasDatabaseConfig() && err.status === 404) return null;
    throw err;
  }
  if (tenant.platform.status === 'suspended') {
    const error = new Error(`Tenant is suspended by Platform Owner. ${tenant.platform.reason || 'Resolve the platform hold before continuing.'}`.trim());
    error.status = 423;
    error.code = 'PLATFORM_TENANT_SUSPENDED';
    error.operation = operation;
    error.tenant = {
      id: tenant.id,
      name: tenant.name,
      status: tenant.platform.status,
      reason: tenant.platform.reason
    };
    throw error;
  }
  return tenant;
}

async function updatePlatformTenantStatus({ tenantId, status, reason, platformUser, ipAddress = '', userAgent = '' }) {
  const normalizedStatus = normalizeTenantStatus(status);
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) {
    const error = new Error('reason is required');
    error.status = 400;
    throw error;
  }

  const tenant = await getPlatformTenant(tenantId);

  if (!hasDatabaseConfig()) {
    demoTenantStatuses.set(Number(tenant.id), {
      status: normalizedStatus,
      reason: normalizedReason,
      updatedAt: new Date().toISOString()
    });
  } else {
    const result = await query(
      `update businesses
       set platform_status = :status,
           platform_status_reason = :reason,
           platform_status_updated_at = current_timestamp
       where id = :tenantId`,
      { status: normalizedStatus, reason: normalizedReason, tenantId: tenant.id }
    );
    if (!result.affectedRows) {
      const error = new Error('Tenant not found');
      error.status = 404;
      throw error;
    }
  }

  await recordPlatformAuditEvent({
    platformUser,
    action: 'platform.tenant.status.update',
    targetType: 'tenant',
    targetId: tenant.id,
    reason: normalizedReason,
    metadata: { from: tenant.platform.status, to: normalizedStatus },
    ipAddress,
    userAgent
  });

  return getPlatformTenant(tenant.id);
}

async function createPlatformTenantNote({ tenantId, note, category = 'general', platformUser, ipAddress = '', userAgent = '' }) {
  const tenant = await getPlatformTenant(tenantId);
  const normalizedNote = String(note || '').trim();
  if (!normalizedNote) {
    const error = new Error('note is required');
    error.status = 400;
    throw error;
  }
  const normalizedCategory = String(category || 'general').trim().toLowerCase().slice(0, 80) || 'general';

  let stored;
  if (!hasDatabaseConfig()) {
    stored = {
      id: nextDemoNoteId++,
      businessId: tenant.id,
      platformUserId: platformUser?.id || null,
      platformUserEmail: platformUser?.email || null,
      note: normalizedNote.slice(0, 1000),
      category: normalizedCategory,
      createdAt: new Date().toISOString()
    };
    demoTenantNotes.unshift(stored);
  } else {
    const result = await query(
      `insert into platform_tenant_notes (business_id, platform_user_id, note, category)
       values (:businessId, :platformUserId, :note, :category)`,
      {
        businessId: tenant.id,
        platformUserId: platformUser?.id || null,
        note: normalizedNote.slice(0, 1000),
        category: normalizedCategory
      }
    );
    stored = {
      id: result.insertId,
      businessId: tenant.id,
      platformUserId: platformUser?.id || null,
      platformUserEmail: platformUser?.email || null,
      note: normalizedNote.slice(0, 1000),
      category: normalizedCategory,
      createdAt: new Date().toISOString()
    };
  }

  await recordPlatformAuditEvent({
    platformUser,
    action: 'platform.tenant.note.create',
    targetType: 'tenant',
    targetId: tenant.id,
    reason: normalizedCategory,
    metadata: { noteId: stored.id },
    ipAddress,
    userAgent
  });

  return stored;
}

async function listPlatformTenantNotes(tenantId, { limit = 20 } = {}) {
  if (!hasDatabaseConfig()) {
    return demoTenantNotes
      .filter((note) => Number(note.businessId) === Number(tenantId))
      .slice(0, normalizeLimit(limit));
  }

  const rows = await query(
    `select ptn.id, ptn.business_id as businessId, ptn.platform_user_id as platformUserId,
            pu.email as platformUserEmail, ptn.note, ptn.category, ptn.created_at as createdAt
     from platform_tenant_notes ptn
     left join platform_users pu on pu.id = ptn.platform_user_id
     where ptn.business_id = :tenantId
     order by ptn.created_at desc, ptn.id desc
     limit ${normalizeLimit(limit)}`,
    { tenantId }
  );
  return rows;
}

async function recordPlatformAuditEvent({ platformUser, action, targetType = null, targetId = null, reason = null, metadata = null, ipAddress = '', userAgent = '' }) {
  const event = {
    platformUserId: platformUser?.id || null,
    platformUserEmail: platformUser?.email || null,
    action,
    targetType,
    targetId: targetId === null || targetId === undefined ? null : String(targetId),
    reason,
    metadata: metadata || {},
    ipAddress: String(ipAddress || '').slice(0, 64),
    userAgent: String(userAgent || '').slice(0, 255)
  };

  if (!hasDatabaseConfig()) {
    const stored = {
      id: nextDemoAuditId++,
      ...event,
      createdAt: new Date().toISOString()
    };
    demoPlatformAuditLogs.unshift(stored);
    return stored;
  }

  const result = await query(
    `insert into platform_audit_logs
       (platform_user_id, action, target_type, target_id, reason, metadata, ip_address, user_agent)
     values
       (:platformUserId, :action, :targetType, :targetId, :reason, :metadata, :ipAddress, :userAgent)`,
    {
      ...event,
      metadata: JSON.stringify(event.metadata)
    }
  );

  return { id: result.insertId, ...event, createdAt: new Date().toISOString() };
}

async function listPlatformAuditEvents({ limit = 50 } = {}) {
  if (!hasDatabaseConfig()) return demoPlatformAuditLogs.slice(0, normalizeLimit(limit));

  const rows = await query(
    `select pal.id, pal.platform_user_id as platformUserId, pu.email as platformUserEmail,
            pal.action, pal.target_type as targetType, pal.target_id as targetId,
            pal.reason, pal.metadata, pal.ip_address as ipAddress, pal.user_agent as userAgent,
            pal.created_at as createdAt
     from platform_audit_logs pal
     left join platform_users pu on pu.id = pal.platform_user_id
     order by pal.created_at desc, pal.id desc
     limit ${normalizeLimit(limit)}`
  );

  return rows.map((row) => ({
    ...row,
    metadata: parseJson(row.metadata)
  }));
}

async function getQueueHealth() {
  const jobs = await listJobs({ limit: 500 });
  const queued = jobs.filter((job) => job.status === 'queued');
  const failed = jobs.filter((job) => job.status === 'failed');
  const running = jobs.filter((job) => job.status === 'running');
  const oldestQueuedAt = queued
    .map((job) => new Date(job.runAt || job.createdAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b)[0];

  return {
    queued: queued.length,
    pending: queued.length,
    running: running.length,
    failed: failed.length,
    oldestQueuedSeconds: oldestQueuedAt ? Math.max(0, Math.round((Date.now() - oldestQueuedAt.getTime()) / 1000)) : 0,
    status: failed.length ? 'attention' : queued.length > 25 ? 'watch' : 'healthy'
  };
}

function listDemoTenants(search) {
  const demoStatus = demoTenantStatuses.get(Number(demo.business.id)) || {};
  const tenant = normalizeTenant({
    id: demo.business.id,
    name: demo.business.name,
    plan: demo.business.plan,
    platformStatus: demoStatus.status || 'active',
    platformStatusReason: demoStatus.reason || null,
    platformStatusUpdatedAt: demoStatus.updatedAt || null,
    metaWabaId: process.env.META_WABA_ID || null,
    metaPhoneNumberId: process.env.META_PHONE_NUMBER_ID || null,
    createdAt: new Date().toISOString(),
    ownerName: 'Admin User',
    ownerEmail: 'admin@chatclan.co.za',
    contactsTotal: demo.contacts.length,
    optedInContacts: demo.contacts.filter((contact) => contact.optedIn).length,
    campaignsTotal: demo.campaigns.length,
    sentMessages: demo.campaigns.reduce((sum, campaign) => sum + Number(campaign.sent || 0), 0),
    subscriptionPlanCode: 'growth',
    subscriptionStatus: 'active',
    subscriptionProvider: 'payfast',
    subscriptionAmountCents: 79900,
    nextBillingDate: demo.business.billingRenewal
  });
  const normalizedSearch = String(search || '').trim().toLowerCase();
  if (!normalizedSearch) return [tenant];
  return [tenant].filter((item) => `${item.name} ${item.owner.email}`.toLowerCase().includes(normalizedSearch));
}

function normalizeTenant(row) {
  const metaConnected = Boolean(row.metaWabaId && row.metaPhoneNumberId);
  const billingStatus = row.subscriptionStatus || 'none';
  const platformStatus = row.platformStatus || 'active';
  const contactsTotal = Number(row.contactsTotal || 0);
  const optedInContacts = Number(row.optedInContacts || 0);
  const healthChecks = [
    check('platform', platformStatus !== 'suspended', platformStatus === 'suspended' ? 'Tenant is suspended' : `Tenant is ${platformStatus}`),
    check('billing', ['active', 'trialing'].includes(billingStatus), `Subscription is ${billingStatus}`),
    check('meta', metaConnected, metaConnected ? 'Meta assets connected' : 'Meta WABA or phone number missing'),
    check('consent', contactsTotal === 0 || optedInContacts / contactsTotal >= 0.5, `${optedInContacts}/${contactsTotal} contacts opted in`)
  ];
  const failedChecks = healthChecks.filter((item) => !item.ok).length;

  return {
    id: Number(row.id),
    name: row.name,
    plan: row.plan || row.subscriptionPlanCode || 'starter',
    createdAt: row.createdAt,
    owner: {
      name: row.ownerName || 'Unknown owner',
      email: row.ownerEmail || ''
    },
    platform: {
      status: platformStatus,
      reason: row.platformStatusReason || null,
      updatedAt: row.platformStatusUpdatedAt || null
    },
    meta: {
      connected: metaConnected,
      wabaId: row.metaWabaId || null,
      phoneNumberId: row.metaPhoneNumberId || null
    },
    billing: {
      status: billingStatus,
      provider: row.subscriptionProvider || null,
      planCode: row.subscriptionPlanCode || null,
      recurringAmountCents: Number(row.subscriptionAmountCents || 0),
      recurringAmountLabel: formatMoney(Number(row.subscriptionAmountCents || 0)),
      nextBillingDate: row.nextBillingDate || null
    },
    usage: {
      contactsTotal,
      optedInContacts,
      campaignsTotal: Number(row.campaignsTotal || 0),
      sentMessages: Number(row.sentMessages || 0)
    },
    health: {
      overall: failedChecks === 0 ? 'healthy' : failedChecks === 1 ? 'watch' : 'blocked',
      checks: healthChecks
    }
  };
}

function check(id, ok, label) {
  return { id, ok: Boolean(ok), label };
}

function vendorStatus(name, ok, detail) {
  return { name, status: ok ? 'healthy' : 'watch', detail };
}

function normalizeLimit(limit) {
  const parsed = Number(limit || 50);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(Math.floor(parsed), 500);
}

function formatMoney(cents) {
  return `R ${(Number(cents || 0) / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateMrrCents(tenants = []) {
  return tenants.reduce(
    (sum, tenant) => sum + (tenant.billing?.status === 'active' ? Number(tenant.billing.recurringAmountCents || 0) : 0),
    0
  );
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeTenantStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['active', 'watchlist', 'suspended'].includes(normalized)) return normalized;
  const error = new Error('status must be active, watchlist, or suspended');
  error.status = 400;
  throw error;
}

module.exports = {
  calculateMrrCents,
  createPlatformTenantNote,
  assertPlatformTenantCanOperate,
  getPlatformOverview,
  getPlatformTenant,
  listPlatformAuditEvents,
  listPlatformTenantNotes,
  listPlatformTenants,
  recordPlatformAuditEvent,
  updatePlatformTenantStatus
};
