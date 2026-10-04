import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { DEFAULT_CODE_LISTS, serializeCodeListEntries } from '../utils/codeLists.js';
import { mapCodeListCollection, mapCodeListEntry } from './codeListMapper.js';
import { validateCodeListKey, validateCodeListRecord } from './codeListRepository.validation.js';
import { readLegacyCodeLists, readLegacyCodeListVersion } from './codeListLegacyAdapter.js';
import { bulkCreateUniqueRecords, makeRepositoryConflict, recordsEquivalent, updateOwnedRecord, withRepositoryConflictAudit } from './repositoryConflict.js';

const codeListTable = () => db.table(DATABASE_TABLES.CODE_LISTS);

export const codeListRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return codeListTable().where('userId').equals(userId).toArray();
  },

  async getList(userId, listKey) {
    if (!userId || !listKey || !validateCodeListKey(listKey)) return [];
    const rows = await codeListTable().where('[userId+listKey]').equals([userId, listKey]).toArray();
    const byValue = new Map();
    for (const row of rows) {
      const key = row.entryValue.trim().toLocaleLowerCase();
      const existing = byValue.get(key);
      if (!existing) {
        byValue.set(key, row);
        continue;
      }
      if (!recordsEquivalent(existing, row, { ignoreId: true })) {
        await withRepositoryConflictAudit({ principalId: userId, operation: 'codeLists.getList' }, async () => {
          throw makeRepositoryConflict({ domain: 'codeLists', operation: 'read', record: row, existing, reason: 'duplicate-logical-entry-differs', fields: ['label', 'active', 'greetingTemplate'] });
        });
      }
    }
    return [...byValue.values()].sort((left, right) => left.id.localeCompare(right.id));
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
    const normalizedValues = normalized.map((entry) => entry.value.trim().toLocaleLowerCase());
    if (new Set(normalizedValues).size !== normalizedValues.length) {
      return withRepositoryConflictAudit({ principalId: userId, operation: 'codeLists.setList' }, async () => {
        throw makeRepositoryConflict({ domain: 'codeLists', operation: 'setList', record: { userId, listKey }, reason: 'duplicate-entry-value-in-list', fields: ['entryValue'] });
      });
    }
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

    return withRepositoryConflictAudit({ principalId: userId, operation: 'codeLists.setList' }, async () => db.transaction('rw', codeListTable(), async () => {
      const existing = await codeListTable().where('[userId+listKey]').equals([userId, listKey]).toArray();
      const existingByValue = new Map();
      for (const row of existing) {
        const key = row.entryValue.trim().toLocaleLowerCase();
        const prior = existingByValue.get(key);
        if (prior && !recordsEquivalent(prior, row, { ignoreId: true })) {
          throw makeRepositoryConflict({ domain: 'codeLists', operation: 'setList', record: row, existing: prior, reason: 'preexisting-logical-entry-conflict', fields: ['label', 'active', 'greetingTemplate'] });
        }
        if (!prior) existingByValue.set(key, row);
      }
      const otherRows = (await codeListTable().toArray()).filter((row) => row.userId !== userId);
      for (const row of prepared) {
        const collision = otherRows.find((item) => item.id === row.id);
        if (collision) throw makeRepositoryConflict({ domain: 'codeLists', operation: 'setList', record: row, existing: collision, reason: 'id-owned-by-another-principal' });
      }
      if (existing.length) await codeListTable().bulkDelete(existing.map((row) => row.id));
      if (prepared.length) await bulkCreateUniqueRecords({ database: db, tableName: DATABASE_TABLES.CODE_LISTS, records: prepared, domain: 'codeLists', identityKey: (row) => `${row.listKey}:${row.entryValue.trim().toLocaleLowerCase()}` });
      return prepared;
    }));
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

    const existing = (await this.getList(userId, listKey))
      .find((row) => row.entryValue.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase()) || null;

    if (!existing && safeEntry.id) {
      const collision = await codeListTable().get(safeEntry.id);
      if (collision && collision.userId !== userId) {
        return withRepositoryConflictAudit({ principalId: userId, operation: 'codeLists.upsertEntry' }, async () => {
          throw makeRepositoryConflict({ domain: 'codeLists', operation: 'upsertEntry', record: safeEntry, existing: collision, reason: 'id-owned-by-another-principal' });
        });
      }
      if (collision && (collision.listKey !== listKey || collision.entryValue !== value)) {
        return withRepositoryConflictAudit({ principalId: userId, operation: 'codeLists.upsertEntry' }, async () => {
          throw makeRepositoryConflict({ domain: 'codeLists', operation: 'upsertEntry', record: safeEntry, existing: collision, reason: 'id-owned-by-another-logical-entry' });
        });
      }
    }

    const mapped = mapCodeListEntry(
      existing ? { ...existing, ...safeEntry, id: existing.id, updatedAt: new Date().toISOString() } : { ...safeEntry, id: safeEntry.id || crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      userId,
    );

    if (!mapped) return null;

    const validation = validateCodeListRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    if (existing) {
      return updateOwnedRecord({
        tableName: DATABASE_TABLES.CODE_LISTS,
        record: { ...mapped, id: existing.id },
        domain: 'codeLists',
        identityKey: (row) => `${row.listKey}:${row.entryValue.trim().toLocaleLowerCase()}`,
      });
    }
    return bulkCreateUniqueRecords({
      tableName: DATABASE_TABLES.CODE_LISTS,
      records: [mapped],
      domain: 'codeLists',
      identityKey: (row) => `${row.listKey}:${row.entryValue.trim().toLocaleLowerCase()}`,
    }).then((rows) => rows[0] || mapped);
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
