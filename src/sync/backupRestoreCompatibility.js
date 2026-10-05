import { buildSyncMetadataEnvelope } from './syncMetadataEnvelope.js';

export const preserveSyncMetadataForBackup = (record = {}) => ({
  ...record,
  ...buildSyncMetadataEnvelope({
    principalId: record.principalId,
    originDeviceId: record.originDeviceId,
    recordType: record.recordType || 'unknown',
    changeSource: record.changeSource || 'user',
    revision: record.revision || 1,
    syncState: record.syncState || 'unsynced',
    lastSyncAt: record.lastSyncAt || null,
    tombstone: Boolean(record.tombstone),
    conflictStatus: record.conflictStatus || 'none',
    lastConflictAt: record.lastConflictAt || null,
  }),
});
