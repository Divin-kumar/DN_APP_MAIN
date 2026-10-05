import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { appendAudit } from './audit.js';

const makeTombstoneId = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `tombstone-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const createTombstone = async ({
  recordId,
  entityType,
  deletedByDeviceId,
  deletedByPrincipalId,
  deleteReason = 'user-requested',
} = {}) => {
  const table = db.table(DATABASE_TABLES.SYNC_TOMBSTONES);
  const deletedAt = new Date().toISOString();
  const retentionUntil = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const row = {
    tombstoneId: makeTombstoneId(),
    recordId,
    entityType,
    deletedByDeviceId: deletedByDeviceId || 'unknown-device',
    deletedByPrincipalId: deletedByPrincipalId || 'guest',
    deletedAt,
    retentionUntil,
    deleteReason,
    status: 'active',
    tombstone: true,
    syncState: 'tombstoned',
  };

  await table.put(row);
  await appendAudit({
    principalId: row.deletedByPrincipalId,
    entityType,
    eventType: 'tombstone-created',
    entityId: recordId,
    originDeviceId: row.deletedByDeviceId,
    details: { tombstoneId: row.tombstoneId, deleteReason },
  });

  return row;
};

export const transitionTombstoneState = async (tombstoneId, status) => {
  const table = db.table(DATABASE_TABLES.SYNC_TOMBSTONES);
  const existing = await table.get(tombstoneId);
  if (!existing) throw new Error(`Tombstone ${tombstoneId} was not found.`);

  const updated = { ...existing, status, syncState: status, updatedAt: new Date().toISOString() };
  await table.put(updated);
  return updated;
};
