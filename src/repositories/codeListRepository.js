import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { DEFAULT_CODE_LISTS, serializeCodeListEntries } from '../utils/codeLists.js';
import { mapCodeListCollection, mapCodeListEntry } from './codeListMapper.js';
import { validateCodeListKey, validateCodeListRecord } from './codeListRepository.validation.js';
import { readLegacyCodeLists, readLegacyCodeListVersion } from './codeListLegacyAdapter.js';

const codeListTable = () => db.table(DATABASE_TABLES.CODE_LISTS);

export const codeListRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return codeListTable().where('userId').equals(userId).toArray();
  },

  async getList(userId, listKey) {
    if (!userId || !listKey || !validateCodeListKey(listKey)) return [];
    return codeListTable().where('[userId+listKey]').equals([userId, listKey]).toArray();
  },

  async getMeta(userId, listKey) {
    if (!userId || !listKey || !validateCodeListKey(listKey)) return [];
    const rows = await this.getList(userId, listKey);
    return rows
      .map((entry) => ({
        value: entry.entryValue,
        label: entry.label,
        active: entry.active,
        isActive: entry.isActive,
        canGenerateGreetingCards: entry.canGenerateGreetingCards,
        greetingTemplate: entry.greetingTemplate,
        showInDashboardUpcoming: entry.showInDashboardUpcoming,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  },

  async setList(userId, listKey, entries = []) {
    if (!userId || !listKey || !validateCodeListKey(listKey)) return [];

    const normalized = serializeCodeListEntries(entries || DEFAULT_CODE_LISTS[listKey] || []);
    const prepared = normalized
      .map((entry) => {
        const mapped = mapCodeListEntry({
          id: crypto.randomUUID(),
          listKey,
          entryValue: entry.value,
          label: entry.label,
          active: entry.active,
          isActive: entry.isActive,
          canGenerateGreetingCards: entry.canGenerateGreetingCards,
          greetingTemplate: entry.greetingTemplate,
          showInDashboardUpcoming: entry.showInDashboardUpcoming,
          source: 'dexie',
        }, userId);

        if (!mapped) return null;
        const validation = validateCodeListRecord(mapped);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }

        return mapped;
      })
      .filter(Boolean);

    if (!prepared.length) return [];
    await codeListTable().bulkPut(prepared);
    return prepared;
  },

  async upsertEntry(userId, listKey, entry) {
    if (!userId || !listKey || !validateCodeListKey(listKey) || !entry) return null;

    const safeEntry = {
      ...entry,
      listKey,
      entryValue: typeof entry.entryValue === 'string' ? entry.entryValue : String(entry.value ?? '').trim(),
      label: typeof entry.label === 'string' ? entry.label : String(entry.value ?? '').trim(),
      active: entry.active !== false && entry.isActive !== false,
      isActive: entry.isActive !== false && entry.active !== false,
      canGenerateGreetingCards: entry.canGenerateGreetingCards ?? entry.generateGreetingCards ?? true,
      greetingTemplate: typeof entry.greetingTemplate === 'string' ? entry.greetingTemplate : '',
      showInDashboardUpcoming: entry.showInDashboardUpcoming ?? entry.showInDashboard ?? true,
      source: entry.source || 'dexie',
    };

    const value = safeEntry.entryValue;
    if (!value) return null;

    const existing = await codeListTable()
      .where('[userId+listKey]')
      .equals([userId, listKey])
      .filter((row) => row.entryValue === value)
      .first();

    const mapped = mapCodeListEntry(
      existing ? { ...existing, ...safeEntry, updatedAt: new Date().toISOString() } : { ...safeEntry, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      userId,
    );

    if (!mapped) return null;

    const validation = validateCodeListRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    await codeListTable().put(mapped);
    return mapped;
  },

  async deleteList(userId, listKey) {
    if (!userId || !listKey || !validateCodeListKey(listKey)) return 0;
    const rows = await this.getList(userId, listKey);
    if (!rows.length) return 0;
    await codeListTable().bulkDelete(rows.map((row) => row.id));
    return rows.length;
  },

  async resetToDefaults(userId) {
    if (!userId) return {};
    const result = {};

    for (const [listKey, values] of Object.entries(DEFAULT_CODE_LISTS)) {
      await this.deleteList(userId, listKey);
      const saved = await this.setList(userId, listKey, values);
      result[listKey] = saved;
    }

    return result;
  },

  async migrateLegacy(userId = null) {
    const legacy = readLegacyCodeLists();
    const version = readLegacyCodeListVersion();
    const prepared = mapCodeListCollection(
      Object.entries(legacy).flatMap(([listKey, values]) =>
        (Array.isArray(values) ? values : []).map((entry) => ({
          listKey,
          entryValue: typeof entry === 'string' ? entry : entry?.value,
          label: typeof entry === 'string' ? entry : entry?.label || entry?.value,
          active: typeof entry === 'object' ? entry.active !== false && entry.isActive !== false : true,
          isActive: typeof entry === 'object' ? entry.isActive !== false && entry.active !== false : true,
          canGenerateGreetingCards: typeof entry === 'object' ? entry.canGenerateGreetingCards ?? entry.generateGreetingCards ?? true : true,
          greetingTemplate: typeof entry === 'object' && typeof entry.greetingTemplate === 'string' ? entry.greetingTemplate : '',
          showInDashboardUpcoming: typeof entry === 'object' ? entry.showInDashboardUpcoming ?? entry.showInDashboard ?? true : true,
          source: 'legacy',
        })),
      ),
      userId,
    );

    if (userId && prepared.length) {
      await codeListTable().bulkPut(prepared);
    }

    return {
      migrated: true,
      version,
      entries: prepared,
    };
  },
};

export default codeListRepository;
