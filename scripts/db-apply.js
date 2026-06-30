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
      await connection.query(statement);
      console.log(`[pass] ${index + 1}/${statements.length}`);
    }
  } finally {
    await connection.end();
  }

  console.log(`${target} applied successfully.`);
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
