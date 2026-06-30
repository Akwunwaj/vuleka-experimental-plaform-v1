#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');

async function main() {
  const config = readDbConfig();
  const expectedTables = readExpectedTables();

  console.log(`ChatClan database verification: ${config.database}@${config.host}:${config.port}`);
  console.log(`Expected tables from schema.sql: ${expectedTables.length}\n`);

  const connection = await mysql.createConnection(config);
  try {
    await verifyConnection(connection);
    await verifyTables(connection, config.database, expectedTables);
    await verifySeedState(connection);
    console.log('\nDatabase verification passed.');
  } finally {
    await connection.end();
  }
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
    password: process.env.DB_PASSWORD || ''
  };
}

function readExpectedTables() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const tables = [...schema.matchAll(/create\s+table\s+if\s+not\s+exists\s+`?([a-z0-9_]+)`?\s*\(/gi)].map((match) => match[1]);
  const uniqueTables = [...new Set(tables)];

  if (uniqueTables.length === 0) {
    throw new Error(`No tables found in ${schemaPath}`);
  }

  return uniqueTables;
}

async function verifyConnection(connection) {
  const [rows] = await connection.query('select database() as dbName, version() as version');
  const info = rows[0];
  pass(`Connected to database ${info.dbName}`);
  pass(`MariaDB/MySQL version ${info.version}`);
}

async function verifyTables(connection, databaseName, expectedTables) {
  const [rows] = await connection.execute(
    `select table_name as tableName
     from information_schema.tables
     where table_schema = ?
     order by table_name`,
    [databaseName]
  );
  const actualTables = new Set(rows.map((row) => row.tableName));
  const missingTables = expectedTables.filter((table) => !actualTables.has(table));

  if (missingTables.length > 0) {
    fail(`Missing ${missingTables.length} table(s): ${missingTables.join(', ')}`);
    process.exitCode = 1;
  } else {
    pass(`All ${expectedTables.length} expected tables exist`);
  }

  const extraTables = rows.map((row) => row.tableName).filter((table) => !expectedTables.includes(table));
  if (extraTables.length > 0) {
    warn(`Database has ${extraTables.length} extra table(s): ${extraTables.join(', ')}`);
  }
}

async function verifySeedState(connection) {
  const [businessRows] = await connection.query('select count(*) as total from businesses');
  const [userRows] = await connection.query('select count(*) as total from users');
  const [membershipRows] = await connection.query('select count(*) as total from business_memberships');

  if (businessRows[0].total > 0) pass(`Business records found: ${businessRows[0].total}`);
  else warn('No business records found. Import seed.sql or create the first tenant before login.');

  if (userRows[0].total > 0) pass(`User records found: ${userRows[0].total}`);
  else warn('No user records found. Import seed.sql or create a bootstrap owner user.');

  if (membershipRows[0].total > 0) pass(`Membership records found: ${membershipRows[0].total}`);
  else warn('No membership records found. Users need memberships before they can access a tenant.');
}

function pass(message) {
  console.log(`[pass] ${message}`);
}

function warn(message) {
  console.log(`[warn] ${message}`);
}

function fail(message) {
  console.log(`[fail] ${message}`);
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
