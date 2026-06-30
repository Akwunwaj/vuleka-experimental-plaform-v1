const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { slugify, templateLibrary } = require('../data/templateLibrary');
const { enforcePlanLimit } = require('./subscriptionPolicy');

const categories = new Set(['MARKETING', 'UTILITY', 'AUTHENTICATION']);
const statuses = new Set(['Draft', 'Submitted', 'Approved', 'Rejected']);
const demoTemplates = demo.templates.map((template) => normalizeStoredTemplate({ ...template, language: 'en_ZA', industry: 'general' }));
let demoTemplateId = Math.max(...demoTemplates.map((template) => Number(template.id) || 0), 1000);

async function listTemplates(businessId) {
  if (!hasDatabaseConfig()) return demoTemplates.filter((template) => Number(template.businessId || 1) === Number(businessId));

  const rows = await query(
    `select id, business_id as businessId, name, slug, category, industry, language, status, body,
            footer, components_json as componentsJson, variables_json as variablesJson,
            meta_template_id as metaTemplateId, rejection_reason as rejectionReason,
            created_at as createdAt, updated_at as updatedAt
     from message_templates
     where business_id = :businessId
     order by created_at desc, id desc`,
    { businessId }
  );
  return rows.map(normalizeStoredTemplate);
}

async function getTemplateById(businessId, templateId) {
  const template = (await listTemplates(businessId)).find((item) => Number(item.id) === Number(templateId));
  if (!template) notFound();
  return template;
}

function listTemplateLibrary({ industryId = null, category = null } = {}) {
  const normalizedCategory = category ? normalizeCategory(category) : null;
  return templateLibrary.filter((template) => {
    return (!industryId || template.industryId === industryId) && (!normalizedCategory || template.category === normalizedCategory);
  });
}

async function createTemplate(businessId, payload) {
  const template = validateTemplatePayload(payload);
  const status = normalizeStatus(payload.status || 'Draft');
  await enforcePlanLimit({ businessId, resource: 'templates', requested: 1 });

  if (!hasDatabaseConfig()) {
    const stored = normalizeStoredTemplate({
      ...template,
      id: nextDemoTemplateId(),
      businessId,
      status
    });
    demoTemplates.unshift(stored);
    return stored;
  }

  const result = await query(
    `insert into message_templates
       (business_id, name, slug, category, industry, language, status, body, footer, components_json, variables_json)
     values
       (:businessId, :name, :slug, :category, :industry, :language, :status, :body, :footer, :componentsJson, :variablesJson)`,
    {
      businessId,
      ...template,
      status,
      componentsJson: JSON.stringify(buildComponents(template)),
      variablesJson: JSON.stringify(extractVariables(template.body))
    }
  );

  return {
    id: result.insertId,
    businessId,
    status,
    ...template
  };
}

async function installLibraryTemplate(businessId, libraryTemplateId) {
  const template = templateLibrary.find((item) => item.id === libraryTemplateId);
  if (!template) {
    const error = new Error('Library template not found');
    error.status = 404;
    throw error;
  }

  return createTemplate(businessId, {
    name: template.name,
    category: template.category,
    industry: template.industryId,
    language: template.language,
    body: template.body,
    footer: template.footer,
    status: 'Draft'
  });
}

async function updateTemplateStatus({ businessId, templateId, status, rejectionReason = null, metaTemplateId = null }) {
  const normalizedStatus = normalizeStatus(status);

  if (!hasDatabaseConfig()) {
    const template = demoTemplates.find((item) => Number(item.id) === Number(templateId) && Number(item.businessId || 1) === Number(businessId));
    if (!template) notFound();
    template.status = normalizedStatus;
    template.rejectionReason = normalizedStatus === 'Rejected' ? rejectionReason || 'Rejected by reviewer' : null;
    template.metaTemplateId = metaTemplateId || template.metaTemplateId || null;
    return template;
  }

  const result = await query(
    `update message_templates
     set status = :status,
         rejection_reason = :rejectionReason,
         meta_template_id = coalesce(:metaTemplateId, meta_template_id),
         submitted_at = case when :status = 'Submitted' then current_timestamp else submitted_at end,
         approved_at = case when :status = 'Approved' then current_timestamp else approved_at end
     where business_id = :businessId and id = :templateId`,
    {
      businessId,
      templateId,
      status: normalizedStatus,
      rejectionReason: normalizedStatus === 'Rejected' ? rejectionReason || 'Rejected by reviewer' : null,
      metaTemplateId
    }
  );
  if (!result.affectedRows) notFound();
  return (await listTemplates(businessId)).find((template) => Number(template.id) === Number(templateId));
}

function validateTemplatePayload(payload) {
  const name = String(payload.name || '').trim();
  const category = normalizeCategory(payload.category);
  const language = String(payload.language || 'en_ZA').trim();
  const body = String(payload.body || '').trim();
  const footer = String(payload.footer || '').trim();
  const industry = String(payload.industry || payload.industryId || 'general').trim() || 'general';
  const slug = slugify(payload.slug || name);

  if (!name) required('name');
  if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
    const error = new Error('Template name can only contain lowercase letters, numbers, and underscores');
    error.status = 400;
    throw error;
  }
  if (!body) required('body');
  if (body.length > 1024) {
    const error = new Error('Template body must be 1,024 characters or less');
    error.status = 400;
    throw error;
  }
  if (/[\n\t]/.test(body) || / {5,}/.test(body)) {
    const error = new Error('Template body cannot contain new lines, tabs, or more than four consecutive spaces');
    error.status = 400;
    throw error;
  }
  validateVariables(body);

  return {
    name,
    slug,
    category,
    industry,
    language,
    body,
    footer
  };
}

function validateVariables(body) {
  const matches = [...body.matchAll(/\{\{\s*([^}]+)\s*\}\}/g)];
  const values = matches.map((match) => match[1].trim());
  if (!values.length) return;

  const expected = values.map((_, index) => String(index + 1));
  if (values.some((value, index) => value !== expected[index])) {
    const error = new Error('Template variables must be sequential: {{1}}, {{2}}, {{3}}');
    error.status = 400;
    throw error;
  }
}

function buildComponents(template) {
  const components = [{ type: 'BODY', text: template.body }];
  if (template.footer) components.push({ type: 'FOOTER', text: template.footer });
  return components;
}

function extractVariables(body) {
  return [...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((match) => Number(match[1]));
}

function normalizeStoredTemplate(template) {
  return {
    id: template.id,
    businessId: template.businessId || template.business_id || 1,
    name: template.name,
    slug: template.slug || slugify(template.name),
    category: normalizeCategory(template.category),
    industry: template.industry || 'general',
    language: template.language || 'en_ZA',
    status: template.status || 'Draft',
    body: template.body,
    footer: template.footer || '',
    metaTemplateId: template.metaTemplateId || template.meta_template_id || null,
    rejectionReason: template.rejectionReason || template.rejection_reason || null,
    components: parseJson(template.componentsJson || template.components_json, null),
    variables: parseJson(template.variablesJson || template.variables_json, extractVariables(template.body || '')),
    createdAt: template.createdAt || template.created_at || null,
    updatedAt: template.updatedAt || template.updated_at || null
  };
}

function normalizeCategory(category) {
  const normalized = String(category || '').trim().toUpperCase();
  if (!categories.has(normalized)) {
    const error = new Error('category must be MARKETING, UTILITY, or AUTHENTICATION');
    error.status = 400;
    throw error;
  }
  return normalized;
}

function normalizeStatus(status) {
  const normalized = String(status || '').trim();
  if (!statuses.has(normalized)) {
    const error = new Error('status must be Draft, Submitted, Approved, or Rejected');
    error.status = 400;
    throw error;
  }
  return normalized;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function nextDemoTemplateId() {
  demoTemplateId += 1;
  return demoTemplateId;
}

function required(field) {
  const error = new Error(`${field} is required`);
  error.status = 400;
  throw error;
}

function notFound() {
  const error = new Error('Template not found');
  error.status = 404;
  throw error;
}

module.exports = {
  createTemplate,
  getTemplateById,
  installLibraryTemplate,
  listTemplateLibrary,
  listTemplates,
  updateTemplateStatus,
  validateTemplatePayload
};
