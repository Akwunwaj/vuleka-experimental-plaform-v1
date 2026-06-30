const {
  SESSION_COOKIE,
  getSession,
  parseCookies,
  serializeClearSessionCookie,
  unsignSessionId
} = require('../services/auth');
const { isDatabaseUnavailableError } = require('../db/pool');

async function attachSession(req, res, next) {
  const cookies = parseCookies(req.get('cookie'));
  const sessionId = unsignSessionId(cookies[SESSION_COOKIE]);
  let session = null;

  try {
    session = await getSession(sessionId);
  } catch (err) {
    if (!isDatabaseUnavailableError(err)) return next(err);
    req.authError = err;
    if (sessionId) res.setHeader('Set-Cookie', serializeClearSessionCookie());
  }

  req.session = session;
  req.user = session?.user || null;
  req.businessId = session?.businessId || null;
  next();
}

function requireAuth(req, res, next) {
  if (req.authError) {
    return res.status(req.authError.status || 503).json({ error: req.authError.message, requestId: req.id });
  }
  if (req.user && req.businessId) return next();
  res.status(401).json({ error: 'Authentication required', requestId: req.id });
}

function requireRole(roles) {
  const allowed = new Set(Array.isArray(roles) ? roles : [roles]);
  return (req, res, next) => {
    if (req.authError) {
      return res.status(req.authError.status || 503).json({ error: req.authError.message, requestId: req.id });
    }
    if (!req.user || !req.businessId) return res.status(401).json({ error: 'Authentication required', requestId: req.id });
    if (allowed.has(req.user.role)) return next();
    return res.status(403).json({ error: 'You do not have permission to perform this action', requestId: req.id });
  };
}

module.exports = { attachSession, requireAuth, requireRole };
