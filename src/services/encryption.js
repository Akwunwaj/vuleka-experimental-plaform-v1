const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

function decryptSecret(payload) {
  if (!payload) return null;
  const [ivText, tagText, encryptedText] = String(payload).split('.');
  if (!ivText || !tagText || !encryptedText) throw new Error('Invalid encrypted payload');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivText, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function maskSecret(value, visible = 4) {
  if (!value) return null;
  const text = String(value);
  if (text.length <= visible) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.max(8, text.length - visible))}${text.slice(-visible)}`;
}

function getEncryptionKey() {
  const configured = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (configured) {
    const key = Buffer.from(configured, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
    return key;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY is required in production');
  }

  return crypto.createHash('sha256').update('chatclan-local-development-credential-key').digest();
}

module.exports = { decryptSecret, encryptSecret, maskSecret };
