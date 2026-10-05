import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { appendAudit } from './audit.js';

const makeConflictId = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `conflict-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const quarantineConflict = async ({
  recordId,
  entityType,
  principalId,
  localValue,
  incomingValue,
  conflictType,
  originDeviceId,
} = {}) => {
  const table = db.table(DATABASE_TABLES.SYNC_CONFLICTS);
  const createdAt = new Date().toISOString();
  const conflict = {
    conflictId: makeConflictId(),
    recordId,
    entityType,
    principalId: principalId || 'guest',
    localValue,
    incomingValue,
    conflictType,
    originDeviceId: originDeviceId || 'unknown-device',
    status: 'quarantined',
    createdAt,
    updatedAt: createdAt,
    auditTrail: [],
  };

  const audit = await appendAudit({
    principalId: conflict.principalId,
    entityType,
    eventType: 'conflict-quarantined',
    entityId: recordId,
    originDeviceId: conflict.originDeviceId,
    details: { conflictId: conflict.conflictId, conflictType },
  });

  conflict.auditTrail = [audit];
  await table.put(conflict);
  return conflict;
};

export const resolveConflict = async (conflictId, resolution = {}) => {
  const table = db.table(DATABASE_TABLES.SYNC_CONFLICTS);
  const existing = await table.get(conflictId);
  if (!existing) throw new Error(`Conflict ${conflictId} was not found.`);

  const updated = {
    ...existing,
    status: 'resolved',
    resolution,
    resolvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await table.put(updated);
  return updated;
};
