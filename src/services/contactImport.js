const { parse } = require('csv-parse/sync');
const { hasDatabaseConfig, query } = require('../db/pool');
const { enforcePlanLimit } = require('./subscriptionPolicy');

const TRUE_VALUES = new Set(['true', 'yes', 'y', '1', 'opted in', 'opt-in', 'consented']);

async function importContacts({ businessId, csvText, mapping, commit = false }) {
  if (!csvText || typeof csvText !== 'string') {
    const error = new Error('csvText is required');
    error.status = 400;
    throw error;
  }

  validateMapping(mapping);

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });

  const seenPhones = new Set();
  const validRows = [];
  const errors = [];
  let duplicates = 0;

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    const row = buildContactRow(record, mapping);
    const phone = normalizePhone(row.phone);

    if (!row.name) {
      errors.push(rowError(rowNumber, 'name', 'Name is required'));
      continue;
    }

    if (!phone.ok) {
      errors.push(rowError(rowNumber, 'phone', phone.message));
      continue;
    }

    if (seenPhones.has(phone.value)) {
      duplicates += 1;
      continue;
    }

    seenPhones.add(phone.value);

    if (!row.optedIn) {
      errors.push(rowError(rowNumber, 'optIn', 'Opt-in consent is required for POPIA compliance'));
      continue;
    }

    validRows.push({
      rowNumber,
      name: row.name,
      phone: phone.value,
      email: row.email || null,
      segment: row.segment || 'Imported',
      optedIn: true,
      optInChannel: row.optInChannel || 'CSV import'
    });
  }

  let imported = 0;
  let existingDuplicates = 0;

  if (commit && validRows.length) {
    await enforcePlanLimit({ businessId, resource: 'contacts', requested: validRows.length });
    const result = await persistImport({ businessId, rows: validRows, errors, fileName: 'contacts.csv' });
    imported = result.imported;
    existingDuplicates = result.duplicates;
  }

  return {
    commit,
    totalRows: records.length,
    validRows: validRows.length,
    imported: commit ? imported : 0,
    duplicates: duplicates + existingDuplicates,
    errors,
    preview: validRows.slice(0, 10)
  };
}

function validateMapping(mapping = {}) {
  const required = ['name', 'phone', 'optIn'];
  for (const key of required) {
    if (!mapping[key]) {
      const label = key === 'optIn' ? 'Opt-in consent column is required for POPIA compliance — please map a column.' : `${key} column is required`;
      const error = new Error(label);
      error.status = 400;
      throw error;
    }
  }
}

function buildContactRow(record, mapping) {
  return {
    name: value(record, mapping.name),
    phone: value(record, mapping.phone),
    email: value(record, mapping.email),
    segment: value(record, mapping.segment),
    optedIn: TRUE_VALUES.has(value(record, mapping.optIn).toLowerCase()),
    optInChannel: value(record, mapping.optInChannel)
  };
}

function value(record, column) {
  return column ? String(record[column] || '').trim() : '';
}

function normalizePhone(phone) {
  const compact = String(phone || '').replace(/[()\s-]/g, '');
  if (!compact) return { ok: false, message: 'Phone number is required' };
  if (compact.startsWith('0')) {
    return { ok: false, message: 'Missing country code — please add +27 for South Africa' };
  }
  if (!compact.startsWith('+27')) {
    return { ok: false, message: 'Missing country code — please add +27 for South Africa' };
  }
  if (!/^\+27\d{9}$/.test(compact)) {
    return { ok: false, message: 'Phone number must be a valid South African number in +27 format' };
  }
  return { ok: true, value: compact };
}

function rowError(row, field, message) {
  return { row, field, message };
}

async function persistImport({ businessId, rows, errors, fileName }) {
  if (!hasDatabaseConfig()) {
    return { imported: rows.length, duplicates: 0 };
  }

  const jobResult = await query(
    `insert into contact_import_jobs
       (business_id, file_name, status, total_rows, error_count)
     values (:businessId, :fileName, 'processing', :totalRows, :errorCount)`,
    {
      businessId,
      fileName,
      totalRows: rows.length + errors.length,
      errorCount: errors.length
    }
  );
  const jobId = jobResult.insertId;

  let imported = 0;
  let duplicates = 0;

  for (const row of rows) {
    const existing = await query(
      'select id from contacts where business_id = :businessId and phone = :phone limit 1',
      { businessId, phone: row.phone }
    );

    if (existing?.length) {
      duplicates += 1;
      continue;
    }

    const result = await query(
      `insert into contacts
         (business_id, name, phone, email, segment, opted_in, opt_in_channel, opt_in_at)
       values
         (:businessId, :name, :phone, :email, :segment, 1, :optInChannel, current_timestamp)`,
      { ...row, businessId }
    );

    await query(
      `insert into opt_in_events
         (business_id, contact_id, event_type, channel, source, occurred_at)
       values
         (:businessId, :contactId, 'opt_in', :channel, 'CSV import', current_timestamp)`,
      {
        businessId,
        contactId: result.insertId,
        channel: row.optInChannel
      }
    );

    imported += 1;
  }

  await query(
    `update contact_import_jobs
     set status = 'completed', imported_count = :imported, duplicate_count = :duplicates, completed_at = current_timestamp
     where id = :jobId`,
    { imported, duplicates, jobId }
  );

  return { imported, duplicates };
}

module.exports = { importContacts, normalizePhone };
