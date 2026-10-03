const crypto = require('crypto');
const { enqueueJob } = require('./jobQueue');
const { getPublicLead, setPublicLeadCrmDelivery } = require('./publicLeads');
const { getCrmConfiguration } = require('./crmConfiguration');

function getPublicLeadCrmStatus() {
  const provider = normalizeProvider(process.env.CRM_LEAD_PROVIDER);
  const configured = provider === 'hubspot'
    ? Boolean(process.env.CRM_HUBSPOT_ACCESS_TOKEN)
    : process.env.CRM_LEAD_WEBHOOK_ENABLED === 'true' && Boolean(process.env.CRM_LEAD_WEBHOOK_URL && process.env.CRM_LEAD_WEBHOOK_SECRET);
  let destination = '';
  if (configured && provider === 'hubspot') destination = 'HubSpot';
  if (configured && provider === 'webhook') {
    try { destination = new URL(process.env.CRM_LEAD_WEBHOOK_URL).host; } catch { destination = 'invalid'; }
  }
  return { configured, destination, provider };
}

async function queuePublicLeadCrmDelivery(leadId, { force = false } = {}) {
  const status = await getResolvedCrmStatus();
  if (!status.configured) return { queued:false, reason:'not_configured' };
  const lead = await getPublicLead(leadId);
  if (lead.crmDeliveryStatus === 'delivered' && !force) return { queued:false, reason:'already_delivered' };
  await setPublicLeadCrmDelivery({ leadId:lead.id, status:'pending', detail:force ? 'Manual CRM delivery queued.' : 'CRM delivery queued.' });
  return enqueueJob({
    type:'public.lead.crm_deliver',
    payload:{ leadId:lead.id },
    maxAttempts:5,
    dedupeKey:`public-lead-crm:${lead.id}:${force ? Date.now() : 'initial'}`
  });
}

async function deliverPublicLeadWebhook({ leadId }, options = {}) {
  const status = options.runtimeConfig || await getResolvedCrmStatus(true);
  if (!status.configured) return { delivered:false, reason:'not_configured' };
  const endpoint = validateEndpoint(status.webhookUrl || process.env.CRM_LEAD_WEBHOOK_URL);
  const lead = await getPublicLead(leadId);
  const deliveryId = crypto.randomUUID();
  const event = {
    id:deliveryId,
    type:'public_lead.created',
    occurredAt:new Date().toISOString(),
    data:crmLeadPayload(lead)
  };
  const body = JSON.stringify(event);
  const signature = `sha256=${crypto.createHmac('sha256', status.webhookSecret || process.env.CRM_LEAD_WEBHOOK_SECRET).update(body).digest('hex')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), normalizeTimeout(process.env.CRM_LEAD_WEBHOOK_TIMEOUT_MS));
  try {
    const response = await (options.fetchImpl || fetch)(endpoint, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'User-Agent':'ChatClan-Lead-Webhook/1.0',
        'X-ChatClan-Delivery':deliveryId,
        'X-ChatClan-Event':'public_lead.created',
        'X-ChatClan-Signature':signature
      },
      body,
      signal:controller.signal
    });
    if (!response.ok) {
      const error = new Error(`CRM webhook returned HTTP ${response.status}`);
      error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw error;
    }
    const deliveredAt = new Date().toISOString();
    await setPublicLeadCrmDelivery({ leadId:lead.id, status:'delivered', deliveredAt, detail:`CRM delivery ${deliveryId} accepted.` });
    return { delivered:true, deliveryId, status:response.status, deliveredAt };
  } catch (error) {
    const message = error.name === 'AbortError' ? 'CRM webhook timed out.' : String(error.message || error);
    await setPublicLeadCrmDelivery({ leadId:lead.id, status:'failed', detail:message.slice(0, 500) });
    if (error.name === 'AbortError') error.retryable = true;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function deliverPublicLeadToCrm(payload, options = {}) {
  const status = await getResolvedCrmStatus(true);
  if (status.provider === 'hubspot') return deliverPublicLeadToHubSpot(payload, { ...options, runtimeConfig:status });
  return deliverPublicLeadWebhook(payload, { ...options, runtimeConfig:status });
}

async function deliverPublicLeadToHubSpot({ leadId }, options = {}) {
  const status = options.runtimeConfig || await getResolvedCrmStatus(true);
  if (!status.configured || status.provider !== 'hubspot') return { delivered:false, reason:'not_configured' };
  const lead = await getPublicLead(leadId);
  try {
    const runtimeOptions = { ...options, accessToken:status.accessToken || process.env.CRM_HUBSPOT_ACCESS_TOKEN };
    const contactResult = await hubspotRequest('/crm/v3/objects/contacts/batch/upsert', {
      method:'POST',
      body:{ inputs:[{ idProperty:'email', id:lead.email, properties:hubspotContactProperties(lead) }] }
    }, runtimeOptions);
    const contactId = String(contactResult.results?.[0]?.id || '');
    if (!contactId) throw permanentError('HubSpot contact upsert did not return a contact identifier.');

    if (status.hubspotDeliveryMode !== 'contacts_and_leads') {
      const deliveredAt = new Date().toISOString();
      await setPublicLeadCrmDelivery({ leadId:lead.id, status:'delivered', deliveredAt, detail:`HubSpot contact ${contactId} synchronised in contacts-only mode.` });
      return { delivered:true, provider:'hubspot', mode:'contacts_only', contactId, deliveredAt };
    }

    const leadName = `ChatClan ${lead.reference}`;
    const search = await hubspotRequest('/crm/v3/objects/leads/search', {
      method:'POST',
      body:{ filterGroups:[{ filters:[{ propertyName:'hs_lead_name', operator:'EQ', value:leadName }] }], properties:['hs_lead_name'], limit:1 }
    }, runtimeOptions);
    let hubspotLeadId = String(search.results?.[0]?.id || '');
    if (!hubspotLeadId) {
      const created = await hubspotRequest('/crm/v3/objects/leads', {
        method:'POST',
        body:{
          properties:hubspotLeadProperties(lead, leadName),
          associations:[{ to:{ id:contactId }, types:[{ associationCategory:'HUBSPOT_DEFINED', associationTypeId:578 }] }]
        }
      }, runtimeOptions);
      hubspotLeadId = String(created.id || '');
    }
    if (!hubspotLeadId) throw permanentError('HubSpot lead creation did not return a lead identifier.');
    const deliveredAt = new Date().toISOString();
    await setPublicLeadCrmDelivery({ leadId:lead.id, status:'delivered', deliveredAt, detail:`HubSpot contact ${contactId} and lead ${hubspotLeadId} synchronised.` });
    return { delivered:true, provider:'hubspot', contactId, hubspotLeadId, deliveredAt };
  } catch (error) {
    await setPublicLeadCrmDelivery({ leadId:lead.id, status:'failed', detail:String(error.message || error).slice(0, 500) });
    throw error;
  }
}

async function hubspotRequest(path, request, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), normalizeTimeout(process.env.CRM_HUBSPOT_TIMEOUT_MS));
  try {
    const response = await (options.fetchImpl || fetch)(`https://api.hubapi.com${path}`, {
      method:request.method || 'GET',
      headers:{ Authorization:`Bearer ${options.accessToken || process.env.CRM_HUBSPOT_ACCESS_TOKEN}`, 'Content-Type':'application/json', 'User-Agent':'ChatClan-HubSpot/1.0' },
      body:request.body ? JSON.stringify(request.body) : undefined,
      signal:controller.signal
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`HubSpot ${path} returned HTTP ${response.status}${result.message ? `: ${result.message}` : ''}`);
      error.retryable = response.status === 408 || response.status === 423 || response.status === 429 || response.status >= 500;
      throw error;
    }
    return result;
  } catch (error) {
    if (error.name === 'AbortError') { error.retryable = true; error.message = 'HubSpot request timed out.'; }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function hubspotContactProperties(lead) {
  const parts = String(lead.name || '').trim().split(/\s+/);
  return compactProperties({
    email:lead.email,
    firstname:parts.shift() || lead.name,
    lastname:parts.join(' '),
    phone:lead.phone,
    company:lead.company,
    jobtitle:lead.roleTitle,
    lifecyclestage:'lead'
  });
}

function hubspotLeadProperties(lead, leadName) {
  return compactProperties({
    hs_lead_name:leadName,
    hs_lead_type:process.env.CRM_HUBSPOT_LEAD_TYPE,
    hs_lead_label:process.env.CRM_HUBSPOT_LEAD_LABEL
  });
}

function compactProperties(properties) {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '').map(([key, value]) => [key, String(value)]));
}

function normalizeProvider(value) {
  return String(value || 'webhook').trim().toLowerCase() === 'hubspot' ? 'hubspot' : 'webhook';
}

async function getResolvedCrmStatus(includeSecrets = false) {
  const saved = await getCrmConfiguration({ includeSecrets });
  return { ...saved, provider:saved.providerKey };
}

function permanentError(message) { const error = new Error(message); error.retryable = false; return error; }

function crmLeadPayload(lead) {
  return {
    reference:lead.reference,
    type:lead.leadType,
    status:lead.status,
    priority:lead.priority,
    route:lead.routeKey,
    prospect:{ name:lead.name, workEmail:lead.email, phone:lead.phone || '', company:lead.company, role:lead.roleTitle || '' },
    qualification:{ teamSize:lead.teamSize || '', monthlyConversations:lead.monthlyConversations || '', useCase:lead.useCase || '', preferredContact:lead.preferredContact, message:lead.message },
    consent:{ contact:lead.consentToContact, marketing:lead.marketingOptIn },
    attribution:lead.attribution || {},
    createdAt:lead.createdAt
  };
}

function validateEndpoint(value) {
  let endpoint;
  try { endpoint = new URL(String(value || '')); } catch { throw configurationError('CRM webhook URL is invalid.'); }
  if (endpoint.username || endpoint.password) throw configurationError('CRM webhook URL must not contain credentials.');
  const localDevelopment = process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1','::1'].includes(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !(localDevelopment && endpoint.protocol === 'http:')) {
    throw configurationError('CRM webhook URL must use HTTPS.');
  }
  return endpoint.toString();
}

function normalizeTimeout(value) {
  const parsed = Number(value || 10000);
  return Number.isFinite(parsed) ? Math.min(30000, Math.max(1000, parsed)) : 10000;
}

function configurationError(message) {
  const error = new Error(message);
  error.retryable = false;
  return error;
}

module.exports = { crmLeadPayload, deliverPublicLeadToCrm, deliverPublicLeadToHubSpot, deliverPublicLeadWebhook, getPublicLeadCrmStatus, getResolvedCrmStatus, hubspotContactProperties, queuePublicLeadCrmDelivery };
