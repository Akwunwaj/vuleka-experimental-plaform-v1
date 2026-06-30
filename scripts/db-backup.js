#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
const backupDir = path.resolve(process.env.DB_BACKUP_DIR || path.join(__dirname, '..', 'backups'));

async function main() {
  const config = readDbConfig();
  const tables = readExpectedTables();
  const filePath = path.join(backupDir, `chatclan-${config.database}-${timestamp()}.sql`);

  fs.mkdirSync(backupDir, { recursive: true });
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

  const connection = await mysql.createConnection(config);
  try {
    writeHeader(stream, config.database);
    for (const table of tables) {
      await dumpTable({ connection, stream, table });
    }
    writeFooter(stream);
  } finally {
    await connection.end();
    await closeStream(stream);
  }

  const stats = fs.statSync(filePath);
  console.log(`Database backup written: ${filePath}`);
  console.log(`Size: ${stats.size} bytes`);
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
    dateStrings: true
  };
}

function readExpectedTables() {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const tables = [...schema.matchAll(/create\s+table\s+if\s+not\s+exists\s+`?([a-z0-9_]+)`?\s*\(/gi)].map((match) => match[1]);
  const uniqueTables = [...new Set(tables)];
  if (!uniqueTables.length) throw new Error(`No tables found in ${schemaPath}`);
  return uniqueTables;
}

function writeHeader(stream, databaseName) {
  stream.write('-- ChatClan MariaDB backup\n');
  stream.write(`-- Database: ${databaseName}\n`);
  stream.write(`-- Created at: ${new Date().toISOString()}\n\n`);
  stream.write('set foreign_key_checks = 0;\n');
  stream.write('set sql_mode = "NO_AUTO_VALUE_ON_ZERO";\n\n');
}

async function dumpTable({ connection, stream, table }) {
  const escapedTable = quoteIdentifier(table);
  const [createRows] = await connection.query(`show create table ${escapedTable}`);
  const createSql = createRows?.[0]?.['Create Table'];
  if (!createSql) throw new Error(`Could not read DDL for table ${table}`);

  stream.write(`-- Table: ${table}\n`);
  stream.write(`drop table if exists ${escapedTable};\n`);
  stream.write(`${createSql};\n\n`);

  const [rows, fields] = await connection.query(`select * from ${escapedTable}`);
  if (!rows.length) {
    stream.write(`-- 0 rows\n\n`);
    console.log(`[pass] ${table}: 0 rows`);
    return;
  }

  const columns = fields.map((field) => quoteIdentifier(field.name)).join(', ');
  for (const row of rows) {
    const values = fields.map((field) => sqlLiteral(row[field.name])).join(', ');
    stream.write(`insert into ${escapedTable} (${columns}) values (${values});\n`);
  }
  stream.write('\n');
  console.log(`[pass] ${table}: ${rows.length} row(s)`);
}

function writeFooter(stream) {
  stream.write('set foreign_key_checks = 1;\n');
}

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  if (Buffer.isBuffer(value)) return `x'${value.toString('hex')}'`;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/'/g, "''")}'`;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream.end((error) => (error ? reject(error) : resolve()));
  });
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
