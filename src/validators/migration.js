import { DATABASE_SCHEMA_VERSION } from '../database/schema.js';
import { DATABASE_BOOT_STATUS } from '../database/versioning.js';

export const validateSchemaVersion = (version) => {
  const parsed = Number(version);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= DATABASE_SCHEMA_VERSION;
};

export const validateMigrationState = (state = {}) => {
  const allowed = new Set([
    DATABASE_BOOT_STATUS.PENDING,
    DATABASE_BOOT_STATUS.READY,
    DATABASE_BOOT_STATUS.FAILED,
    DATABASE_BOOT_STATUS.ROLLED_BACK,
  ]);

  const status = state.migrationStatus || DATABASE_BOOT_STATUS.PENDING;
  const rollbackStatus = state.rollbackStatus || 'none';

  return {
    valid: allowed.has(status) && (typeof rollbackStatus === 'string' || rollbackStatus === null),
    status,
    rollbackStatus,
  };
};

export const validateDatabaseReadiness = (database) => {
  if (!database || typeof database.open !== 'function') {
    return { valid: false, errors: ['Database instance is not ready.'] };
  }

  return { valid: true, errors: [] };
};
