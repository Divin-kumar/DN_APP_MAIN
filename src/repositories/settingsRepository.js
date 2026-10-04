import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapSettingsCollection, mapSettingsRecord } from './settingsMapper.js';
import { validateSettingsRecord, validateSettingsValue } from './settingsRepository.validation.js';
import { migrateLegacySettings } from './settingsRepository.migration.js';

const settingsTable = () => db.table(DATABASE_TABLES.SETTINGS);

export const settingsRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return settingsTable().where('userId').equals(userId).toArray();
  },

  async getByKey(userId, key) {
    if (!userId || !key) return null;
    return settingsTable().where('[userId+key]').equals([userId, key]).first();
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

    const record = await settingsTable().put(next);
    return { ...next, id: record };
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

    await settingsTable().put(updated);
    return updated;
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

    await settingsTable().bulkPut(prepared);
    return prepared;
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

    const entries = Object.entries(partialPreferences).map(([key, value]) => ({
      id: crypto.randomUUID(),
      userId,
      key,
      value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'dexie',
    }));

    if (!entries.length) return {};
    await settingsTable().bulkPut(entries);
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
