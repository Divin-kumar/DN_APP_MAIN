// Centralized table names keep database definitions and migration scaffolding aligned.
export const DATABASE_TABLES = Object.freeze({
  METADATA: 'metadata',
  DEVICE_REGISTRY: 'deviceRegistry',
  SYNC_JOURNAL: 'syncJournal',
  SYNC_TOMBSTONES: 'syncTombstones',
  SYNC_CONFLICTS: 'syncConflicts',
  SYNC_AUDIT: 'syncAudit',
  GUEST_LINEAGE: 'guestLineage',
  MOMENTS: 'moments',
  ACTIVITIES: 'activities',
  MEMORIES: 'memories',
  ATTACHMENTS: 'attachments',
  ATTACHMENT_LINKS: 'attachmentLinks',
  ATTACHMENT_FILES: 'attachmentFiles',
  EXPENSES: 'expenses',
  INCOMES: 'incomes',
  SETTINGS: 'settings',
  CODE_LISTS: 'codeLists',
  MIGRATION_RUNS: 'migrationRuns',
  MIGRATION_SNAPSHOTS: 'migrationSnapshots',
  MIGRATION_STAGING: 'migrationStaging',
  MIGRATION_AUDIT: 'migrationAudit',
  MIGRATION_LOCKS: 'migrationLocks',
});

export const DATABASE_TABLE_LIST = Object.freeze(Object.values(DATABASE_TABLES));
