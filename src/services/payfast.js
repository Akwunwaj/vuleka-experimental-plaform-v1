const crypto = require('crypto');

const PAYFAST_HOSTS = {
  sandbox: 'sandbox.payfast.co.za',
  live: 'www.payfast.co.za'
};

function buildSignatureString(data, { includeSignature = false } = {}) {
  return Object.entries(data)
    .filter(([key, value]) => includeSignature || key !== 'signature')
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`)
    .join('&');
}

function verifyPayFastSignature(data, passphrase = process.env.PAYFAST_PASSPHRASE) {
  if (!data.signature) return { ok: false, reason: 'missing-signature' };
  let signatureString = buildSignatureString(data);
  if (passphrase) {
    signatureString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }

  const expected = crypto.createHash('md5').update(signatureString).digest('hex');
  return {
    ok: expected === String(data.signature).toLowerCase(),
    expected,
    received: data.signature
  };
}

function signPayFastData(data, passphrase = process.env.PAYFAST_PASSPHRASE) {
  let signatureString = buildSignatureString(data);
  if (passphrase) {
    signatureString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(signatureString).digest('hex');
}

function payFastProcessUrl() {
  const env = process.env.PAYFAST_ENV === 'live' ? 'live' : 'sandbox';
  return `https://${PAYFAST_HOSTS[env]}/eng/process`;
}

async function confirmPayFastWithServer(data) {
  const env = process.env.PAYFAST_ENV === 'live' ? 'live' : 'sandbox';
  const host = PAYFAST_HOSTS[env];
  const body = buildSignatureString(data, { includeSignature: true });

  const response = await fetch(`https://${host}/eng/query/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const text = await response.text();
  return {
    ok: text.trim() === 'VALID',
    response: text.trim(),
    env
  };
}

function summarizePayFastEvent(data) {
  return {
    paymentId: data.pf_payment_id || null,
    merchantPaymentId: data.m_payment_id || null,
    paymentStatus: data.payment_status || null,
    amountGross: data.amount_gross || null,
    token: data.token || null,
    itemName: data.item_name || null
  };
}

module.exports = {
  buildSignatureString,
  verifyPayFastSignature,
  signPayFastData,
  payFastProcessUrl,
  confirmPayFastWithServer,
  summarizePayFastEvent
};
