const { hasDatabaseConfig, query } = require('../db/pool');
const { decryptSecret, encryptSecret, maskSecret } = require('./encryption');

const demoCredentials = new Map();

async function saveMetaCredentials(businessId, payload) {
  const existing = await getMetaCredentials(businessId);
  const credentials = normalizeCredentials(payload, existing);

  if (!hasDatabaseConfig()) {
    demoCredentials.set(Number(businessId), {
      ...credentials,
      accessTokenEncrypted: encryptSecret(credentials.accessToken)
    });
    return getMaskedMetaCredentials(businessId);
  }

  await query(
    `insert into business_integrations
       (business_id, provider, status, external_account_id, phone_number_id, access_token_encrypted, verify_token)
     values
       (:businessId, 'meta_whatsapp', 'connected', :wabaId, :phoneNumberId, :accessTokenEncrypted, :verifyToken)
     on duplicate key update
       status = 'connected',
       external_account_id = values(external_account_id),
       phone_number_id = values(phone_number_id),
       access_token_encrypted = values(access_token_encrypted),
       verify_token = values(verify_token),
       updated_at = current_timestamp`,
    {
      businessId,
      wabaId: credentials.wabaId,
      phoneNumberId: credentials.phoneNumberId,
      accessTokenEncrypted: encryptSecret(credentials.accessToken),
      verifyToken: credentials.verifyToken || null
    }
  );

  return getMaskedMetaCredentials(businessId);
}

async function getMaskedMetaCredentials(businessId) {
  const credentials = await getMetaCredentials(businessId);
  if (!credentials) return { connected: false };

  return {
    connected: true,
    provider: 'meta_whatsapp',
    wabaId: credentials.wabaId,
    phoneNumberId: credentials.phoneNumberId,
    accessTokenMasked: maskSecret(credentials.accessToken),
    verifyTokenMasked: maskSecret(credentials.verifyToken),
    status: credentials.status || 'connected'
  };
}

async function getMetaCredentials(businessId) {
  if (!hasDatabaseConfig()) {
    const stored = demoCredentials.get(Number(businessId));
    if (stored) {
      return {
        ...stored,
        accessToken: decryptSecret(stored.accessTokenEncrypted)
      };
    }
    return envCredentials();
  }

  const rows = await query(
    `select external_account_id as wabaId, phone_number_id as phoneNumberId,
            access_token_encrypted as accessTokenEncrypted, verify_token as verifyToken, status
     from business_integrations
     where business_id = :businessId and provider = 'meta_whatsapp'
     limit 1`,
    { businessId }
  );

  const row = rows?.[0];
  if (!row) return envCredentials();
  return {
    ...row,
    accessToken: decryptSecret(row.accessTokenEncrypted)
  };
}

async function findBusinessIdByMetaPhoneNumberId(phoneNumberId) {
  const normalizedPhoneNumberId = String(phoneNumberId || '').trim();
  if (!normalizedPhoneNumberId) return hasDatabaseConfig() ? null : 1;

  if (!hasDatabaseConfig()) {
    for (const [businessId, credentials] of demoCredentials.entries()) {
      if (credentials.phoneNumberId === normalizedPhoneNumberId) return businessId;
    }
    const env = envCredentials();
    if (env?.phoneNumberId === normalizedPhoneNumberId) return 1;
    return 1;
  }

  const rows = await query(
    `select business_id as businessId
     from business_integrations
     where provider = 'meta_whatsapp' and phone_number_id = :phoneNumberId
     limit 1`,
    { phoneNumberId: normalizedPhoneNumberId }
  );

  return rows?.[0]?.businessId || null;
}

function normalizeCredentials(payload, existing = null) {
  const wabaId = String(payload.wabaId || '').trim();
  const phoneNumberId = String(payload.phoneNumberId || '').trim();
  const accessToken = String(payload.accessToken || '').trim() || existing?.accessToken || '';
  const verifyToken = String(payload.verifyToken || '').trim() || existing?.verifyToken || '';

  if (!wabaId || !phoneNumberId || !accessToken) {
    const error = new Error('wabaId, phoneNumberId and accessToken are required');
    error.status = 400;
    throw error;
  }

  return { wabaId, phoneNumberId, accessToken, verifyToken };
}

function envCredentials() {
  if (!process.env.META_PHONE_NUMBER_ID || !process.env.META_ACCESS_TOKEN) return null;
  return {
    wabaId: process.env.META_WABA_ID || null,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    accessToken: process.env.META_ACCESS_TOKEN,
    verifyToken: process.env.META_VERIFY_TOKEN || null,
    status: 'environment'
  };
}

module.exports = {
  findBusinessIdByMetaPhoneNumberId,
  getMaskedMetaCredentials,
  getMetaCredentials,
  saveMetaCredentials
};
