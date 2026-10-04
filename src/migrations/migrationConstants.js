export const MIGRATION_STATE = Object.freeze({
  NOT_STARTED: 'NotStarted',
  CHECKING_SOURCE: 'CheckingSource',
  SNAPSHOT_CREATED: 'SnapshotCreated',
  IMPORT_PREVIEW: 'ImportPreview',
  IMPORTING: 'Importing',
  VALIDATING: 'Validating',
  COMMIT_READY: 'CommitReady',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  ROLLED_BACK: 'RolledBack',
});

export const MIGRATION_STATES = Object.freeze(Object.values(MIGRATION_STATE));

export const MIGRATION_DOMAIN = Object.freeze({
  SETTINGS: 'settings',
  CODE_LISTS: 'codeLists',
  MOMENTS: 'moments',
  ACTIVITIES: 'activities',
  EXPENSES: 'expenses',
  INCOMES: 'incomes',
  MEMORIES: 'memories',
  ATTACHMENTS: 'attachments',
});

export const MIGRATION_SOURCE = Object.freeze({
  FIREBASE: 'firebase',
  GUEST: 'guest-local-storage',
  SETTINGS: 'settings-local-storage',
  DEXIE: 'dexie-existing',
});

export const MIGRATION_VERSION = 1;
export const DEFAULT_SNAPSHOT_RETENTION_DAYS = 30;
export const DEFAULT_MIGRATION_LOCK_TTL_MS = 5 * 60 * 1000;
