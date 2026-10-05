import { normalizeRevision } from './revisionTracker.js';

export const buildSyncMetadataEnvelope = ({
  principalId,
  originDeviceId,
  recordType = 'unknown',
  changeSource = 'user',
  revision = 1,
  syncState = 'unsynced',
  lastSyncAt = null,
  tombstone = false,
  conflictStatus = 'none',
  lastConflictAt = null,
} = {}) => ({
  principalId: principalId || 'guest',
  originDeviceId: originDeviceId || 'unknown-device',
  recordType,
  changeSource,
  revision: normalizeRevision(revision),
  syncState,
  lastSyncAt,
  tombstone,
  conflictStatus,
  lastConflictAt,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const applySyncMetadataEnvelope = (record = {}, options = {}) => ({
  ...record,
  ...buildSyncMetadataEnvelope(options),
});
