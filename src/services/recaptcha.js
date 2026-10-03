const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const DEFAULT_MIN_SCORE = 0.5;
const MAX_TOKEN_AGE_MS = 2 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 30 * 1000;

function getRecaptchaClientConfig() {
  const siteKey = env('RECAPTCHA_SITE_KEY');
  return {
    enabled: recaptchaEnabled(),
    siteKey
  };
}

async function verifyRecaptcha({ token, expectedAction, remoteIp, fetchImpl = fetch, now = Date.now() }) {
  if (env('RECAPTCHA_MODE') === 'enforced' && (!env('RECAPTCHA_SITE_KEY') || !env('RECAPTCHA_SECRET_KEY'))) {
    throw unavailableError();
  }
  if (!recaptchaEnabled()) return { ok: true, bypassed: true, action: expectedAction };
  if (!token) throw verificationError('Security verification is required. Please try again.');
  if (!expectedAction) throw new Error('A reCAPTCHA action is required');

  const body = new URLSearchParams({
    secret: env('RECAPTCHA_SECRET_KEY'),
    response: String(token)
  });
  if (remoteIp) body.set('remoteip', String(remoteIp));

  let response;
  try {
    response = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch {
    throw unavailableError();
  }

  const assessment = await response.json().catch(() => null);
  if (!response.ok || !assessment) throw unavailableError();

  const challengeTime = new Date(assessment.challenge_ts).getTime();
  const age = now - challengeTime;
  const score = Number(assessment.score);
  const allowedHostnames = recaptchaHostnames();
  const hostnameAllowed = allowedHostnames.includes(String(assessment.hostname || '').toLowerCase());
  const valid = assessment.success === true
    && assessment.action === expectedAction
    && Number.isFinite(score)
    && score >= minScore()
    && Number.isFinite(challengeTime)
    && age >= -FUTURE_TOLERANCE_MS
    && age <= MAX_TOKEN_AGE_MS
    && hostnameAllowed;

  if (!valid) throw verificationError('Security verification failed. Please try again.');
  return {
    ok: true,
    action: assessment.action,
    hostname: assessment.hostname,
    score,
    challengeTime: assessment.challenge_ts
  };
}

function recaptchaEnabled() {
  const configured = Boolean(env('RECAPTCHA_SITE_KEY') && env('RECAPTCHA_SECRET_KEY'));
  if (env('RECAPTCHA_MODE') === 'disabled') return false;
  return configured;
}

function recaptchaHostnames() {
  const configured = env('RECAPTCHA_ALLOWED_HOSTNAMES')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (configured.length) return configured;

  const hostnames = ['localhost', '127.0.0.1'];
  try {
    hostnames.push(new URL(env('APP_URL')).hostname.toLowerCase());
  } catch {
    // Local development can run without APP_URL.
  }
  return [...new Set(hostnames)];
}

function minScore() {
  const configured = Number(env('RECAPTCHA_MIN_SCORE'));
  return Number.isFinite(configured) && configured >= 0 && configured <= 1 ? configured : DEFAULT_MIN_SCORE;
}

function verificationError(message) {
  return Object.assign(new Error(message), { status: 403, code: 'RECAPTCHA_FAILED' });
}

function unavailableError() {
  return Object.assign(new Error('Security verification is temporarily unavailable. Please try again.'), {
    status: 503,
    code: 'RECAPTCHA_UNAVAILABLE'
  });
}

function env(key) {
  return String(process.env[key] || '').trim();
}

module.exports = {
  getRecaptchaClientConfig,
  verifyRecaptcha
};
