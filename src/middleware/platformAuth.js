const { isDatabaseUnavailableError } = require('../db/pool');
const {
  getPlatformSession,
  readSignedPlatformSessionId,
  serializeClearPlatformSessionCookie
} = require('../services/platformAuth');

async function attachPlatformSession(req, res, next) {
  const sessionId = readSignedPlatformSessionId(req.get('cookie'));
  let session = null;

  try {
    session = await getPlatformSession(sessionId);
  } catch (err) {
    if (!isDatabaseUnavailableError(err)) return next(err);
    req.platformAuthError = err;
    if (sessionId) res.append('Set-Cookie', serializeClearPlatformSessionCookie());
  }

  req.platformSession = session;
  req.platformUser = session?.user || null;
  next();
}

function requirePlatformAuth(req, res, next) {
  if (req.platformAuthError) {
    return res.status(req.platformAuthError.status || 503).json({ error: req.platformAuthError.message, requestId: req.id });
  }
  if (req.platformUser) return next();
  res.status(401).json({ error: 'Platform authentication required', requestId: req.id });
}

function requirePlatformRole(roles) {
  const allowed = new Set(Array.isArray(roles) ? roles : [roles]);
  return (req, res, next) => {
    if (req.platformAuthError) {
      return res.status(req.platformAuthError.status || 503).json({ error: req.platformAuthError.message, requestId: req.id });
    }
    if (!req.platformUser) return res.status(401).json({ error: 'Platform authentication required', requestId: req.id });
    if (allowed.has(req.platformUser.role)) return next();
    return res.status(403).json({ error: 'You do not have permission to perform this platform action', requestId: req.id });
  };
}

module.exports = { attachPlatformSession, requirePlatformAuth, requirePlatformRole };
