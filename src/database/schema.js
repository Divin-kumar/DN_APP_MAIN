import { DATABASE_TABLES } from './tables.js';

export const DATABASE_SCHEMA_VERSION = 4;

export const DATABASE_SCHEMA = Object.freeze({
  [DATABASE_TABLES.METADATA]: '&key, updatedAt, status',
  [DATABASE_TABLES.DEVICE_REGISTRY]: '&deviceId, principalId, status, registeredAt, lastSeenAt, [principalId+status]',
  [DATABASE_TABLES.SYNC_JOURNAL]: '&journalId, entityType, recordId, principalId, originDeviceId, changeType, occurredAt, [entityType+recordId], [principalId+occurredAt]',
  [DATABASE_TABLES.SYNC_TOMBSTONES]: '&tombstoneId, recordId, entityType, status, deletedAt, retentionUntil, [recordId+entityType]',
  [DATABASE_TABLES.SYNC_CONFLICTS]: '&conflictId, recordId, entityType, status, createdAt, [recordId+status]',
  [DATABASE_TABLES.SYNC_AUDIT]: '&auditId, principalId, entityType, eventType, occurredAt, [principalId+occurredAt]',
  [DATABASE_TABLES.GUEST_LINEAGE]: '&lineageId, recordId, entityType, principalId, guestPrincipalId, convertedAt, [principalId+convertedAt]',
  [DATABASE_TABLES.MOMENTS]: '&id, userId, ownerType, date, type, status, updatedAt, [userId+ownerType]',
  [DATABASE_TABLES.ACTIVITIES]: '&id, momentId, userId, date, completed, priority, updatedAt, [momentId+date]',
  [DATABASE_TABLES.MEMORIES]: '&id, momentId, userId, createdAt, kind, updatedAt, [momentId+createdAt]',
  [DATABASE_TABLES.ATTACHMENTS]: '&id, momentId, userId, type, createdAt, updatedAt, [momentId+createdAt]',
  [DATABASE_TABLES.ATTACHMENT_LINKS]: '&id, userId, attachmentId, parentType, parentId, createdAt, [userId+attachmentId], [userId+parentType+parentId]',
  [DATABASE_TABLES.ATTACHMENT_FILES]: '&attachmentId, userId, mimeType, size, updatedAt',
  [DATABASE_TABLES.EXPENSES]: '&id, userId, momentId, activityId, date, category, amount, updatedAt, [userId+date]',
  [DATABASE_TABLES.INCOMES]: '&id, userId, date, type, amount, updatedAt, [userId+date]',
  [DATABASE_TABLES.SETTINGS]: '&id, userId, key, updatedAt, [userId+key]',
  [DATABASE_TABLES.CODE_LISTS]: '&id, userId, listKey, entryValue, active, updatedAt, [userId+listKey]',
  [DATABASE_TABLES.MIGRATION_RUNS]: '&id, principalId, state, migrationVersion, startedAt, sourceFingerprint, [principalId+state]',
  [DATABASE_TABLES.MIGRATION_SNAPSHOTS]: '&id, runId, principalId, createdAt, expiresAt, status, [runId+status]',
  [DATABASE_TABLES.MIGRATION_STAGING]: '&id, runId, principalId, domain, [runId+domain]',
  [DATABASE_TABLES.MIGRATION_AUDIT]: '&id, runId, principalId, occurredAt, eventType, [runId+occurredAt]',
  [DATABASE_TABLES.MIGRATION_LOCKS]: '&principalId, runId, expiresAt',
});

export const DATABASE_SCHEMA_INFO = Object.freeze({
  version: DATABASE_SCHEMA_VERSION,
  tables: DATABASE_SCHEMA,
});
