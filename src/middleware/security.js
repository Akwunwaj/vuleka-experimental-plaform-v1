const crypto = require('crypto');

function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

function securityHeaders(req, res, next) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('x-permitted-cross-domain-policies', 'none');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('cross-origin-opener-policy', 'same-origin');
  res.setHeader(
    'content-security-policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'"
    ].join('; ')
  );
  next();
}

module.exports = { requestId, securityHeaders };
