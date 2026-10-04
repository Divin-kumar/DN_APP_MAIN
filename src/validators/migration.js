import { DATABASE_SCHEMA_VERSION } from '../database/schema.js';
import { DATABASE_BOOT_STATUS } from '../database/versioning.js';

export const validateSchemaVersion = (version) => {
  const parsed = Number(version);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= DATABASE_SCHEMA_VERSION;
};

export const validateSchemaMetadataRecord = (record, openedVersion = DATABASE_SCHEMA_VERSION) => {
  const storedVersion = Number(record?.value);
  const errors = [];
  if (!record || record.key !== 'schemaVersion') errors.push('Schema-version metadata row is missing or malformed.');
  if (!Number.isInteger(storedVersion) || storedVersion !== openedVersion) {
    errors.push(`Schema metadata version ${String(record?.value)} does not match opened database version ${openedVersion}.`);
  }
  if (openedVersion !== DATABASE_SCHEMA_VERSION) {
    errors.push(`Opened database version ${openedVersion} does not match application schema version ${DATABASE_SCHEMA_VERSION}.`);
  }
  if (record?.status !== 'ready') errors.push('Schema metadata status is not ready.');
  return { valid: errors.length === 0, errors, storedVersion, openedVersion };
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
