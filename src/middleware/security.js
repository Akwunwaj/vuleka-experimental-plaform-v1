const crypto = require('crypto');
const publicFormAttempts = new Map();

function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

function securityHeaders(req, res, next) {
  const nonce = crypto.randomBytes(18).toString('base64');
  res.locals = res.locals || {};
  res.locals.cspNonce = nonce;
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('x-permitted-cross-domain-policies', 'none');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('cross-origin-opener-policy', 'same-origin-allow-popups');
  res.setHeader(
    'content-security-policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      `script-src 'self' 'nonce-${nonce}' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://connect.facebook.net/`,
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://www.google.com/recaptcha/ https://graph.facebook.com/ https://www.facebook.com/",
      "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://www.facebook.com/ https://web.facebook.com/"
    ].join('; ')
  );
  next();
}

function publicFormRateLimit(req, res, next) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${req.path}`;
  const attempts = (publicFormAttempts.get(key) || []).filter((time) => now - time < windowMs);
  attempts.push(now);
  publicFormAttempts.set(key, attempts);
  if (attempts.length > 8) {
    res.setHeader('retry-after', String(Math.ceil(windowMs / 1000)));
    return res.status(429).json({ error: 'Too many form submissions. Please wait before trying again.', requestId: req.id });
  }
  if (publicFormAttempts.size > 5000) {
    for (const [attemptKey, times] of publicFormAttempts) {
      if (!times.some((time) => now - time < windowMs)) publicFormAttempts.delete(attemptKey);
    }
  }
  next();
}

module.exports = { publicFormRateLimit, requestId, securityHeaders };
