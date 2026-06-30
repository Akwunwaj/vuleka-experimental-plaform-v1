const express = require('express');
const path = require('path');
require('dotenv').config();

const webRoutes = require('./routes/web');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhooks');
const { brand } = require('./config/app');
const { closePool, hasDatabaseConfig } = require('./db/pool');
const { requestId, securityHeaders } = require('./middleware/security');
const { attachSession } = require('./middleware/auth');

const app = express();
const port = Number(process.env.PORT || 3000);

if (process.env.NODE_ENV === 'production' && !hasDatabaseConfig()) {
  throw new Error('MariaDB configuration is required in production. Set DB_HOST, DB_NAME, and DB_USER before starting ChatClan.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

function captureRawBody(req, res, buf) {
  req.rawBody = buf;
}

app.use(requestId);
app.use(securityHeaders);
app.use(express.json({ limit: '2mb', verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, verify: captureRawBody }));
app.use(attachSession);
app.use('/assets', express.static(path.join(__dirname, '..', 'public')));

app.use('/', webRoutes);
app.use('/api', apiRoutes);
app.use('/webhooks', webhookRoutes);

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.use((err, req, res, next) => {
  console.error({
    requestId: req.id,
    error: err.message || err.code || err.name || 'Unknown error',
    code: err.code,
    details: err.details,
    stack: err.stack
  });
  const status = err.status || 500;
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
    requestId: req.id
  });
});

const server = app.listen(port, () => {
  console.log(`${brand.name} is running on http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down ${brand.name}`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
