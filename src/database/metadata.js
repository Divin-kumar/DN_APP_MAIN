export const DATABASE_METADATA_KEYS = Object.freeze({
  SCHEMA_VERSION: 'schemaVersion',
  MIGRATION_STATUS: 'migrationStatus',
  LAST_SUCCESSFUL_MIGRATION: 'lastSuccessfulMigration',
  ROLLBACK_STATUS: 'rollbackStatus',
});

export const DEFAULT_METADATA = Object.freeze({
  schemaVersion: 1,
  migrationStatus: 'pending',
  lastSuccessfulMigration: null,
  rollbackStatus: 'none',
  updatedAt: null,
});

export const buildMetadataEntries = () => {
  const now = new Date().toISOString();
  return [
    {
      key: DATABASE_METADATA_KEYS.SCHEMA_VERSION,
      value: DEFAULT_METADATA.schemaVersion,
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
