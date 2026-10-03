const mysql = require('mysql2/promise');

let pool;

function hasDatabaseConfig() {
  return Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);
}

function getPool() {
  if (!hasDatabaseConfig()) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true
    });
  }
  return pool;
}

async function query(sql, params = {}) {
  const db = getPool();
  if (!db) return null;
  try {
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    throw normalizeDatabaseError(err);
  }
}

async function transaction(callback) {
  const db = getPool();
  if (!db) return callback(null);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback({
      async query(sql, params = {}) {
        const [rows] = await connection.execute(sql, params);
        return rows;
      }
    });
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    if (Number(err?.status) >= 400 && Number(err?.status) < 500) throw err;
    throw normalizeDatabaseError(err);
  } finally {
    connection.release();
  }
}

async function ping() {
  const db = getPool();
  if (!db) return { configured: false, ok: true };
  try {
    await db.query('select 1');
    return { configured: true, ok: true };
  } catch (err) {
    const normalized = normalizeDatabaseError(err);
    return {
      configured: true,
      ok: false,
      error: normalized.message,
      code: normalized.dbCode || normalized.code || 'DATABASE_UNAVAILABLE'
    };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function normalizeDatabaseError(err) {
  const details = databaseErrorDetails(err);
  const normalized = new Error(details.message || 'Database query failed');
  normalized.name = err?.name || 'DatabaseError';
  normalized.status = details.unavailable ? 503 : 500;
  normalized.code = details.unavailable ? 'DATABASE_UNAVAILABLE' : 'DATABASE_ERROR';
  normalized.dbCode = details.code;
  normalized.cause = err;
  normalized.details = details;
  return normalized;
}

function databaseErrorDetails(err) {
  const nested = Array.isArray(err?.errors) ? err.errors : [];
  const codes = [err?.code, ...nested.map((item) => item?.code)].filter(Boolean);
  const messages = [err?.message, ...nested.map((item) => item?.message)].filter(Boolean);
  const addresses = nested
    .map((item) => [item?.address, item?.port].filter(Boolean).join(':'))
    .filter(Boolean);
  const code = codes[0] || err?.errno || null;
  const unavailableCodes = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET']);
  const unavailable = codes.some((item) => unavailableCodes.has(item));
  const target = `${process.env.DB_HOST || 'database'}:${process.env.DB_PORT || 3306}`;
  const reason = messages.find(Boolean) || (code ? String(code) : 'connection failed');
  const addressSuffix = addresses.length ? ` (${addresses.join(', ')})` : '';

  return {
    code,
    unavailable,
    message: unavailable
      ? `Database unavailable at ${target}: ${reason}${addressSuffix}`
      : reason,
    originalName: err?.name || null
  };
}

function isDatabaseUnavailableError(err) {
  return err?.code === 'DATABASE_UNAVAILABLE' || err?.status === 503;
}

module.exports = { hasDatabaseConfig, query, transaction, ping, closePool, isDatabaseUnavailableError };
