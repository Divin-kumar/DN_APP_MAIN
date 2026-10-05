import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { appendAudit } from './audit.js';

const makeJournalId = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `journal-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const appendMutationJournalEntry = async ({
  entityType,
  recordId,
  principalId,
  originDeviceId,
  changeSource,
  changeType,
  beforeValue = null,
  afterValue = null,
} = {}) => {
  const table = db.table(DATABASE_TABLES.SYNC_JOURNAL);
  const rows = await table.where('entityType').equals(entityType).toArray();
  const recordEntries = rows.filter((row) => row.recordId === recordId);
  const sequence = recordEntries.length + 1;
  const occurredAt = new Date().toISOString();
  const entry = {
    journalId: makeJournalId(),
    entityType,
    recordId,
    principalId: principalId || 'guest',
    originDeviceId: originDeviceId || 'unknown-device',
    changeSource: changeSource || 'user',
    changeType,
    beforeValue,
    afterValue,
    occurredAt,
    sequence,
    revision: sequence,
    syncState: 'pending',
    createdAt: occurredAt,
  };

  await table.put(entry);
  await appendAudit({
    principalId: entry.principalId,
    entityType,
    eventType: 'mutation-journaled',
    entityId: recordId,
    originDeviceId: entry.originDeviceId,
    details: { journalId: entry.journalId, changeType, sequence },
  });

  return entry;
};

export const getMutationJournal = async ({ entityType, recordId } = {}) => {
  const table = db.table(DATABASE_TABLES.SYNC_JOURNAL);
  const rows = await table.where('entityType').equals(entityType).toArray();
  return rows
    .filter((row) => row.recordId === recordId)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
};
