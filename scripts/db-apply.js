#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const target = process.argv[2];
const files = {
  schema: path.join(__dirname, '..', 'database', 'schema.sql'),
  seed: path.join(__dirname, '..', 'database', 'seed.sql')
};

async function main() {
  if (!files[target]) {
    throw new Error('Usage: node scripts/db-apply.js <schema|seed>');
  }

  const config = readDbConfig();
  const sqlFile = files[target];
  const sql = fs.readFileSync(sqlFile, 'utf8');
  const statements = splitStatements(sql);

  console.log(`Applying ${target} to ${config.database}@${config.host}:${config.port}`);
  console.log(`Statements: ${statements.length}`);

  const bootstrap = await mysql.createConnection({ ...config, database: undefined });
  try {
    await bootstrap.query(`create database if not exists ${quoteIdentifier(config.database)} character set utf8mb4 collate utf8mb4_unicode_ci`);
  } finally {
    await bootstrap.end();
  }

  const connection = await mysql.createConnection(config);
  try {
    for (const [index, statement] of statements.entries()) {
      await applyStatement(connection, config.database, statement);
      console.log(`[pass] ${index + 1}/${statements.length}`);
    }
  } finally {
    await connection.end();
  }

  console.log(`${target} applied successfully.`);
}

async function applyStatement(connection, database, statement) {
  const addColumn = statement.match(/^alter\s+table\s+`?([a-zA-Z0-9_]+)`?\s+add\s+column\s+if\s+not\s+exists\s+`?([a-zA-Z0-9_]+)`?\s+(.+);?$/is);
  if (!addColumn) {
    await connection.query(statement);
    return;
  }

  const [, tableName, columnName, definition] = addColumn;
  const [rows] = await connection.query(
    `select count(*) as total
     from information_schema.columns
     where table_schema = ? and table_name = ? and column_name = ?`,
    [database, tableName, columnName]
  );
  if (Number(rows?.[0]?.total || 0) > 0) return;

  await connection.query(`alter table ${quoteIdentifier(tableName)} add column ${quoteIdentifier(columnName)} ${definition.replace(/;$/, '')}`);
}

function readDbConfig() {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false
  };
}

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const char of sql) {
    current += char;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
    }
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements.filter((statement) => !statement.startsWith('--'));
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

main().catch((error) => {
  console.error(`[fail] ${formatError(error)}`);
  process.exitCode = 1;
});

function formatError(error) {
  const parts = [
    error?.message,
    error?.code && `code=${error.code}`,
    error?.errno && `errno=${error.errno}`,
    error?.sqlState && `sqlState=${error.sqlState}`,
    error?.sqlMessage && `sqlMessage=${error.sqlMessage}`
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : String(error);
}
