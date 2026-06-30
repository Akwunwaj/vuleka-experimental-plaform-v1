const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { getMaskedMetaCredentials } = require('./metaCredentials');
const { listTemplates } = require('./templates');

const stepDefinitions = [
  {
    id: 'business_profile',
    title: 'Workspace profile',
    description: 'Confirm the business workspace and default plan are ready.',
    action: { label: 'Review dashboard', page: 'dashboard' },
    autoComplete: true
  },
  {
    id: 'business_verification',
    title: 'Meta verification',
    description: 'Track CIPC documents, display name review, and Meta Business Manager verification.',
    action: { label: 'Track verification', page: 'settings' }
  },
  {
    id: 'meta_credentials',
    title: 'Connect WhatsApp',
    description: 'Save the WABA ID, phone number ID, access token, and webhook verify token.',
    action: { label: 'Connect Meta', page: 'settings' },
    autoComplete: true
  },
  {
    id: 'meta_phone_registration',
    title: 'Register phone number',
    description: 'Register the verified WhatsApp phone number with Cloud API using a 6 digit PIN.',
    action: { label: 'Register phone', page: 'settings' }
  },
  {
    id: 'meta_webhook_subscription',
    title: 'Subscribe webhooks',
    description: 'Subscribe the connected WABA to message and template status webhook events.',
    action: { label: 'Subscribe webhooks', page: 'settings' }
  },
  {
    id: 'first_template',
    title: 'First template',
    description: 'Create or install one WhatsApp message template for approval.',
    action: { label: 'Create template', page: 'templates' },
    autoComplete: true
  },
  {
    id: 'contacts',
    title: 'Opted-in contacts',
    description: 'Add or import POPIA-compliant WhatsApp contacts.',
    action: { label: 'Add contacts', page: 'contacts' },
    autoComplete: true
  },
  {
    id: 'test_message',
    title: 'Test message',
    description: 'Send a WhatsApp test message to confirm the connection works.',
    action: { label: 'Send test', page: 'settings' }
  }
];

const demoStepState = new Map();

async function getSetupWizardProgress(businessId) {
  const explicitState = await loadStepState(businessId);
  const derivedCompleted = await deriveCompletedSteps(businessId);
  const steps = stepDefinitions.map((definition) => {
    const explicit = explicitState.get(definition.id);
    const completed = Boolean(explicit?.status === 'completed' || derivedCompleted.has(definition.id));
    const status = completed ? 'completed' : explicit?.status || 'pending';

    return {
      ...definition,
      status,
      completed,
      completedAt: explicit?.completedAt || (completed && derivedCompleted.has(definition.id) ? new Date().toISOString() : null),
      metadata: explicit?.metadata || {}
    };
  });
  const completedCount = steps.filter((step) => step.completed).length;
  const nextStep = steps.find((step) => !step.completed) || null;

  return {
    businessId: Number(businessId),
    steps,
    completedCount,
    totalSteps: steps.length,
    percent: Math.round((completedCount / steps.length) * 100),
    nextStepId: nextStep?.id || null,
    complete: completedCount === steps.length
  };
}

async function markSetupStep({ businessId, stepId, status = 'completed', metadata = {} }) {
  const definition = stepDefinitions.find((step) => step.id === stepId);
  if (!definition) {
    const error = new Error(`Unknown setup step: ${stepId}`);
    error.status = 400;
    throw error;
  }
  const normalizedStatus = normalizeStatus(status);
  const completedAtDate = normalizedStatus === 'completed' ? new Date() : null;
  const state = {
    stepId,
    status: normalizedStatus,
    completedAt: completedAtDate ? completedAtDate.toISOString() : null,
    metadata: sanitizeMetadata(metadata)
  };

  if (!hasDatabaseConfig()) {
    const businessState = demoStepState.get(Number(businessId)) || new Map();
    businessState.set(stepId, state);
    demoStepState.set(Number(businessId), businessState);
    return getSetupWizardProgress(businessId);
  }

  await query(
    `insert into setup_wizard_steps
       (business_id, step_id, status, completed_at, metadata_json)
     values
       (:businessId, :stepId, :status, :completedAt, :metadataJson)
     on duplicate key update
       status = values(status),
       completed_at = values(completed_at),
       metadata_json = values(metadata_json),
       updated_at = current_timestamp`,
    {
      businessId,
      stepId,
      status: state.status,
      completedAt: completedAtDate,
      metadataJson: JSON.stringify(state.metadata)
    }
  );

  return getSetupWizardProgress(businessId);
}

async function loadStepState(businessId) {
  if (!hasDatabaseConfig()) return demoStepState.get(Number(businessId)) || new Map();

  const rows = await query(
    `select step_id as stepId, status, completed_at as completedAt, metadata_json as metadata
     from setup_wizard_steps
     where business_id = :businessId`,
    { businessId }
  );

  return new Map(
    (rows || []).map((row) => [
      row.stepId,
      {
        stepId: row.stepId,
        status: row.status,
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        metadata: parseJson(row.metadata)
      }
    ])
  );
}

async function deriveCompletedSteps(businessId) {
  const completed = new Set(['business_profile']);
  const credentials = await getMaskedMetaCredentials(businessId);
  if (credentials.connected) completed.add('meta_credentials');
  if ((await templateCount(businessId)) > 0) completed.add('first_template');
  if ((await contactCount(businessId)) > 0) completed.add('contacts');
  return completed;
}

async function templateCount(businessId) {
  if (!hasDatabaseConfig()) return (await listTemplates(businessId)).length;
  const rows = await query('select count(*) as total from message_templates where business_id = :businessId', { businessId });
  return Number(rows?.[0]?.total || 0);
}

async function contactCount(businessId) {
  if (!hasDatabaseConfig()) return demo.contacts.filter((contact) => Number(contact.businessId || 1) === Number(businessId)).length;
  const rows = await query('select count(*) as total from contacts where business_id = :businessId', { businessId });
  return Number(rows?.[0]?.total || 0);
}

function normalizeStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (['pending', 'in_progress', 'blocked', 'completed'].includes(normalized)) return normalized;
  return 'completed';
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null)
      .slice(0, 20)
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

function resetSetupWizardForTests() {
  demoStepState.clear();
}

module.exports = {
  getSetupWizardProgress,
  markSetupStep,
  resetSetupWizardForTests,
  stepDefinitions
};
