import { readLegacySettingsAsMap } from './settingsLegacyAdapter.js';
import { DEFAULT_METADATA } from '../database/metadata.js';

export const migrateLegacySettings = () => {
  const legacy = readLegacySettingsAsMap();
  const migratable = {
    preferences: legacy.preferences || {},
    theme: legacy.theme || null,
    adminValues: legacy.adminValues || {},
    version: legacy.version || 0,
  };

  return {
    migrated: true,
    snapshot: migratable,
    metadata: {
      schemaVersion: 1,
      migrationStatus: 'pending',
      lastSuccessfulMigration: null,
      rollbackStatus: 'none',
      updatedAt: new Date().toISOString(),
      ...DEFAULT_METADATA,
    },
  };
};
