const { hasDatabaseConfig, query } = require('../db/pool');
const {
  findPublishedChatbotFlowForInput,
  getChatbotFlow,
  simulateDefinition
} = require('./chatbotFlows');
const {
  addConversationNote,
  normalizeInboxPhone,
  recordOutboundReply
} = require('./inbox');

const botActor = { id: null, name: 'ChatClan Bot' };
const demoSessions = new Map();
let demoSessionId = 10000;

async function processChatbotInbound({ businessId, event, inbox }) {
  if (!businessId || event?.type !== 'message.received' || !inbox?.conversation || inbox.deduped) {
    return null;
  }

  const input = String(event.text || '').trim();
  if (!input || String(event.messageType || 'text').toLowerCase() !== 'text') {
    return null;
  }

  const customerPhone = normalizeInboxPhone(event.from);
  const conversationId = inbox.conversation.id;
  let session = await findActiveSession({ businessId, customerPhone });
  let flow = null;

  if (session) {
    flow = await getChatbotFlow(businessId, session.flowId);
  } else {
    flow = await findPublishedChatbotFlowForInput({ businessId, input });
    if (!flow) return { matched: false, reason: 'no_published_trigger' };
    session = await createSession({
      businessId,
      flowId: flow.id,
      conversationId,
      customerPhone,
      input
    });
  }

  const simulation = simulateDefinition(flow.definition, input, contactFromConversation(inbox.conversation));
  const replies = [];
  const notes = [];

  for (const line of simulation.transcript) {
    if (line.direction === 'bot') {
      const reply = await recordOutboundReply({
        businessId,
        conversationId,
        body: line.body,
        actorUser: botActor
      });
      replies.push({
        nodeId: line.nodeId,
        body: line.body,
        messageId: reply.message.id,
        providerMessageId: reply.message.providerMessageId || null,
        sendMode: reply.sendResult?.mode || null
      });
    }
  }

  if (simulation.handoff) {
    const note = await addConversationNote({
      businessId,
      conversationId,
      body: `Bot escalation: ${flow.name} handed this conversation to the team.`,
      actorUser: botActor
    });
    notes.push(note);
  }

  const nextStatus = simulation.handoff ? 'handoff' : simulation.completed ? 'completed' : 'active';
  session = await updateSession(session.id, {
    status: nextStatus,
    currentNodeId: simulation.visitedNodeIds.at(-1) || null,
    input,
    context: {
      flowName: flow.name,
      visitedNodeIds: simulation.visitedNodeIds,
      transcriptLength: simulation.transcript.length,
      handoff: simulation.handoff
    }
  });

  return {
    matched: true,
    flowId: flow.id,
    flowName: flow.name,
    session,
    replies,
    notes,
    handoff: simulation.handoff,
    visitedNodeIds: simulation.visitedNodeIds
  };
}

async function findActiveSession({ businessId, customerPhone }) {
  if (!businessId || !customerPhone) return null;

  if (!hasDatabaseConfig()) {
    return [...demoSessions.values()].find((session) => {
      return (
        Number(session.businessId) === Number(businessId) &&
        session.customerPhone === customerPhone &&
        session.status === 'active'
      );
    }) || null;
  }

  const rows = await query(
    `select id, business_id as businessId, flow_id as flowId,
            conversation_id as conversationId, customer_phone as customerPhone,
            status, current_node_id as currentNodeId, context_json as context,
            last_input as lastInput, started_at as startedAt, updated_at as updatedAt,
            completed_at as completedAt
     from chatbot_sessions
     where business_id = :businessId
       and customer_phone = :customerPhone
       and status = 'active'
     order by updated_at desc, id desc
     limit 1`,
    { businessId, customerPhone }
  );
  return rows?.[0] ? normalizeSession(rows[0]) : null;
}

async function createSession({ businessId, flowId, conversationId, customerPhone, input }) {
  const session = normalizeSession({
    id: nextDemoSessionId(),
    businessId,
    flowId,
    conversationId,
    customerPhone,
    status: 'active',
    currentNodeId: null,
    context: {},
    lastInput: input,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null
  });

  if (!hasDatabaseConfig()) {
    demoSessions.set(String(session.id), session);
    return session;
  }

  const result = await query(
    `insert into chatbot_sessions
       (business_id, flow_id, conversation_id, customer_phone, status, current_node_id, context_json, last_input)
     values
       (:businessId, :flowId, :conversationId, :customerPhone, 'active', null, :context, :lastInput)`,
    {
      businessId,
      flowId,
      conversationId,
      customerPhone,
      context: JSON.stringify({}),
      lastInput: input.slice(0, 500)
    }
  );
  return getSession(result.insertId);
}

async function updateSession(sessionId, patch) {
  const completedAt = patch.status === 'active' ? null : new Date();

  if (!hasDatabaseConfig()) {
    const session = demoSessions.get(String(sessionId));
    if (!session) return null;
    Object.assign(session, {
      status: patch.status || session.status,
      currentNodeId: patch.currentNodeId || session.currentNodeId,
      context: patch.context || session.context || {},
      lastInput: patch.input || session.lastInput,
      updatedAt: new Date().toISOString(),
      completedAt: completedAt ? completedAt.toISOString() : session.completedAt
    });
    return normalizeSession(session);
  }

  await query(
    `update chatbot_sessions
     set status = :status,
         current_node_id = :currentNodeId,
         context_json = :context,
         last_input = :lastInput,
         completed_at = :completedAt
     where id = :sessionId`,
    {
      sessionId,
      status: patch.status,
      currentNodeId: patch.currentNodeId || null,
      context: JSON.stringify(patch.context || {}),
      lastInput: String(patch.input || '').slice(0, 500),
      completedAt
    }
  );
  return getSession(sessionId);
}

async function getSession(sessionId) {
  if (!hasDatabaseConfig()) {
    return demoSessions.get(String(sessionId)) || null;
  }

  const rows = await query(
    `select id, business_id as businessId, flow_id as flowId,
            conversation_id as conversationId, customer_phone as customerPhone,
            status, current_node_id as currentNodeId, context_json as context,
            last_input as lastInput, started_at as startedAt, updated_at as updatedAt,
            completed_at as completedAt
     from chatbot_sessions
     where id = :sessionId
     limit 1`,
    { sessionId }
  );
  return rows?.[0] ? normalizeSession(rows[0]) : null;
}

function contactFromConversation(conversation) {
  const name = conversation.customerName || '';
  return {
    name,
    firstName: name.split(/\s+/)[0] || ''
  };
}

function normalizeSession(row) {
  return {
    id: Number(row.id),
    businessId: Number(row.businessId || row.business_id),
    flowId: Number(row.flowId || row.flow_id),
    conversationId: row.conversationId || row.conversation_id || null,
    customerPhone: row.customerPhone || row.customer_phone,
    status: row.status,
    currentNodeId: row.currentNodeId || row.current_node_id || null,
    context: parseJson(row.context || row.context_json),
    lastInput: row.lastInput || row.last_input || null,
    startedAt: row.startedAt || row.started_at || null,
    updatedAt: row.updatedAt || row.updated_at || null,
    completedAt: row.completedAt || row.completed_at || null
  };
}

function parseJson(value) {
  if (!value || typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function nextDemoSessionId() {
  demoSessionId += 1;
  return demoSessionId;
}

module.exports = {
  processChatbotInbound
};
