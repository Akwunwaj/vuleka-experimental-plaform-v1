const crypto = require('crypto');
const { hasDatabaseConfig, query } = require('../db/pool');
const { brand } = require('../config/app');
const { deleteSocialIdentityAccountData } = require('./socialAuth');

const demoRequests = new Map();

function parseFacebookSignedRequest(signedRequest, appSecret = process.env.SOCIAL_FACEBOOK_CLIENT_SECRET) {
  const parts = String(signedRequest || '').split('.');
  if (parts.length !== 2 || !appSecret) invalidSignedRequest();
  const [encodedSignature, encodedPayload] = parts;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    invalidSignedRequest();
  }
  if (payload?.algorithm !== 'HMAC-SHA256' || !payload.user_id) invalidSignedRequest();
  const received = Buffer.from(encodedSignature, 'base64url');
  const expected = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) invalidSignedRequest();
  return payload;
}

async function processFacebookDataDeletion({ signedRequest }) {
  const payload = parseFacebookSignedRequest(signedRequest);
  const providerUserId = String(payload.user_id);
  const providerUserIdHash = crypto.createHash('sha256').update(providerUserId).digest('hex');
  const confirmationCode = crypto.randomBytes(12).toString('hex');
  const deletion = await deleteSocialIdentityAccountData({ provider: 'facebook', providerUserId });
  const record = {
    confirmationCode,
    provider: 'facebook',
    providerUserIdHash,
    userId: deletion.userId,
    status: 'completed',
    completedAt: new Date()
  };

  if (!hasDatabaseConfig()) {
    demoRequests.set(confirmationCode, record);
  } else {
    await query(
      `insert into social_data_deletion_requests
         (confirmation_code, provider, provider_user_id_hash, user_id, status, completed_at)
       values
         (:confirmationCode, :provider, :providerUserIdHash, :userId, :status, :completedAt)`,
      record
    );
  }

  const baseUrl = String(brand.domain || '').replace(/\/$/, '');
  return {
    url: `${baseUrl}/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`,
    confirmation_code: confirmationCode
  };
}

async function getSocialDataDeletionStatus(code) {
  const normalizedCode = String(code || '').trim();
  if (!/^[a-f0-9]{24}$/.test(normalizedCode)) return null;
  if (!hasDatabaseConfig()) return demoRequests.get(normalizedCode) || null;
  const rows = await query(
    `select confirmation_code as confirmationCode, provider, status,
            completed_at as completedAt, created_at as createdAt
     from social_data_deletion_requests
     where confirmation_code = :confirmationCode
     limit 1`,
    { confirmationCode: normalizedCode }
  );
  return rows?.[0] || null;
}

function invalidSignedRequest() {
  const error = new Error('Invalid Facebook signed request');
  error.status = 400;
  error.code = 'INVALID_FACEBOOK_SIGNED_REQUEST';
  throw error;
}

module.exports = {
  getSocialDataDeletionStatus,
  parseFacebookSignedRequest,
  processFacebookDataDeletion
};
