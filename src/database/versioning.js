export const DATABASE_BOOT_STATUS = Object.freeze({
  PENDING: 'pending',
  READY: 'ready',
  FAILED: 'failed',
  ROLLED_BACK: 'rolled_back',
});

export const DATABASE_VERSION_INFO = Object.freeze({
  current: 1,
  minimumSupported: 1,
  metadataKeys: Object.freeze({
    SCHEMA_VERSION: 'schemaVersion',
    MIGRATION_STATUS: 'migrationStatus',
    LAST_SUCCESSFUL_MIGRATION: 'lastSuccessfulMigration',
    ROLLBACK_STATUS: 'rollbackStatus',
  }),
});

export const getDatabaseVersionInfo = () => ({
  ...DATABASE_VERSION_INFO,
  metadataKeys: { ...DATABASE_VERSION_INFO.metadataKeys },
});
