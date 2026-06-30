const { hasDatabaseConfig, query } = require('../db/pool');

const demoContacts = new Map();
const demoEvents = [];

async function recordOptIn({ businessId, contactId, phone, channel = 'Manual', source = 'Manual', metadata = null }) {
  const contact = await ensureDemoContact({ businessId, contactId, phone });

  if (!hasDatabaseConfig()) {
    contact.optedIn = true;
    contact.optedOutAt = null;
    const event = eventRecord({ businessId, contactId: contact.id, phone: contact.phone, eventType: 'opt_in', channel, source, metadata });
    demoEvents.push(event);
    return event;
  }

  await query(
    `insert into opt_in_events
       (business_id, contact_id, event_type, channel, source, occurred_at, metadata)
     values
       (:businessId, :contactId, 'opt_in', :channel, :source, current_timestamp, :metadata)`,
    {
      businessId,
      contactId,
      channel,
      source,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  );

  await query(
    `update contacts
     set opted_in = 1, opt_in_channel = :channel, opt_in_at = current_timestamp, opted_out_at = null
     where business_id = :businessId and id = :contactId`,
    { businessId, contactId, channel }
  );
}

async function suppressContactByPhone({ businessId, phone, channel = 'WhatsApp reply', source = 'STOP keyword', metadata = null }) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);

  if (!hasDatabaseConfig()) {
    const contact = await ensureDemoContact({ businessId, phone: normalizedPhone });
    contact.optedIn = false;
    contact.optedOutAt = new Date();
    const event = eventRecord({ businessId, contactId: contact.id, phone: normalizedPhone, eventType: 'opt_out', channel, source, metadata });
    demoEvents.push(event);
    return { suppressed: true, contact, event };
  }

  const rows = await query(
    'select id, phone from contacts where business_id = :businessId and phone = :phone limit 1',
    { businessId, phone: normalizedPhone }
  );

  if (!rows?.length) {
    return { suppressed: false, reason: 'contact_not_found', phone: normalizedPhone };
  }

  const contact = rows[0];
  await query(
    `update contacts
     set opted_in = 0, opted_out_at = current_timestamp
     where business_id = :businessId and id = :contactId`,
    { businessId, contactId: contact.id }
  );

  await query(
    `insert into opt_in_events
       (business_id, contact_id, event_type, channel, source, occurred_at, metadata)
     values
       (:businessId, :contactId, 'opt_out', :channel, :source, current_timestamp, :metadata)`,
    {
      businessId,
      contactId: contact.id,
      channel,
      source,
      metadata: metadata ? JSON.stringify(metadata) : null
    }
  );

  return { suppressed: true, contact };
}

async function listConsentEvents(businessId, { contactId } = {}) {
  if (!hasDatabaseConfig()) {
    return demoEvents.filter((event) => {
      return Number(event.businessId) === Number(businessId) && (!contactId || Number(event.contactId) === Number(contactId));
    });
  }

  const contactFilter = contactId ? 'and e.contact_id = :contactId' : '';
  return query(
    `select e.id, e.business_id as businessId, e.contact_id as contactId, c.phone,
            e.event_type as eventType, e.channel, e.source, e.occurred_at as occurredAt
     from opt_in_events e
     join contacts c on c.id = e.contact_id
     where e.business_id = :businessId ${contactFilter}
     order by e.occurred_at desc, e.id desc
     limit 500`,
    { businessId, contactId }
  );
}

async function exportConsentEventsCsv(businessId) {
  const events = await listConsentEvents(businessId);
  const header = ['contact_id', 'phone_masked', 'event_type', 'channel', 'source', 'occurred_at'];
  const rows = events.map((event) => [
    event.contactId,
    maskPhone(event.phone),
    event.eventType,
    event.channel,
    event.source || '',
    event.occurredAt instanceof Date ? event.occurredAt.toISOString() : event.occurredAt
  ]);
  return [header, ...rows].map(csvRow).join('\n');
}

function isStopMessage(text) {
  return /^\s*(stop|unsubscribe|opt\s*out)\s*$/i.test(String(text || ''));
}

function normalizeWhatsAppPhone(phone) {
  const raw = String(phone || '').trim();
  if (raw.startsWith('+')) return raw.replace(/[()\s-]/g, '');
  if (raw.startsWith('27')) return `+${raw}`;
  return raw;
}

function maskPhone(phone) {
  const text = String(phone || '');
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(6, text.length - 4))}${text.slice(-4)}`;
}

async function ensureDemoContact({ businessId, contactId, phone }) {
  const key = contactId ? `${businessId}:id:${contactId}` : `${businessId}:phone:${normalizeWhatsAppPhone(phone)}`;
  if (!demoContacts.has(key)) {
    demoContacts.set(key, {
      id: contactId || demoContacts.size + 1,
      businessId,
      phone: normalizeWhatsAppPhone(phone || '+27821234567'),
      optedIn: true,
      optedOutAt: null
    });
  }
  return demoContacts.get(key);
}

function eventRecord({ businessId, contactId, phone, eventType, channel, source, metadata }) {
  return {
    id: demoEvents.length + 1,
    businessId,
    contactId,
    phone,
    eventType,
    channel,
    source,
    metadata,
    occurredAt: new Date().toISOString()
  };
}

function csvRow(values) {
  return values.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
}

module.exports = {
  exportConsentEventsCsv,
  isStopMessage,
  listConsentEvents,
  maskPhone,
  normalizeWhatsAppPhone,
  recordOptIn,
  suppressContactByPhone
};
