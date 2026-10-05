import { DATABASE_SCHEMA_VERSION } from './schema.js';

export const DATABASE_METADATA_KEYS = Object.freeze({
  SCHEMA_VERSION: 'schemaVersion',
  MIGRATION_STATUS: 'migrationStatus',
  LAST_SUCCESSFUL_MIGRATION: 'lastSuccessfulMigration',
  ROLLBACK_STATUS: 'rollbackStatus',
  SYNC_FOUNDATION_STATUS: 'syncFoundationStatus',
});

export const DEFAULT_METADATA = Object.freeze({
  schemaVersion: DATABASE_SCHEMA_VERSION,
  migrationStatus: 'pending',
  lastSuccessfulMigration: null,
  rollbackStatus: 'none',
  syncFoundationStatus: 'ready',
  updatedAt: null,
});

export const buildMetadataEntries = (schemaVersion = DATABASE_SCHEMA_VERSION) => {
  const now = new Date().toISOString();
  return [
    {
      key: DATABASE_METADATA_KEYS.SCHEMA_VERSION,
      value: schemaVersion,
      updatedAt: now,
      status: 'ready',
    },
    {
      key: DATABASE_METADATA_KEYS.MIGRATION_STATUS,
      value: DEFAULT_METADATA.migrationStatus,
      updatedAt: now,
      status: DEFAULT_METADATA.migrationStatus,
    },
    {
      key: DATABASE_METADATA_KEYS.LAST_SUCCESSFUL_MIGRATION,
      value: DEFAULT_METADATA.lastSuccessfulMigration,
      updatedAt: now,
      status: 'ready',
    },
    {
      key: DATABASE_METADATA_KEYS.ROLLBACK_STATUS,
      value: DEFAULT_METADATA.rollbackStatus,
      updatedAt: now,
      status: DEFAULT_METADATA.rollbackStatus,
    },
    {
      key: DATABASE_METADATA_KEYS.SYNC_FOUNDATION_STATUS,
      value: DEFAULT_METADATA.syncFoundationStatus,
      updatedAt: now,
      status: DEFAULT_METADATA.syncFoundationStatus,
    },
  ];
};

export const buildDefaultMetadata = (overrides = {}) => ({
  ...DEFAULT_METADATA,
  ...overrides,
  updatedAt: overrides.updatedAt || new Date().toISOString(),
});

export const normalizeMetadataRecord = (record = {}) => {
  const normalized = { ...DEFAULT_METADATA, ...record };
  return {
    ...normalized,
    updatedAt: normalized.updatedAt || new Date().toISOString(),
  };
};
