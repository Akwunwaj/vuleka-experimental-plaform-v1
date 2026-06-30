const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');

const demoCampaignRecipients = new Map();

async function prepareCampaignRecipients({ businessId, campaignId, audience = 'All contacts', body = '' }) {
  if (!campaignId) {
    const error = new Error('campaignId is required');
    error.status = 400;
    throw error;
  }

  if (!hasDatabaseConfig()) {
    return prepareDemoRecipients({ businessId, campaignId, audience, body });
  }

  const contacts = await selectEligibleContacts(businessId, audience);
  const totalContacts = await countAudienceContacts(businessId, audience);
  const excludedOptOut = totalContacts - contacts.length;

  await query('delete from campaign_recipients where campaign_id = :campaignId', { campaignId });

  for (const contact of contacts) {
    await query(
      `insert into campaign_recipients
         (business_id, campaign_id, contact_id, phone, status, personalized_body)
       values
         (:businessId, :campaignId, :contactId, :phone, 'queued', :personalizedBody)`,
      {
        businessId,
        campaignId,
        contactId: contact.id,
        phone: contact.phone,
        personalizedBody: personalizeBody(body, contact)
      }
    );
  }

  await query(
    `update campaigns
     set audience = :audience, status = 'Draft'
     where business_id = :businessId and id = :campaignId`,
    { businessId, campaignId, audience: `${contacts.length} contacts` }
  );

  return summary({ campaignId, audience, totalContacts, eligible: contacts.length, excludedOptOut });
}

async function listCampaignRecipients({ businessId, campaignId }) {
  if (!campaignId) {
    const error = new Error('campaignId is required');
    error.status = 400;
    throw error;
  }

  if (!hasDatabaseConfig()) {
    return demoCampaignRecipients.get(keyFor(businessId, campaignId)) || [];
  }

  return query(
    `select id, campaign_id as campaignId, contact_id as contactId, phone, status,
            provider_message_id as providerMessageId, error_message as errorMessage,
            sent_at as sentAt, delivered_at as deliveredAt, read_at as readAt
     from campaign_recipients
     where business_id = :businessId and campaign_id = :campaignId
     order by id asc
     limit 1000`,
    { businessId, campaignId }
  );
}

async function listQueuedCampaignRecipients({ businessId, campaignId, limit = 100 }) {
  const recipients = await listCampaignRecipients({ businessId, campaignId });
  return recipients.filter((recipient) => recipient.status === 'queued').slice(0, limit);
}

async function updateCampaignRecipientStatus({ businessId, campaignId, recipientId, status, providerMessageId = null, errorMessage = null }) {
  if (!hasDatabaseConfig()) {
    const recipients = demoCampaignRecipients.get(keyFor(businessId, campaignId)) || [];
    const recipient = recipients.find((item) => Number(item.id) === Number(recipientId));
    if (!recipient) return null;
    Object.assign(recipient, statusPatch({ status, providerMessageId, errorMessage }));
    return recipient;
  }

  const timestampColumn = timestampColumnForStatus(status);
  const timestampSql = timestampColumn ? `, ${timestampColumn} = current_timestamp` : '';
  await query(
    `update campaign_recipients
     set status = :status,
         provider_message_id = :providerMessageId,
         error_message = :errorMessage
         ${timestampSql}
     where business_id = :businessId
       and campaign_id = :campaignId
       and id = :recipientId`,
    { businessId, campaignId, recipientId, status, providerMessageId, errorMessage }
  );

  return { id: recipientId, status, providerMessageId, errorMessage };
}

async function updateCampaignRecipientStatusByProviderMessageId({ businessId, providerMessageId, status, errorMessage = null }) {
  if (!providerMessageId) return null;

  if (!hasDatabaseConfig()) {
    for (const [key, recipients] of demoCampaignRecipients.entries()) {
      const [recipientBusinessId, campaignId] = key.split(':');
      if (Number(recipientBusinessId) !== Number(businessId)) continue;
      const recipient = recipients.find((item) => item.providerMessageId === providerMessageId);
      if (!recipient) continue;
      Object.assign(recipient, statusPatch({ status, providerMessageId, errorMessage }));
      return { ...recipient, campaignId: Number(campaignId) };
    }
    return null;
  }

  const timestampColumn = timestampColumnForStatus(status);
  const timestampSql = timestampColumn ? `, ${timestampColumn} = current_timestamp` : '';
  await query(
    `update campaign_recipients
     set status = :status,
         error_message = :errorMessage
         ${timestampSql}
     where business_id = :businessId and provider_message_id = :providerMessageId`,
    { businessId, providerMessageId, status, errorMessage }
  );

  const rows = await query(
    `select id, campaign_id as campaignId, contact_id as contactId, phone, status,
            provider_message_id as providerMessageId, error_message as errorMessage,
            sent_at as sentAt, delivered_at as deliveredAt, read_at as readAt
     from campaign_recipients
     where business_id = :businessId and provider_message_id = :providerMessageId
     limit 1`,
    { businessId, providerMessageId }
  );
  const recipient = rows?.[0] || null;
  if (recipient) await refreshCampaignSendCounts({ businessId, campaignId: recipient.campaignId });
  return recipient;
}

async function findCampaignRecipientByProviderMessageId({ businessId, providerMessageId }) {
  if (!providerMessageId) return null;

  if (!hasDatabaseConfig()) {
    for (const [key, recipients] of demoCampaignRecipients.entries()) {
      const [recipientBusinessId, campaignId] = key.split(':');
      if (Number(recipientBusinessId) !== Number(businessId)) continue;
      const recipient = recipients.find((item) => item.providerMessageId === providerMessageId);
      if (!recipient) continue;
      const campaign = demo.campaigns.find((item) => Number(item.id) === Number(campaignId));
      return { ...recipient, campaignId: Number(campaignId), campaignCategory: campaign?.category || 'MARKETING' };
    }
    return null;
  }

  const rows = await query(
    `select cr.id, cr.campaign_id as campaignId, cr.contact_id as contactId, cr.phone, cr.status,
            cr.provider_message_id as providerMessageId, c.category as campaignCategory
     from campaign_recipients cr
     join campaigns c on c.id = cr.campaign_id and c.business_id = cr.business_id
     where cr.business_id = :businessId and cr.provider_message_id = :providerMessageId
     limit 1`,
    { businessId, providerMessageId }
  );
  return rows?.[0] || null;
}

async function deleteCampaignRecipientsForSubject({ businessId, contactId = null, phone = null }) {
  if (!contactId && !phone) return { campaignRecipients: 0 };

  if (!hasDatabaseConfig()) {
    let removed = 0;
    for (const [key, recipients] of demoCampaignRecipients.entries()) {
      const [recipientBusinessId] = key.split(':');
      if (Number(recipientBusinessId) !== Number(businessId)) continue;
      const kept = recipients.filter((recipient) => {
        const match = (contactId && Number(recipient.contactId) === Number(contactId)) || (phone && recipient.phone === phone);
        if (match) removed += 1;
        return !match;
      });
      demoCampaignRecipients.set(key, kept);
    }
    return { campaignRecipients: removed };
  }

  if (contactId) {
    await query(
      `update message_cost_events
       set campaign_recipient_id = null
       where business_id = :businessId
         and campaign_recipient_id in (
           select id from campaign_recipients
           where business_id = :businessId and contact_id = :contactId
         )`,
      { businessId, contactId }
    );
  }

  const where = ['business_id = :businessId'];
  const params = { businessId, contactId, phone };
  if (contactId) where.push('contact_id = :contactId');
  if (phone) where.push('phone = :phone');
  const result = await query(`delete from campaign_recipients where ${where.join(' and ')}`, params);
  return { campaignRecipients: Number(result?.affectedRows || 0) };
}

async function refreshCampaignSendCounts({ businessId, campaignId }) {
  if (!hasDatabaseConfig()) return;
  await query(
    `update campaigns c
     set c.sent = (
           select count(*)
           from campaign_recipients cr
           where cr.campaign_id = c.id and cr.status in ('sent', 'delivered', 'read')
         ),
         c.delivered = (
           select count(*)
           from campaign_recipients cr
           where cr.campaign_id = c.id and cr.status in ('delivered', 'read')
         ),
         c.status = case
           when exists (
             select 1 from campaign_recipients cr
             where cr.campaign_id = c.id and cr.status = 'queued'
           ) then 'Sending'
           else 'Sent'
         end
     where c.business_id = :businessId and c.id = :campaignId`,
    { businessId, campaignId }
  );
}

async function selectEligibleContacts(businessId, audience) {
  const audienceClause = audienceFilterSql(audience);
  return query(
    `select id, name, phone, segment
     from contacts
     where business_id = :businessId
       and opted_in = 1
       and opted_out_at is null
       ${audienceClause.sql}
     order by id asc`,
    { businessId, ...audienceClause.params }
  );
}

async function countAudienceContacts(businessId, audience) {
  const audienceClause = audienceFilterSql(audience);
  const rows = await query(
    `select count(*) as total
     from contacts
     where business_id = :businessId
       ${audienceClause.sql}`,
    { businessId, ...audienceClause.params }
  );
  return Number(rows?.[0]?.total || 0);
}

function prepareDemoRecipients({ businessId, campaignId, audience, body }) {
  const audienceContacts = filterAudience(demo.contacts, audience);
  const eligibleContacts = audienceContacts.filter((contact) => contact.optedIn !== false && !contact.optedOutAt);
  const recipients = eligibleContacts.map((contact, index) => ({
    id: index + 1,
    businessId,
    campaignId,
    contactId: contact.id,
    phone: contact.phone,
    status: 'queued',
    personalizedBody: personalizeBody(body, contact)
  }));

  demoCampaignRecipients.set(keyFor(businessId, campaignId), recipients);
  return summary({
    campaignId,
    audience,
    totalContacts: audienceContacts.length,
    eligible: recipients.length,
    excludedOptOut: audienceContacts.length - recipients.length
  });
}

function filterAudience(contacts, audience) {
  const token = audienceToken(audience);
  if (!token) return contacts;
  return contacts.filter((contact) => String(contact.segment || '').toLowerCase().includes(token));
}

function audienceFilterSql(audience) {
  const token = audienceToken(audience);
  if (!token) return { sql: '', params: {} };
  return { sql: 'and lower(segment) like :audienceToken', params: { audienceToken: `%${token}%` } };
}

function audienceToken(audience) {
  const text = String(audience || '').toLowerCase();
  if (!text || text.includes('all')) return '';
  if (text.includes('vip')) return 'vip';
  if (text.includes('inactive')) return 'inactive';
  if (text.includes('recent')) return 'recent';
  return text.replace(/[^a-z0-9]+/g, ' ').trim().split(' ')[0] || '';
}

function personalizeBody(body, contact) {
  const firstName = String(contact.name || '').trim().split(/\s+/)[0] || 'there';
  return String(body || '').replace(/\{\{\s*first_name\s*\}\}/gi, firstName);
}

function statusPatch({ status, providerMessageId, errorMessage }) {
  const now = new Date().toISOString();
  const patch = { status, providerMessageId, errorMessage };
  if (status === 'sent') patch.sentAt = now;
  if (status === 'delivered') patch.deliveredAt = now;
  if (status === 'read') patch.readAt = now;
  if (status === 'failed') patch.failedAt = now;
  return patch;
}

function timestampColumnForStatus(status) {
  if (status === 'sent') return 'sent_at';
  if (status === 'delivered') return 'delivered_at';
  if (status === 'read') return 'read_at';
  if (status === 'failed') return 'failed_at';
  return null;
}

function summary({ campaignId, audience, totalContacts, eligible, excludedOptOut }) {
  return {
    campaignId: Number(campaignId),
    audience,
    totalContacts,
    eligible,
    excludedOptOut,
    status: eligible > 0 ? 'prepared' : 'empty'
  };
}

function keyFor(businessId, campaignId) {
  return `${businessId}:${campaignId}`;
}

module.exports = {
  deleteCampaignRecipientsForSubject,
  findCampaignRecipientByProviderMessageId,
  listCampaignRecipients,
  listQueuedCampaignRecipients,
  personalizeBody,
  prepareCampaignRecipients,
  refreshCampaignSendCounts,
  updateCampaignRecipientStatusByProviderMessageId,
  updateCampaignRecipientStatus
};
