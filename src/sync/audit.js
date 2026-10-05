import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';

const makeAuditId = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const appendAudit = async ({
  principalId,
  entityType,
  eventType,
  entityId,
  originDeviceId,
  details = {},
} = {}) => {
  const table = db.table(DATABASE_TABLES.SYNC_AUDIT);
  const occurredAt = new Date().toISOString();
  const entry = {
    auditId: makeAuditId(),
    principalId: principalId || 'guest',
    entityType: entityType || 'unknown',
    eventType,
    entityId,
    originDeviceId: originDeviceId || 'unknown-device',
    occurredAt,
    details,
    createdAt: occurredAt,
  };

  await table.put(entry);
  return entry;
};

export const listAuditEntries = async ({ principalId, entityType } = {}) => {
  const table = db.table(DATABASE_TABLES.SYNC_AUDIT);
  const rows = await table.toArray();
  return rows
    .filter((row) => (!principalId || row.principalId === principalId) && (!entityType || row.entityType === entityType))
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
};
