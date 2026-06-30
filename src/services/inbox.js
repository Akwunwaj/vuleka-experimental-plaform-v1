const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { sendTextMessage } = require('./metaClient');
const { publishInboxEvent } = require('./inboxEvents');

const conversationStatuses = new Set(['open', 'resolved']);
const demoConversations = new Map();
const demoMessages = new Map();
const demoNotes = new Map();

function ensureDemoSeed(businessId = 1) {
  if (demoConversations.has(String(businessId))) return;

  const conversations = demo.inbox.map((item, index) => {
    const contact = demo.contacts.find((candidate) => initialsFor(candidate.name) === item.avatar) || demo.contacts[index];
    const conversation = {
      id: item.id,
      businessId,
      contactId: contact?.id || null,
      customerName: item.name,
      customerPhone: normalizeInboxPhone(contact?.phone || `+2782000000${index}`),
      avatar: item.avatar,
      status: 'open',
      assignedUserId: null,
      assignedUserName: null,
      lastMessagePreview: item.preview,
      unreadCount: item.unread || 0,
      lastMessageAt: new Date(Date.now() - index * 1000 * 60 * 12).toISOString(),
      firstResponseDueAt: new Date(Date.now() + (index + 1) * 1000 * 60 * 30).toISOString(),
      firstRespondedAt: null,
      resolvedAt: null,
      csatScore: null,
      csatComment: null,
      csatRequestedAt: null,
      csatReceivedAt: null,
      source: 'whatsapp',
      createdAt: new Date(Date.now() - index * 1000 * 60 * 60).toISOString(),
      updatedAt: new Date(Date.now() - index * 1000 * 60 * 12).toISOString()
    };

    demoMessages.set(keyFor(businessId, conversation.id), [
      {
        id: item.id,
        businessId,
        conversationId: conversation.id,
        direction: 'inbound',
        channel: 'whatsapp',
        providerMessageId: `demo_${item.id}`,
        messageType: 'text',
        body: item.preview,
        status: 'received',
        authorUserId: null,
        authorName: item.name,
        occurredAt: conversation.lastMessageAt,
        metadata: {}
      }
    ]);

    return conversation;
  });

  demoConversations.set(String(businessId), conversations);
}

async function listConversations(businessId, filters = {}) {
  if (!hasDatabaseConfig()) {
    ensureDemoSeed(businessId);
    return sortConversations(filterConversations(demoConversations.get(String(businessId)) || [], filters));
  }

  const where = ['c.business_id = :businessId'];
  const params = { businessId };
  if (filters.status) {
    where.push('c.status = :status');
    params.status = normalizeStatus(filters.status);
  }
  if (filters.assigned === 'unassigned') where.push('c.assigned_user_id is null');
  if (filters.assignedUserId) {
    where.push('c.assigned_user_id = :assignedUserId');
    params.assignedUserId = filters.assignedUserId;
  }

  const rows = await query(
    `select c.id, c.business_id as businessId, c.contact_id as contactId,
            c.customer_name as customerName, c.customer_phone as customerPhone,
            c.status, c.assigned_user_id as assignedUserId, u.name as assignedUserName,
            c.last_message_preview as lastMessagePreview, c.unread_count as unreadCount,
            c.last_message_at as lastMessageAt, c.source, c.created_at as createdAt,
            c.first_response_due_at as firstResponseDueAt, c.first_responded_at as firstRespondedAt,
            c.resolved_at as resolvedAt, c.csat_score as csatScore, c.csat_comment as csatComment,
            c.csat_requested_at as csatRequestedAt, c.csat_received_at as csatReceivedAt,
            c.updated_at as updatedAt
     from inbox_conversations c
     left join users u on u.id = c.assigned_user_id
     where ${where.join(' and ')}
     order by c.last_message_at desc, c.id desc
     limit 200`,
    params
  );

  return rows.map(normalizeConversation);
}

async function getConversation(businessId, conversationId) {
  const conversation = await findConversationById(businessId, conversationId);
  if (!conversation) notFound();
  return {
    conversation,
    messages: await listMessages(businessId, conversationId),
    notes: await listConversationNotes(businessId, conversationId)
  };
}

async function recordInboundMessage({ businessId, event }) {
  if (!businessId || !event || event.type !== 'message.received') return null;
  const providerMessageId = event.messageId || null;
  if (providerMessageId && (await findMessageByProviderId(businessId, providerMessageId))) {
    return { deduped: true, providerMessageId };
  }

  const phone = normalizeInboxPhone(event.from);
  const body = messageBodyFromEvent(event);
  const occurredAt = new Date();
  const contact = await findContactByPhone(businessId, phone);

  if (!hasDatabaseConfig()) {
    const conversation = upsertDemoConversation({
      businessId,
      contact,
      phone,
      body,
      occurredAt,
      customerName: event.raw?.profile?.name
    });
    const message = appendDemoMessage({
      businessId,
      conversationId: conversation.id,
      direction: 'inbound',
      providerMessageId,
      messageType: event.messageType || 'text',
      body,
      status: 'received',
      authorName: conversation.customerName,
      occurredAt,
      metadata: event.raw || {}
    });
    const result = { conversation: normalizeConversation(conversation), message };
    publishInboxEvent(businessId, { type: 'conversation.message.received', conversation, message });
    return result;
  }

  const conversation = await upsertDatabaseConversation({
    businessId,
    contact,
    phone,
    body,
    occurredAt,
    customerName: event.raw?.profile?.name
  });
  const message = await insertDatabaseMessage({
    businessId,
    conversationId: conversation.id,
    direction: 'inbound',
    providerMessageId,
    messageType: event.messageType || 'text',
    body,
    status: 'received',
    authorUserId: null,
    occurredAt,
    metadata: event.raw || {}
  });

  const result = { conversation: normalizeConversation(conversation), message };
  publishInboxEvent(businessId, { type: 'conversation.message.received', conversation: result.conversation, message });
  return result;
}

async function recordMessageStatus({ businessId, providerMessageId, status, metadata = {} }) {
  if (!businessId || !providerMessageId) return null;
  const normalizedStatus = normalizeMessageStatus(status);

  if (!hasDatabaseConfig()) {
    ensureDemoSeed(businessId);
    for (const messages of demoMessages.values()) {
      const message = messages.find((item) => item.providerMessageId === providerMessageId && Number(item.businessId) === Number(businessId));
      if (message) {
        message.status = normalizedStatus;
        message.metadata = { ...message.metadata, statusMetadata: metadata };
        publishInboxEvent(businessId, { type: 'conversation.message.status', conversationId: message.conversationId, message });
        return { updated: true, message };
      }
    }
    return { updated: false };
  }

  const result = await query(
    `update inbox_messages
     set status = :status,
         metadata = :metadata
     where business_id = :businessId and provider_message_id = :providerMessageId`,
    {
      businessId,
      providerMessageId,
      status: normalizedStatus,
      metadata: JSON.stringify(metadata)
    }
  );

  const updated = Boolean(result.affectedRows);
  if (updated) publishInboxEvent(businessId, { type: 'conversation.message.status', providerMessageId, status: normalizedStatus });
  return { updated };
}

async function updateConversation({ businessId, conversationId, assignedUserId, status, markRead = false }) {
  const conversation = await findConversationById(businessId, conversationId);
  if (!conversation) notFound();

  const patch = {};
  if (status !== undefined) patch.status = normalizeStatus(status);
  if (assignedUserId !== undefined) patch.assignedUserId = assignedUserId ? Number(assignedUserId) : null;
  if (markRead) patch.unreadCount = 0;
  if (patch.status === 'resolved') {
    patch.resolvedAt = new Date().toISOString();
    patch.csatRequestedAt = new Date().toISOString();
  } else if (patch.status === 'open' && conversation.status === 'resolved') {
    patch.resolvedAt = null;
  }
  if (!Object.keys(patch).length) return conversation;

  if (!hasDatabaseConfig()) {
    Object.assign(conversation, patch, { updatedAt: new Date().toISOString() });
    const updated = normalizeConversation(conversation);
    publishInboxEvent(businessId, { type: 'conversation.updated', conversation: updated });
    return updated;
  }

  if (patch.assignedUserId) {
    await assertUserBelongsToBusiness(businessId, patch.assignedUserId);
  }

  await query(
    `update inbox_conversations
     set status = coalesce(:status, status),
         assigned_user_id = :assignedUserId,
         unread_count = case when :markRead = 1 then 0 else unread_count end,
         resolved_at = case
           when :status = 'resolved' then :resolvedAt
           when :status = 'open' then null
           else resolved_at
         end,
         csat_requested_at = case when :status = 'resolved' then :csatRequestedAt else csat_requested_at end
     where business_id = :businessId and id = :conversationId`,
    {
      businessId,
      conversationId,
      status: patch.status || null,
      assignedUserId: assignedUserId === undefined ? conversation.assignedUserId : patch.assignedUserId,
      markRead: markRead ? 1 : 0,
      resolvedAt: patch.resolvedAt || null,
      csatRequestedAt: patch.csatRequestedAt || null
    }
  );

  const updated = await findConversationById(businessId, conversationId);
  publishInboxEvent(businessId, { type: 'conversation.updated', conversation: updated });
  return updated;
}

async function recordOutboundReply({ businessId, conversationId, body, actorUser }) {
  const text = String(body || '').trim();
  if (!text) {
    const error = new Error('reply body is required');
    error.status = 400;
    throw error;
  }

  const conversation = await findConversationById(businessId, conversationId);
  if (!conversation) notFound();

  const sendResult = await sendTextMessage({
    businessId,
    to: conversation.customerPhone.replace(/^\+/, ''),
    text
  });
  const occurredAt = new Date();

  if (!hasDatabaseConfig()) {
    conversation.lastMessagePreview = text;
    conversation.lastMessageAt = occurredAt.toISOString();
    conversation.unreadCount = 0;
    conversation.status = 'open';
    conversation.firstRespondedAt = conversation.firstRespondedAt || occurredAt.toISOString();
    conversation.assignedUserId = actorUser?.id || conversation.assignedUserId;
    conversation.assignedUserName = actorUser?.name || conversation.assignedUserName;
    conversation.updatedAt = occurredAt.toISOString();
    const message = appendDemoMessage({
      businessId,
      conversationId: conversation.id,
      direction: 'outbound',
      providerMessageId: sendResult.messageId || null,
      messageType: 'text',
      body: text,
      status: sendResult.messageId ? 'sent' : 'queued',
      authorUserId: actorUser?.id || null,
      authorName: actorUser?.name || 'Agent',
      occurredAt,
      metadata: { sendMode: sendResult.mode }
    });
    const result = { conversation: normalizeConversation(conversation), message, sendResult };
    publishInboxEvent(businessId, { type: 'conversation.message.sent', conversation: result.conversation, message });
    return result;
  }

  const message = await insertDatabaseMessage({
    businessId,
    conversationId,
    direction: 'outbound',
    providerMessageId: sendResult.messageId || null,
    messageType: 'text',
    body: text,
    status: sendResult.messageId ? 'sent' : 'queued',
    authorUserId: actorUser?.id || null,
    occurredAt,
    metadata: { sendMode: sendResult.mode }
  });

  await query(
    `update inbox_conversations
     set status = 'open',
         assigned_user_id = coalesce(assigned_user_id, :actorUserId),
         first_responded_at = coalesce(first_responded_at, :firstRespondedAt),
         last_message_preview = :preview,
         last_message_at = :lastMessageAt,
         unread_count = 0
     where business_id = :businessId and id = :conversationId`,
    {
      businessId,
      conversationId,
      actorUserId: actorUser?.id || null,
      firstRespondedAt: occurredAt,
      preview: preview(text),
      lastMessageAt: occurredAt
    }
  );

  const result = {
    conversation: await findConversationById(businessId, conversationId),
    message,
    sendResult
  };
  publishInboxEvent(businessId, { type: 'conversation.message.sent', conversation: result.conversation, message });
  return result;
}

async function listConversationNotes(businessId, conversationId) {
  await assertConversationExists(businessId, conversationId);
  if (!hasDatabaseConfig()) {
    return sortNotes(demoNotes.get(keyFor(businessId, conversationId)) || []);
  }

  const rows = await query(
    `select n.id, n.business_id as businessId, n.conversation_id as conversationId,
            n.body, n.author_user_id as authorUserId, u.name as authorName,
            n.created_at as createdAt
     from inbox_notes n
     left join users u on u.id = n.author_user_id
     where n.business_id = :businessId and n.conversation_id = :conversationId
     order by n.created_at asc, n.id asc
     limit 200`,
    { businessId, conversationId }
  );

  return rows;
}

async function addConversationNote({ businessId, conversationId, body, actorUser }) {
  const text = String(body || '').trim();
  if (!text) {
    const error = new Error('note body is required');
    error.status = 400;
    throw error;
  }
  const conversation = await assertConversationExists(businessId, conversationId);
  const occurredAt = new Date();

  if (!hasDatabaseConfig()) {
    const notes = demoNotes.get(keyFor(businessId, conversationId)) || [];
    const note = {
      id: Date.now() + notes.length,
      businessId,
      conversationId: Number(conversationId),
      body: text,
      authorUserId: actorUser?.id || null,
      authorName: actorUser?.name || 'Agent',
      createdAt: occurredAt.toISOString()
    };
    notes.push(note);
    demoNotes.set(keyFor(businessId, conversationId), notes);
    publishInboxEvent(businessId, { type: 'conversation.note.created', conversation, note });
    return note;
  }

  const result = await query(
    `insert into inbox_notes
       (business_id, conversation_id, body, author_user_id, created_at)
     values
       (:businessId, :conversationId, :body, :authorUserId, :createdAt)`,
    {
      businessId,
      conversationId,
      body: text,
      authorUserId: actorUser?.id || null,
      createdAt: occurredAt
    }
  );
  const note = {
    id: result.insertId,
    businessId,
    conversationId: Number(conversationId),
    body: text,
    authorUserId: actorUser?.id || null,
    authorName: actorUser?.name || null,
    createdAt: occurredAt
  };
  publishInboxEvent(businessId, { type: 'conversation.note.created', conversation, note });
  return note;
}

async function recordTypingIndicator({ businessId, conversationId, actorUser, isTyping }) {
  const conversation = await assertConversationExists(businessId, conversationId);
  return publishInboxEvent(businessId, {
    type: 'conversation.typing',
    conversationId: Number(conversationId),
    conversation,
    user: actorUser ? { id: actorUser.id, name: actorUser.name } : null,
    isTyping: isTyping !== false
  });
}

async function recordConversationCsat({ businessId, conversationId, score, comment }) {
  const conversation = await assertConversationExists(businessId, conversationId);
  const normalizedScore = Number(score);
  if (!Number.isInteger(normalizedScore) || normalizedScore < 1 || normalizedScore > 5) {
    const error = new Error('CSAT score must be an integer from 1 to 5');
    error.status = 400;
    throw error;
  }
  const receivedAt = new Date();
  const text = String(comment || '').trim() || null;

  if (!hasDatabaseConfig()) {
    Object.assign(conversation, {
      csatScore: normalizedScore,
      csatComment: text,
      csatReceivedAt: receivedAt.toISOString(),
      updatedAt: receivedAt.toISOString()
    });
    const updated = normalizeConversation(conversation);
    publishInboxEvent(businessId, { type: 'conversation.csat.received', conversation: updated });
    return updated;
  }

  await query(
    `update inbox_conversations
     set csat_score = :score,
         csat_comment = :comment,
         csat_received_at = :receivedAt
     where business_id = :businessId and id = :conversationId`,
    { businessId, conversationId, score: normalizedScore, comment: text, receivedAt }
  );
  const updated = await findConversationById(businessId, conversationId);
  publishInboxEvent(businessId, { type: 'conversation.csat.received', conversation: updated });
  return updated;
}

async function redactInboxDataForSubject({ businessId, contactId = null, phone = null, requestId }) {
  const normalizedPhone = phone ? normalizeInboxPhone(phone) : null;
  const redactedPreview = '[deleted by POPIA request]';

  if (!hasDatabaseConfig()) {
    ensureDemoSeed(businessId);
    const conversations = demoConversations.get(String(businessId)) || [];
    const matched = conversations.filter((conversation) => {
      return (
        (contactId && Number(conversation.contactId) === Number(contactId)) ||
        (normalizedPhone && conversation.customerPhone === normalizedPhone)
      );
    });
    let messageCount = 0;
    let noteCount = 0;
    for (const conversation of matched) {
      conversation.customerName = 'Deleted contact';
      conversation.customerPhone = deletedSubjectKey(requestId, conversation.id);
      conversation.lastMessagePreview = redactedPreview;
      conversation.unreadCount = 0;
      conversation.updatedAt = new Date().toISOString();
      const messages = demoMessages.get(keyFor(businessId, conversation.id)) || [];
      messages.forEach((message) => {
        message.body = redactedPreview;
        message.authorName = message.direction === 'inbound' ? 'Deleted contact' : message.authorName;
        message.metadata = { redactedBy: 'data_deletion_request', requestId };
        messageCount += 1;
      });
      const notes = demoNotes.get(keyFor(businessId, conversation.id)) || [];
      notes.forEach((note) => {
        note.body = redactedPreview;
        noteCount += 1;
      });
      publishInboxEvent(businessId, { type: 'conversation.updated', conversation: normalizeConversation(conversation) });
    }
    return { conversations: matched.length, messages: messageCount, notes: noteCount };
  }

  const where = ['business_id = :businessId'];
  const params = { businessId, contactId, phone: normalizedPhone, requestId, redactedPreview };
  if (contactId) where.push('contact_id = :contactId');
  if (normalizedPhone) where.push('customer_phone = :phone');
  if (where.length === 1) return { conversations: 0, messages: 0, notes: 0 };

  const conversations = await query(
    `select id
     from inbox_conversations
     where ${where.join(' and ')}`,
    params
  );
  const ids = (conversations || []).map((conversation) => Number(conversation.id));
  if (!ids.length) return { conversations: 0, messages: 0, notes: 0 };

  let messageCount = 0;
  let noteCount = 0;
  for (const conversationId of ids) {
    const deletedPhone = deletedSubjectKey(requestId, conversationId);
    await query(
      `update inbox_conversations
       set customer_name = 'Deleted contact',
           customer_phone = :deletedPhone,
           last_message_preview = :redactedPreview,
           unread_count = 0,
           contact_id = null
       where business_id = :businessId and id = :conversationId`,
      { businessId, conversationId, deletedPhone, redactedPreview }
    );
    const messageResult = await query(
      `update inbox_messages
       set body = :redactedPreview,
           metadata = :metadata
       where business_id = :businessId and conversation_id = :conversationId`,
      {
        businessId,
        conversationId,
        redactedPreview,
        metadata: JSON.stringify({ redactedBy: 'data_deletion_request', requestId })
      }
    );
    const noteResult = await query(
      `update inbox_notes
       set body = :redactedPreview
       where business_id = :businessId and conversation_id = :conversationId`,
      { businessId, conversationId, redactedPreview }
    );
    messageCount += Number(messageResult?.affectedRows || 0);
    noteCount += Number(noteResult?.affectedRows || 0);
    publishInboxEvent(businessId, { type: 'conversation.updated', conversationId });
  }

  return { conversations: ids.length, messages: messageCount, notes: noteCount };
}

async function listMessages(businessId, conversationId) {
  if (!hasDatabaseConfig()) {
    ensureDemoSeed(businessId);
    return demoMessages.get(keyFor(businessId, conversationId)) || [];
  }

  const rows = await query(
    `select m.id, m.business_id as businessId, m.conversation_id as conversationId,
            m.direction, m.channel, m.provider_message_id as providerMessageId,
            m.message_type as messageType, m.body, m.status, m.author_user_id as authorUserId,
            u.name as authorName, m.occurred_at as occurredAt, m.metadata
     from inbox_messages m
     left join users u on u.id = m.author_user_id
     where m.business_id = :businessId and m.conversation_id = :conversationId
     order by m.occurred_at asc, m.id asc
     limit 500`,
    { businessId, conversationId }
  );

  return rows.map(normalizeMessage);
}

async function findConversationById(businessId, conversationId) {
  if (!hasDatabaseConfig()) {
    ensureDemoSeed(businessId);
    return (demoConversations.get(String(businessId)) || []).find((item) => Number(item.id) === Number(conversationId)) || null;
  }

  const rows = await query(
    `select c.id, c.business_id as businessId, c.contact_id as contactId,
            c.customer_name as customerName, c.customer_phone as customerPhone,
            c.status, c.assigned_user_id as assignedUserId, u.name as assignedUserName,
            c.last_message_preview as lastMessagePreview, c.unread_count as unreadCount,
            c.last_message_at as lastMessageAt, c.source, c.created_at as createdAt,
            c.first_response_due_at as firstResponseDueAt, c.first_responded_at as firstRespondedAt,
            c.resolved_at as resolvedAt, c.csat_score as csatScore, c.csat_comment as csatComment,
            c.csat_requested_at as csatRequestedAt, c.csat_received_at as csatReceivedAt,
            c.updated_at as updatedAt
     from inbox_conversations c
     left join users u on u.id = c.assigned_user_id
     where c.business_id = :businessId and c.id = :conversationId
     limit 1`,
    { businessId, conversationId }
  );
  return rows?.[0] ? normalizeConversation(rows[0]) : null;
}

async function findMessageByProviderId(businessId, providerMessageId) {
  if (!providerMessageId) return null;
  if (!hasDatabaseConfig()) {
    ensureDemoSeed(businessId);
    for (const messages of demoMessages.values()) {
      const message = messages.find((item) => item.providerMessageId === providerMessageId && Number(item.businessId) === Number(businessId));
      if (message) return message;
    }
    return null;
  }

  const rows = await query(
    `select id from inbox_messages
     where business_id = :businessId and provider_message_id = :providerMessageId
     limit 1`,
    { businessId, providerMessageId }
  );
  return rows?.[0] || null;
}

async function findContactByPhone(businessId, phone) {
  if (!hasDatabaseConfig()) {
    return demo.contacts.find((contact) => normalizeInboxPhone(contact.phone) === phone) || null;
  }

  const rows = await query(
    `select id, name, phone
     from contacts
     where business_id = :businessId
       and replace(replace(replace(phone, ' ', ''), '-', ''), '(', '') = :phone
     limit 1`,
    { businessId, phone }
  );
  return rows?.[0] || null;
}

async function upsertDatabaseConversation({ businessId, contact, phone, body, occurredAt, customerName }) {
  const firstResponseDueAt = firstResponseDueAtFor(occurredAt);
  const result = await query(
    `insert into inbox_conversations
       (business_id, contact_id, customer_name, customer_phone, status, last_message_preview, last_message_at, unread_count, first_response_due_at, source)
     values
       (:businessId, :contactId, :customerName, :customerPhone, 'open', :preview, :lastMessageAt, 1, :firstResponseDueAt, 'whatsapp')
     on duplicate key update
       id = last_insert_id(id),
       contact_id = coalesce(values(contact_id), contact_id),
       customer_name = coalesce(values(customer_name), customer_name),
       first_response_due_at = case
         when status = 'resolved' or (first_response_due_at is null and first_responded_at is null) then values(first_response_due_at)
         else first_response_due_at
       end,
       first_responded_at = case when status = 'resolved' then null else first_responded_at end,
       resolved_at = null,
       status = 'open',
       last_message_preview = values(last_message_preview),
       last_message_at = values(last_message_at),
       unread_count = unread_count + 1`,
    {
      businessId,
      contactId: contact?.id || null,
      customerName: customerName || contact?.name || phone,
      customerPhone: phone,
      preview: preview(body),
      lastMessageAt: occurredAt,
      firstResponseDueAt
    }
  );

  return findConversationById(businessId, result.insertId);
}

async function insertDatabaseMessage({ businessId, conversationId, direction, providerMessageId, messageType, body, status, authorUserId, occurredAt, metadata }) {
  const result = await query(
    `insert into inbox_messages
       (business_id, conversation_id, direction, channel, provider_message_id, message_type, body, status, author_user_id, occurred_at, metadata)
     values
       (:businessId, :conversationId, :direction, 'whatsapp', :providerMessageId, :messageType, :body, :status, :authorUserId, :occurredAt, :metadata)`,
    {
      businessId,
      conversationId,
      direction,
      providerMessageId,
      messageType,
      body,
      status,
      authorUserId,
      occurredAt,
      metadata: JSON.stringify(metadata || {})
    }
  );

  return {
    id: result.insertId,
    businessId,
    conversationId: Number(conversationId),
    direction,
    channel: 'whatsapp',
    providerMessageId,
    messageType,
    body,
    status,
    authorUserId,
    authorName: null,
    occurredAt,
    metadata: metadata || {}
  };
}

function upsertDemoConversation({ businessId, contact, phone, body, occurredAt, customerName }) {
  ensureDemoSeed(businessId);
  const conversations = demoConversations.get(String(businessId));
  let conversation = conversations.find((item) => item.customerPhone === phone);
  if (!conversation) {
    conversation = {
      id: Date.now(),
      businessId,
      contactId: contact?.id || null,
      customerName: customerName || contact?.name || phone,
      customerPhone: phone,
      avatar: initialsFor(customerName || contact?.name || phone),
      status: 'open',
      assignedUserId: null,
      assignedUserName: null,
      lastMessagePreview: '',
      unreadCount: 0,
      lastMessageAt: null,
      firstResponseDueAt: firstResponseDueAtFor(occurredAt).toISOString(),
      firstRespondedAt: null,
      resolvedAt: null,
      csatScore: null,
      csatComment: null,
      csatRequestedAt: null,
      csatReceivedAt: null,
      source: 'whatsapp',
      createdAt: occurredAt.toISOString(),
      updatedAt: occurredAt.toISOString()
    };
    conversations.unshift(conversation);
    demoMessages.set(keyFor(businessId, conversation.id), []);
  }

  if (conversation.status === 'resolved') {
    conversation.firstResponseDueAt = firstResponseDueAtFor(occurredAt).toISOString();
    conversation.firstRespondedAt = null;
    conversation.resolvedAt = null;
  } else if (!conversation.firstResponseDueAt && !conversation.firstRespondedAt) {
    conversation.firstResponseDueAt = firstResponseDueAtFor(occurredAt).toISOString();
  }
  conversation.status = 'open';
  conversation.lastMessagePreview = preview(body);
  conversation.lastMessageAt = occurredAt.toISOString();
  conversation.unreadCount += 1;
  conversation.updatedAt = occurredAt.toISOString();
  return conversation;
}

function appendDemoMessage({ businessId, conversationId, direction, providerMessageId, messageType, body, status, authorUserId = null, authorName = null, occurredAt, metadata }) {
  const messages = demoMessages.get(keyFor(businessId, conversationId)) || [];
  const message = {
    id: Date.now() + messages.length,
    businessId,
    conversationId,
    direction,
    channel: 'whatsapp',
    providerMessageId,
    messageType,
    body,
    status,
    authorUserId,
    authorName,
    occurredAt: occurredAt.toISOString(),
    metadata
  };
  messages.push(message);
  demoMessages.set(keyFor(businessId, conversationId), messages);
  return message;
}

async function assertUserBelongsToBusiness(businessId, userId) {
  const rows = await query(
    `select 1
     from business_memberships bm
     join users u on u.id = bm.user_id
     where bm.business_id = :businessId and bm.user_id = :userId and u.status = 'active'
     limit 1`,
    { businessId, userId }
  );
  if (!rows?.length) {
    const error = new Error('Assigned user must belong to this workspace');
    error.status = 400;
    throw error;
  }
}

function filterConversations(conversations, filters) {
  return conversations.filter((conversation) => {
    if (filters.status && conversation.status !== normalizeStatus(filters.status)) return false;
    if (filters.assigned === 'unassigned' && conversation.assignedUserId) return false;
    if (filters.assignedUserId && Number(conversation.assignedUserId) !== Number(filters.assignedUserId)) return false;
    return true;
  });
}

function sortConversations(conversations) {
  return [...conversations].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

function normalizeConversation(conversation) {
  const normalized = {
    ...conversation,
    unreadCount: Number(conversation.unreadCount || conversation.unread_count || 0),
    csatScore: conversation.csatScore === null || conversation.csatScore === undefined ? null : Number(conversation.csatScore),
    avatar: conversation.avatar || initialsFor(conversation.customerName || conversation.customerPhone)
  };
  normalized.slaStatus = slaStatusFor(normalized);
  return normalized;
}

function normalizeMessage(message) {
  return {
    ...message,
    metadata: parseJson(message.metadata)
  };
}

function normalizeStatus(status) {
  const normalized = String(status || 'open').trim().toLowerCase();
  if (conversationStatuses.has(normalized)) return normalized;
  const error = new Error('conversation status must be open or resolved');
  error.status = 400;
  throw error;
}

function normalizeMessageStatus(status) {
  const normalized = String(status || 'received').trim().toLowerCase();
  if (['queued', 'sent', 'delivered', 'read', 'failed', 'received'].includes(normalized)) return normalized;
  return 'received';
}

function normalizeInboxPhone(phone) {
  const compact = String(phone || '').replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('27')) return `+${compact}`;
  if (compact.startsWith('0')) return `+27${compact.slice(1)}`;
  return compact ? `+${compact}` : '';
}

function messageBodyFromEvent(event) {
  if (event.text) return String(event.text);
  if (event.messageType) return `[${event.messageType} message]`;
  return '[message]';
}

function preview(text) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function firstResponseDueAtFor(date) {
  const minutes = Number(process.env.INBOX_FIRST_RESPONSE_SLA_MINUTES || 60);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  return new Date(new Date(date).getTime() + safeMinutes * 60 * 1000);
}

function slaStatusFor(conversation) {
  if (conversation.status === 'resolved') return 'resolved';
  if (conversation.firstRespondedAt) return 'responded';
  if (!conversation.firstResponseDueAt) return 'not_started';
  const dueAt = new Date(conversation.firstResponseDueAt).getTime();
  if (!Number.isFinite(dueAt)) return 'not_started';
  const remainingMs = dueAt - Date.now();
  if (remainingMs < 0) return 'breached';
  if (remainingMs <= 15 * 60 * 1000) return 'due_soon';
  return 'on_track';
}

async function assertConversationExists(businessId, conversationId) {
  const conversation = await findConversationById(businessId, conversationId);
  if (!conversation) notFound();
  return conversation;
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function initialsFor(name) {
  return String(name || 'CC')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CC';
}

function keyFor(businessId, conversationId) {
  return `${businessId}:${conversationId}`;
}

function deletedSubjectKey(requestId, suffix) {
  return `deleted:${String(requestId || 'request').slice(-8)}:${suffix}`;
}

function parseJson(value) {
  if (!value || typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function notFound() {
  const error = new Error('Conversation not found');
  error.status = 404;
  throw error;
}

module.exports = {
  addConversationNote,
  getConversation,
  listConversationNotes,
  listConversations,
  normalizeInboxPhone,
  redactInboxDataForSubject,
  recordConversationCsat,
  recordInboundMessage,
  recordMessageStatus,
  recordOutboundReply,
  recordTypingIndicator,
  updateConversation
};
