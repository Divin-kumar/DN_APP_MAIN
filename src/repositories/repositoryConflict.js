import Dexie from 'dexie';
import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { isIsoDate, isNonEmptyString } from '../validators/base.js';

const VOLATILE_FIELDS = new Set(['createdAt', 'updatedAt', 'source', 'table', 'firestoreId']);
const makeId = () => globalThis.crypto?.randomUUID?.() || `runtime-conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const stableRecordString = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableRecordString).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableRecordString(value[key])}`).join(',')}}`;
};

const comparableRecord = (record, ignoreId = false) => Object.fromEntries(
  Object.entries(record || {})
    .filter(([key]) => !VOLATILE_FIELDS.has(key) && !(ignoreId && key === 'id'))
    .sort(([left], [right]) => left.localeCompare(right)),
);

export const recordsEquivalent = (left, right, { ignoreId = false } = {}) =>
  stableRecordString(comparableRecord(left, ignoreId)) === stableRecordString(comparableRecord(right, ignoreId));

export const differingRecordFields = (left, right) => {
  const a = comparableRecord(left);
  const b = comparableRecord(right);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => stableRecordString(a[key]) !== stableRecordString(b[key]));
};

const fingerprint = (value) => {
  const input = stableRecordString(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export class RepositoryConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RepositoryConflictError';
    this.code = 'REPOSITORY_CONFLICT';
    this.details = details;
  }
}

export const makeRepositoryConflict = ({ domain, operation, record, existing, reason, fields = [] }) => new RepositoryConflictError(
  `${domain} ${operation} conflicts with an existing record (${reason}).`,
  {
    domain,
    operation,
    recordId: record?.id || null,
    existingId: existing?.id || null,
    reason,
    fields,
    existingFingerprint: existing ? fingerprint(comparableRecord(existing)) : null,
    incomingFingerprint: record ? fingerprint(comparableRecord(record)) : null,
  },
);

const writeConflictAudit = async ({ principalId, error }) => {
  const details = error.details || {};
  await db.table(DATABASE_TABLES.MIGRATION_AUDIT).add({
    id: makeId(),
    runId: `runtime-conflict:${makeId()}`,
    principalId,
    occurredAt: new Date().toISOString(),
    eventType: 'repository-write-conflict',
    source: 'dexie-runtime',
    migrationVersion: null,
    outcome: 'conflict',
    conflictStatus: 'unresolved',
    domain: details.domain || null,
    operation: details.operation || null,
    originalId: details.recordId || null,
    existingId: details.existingId || null,
    reason: details.reason || 'primary-key-conflict',
    differingFields: details.fields || [],
    existingFingerprint: details.existingFingerprint || null,
    incomingFingerprint: details.incomingFingerprint || null,
  });
};

export const withRepositoryConflictAudit = async ({ principalId, operation }, work) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RepositoryConflictError || error?.name === 'ConstraintError') {
      const conflict = error instanceof RepositoryConflictError
        ? error
        : new RepositoryConflictError('Repository primary-key collision.', { operation, reason: 'primary-key-collision' });
      try {
        await Dexie.ignoreTransaction(() => writeConflictAudit({ principalId, error: conflict }));
      } catch (auditError) {
        throw new AggregateError([conflict, auditError], 'Repository conflict was blocked but could not be audited.');
      }
      throw conflict;
    }
    throw error;
  }
};

export const findLogicalMatch = (rows, record, identityKey) => {
  if (!identityKey) return null;
  const expected = identityKey(record);
  return rows.find((row) => row.userId === record.userId && identityKey(row) === expected) || null;
};

export const prepareCreateBatch = ({ rows, existingRows, domain, identityKey = null }) => {
  const accepted = [];
  const stagedIds = new Map();
  const stagedLogical = new Map();

  for (const record of rows) {
    const existingById = stagedIds.get(record.id) || existingRows.find((row) => row.id === record.id);
    if (existingById) {
      if (recordsEquivalent(existingById, record)) {
        stagedIds.set(record.id, existingById);
        const sameLogical = identityKey?.(record);
        if (sameLogical !== undefined && sameLogical !== null) stagedLogical.set(sameLogical, existingById);
        continue;
      }
      throw makeRepositoryConflict({
        domain,
        operation: 'bulk-create',
        record,
        existing: existingById,
        reason: 'same-id-different-content',
        fields: differingRecordFields(existingById, record),
      });
    }

    const logicalKey = identityKey?.(record);
    const existingLogical = logicalKey === undefined || logicalKey === null
      ? null
      : stagedLogical.get(logicalKey) || existingRows.find((row) => row.userId === record.userId && identityKey(row) === logicalKey);
    if (existingLogical) {
      if (recordsEquivalent(existingLogical, record, { ignoreId: true })) {
        stagedIds.set(record.id, existingLogical);
        stagedLogical.set(logicalKey, existingLogical);
        continue;
      }
      throw makeRepositoryConflict({
        domain,
        operation: 'bulk-create',
        record,
        existing: existingLogical,
        reason: 'same-logical-identity-different-content',
        fields: differingRecordFields(existingLogical, record),
      });
    }

    accepted.push(record);
    stagedIds.set(record.id, record);
    if (logicalKey !== undefined && logicalKey !== null) stagedLogical.set(logicalKey, record);
  }
  return accepted;
};

export const createUniqueRecord = async ({ database = db, tableName, record, domain, identityKey = null, transactionTables = [], beforeInsert = null }) => {
  const table = database.table(tableName);
  return withRepositoryConflictAudit({ principalId: record.userId, operation: `${domain}.create` }, async () => database.transaction('rw', table, ...transactionTables, async () => {
    if (beforeInsert) await beforeInsert();
    const sameId = await table.get(record.id);
    if (sameId) {
      if (sameId.userId === record.userId && recordsEquivalent(sameId, record)) return sameId;
      throw makeRepositoryConflict({
        domain,
        operation: 'create',
        record,
        existing: sameId,
        reason: sameId.userId === record.userId ? 'same-id-different-content' : 'id-owned-by-another-principal',
        fields: differingRecordFields(sameId, record),
      });
    }

    if (identityKey) {
      const ownerRows = await table.where('userId').equals(record.userId).toArray();
      const sameLogical = findLogicalMatch(ownerRows, record, identityKey);
      if (sameLogical) {
        if (recordsEquivalent(sameLogical, record, { ignoreId: true })) return sameLogical;
        throw makeRepositoryConflict({
          domain,
          operation: 'create',
          record,
          existing: sameLogical,
          reason: 'same-logical-identity-different-content',
          fields: differingRecordFields(sameLogical, record),
        });
      }
    }

    await table.add(record);
    return record;
  }));
};

export const bulkCreateUniqueRecords = async ({ database = db, tableName, records, domain, identityKey = null, transactionTables = [], beforeInsert = null }) => {
  if (!records.length) return [];
  const table = database.table(tableName);
  return withRepositoryConflictAudit({ principalId: records[0].userId, operation: `${domain}.bulkCreate` }, async () => database.transaction('rw', table, ...transactionTables, async () => {
    if (beforeInsert) await beforeInsert(records);
    const existingRows = await table.toArray();
    const accepted = prepareCreateBatch({ rows: records, existingRows, domain, identityKey });
    if (accepted.length) await table.bulkAdd(accepted);
    return accepted;
  }));
};

export const updateOwnedRecord = async ({ database = db, tableName, record, domain, identityKey = null, transactionTables = [], beforeUpdate = null }) => {
  const table = database.table(tableName);
  return withRepositoryConflictAudit({ principalId: record.userId, operation: `${domain}.update` }, async () => database.transaction('rw', table, ...transactionTables, async () => {
    const existing = await table.get(record.id);
    if (!existing) throw new Error(`${domain} record ${record.id} does not exist for update.`);
    if (existing.userId !== record.userId) {
      throw makeRepositoryConflict({ domain, operation: 'update', record, existing, reason: 'id-owned-by-another-principal' });
    }
    if (beforeUpdate) await beforeUpdate(existing, record);
    if (identityKey) {
      const ownerRows = await table.where('userId').equals(record.userId).toArray();
      const sameLogical = findLogicalMatch(ownerRows, record, identityKey);
      if (sameLogical && sameLogical.id !== existing.id) {
        throw makeRepositoryConflict({
          domain,
          operation: 'update',
          record,
          existing: sameLogical,
          reason: 'logical-identity-already-owned-by-another-row',
          fields: differingRecordFields(sameLogical, record),
        });
      }
    }
    const next = { ...existing, ...record, createdAt: existing.createdAt || record.createdAt };
    await table.put(next);
    return next;
  }));
};

export const repositoryIdentityKey = (...parts) => stableRecordString(parts);

export const assertRawRepositoryInput = (domain, record, { requiredStrings = [], requiredDates = [], optionalDates = [], optionalFiniteNumbers = [] } = {}) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`${domain} record must be an object.`);
  }
  if (record.id !== undefined && record.id !== null && !isNonEmptyString(record.id)) {
    throw new TypeError(`${domain} id must be a non-empty string when supplied.`);
  }
  for (const field of requiredStrings) {
    if (!isNonEmptyString(record[field])) throw new TypeError(`${domain} ${field} is required and must be a non-empty string.`);
  }
  for (const field of requiredDates) {
    if (!isIsoDate(record[field])) throw new TypeError(`${domain} ${field} must be a valid ISO date.`);
  }
  for (const field of optionalDates) {
    if (record[field] !== undefined && record[field] !== null && !isIsoDate(record[field])) {
      throw new TypeError(`${domain} ${field} must be a valid ISO date when supplied.`);
    }
  }
  for (const field of optionalFiniteNumbers) {
    if (record[field] !== undefined && record[field] !== null && (!Number.isFinite(Number(record[field])) || Number(record[field]) < 0)) {
      throw new TypeError(`${domain} ${field} must be a finite non-negative number.`);
    }
  }
};
