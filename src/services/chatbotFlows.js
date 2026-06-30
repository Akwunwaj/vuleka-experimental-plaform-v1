const { hasDatabaseConfig, query } = require('../db/pool');
const { chatbotFlowLibrary } = require('../data/chatbotFlowLibrary');
const { enforcePlanLimit } = require('./subscriptionPolicy');

const allowedNodeTypes = new Set(['trigger', 'message', 'condition', 'action', 'delay', 'end']);
const demoFlows = new Map();
let demoFlowId = 1000;

function listFlowTemplates({ industryId } = {}) {
  return chatbotFlowLibrary.filter((template) => !industryId || template.industryId === industryId);
}

async function listChatbotFlows(businessId) {
  if (!hasDatabaseConfig()) {
    return [...(demoFlows.get(String(businessId)) || [])].map(flowSummary);
  }

  const rows = await query(
    `select id, business_id as businessId, name, industry_id as industryId,
            industry_name as industryName, status, version, created_at as createdAt,
            updated_at as updatedAt, published_at as publishedAt
     from chatbot_flows
     where business_id = :businessId
     order by updated_at desc, id desc`,
    { businessId }
  );
  return rows.map(normalizeFlowSummary);
}

async function getChatbotFlow(businessId, flowId) {
  if (!hasDatabaseConfig()) {
    const flow = findDemoFlow(businessId, flowId);
    if (!flow) notFound();
    return flow;
  }

  const rows = await query(
    `select id, business_id as businessId, name, industry_id as industryId,
            industry_name as industryName, status, version, definition_json as definition,
            created_at as createdAt, updated_at as updatedAt, published_at as publishedAt
     from chatbot_flows
     where business_id = :businessId and id = :flowId
     limit 1`,
    { businessId, flowId }
  );
  if (!rows?.[0]) notFound();
  return normalizeFlow(rows[0]);
}

async function duplicateFlowTemplate({ businessId, templateId, name }) {
  const template = chatbotFlowLibrary.find((item) => item.id === templateId);
  if (!template) {
    const error = new Error('Flow template not found');
    error.status = 404;
    throw error;
  }
  return createChatbotFlow(businessId, {
    name: name || template.name,
    industryId: template.industryId,
    industryName: template.industryName,
    definition: template.definition
  });
}

async function createChatbotFlow(businessId, payload) {
  await enforcePlanLimit({ businessId, resource: 'chatbotFlows', requested: 1 });
  const definition = normalizeDefinition(payload.definition);
  const validation = validateFlowDefinition(definition);
  const flow = normalizeFlow({
    id: nextDemoFlowId(),
    businessId,
    name: safeName(payload.name),
    industryId: payload.industryId || 'custom',
    industryName: payload.industryName || 'Custom',
    status: 'Draft',
    version: 1,
    definition,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    validation
  });

  if (!hasDatabaseConfig()) {
    const flows = demoFlows.get(String(businessId)) || [];
    flows.unshift(flow);
    demoFlows.set(String(businessId), flows);
    return flow;
  }

  const result = await query(
    `insert into chatbot_flows
       (business_id, name, industry_id, industry_name, status, version, definition_json)
     values
       (:businessId, :name, :industryId, :industryName, 'Draft', 1, :definition)`,
    {
      businessId,
      name: flow.name,
      industryId: flow.industryId,
      industryName: flow.industryName,
      definition: JSON.stringify(definition)
    }
  );
  return getChatbotFlow(businessId, result.insertId);
}

async function updateChatbotFlow({ businessId, flowId, name, definition }) {
  const flow = await getChatbotFlow(businessId, flowId);
  const nextDefinition = definition ? normalizeDefinition(definition) : flow.definition;
  const validation = validateFlowDefinition(nextDefinition);

  if (!hasDatabaseConfig()) {
    Object.assign(flow, {
      name: name ? safeName(name) : flow.name,
      definition: nextDefinition,
      validation,
      status: flow.status === 'Published' ? 'Draft' : flow.status,
      version: Number(flow.version || 1) + 1,
      updatedAt: new Date().toISOString()
    });
    return flow;
  }

  await query(
    `update chatbot_flows
     set name = :name,
         definition_json = :definition,
         status = case when status = 'Published' then 'Draft' else status end,
         version = version + 1
     where business_id = :businessId and id = :flowId`,
    {
      businessId,
      flowId,
      name: name ? safeName(name) : flow.name,
      definition: JSON.stringify(nextDefinition)
    }
  );
  return getChatbotFlow(businessId, flowId);
}

async function publishChatbotFlow({ businessId, flowId }) {
  const flow = await getChatbotFlow(businessId, flowId);
  const validation = validateFlowDefinition(flow.definition);
  if (!validation.valid) {
    const error = new Error('Flow cannot be published until validation errors are fixed');
    error.status = 400;
    error.validation = validation;
    throw error;
  }

  if (!hasDatabaseConfig()) {
    flow.status = 'Published';
    flow.publishedAt = new Date().toISOString();
    flow.updatedAt = flow.publishedAt;
    flow.validation = validation;
    return flow;
  }

  await query(
    `update chatbot_flows
     set status = 'Published', published_at = current_timestamp
     where business_id = :businessId and id = :flowId`,
    { businessId, flowId }
  );
  return getChatbotFlow(businessId, flowId);
}

async function simulateChatbotFlow({ businessId, flowId, input, contact = {} }) {
  const flow = await getChatbotFlow(businessId, flowId);
  const validation = validateFlowDefinition(flow.definition);
  if (!validation.valid) {
    const error = new Error('Flow cannot be simulated until validation errors are fixed');
    error.status = 400;
    error.validation = validation;
    throw error;
  }
  return simulateDefinition(flow.definition, input, contact);
}

async function findPublishedChatbotFlowForInput({ businessId, input }) {
  const text = String(input || '').trim();
  if (!businessId || !text) return null;

  if (!hasDatabaseConfig()) {
    return (
      (demoFlows.get(String(businessId)) || [])
        .filter((flow) => flow.status === 'Published')
        .find((flow) => triggerMatches(flow.definition, text)) || null
    );
  }

  const rows = await query(
    `select id, business_id as businessId, name, industry_id as industryId,
            industry_name as industryName, status, version, definition_json as definition,
            created_at as createdAt, updated_at as updatedAt, published_at as publishedAt
     from chatbot_flows
     where business_id = :businessId and status = 'Published'
     order by published_at desc, updated_at desc, id desc`,
    { businessId }
  );

  return rows.map(normalizeFlow).find((flow) => triggerMatches(flow.definition, text)) || null;
}

function validateFlowDefinition(definition) {
  const errors = [];
  const warnings = [];
  const nodes = definition.nodes || [];
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (!nodes.length) errors.push('Flow must contain at least one node');
  if (!nodeIds.has(definition.startNodeId)) errors.push('Flow startNodeId must reference an existing node');

  for (const node of nodes) {
    if (!node.id) errors.push('Every node requires an id');
    if (!allowedNodeTypes.has(node.type)) errors.push(`Node ${node.id} has unsupported type ${node.type}`);
    if (node.type === 'message' && !String(node.config?.body || '').trim()) errors.push(`Message node ${node.id} requires body text`);
    if (node.type === 'condition') {
      const branches = node.config?.branches || [];
      if (!branches.length) errors.push(`Condition node ${node.id} requires at least one branch`);
      for (const branch of branches) {
        if (!branch.targetNodeId || !nodeIds.has(branch.targetNodeId)) {
          errors.push(`Condition branch ${branch.label || branch.match || 'unnamed'} on ${node.id} must target an existing node`);
        }
      }
    }
  }

  for (const edge of definition.edges || []) {
    if (!nodeIds.has(edge.from)) errors.push(`Edge references missing from node ${edge.from}`);
    if (!nodeIds.has(edge.to)) errors.push(`Edge references missing to node ${edge.to}`);
  }

  for (const node of nodes) {
    if (node.type === 'end') continue;
    if (node.type === 'condition') continue;
    const outgoing = (definition.edges || []).filter((edge) => edge.from === node.id);
    if (!outgoing.length) errors.push(`Node ${node.id} must connect to another node`);
  }

  const reachable = reachableNodeIds(definition);
  for (const node of nodes) {
    if (!reachable.has(node.id)) warnings.push(`Node ${node.id} is not reachable from the start node`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

function simulateDefinition(definition, input, contact = {}) {
  const transcript = [];
  const visited = new Set();
  const nodeById = new Map(definition.nodes.map((node) => [node.id, node]));
  let current = nodeById.get(definition.startNodeId);
  let selectedInput = String(input || '').trim();
  let handoff = false;
  let completed = false;

  while (current && !visited.has(current.id) && transcript.length < 20) {
    visited.add(current.id);
    if (current.type === 'trigger') {
      current = nextNode(definition, current.id, nodeById);
      continue;
    }
    if (current.type === 'message') {
      transcript.push({
        direction: 'bot',
        nodeId: current.id,
        body: personalize(current.config?.body, contact),
        buttons: current.config?.buttons || []
      });
      current = nextNode(definition, current.id, nodeById);
      continue;
    }
    if (current.type === 'condition') {
      transcript.push({ direction: 'user', body: selectedInput || '(no input)' });
      const branch = selectBranch(current, selectedInput);
      current = nodeById.get(branch?.targetNodeId || current.config?.fallbackNodeId);
      selectedInput = '';
      continue;
    }
    if (current.type === 'action') {
      handoff = current.config?.action === 'assign_to_agent';
      transcript.push({
        direction: 'system',
        nodeId: current.id,
        body: handoff ? 'Conversation escalated to the inbox.' : `Action executed: ${current.config?.action || current.name}`
      });
      current = nextNode(definition, current.id, nodeById);
      continue;
    }
    if (current.type === 'delay') {
      transcript.push({ direction: 'system', nodeId: current.id, body: 'Delay skipped in test mode.' });
      current = nextNode(definition, current.id, nodeById);
      continue;
    }
    if (current.type === 'end') {
      completed = true;
      transcript.push({ direction: 'system', nodeId: current.id, body: `Flow ended: ${current.config?.outcome || 'complete'}` });
      break;
    }
  }

  return {
    transcript,
    completed,
    handoff,
    visitedNodeIds: [...visited]
  };
}

function triggerMatches(definition, input) {
  const normalizedInput = normalizeMatchText(input);
  if (!normalizedInput) return false;
  const triggerNodes = (definition.nodes || []).filter((node) => node.type === 'trigger');
  return triggerNodes.some((node) => {
    const keywords = node.config?.keywords || [];
    return keywords.some((keyword) => {
      const normalizedKeyword = normalizeMatchText(keyword);
      return normalizedKeyword && (normalizedInput.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedInput));
    });
  });
}

function normalizeDefinition(definition = {}) {
  return {
    version: Number(definition.version || 1),
    locale: definition.locale || 'en_ZA',
    startNodeId: definition.startNodeId || definition.nodes?.[0]?.id || 'trigger_inbound',
    nodes: (definition.nodes || []).map((node) => ({
      id: String(node.id || '').trim(),
      type: String(node.type || '').trim().toLowerCase(),
      name: String(node.name || node.id || '').trim(),
      config: node.config || {}
    })),
    edges: (definition.edges || []).map((edge) => ({
      from: String(edge.from || '').trim(),
      to: String(edge.to || '').trim(),
      condition: edge.condition || null
    })),
    layout: definition.layout || {}
  };
}

function nextNode(definition, nodeId, nodeById) {
  const edge = (definition.edges || []).find((item) => item.from === nodeId);
  return edge ? nodeById.get(edge.to) : null;
}

function selectBranch(node, input) {
  const normalizedInput = normalizeMatchText(input);
  if (!normalizedInput) return null;
  return (node.config?.branches || []).find((branch) => {
    const match = normalizeMatchText(branch.match || branch.label);
    return normalizedInput.includes(match) || match.includes(normalizedInput);
  });
}

function reachableNodeIds(definition) {
  const reachable = new Set();
  const nodeById = new Map((definition.nodes || []).map((node) => [node.id, node]));
  const stack = [definition.startNodeId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || reachable.has(id) || !nodeById.has(id)) continue;
    reachable.add(id);
    for (const edge of definition.edges || []) {
      if (edge.from === id) stack.push(edge.to);
    }
    const node = nodeById.get(id);
    if (node.type === 'condition') {
      for (const branch of node.config?.branches || []) stack.push(branch.targetNodeId);
      if (node.config?.fallbackNodeId) stack.push(node.config.fallbackNodeId);
    }
  }
  return reachable;
}

function flowSummary(flow) {
  return {
    id: flow.id,
    businessId: flow.businessId,
    name: flow.name,
    industryId: flow.industryId,
    industryName: flow.industryName,
    status: flow.status,
    version: flow.version,
    nodeCount: flow.definition?.nodes?.length || 0,
    updatedAt: flow.updatedAt,
    publishedAt: flow.publishedAt
  };
}

function normalizeFlow(row) {
  const definition = parseJson(row.definition || row.definition_json);
  return {
    ...normalizeFlowSummary(row),
    definition,
    validation: validateFlowDefinition(definition)
  };
}

function normalizeFlowSummary(row) {
  return {
    id: row.id,
    businessId: Number(row.businessId || row.business_id),
    name: row.name,
    industryId: row.industryId || row.industry_id,
    industryName: row.industryName || row.industry_name,
    status: row.status,
    version: Number(row.version || 1),
    updatedAt: row.updatedAt || row.updated_at || null,
    createdAt: row.createdAt || row.created_at || null,
    publishedAt: row.publishedAt || row.published_at || null,
    nodeCount: row.nodeCount || row.node_count || undefined
  };
}

function findDemoFlow(businessId, flowId) {
  return (demoFlows.get(String(businessId)) || []).find((flow) => Number(flow.id) === Number(flowId)) || null;
}

function safeName(name) {
  const value = String(name || '').trim();
  if (!value) {
    const error = new Error('flow name is required');
    error.status = 400;
    throw error;
  }
  return value.slice(0, 180);
}

function personalize(value, contact) {
  return String(value || '').replace(/\{\{\s*first_name\s*\}\}/gi, contact.firstName || contact.name?.split(/\s+/)[0] || 'there');
}

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJson(value) {
  if (!value || typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function nextDemoFlowId() {
  demoFlowId += 1;
  return demoFlowId;
}

function notFound() {
  const error = new Error('Chatbot flow not found');
  error.status = 404;
  throw error;
}

module.exports = {
  createChatbotFlow,
  duplicateFlowTemplate,
  findPublishedChatbotFlowForInput,
  getChatbotFlow,
  listChatbotFlows,
  listFlowTemplates,
  publishChatbotFlow,
  simulateDefinition,
  simulateChatbotFlow,
  triggerMatches,
  updateChatbotFlow,
  validateFlowDefinition
};
