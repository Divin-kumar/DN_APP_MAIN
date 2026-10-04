import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapSettingsCollection, mapSettingsRecord } from './settingsMapper.js';
import { validateSettingsRecord, validateSettingsValue } from './settingsRepository.validation.js';
import { migrateLegacySettings } from './settingsRepository.migration.js';
import { bulkCreateUniqueRecords, createUniqueRecord, makeRepositoryConflict, recordsEquivalent, updateOwnedRecord, withRepositoryConflictAudit } from './repositoryConflict.js';

const settingsTable = () => db.table(DATABASE_TABLES.SETTINGS);

export const settingsRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return settingsTable().where('userId').equals(userId).toArray();
  },

  async getByKey(userId, key) {
    if (!userId || !key) return null;
    const rows = await settingsTable().where('[userId+key]').equals([userId, key]).toArray();
    if (rows.length < 2) return rows[0] || null;
    const deterministic = [...rows].sort((left, right) => left.id.localeCompare(right.id));
    if (deterministic.every((row) => recordsEquivalent(deterministic[0], row))) return deterministic[0];
    return withRepositoryConflictAudit({ principalId: userId, operation: 'settings.read-conflict' }, async () => {
      throw makeRepositoryConflict({ domain: 'settings', operation: 'read', record: deterministic[0], existing: deterministic[1], reason: 'multiple-setting-rows-differ', fields: ['value'] });
    });
  },

  async setOne(userId, key, value) {
    if (!userId || !key) return null;
    const validation = validateSettingsValue(key, value);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = {
      id: crypto.randomUUID(),
      userId,
      key,
      value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'dexie',
    };

    return createUniqueRecord({
      tableName: DATABASE_TABLES.SETTINGS,
      record: next,
      domain: 'settings',
      identityKey: (row) => row.key,
    });
  },

  async updateOne(userId, key, value) {
    if (!userId || !key) return null;
    const existing = await this.getByKey(userId, key);
    if (!existing) {
      return this.setOne(userId, key, value);
    }

    const validation = validateSettingsValue(key, value);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const updated = {
      ...existing,
      value,
      updatedAt: new Date().toISOString(),
      source: 'dexie',
    };

    return updateOwnedRecord({
      tableName: DATABASE_TABLES.SETTINGS,
      record: updated,
      domain: 'settings',
      identityKey: (row) => row.key,
    });
  },

  async setMany(userId, entries = []) {
    if (!userId || !Array.isArray(entries)) return [];
    const prepared = entries
      .map((entry) => mapSettingsRecord(entry, userId))
      .filter(Boolean)
      .map((entry) => {
        const validation = validateSettingsRecord(entry);
        if (!validation.valid) throw new Error(validation.errors.join(', '));
        return entry;
      });

    return bulkCreateUniqueRecords({
      tableName: DATABASE_TABLES.SETTINGS,
      records: prepared,
      domain: 'settings',
      identityKey: (row) => row.key,
    });
  },

  async resetToDefaults(userId) {
    if (!userId) return [];
    const all = await this.getAll(userId);
    await settingsTable().bulkDelete(all.map((item) => item.id));
    return [];
  },

  async getPreferences(userId) {
    const settings = await this.getAll(userId);
    return settings.reduce((accumulator, setting) => {
      if (setting && setting.key) {
        accumulator[setting.key] = setting.value;
      }
      return accumulator;
    }, {});
  },

  async updatePreferences(userId, partialPreferences = {}) {
    if (!userId || typeof partialPreferences !== 'object' || Array.isArray(partialPreferences)) {
      return {};
    }

    const entries = Object.entries(partialPreferences);
    if (!entries.length) return {};
    await db.transaction('rw', settingsTable(), async () => {
      for (const [key, value] of entries) await this.updateOne(userId, key, value);
    });
    return partialPreferences;
  },

  async migrateLegacySettings(userId = null) {
    const migration = migrateLegacySettings();
    const legacyEntries = mapSettingsCollection([
      ...(migration.snapshot?.preferences ? Object.entries(migration.snapshot.preferences).map(([key, value]) => ({ key, value, source: 'legacy' })) : []),
      ...(migration.snapshot?.theme ? [{ key: 'theme', value: migration.snapshot.theme, source: 'legacy' }] : []),
      ...(migration.snapshot?.adminValues && typeof migration.snapshot.adminValues === 'object'
        ? Object.entries(migration.snapshot.adminValues).map(([key, value]) => ({ key, value, source: 'legacy' }))
        : []),
    ], userId);

    if (legacyEntries.length) {
      await this.setMany(userId, legacyEntries);
    }

    return migration;
  },
};
