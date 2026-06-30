const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { deleteCampaignRecipientsForSubject } = require('./campaignRecipients');
const { maskPhone, normalizeWhatsAppPhone } = require('./consent');
const { redactInboxDataForSubject } = require('./inbox');

const demoRequests = [];

async function createDataDeletionRequest({ businessId, phone, requestedByUserId = null, reason = 'Customer request' }) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 8) {
    const error = new Error('A valid customer phone number is required');
    error.status = 400;
    throw error;
  }

  const contact = await findContactForDeletion(businessId, normalizedPhone);
  const request = await insertDeletionRequest({
    businessId,
    phone: normalizedPhone,
    requestedByUserId,
    reason,
    contactId: contact?.id || null
  });
  const result = await processDataDeletionRequest({ businessId, requestId: request.id });
  return sanitizeDeletionRequest(result);
}

async function listDataDeletionRequests(businessId) {
  if (!hasDatabaseConfig()) {
    return demoRequests
      .filter((request) => Number(request.businessId) === Number(businessId))
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
      .map(sanitizeDeletionRequest);
  }

  const rows = await query(
    `select id, business_id as businessId, contact_id as contactId,
            phone_masked as phoneMasked, phone_hash as phoneHash, requested_by_user_id as requestedByUserId,
            reason, status, affected_counts_json as affectedCounts, requested_at as requestedAt,
            completed_at as completedAt
     from data_deletion_requests
     where business_id = :businessId
     order by requested_at desc, id desc
     limit 200`,
    { businessId }
  );

  return (rows || []).map((row) => sanitizeDeletionRequest({ ...row, affectedCounts: parseJson(row.affectedCounts) }));
}

async function processDataDeletionRequest({ businessId, requestId }) {
  const request = await getDeletionRequest(businessId, requestId);
  if (!request) {
    const error = new Error('Data deletion request not found');
    error.status = 404;
    throw error;
  }

  const contact = request.contactId ? await findContactById(businessId, request.contactId) : await findContactByHash(businessId, request.phoneHash);
  const phone = contact?.phone || request.phone;
  const campaignResult = await deleteCampaignRecipientsForSubject({
    businessId,
    contactId: contact?.id || null,
    phone
  });
  const inboxResult = await redactInboxDataForSubject({
    businessId,
    contactId: contact?.id || null,
    phone,
    requestId
  });
  const contactResult = contact ? await redactContact({ businessId, contact, requestId }) : { contacts: 0 };
  const consentResult = contact ? await recordDeletionConsentEvent({ businessId, contactId: contact.id, requestId }) : { consentEvents: 0 };
  const affectedCounts = {
    ...contactResult,
    ...campaignResult,
    ...inboxResult,
    ...consentResult
  };

  await completeDeletionRequest({ businessId, requestId, affectedCounts });
  return sanitizeDeletionRequest({
    ...(await getDeletionRequest(businessId, requestId)),
    affectedCounts
  });
}

async function insertDeletionRequest({ businessId, phone, requestedByUserId, reason, contactId }) {
  const record = {
    id: Date.now() + demoRequests.length,
    businessId: Number(businessId),
    contactId: contactId || null,
    phone,
    phoneMasked: maskPhone(phone),
    phoneHash: hashSubjectPhone(phone),
    requestedByUserId: requestedByUserId || null,
    reason: String(reason || 'Customer request').trim().slice(0, 255),
    status: 'processing',
    affectedCounts: {},
    requestedAt: new Date().toISOString(),
    completedAt: null
  };

  if (!hasDatabaseConfig()) {
    demoRequests.push(record);
    return record;
  }

  const result = await query(
    `insert into data_deletion_requests
       (business_id, contact_id, phone_masked, phone_hash, requested_by_user_id, reason, status, requested_at)
     values
       (:businessId, :contactId, :phoneMasked, :phoneHash, :requestedByUserId, :reason, 'processing', current_timestamp)`,
    record
  );
  return { ...record, id: result.insertId };
}

async function completeDeletionRequest({ businessId, requestId, affectedCounts }) {
  if (!hasDatabaseConfig()) {
    const request = demoRequests.find((item) => Number(item.businessId) === Number(businessId) && Number(item.id) === Number(requestId));
    if (request) {
      request.status = 'completed';
      request.affectedCounts = affectedCounts;
      request.completedAt = new Date().toISOString();
    }
    return;
  }

  await query(
    `update data_deletion_requests
     set status = 'completed',
         affected_counts_json = :affectedCounts,
         completed_at = current_timestamp
     where business_id = :businessId and id = :requestId`,
    { businessId, requestId, affectedCounts: JSON.stringify(affectedCounts) }
  );
}

async function getDeletionRequest(businessId, requestId) {
  if (!hasDatabaseConfig()) {
    return demoRequests.find((request) => Number(request.businessId) === Number(businessId) && Number(request.id) === Number(requestId)) || null;
  }

  const rows = await query(
    `select id, business_id as businessId, contact_id as contactId,
            phone_masked as phoneMasked, phone_hash as phoneHash, requested_by_user_id as requestedByUserId,
            reason, status, affected_counts_json as affectedCounts, requested_at as requestedAt,
            completed_at as completedAt
     from data_deletion_requests
     where business_id = :businessId and id = :requestId
     limit 1`,
    { businessId, requestId }
  );
  const row = rows?.[0];
  return row ? { ...row, affectedCounts: parseJson(row.affectedCounts) } : null;
}

async function findContactForDeletion(businessId, phone) {
  if (!hasDatabaseConfig()) {
    return demo.contacts.find((contact) => Number(contact.businessId || 1) === Number(businessId) && normalizeWhatsAppPhone(contact.phone) === phone) || null;
  }

  const rows = await query(
    `select id, name, phone
     from contacts
     where business_id = :businessId
       and replace(replace(replace(replace(phone, ' ', ''), '-', ''), '(', ''), ')', '') = :phone
     limit 1`,
    { businessId, phone }
  );
  return rows?.[0] || null;
}

async function findContactById(businessId, contactId) {
  if (!hasDatabaseConfig()) {
    return demo.contacts.find((contact) => Number(contact.businessId || 1) === Number(businessId) && Number(contact.id) === Number(contactId)) || null;
  }

  const rows = await query(
    `select id, name, phone
     from contacts
     where business_id = :businessId and id = :contactId
     limit 1`,
    { businessId, contactId }
  );
  return rows?.[0] || null;
}

async function findContactByHash(businessId, phoneHash) {
  if (!hasDatabaseConfig()) {
    return demo.contacts.find((contact) => Number(contact.businessId || 1) === Number(businessId) && hashSubjectPhone(normalizeWhatsAppPhone(contact.phone)) === phoneHash) || null;
  }
  return null;
}

async function redactContact({ businessId, contact, requestId }) {
  const redactedPhone = deletedContactPhone(requestId, contact.id);

  if (!hasDatabaseConfig()) {
    contact.name = 'Deleted contact';
    contact.phone = redactedPhone;
    contact.email = null;
    contact.segment = 'Deleted';
    contact.optedIn = false;
    contact.optedOutAt = new Date().toISOString();
    contact.lastSeen = 'Deleted';
    return { contacts: 1 };
  }

  const result = await query(
    `update contacts
     set name = 'Deleted contact',
         phone = :redactedPhone,
         email = null,
         segment = 'Deleted',
         opted_in = 0,
         opted_out_at = current_timestamp,
         last_seen = 'Deleted'
     where business_id = :businessId and id = :contactId`,
    { businessId, contactId: contact.id, redactedPhone }
  );
  return { contacts: Number(result?.affectedRows || 0) };
}

async function recordDeletionConsentEvent({ businessId, contactId, requestId }) {
  if (!hasDatabaseConfig()) return { consentEvents: 1 };

  const result = await query(
    `insert into opt_in_events
       (business_id, contact_id, event_type, channel, source, occurred_at, metadata)
     values
       (:businessId, :contactId, 'data_deleted', 'POPIA request', 'Data subject request', current_timestamp, :metadata)`,
    {
      businessId,
      contactId,
      metadata: JSON.stringify({ requestId })
    }
  );
  return { consentEvents: Number(result?.affectedRows || 0) };
}

function hashSubjectPhone(phone) {
  return crypto.createHash('sha256').update(String(phone || '')).digest('hex');
}

function deletedContactPhone(requestId, contactId) {
  return `deleted:${String(requestId).slice(-8)}:${contactId}`;
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

function sanitizeDeletionRequest(request) {
  if (!request) return null;
  const { phone, ...safe } = request;
  return safe;
}

function resetDataDeletionForTests() {
  demoRequests.length = 0;
}

module.exports = {
  createDataDeletionRequest,
  hashSubjectPhone,
  listDataDeletionRequests,
  processDataDeletionRequest,
  resetDataDeletionForTests
};
