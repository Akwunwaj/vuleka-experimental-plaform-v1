const { getMetaCredentials } = require('./metaCredentials');
const {
  createTemplate,
  getTemplateById,
  listTemplates,
  updateTemplateStatus
} = require('./templates');
const { slugify } = require('../data/templateLibrary');

const defaultGraphVersion = 'v21.0';

async function submitTemplateToMeta({ businessId, templateId }) {
  const template = await getTemplateById(businessId, templateId);
  const payload = buildMetaTemplatePayload(template);

  if (process.env.META_TEMPLATE_MODE !== 'live') {
    const metaTemplateId = template.metaTemplateId || `mock_tpl_${template.slug || template.id}`;
    const updated = await updateTemplateStatus({
      businessId,
      templateId,
      status: 'Submitted',
      metaTemplateId
    });
    return {
      mode: 'mock',
      template: updated,
      payload,
      note: 'Set META_TEMPLATE_MODE=live to submit templates to Meta.'
    };
  }

  const credentials = await requireTemplateCredentials(businessId);
  const response = await graphRequest({
    path: `/${credentials.wabaId}/message_templates`,
    method: 'POST',
    accessToken: credentials.accessToken,
    body: payload
  });

  const status = mapMetaStatus(response.status || 'PENDING');
  const updated = await updateTemplateStatus({
    businessId,
    templateId,
    status,
    metaTemplateId: response.id || template.metaTemplateId,
    rejectionReason: rejectionReasonFromMeta(response)
  });

  return {
    mode: 'live',
    template: updated,
    meta: response,
    payload
  };
}

async function syncMetaTemplates(businessId, options = {}) {
  let remoteTemplates = options.remoteTemplates || null;
  let mode = options.remoteTemplates ? 'provided' : 'mock';

  if (!remoteTemplates && process.env.META_TEMPLATE_MODE === 'live') {
    const credentials = await requireTemplateCredentials(businessId);
    remoteTemplates = await fetchAllMetaTemplates(credentials);
    mode = 'live';
  }

  if (!remoteTemplates) {
    return {
      mode,
      synced: 0,
      templates: await listTemplates(businessId),
      note: 'Set META_TEMPLATE_MODE=live to sync template statuses from Meta.'
    };
  }

  const localTemplates = await listTemplates(businessId);
  const changes = [];

  for (const remote of remoteTemplates) {
    const normalized = normalizeRemoteTemplate(remote);
    if (!normalized.body) continue;

    let local = localTemplates.find((template) => {
      return (
        (normalized.metaTemplateId && template.metaTemplateId === normalized.metaTemplateId) ||
        template.slug === normalized.slug
      );
    });

    if (!local) {
      local = await createTemplate(businessId, {
        name: normalized.name,
        slug: normalized.slug,
        category: normalized.category,
        language: normalized.language,
        body: normalized.body,
        footer: normalized.footer,
        status: normalized.status
      });
    }

    const updated = await updateTemplateStatus({
      businessId,
      templateId: local.id,
      status: normalized.status,
      metaTemplateId: normalized.metaTemplateId,
      rejectionReason: normalized.rejectionReason
    });
    changes.push(updated);
  }

  return {
    mode,
    synced: changes.length,
    templates: changes
  };
}

function buildMetaTemplatePayload(template) {
  const bodyComponent = {
    type: 'BODY',
    text: template.body
  };
  const variables = extractVariables(template.body);
  if (variables.length) {
    bodyComponent.example = {
      body_text: [variables.map((number) => `Sample ${number}`)]
    };
  }

  const components = [bodyComponent];
  if (template.footer) {
    components.push({
      type: 'FOOTER',
      text: template.footer
    });
  }

  return {
    name: template.slug || slugify(template.name),
    language: template.language || 'en_ZA',
    category: String(template.category || '').toUpperCase(),
    components
  };
}

async function fetchAllMetaTemplates(credentials) {
  const fields = 'id,name,status,category,language,components,rejected_reason';
  let nextUrl = graphUrl(`/${credentials.wabaId}/message_templates?fields=${encodeURIComponent(fields)}&limit=100`);
  const templates = [];
  let pages = 0;

  while (nextUrl && pages < 10) {
    const page = await graphRequest({
      absoluteUrl: nextUrl,
      accessToken: credentials.accessToken
    });
    templates.push(...(page.data || []));
    nextUrl = page.paging?.next || null;
    pages += 1;
  }

  return templates;
}

async function requireTemplateCredentials(businessId) {
  const credentials = await getMetaCredentials(businessId);
  if (!credentials?.wabaId || !credentials?.accessToken) {
    const error = new Error('Meta WABA ID and access token are required before live template operations');
    error.status = 400;
    throw error;
  }
  return credentials;
}

async function graphRequest({ path, absoluteUrl = null, method = 'GET', accessToken, body = null }) {
  const response = await fetch(absoluteUrl || graphUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || 'Meta template API request failed';
    const error = new Error(detail);
    error.status = 502;
    error.meta = payload;
    throw error;
  }

  return payload;
}

function normalizeRemoteTemplate(remote) {
  const body = componentText(remote.components, 'BODY');
  const footer = componentText(remote.components, 'FOOTER');
  return {
    metaTemplateId: remote.id || null,
    name: humanName(remote.name),
    slug: slugify(remote.name),
    category: normalizeRemoteCategory(remote.category),
    language: remote.language || 'en_ZA',
    status: mapMetaStatus(remote.status),
    body,
    footer,
    rejectionReason: rejectionReasonFromMeta(remote)
  };
}

function componentText(components = [], type) {
  const component = (components || []).find((item) => String(item.type || '').toUpperCase() === type);
  return String(component?.text || '').trim();
}

function mapMetaStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'APPROVED') return 'Approved';
  if (normalized === 'REJECTED') return 'Rejected';
  return 'Submitted';
}

function rejectionReasonFromMeta(remote) {
  return remote.rejected_reason || remote.rejection_reason || remote.rejectedReason || null;
}

function normalizeRemoteCategory(category) {
  const normalized = String(category || '').trim().toUpperCase();
  if (['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(normalized)) return normalized;
  return 'MARKETING';
}

function extractVariables(body) {
  return [...String(body || '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1]));
}

function humanName(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Imported Meta Template';
}

function graphUrl(path) {
  const version = process.env.META_GRAPH_VERSION || defaultGraphVersion;
  return `https://graph.facebook.com/${version}${path}`;
}

module.exports = {
  buildMetaTemplatePayload,
  mapMetaStatus,
  normalizeRemoteTemplate,
  submitTemplateToMeta,
  syncMetaTemplates
};
