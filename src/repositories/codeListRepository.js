import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { DEFAULT_CODE_LISTS, normalizeCodeListIdentityValue, serializeCodeListEntries } from '../utils/codeLists.js';
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
    const rows = (await codeListTable().where('[userId+listKey]').equals([userId, listKey]).toArray())
      .map((row) => ({ ...row, value: row.value ?? row.entryValue }));
    const byValue = new Map();
    for (const row of rows) {
      const key = normalizeCodeListIdentityValue(row.entryValue);
      const existing = byValue.get(key);
      if (!existing) {
        byValue.set(key, row);
        continue;
      }
      if (!recordsEquivalent(existing, row, { ignoreId: true })) {
        throw new Error(`The ${listKey} list contains entries with the same name. Review the list and keep one version.`);
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
    const normalizedValues = normalized.map((entry) => normalizeCodeListIdentityValue(entry.value));
    if (new Set(normalizedValues).size !== normalizedValues.length) {
      throw new Error(`This ${listKey.replace(/([A-Z])/g, ' $1').toLowerCase()} list already contains an entry with that name.`);
    }

    return withRepositoryConflictAudit({ principalId: userId, operation: 'codeLists.setList' }, async () => db.transaction('rw', codeListTable(), async () => {
      const existing = await codeListTable().where('[userId+listKey]').equals([userId, listKey]).toArray();
      const existingByValue = new Map();
      for (const row of existing) {
        const key = normalizeCodeListIdentityValue(row.entryValue);
        const prior = existingByValue.get(key);
        if (prior && !recordsEquivalent(prior, row, { ignoreId: true })) {
          throw new Error(`The ${listKey} list contains duplicate names. Resolve those entries before saving.`);
        }
        if (!prior) existingByValue.set(key, row);
      }
      const existingById = new Map(existing.map((row) => [row.id, row]));
      const prepared = normalized.map((entry) => {
        const prior = (entry.id && existingById.get(entry.id)) || existingByValue.get(normalizeCodeListIdentityValue(entry.value));
        if (prior && normalizeCodeListIdentityValue(prior.entryValue) !== normalizeCodeListIdentityValue(entry.value)) {
          throw new Error('A saved list value is a stable identity and cannot be renamed. Edit its display name instead.');
        }
        const mapped = mapCodeListEntry({
          ...entry,
          id: prior?.id || entry.id || crypto.randomUUID(),
          listKey,
          entryValue: entry.value,
          source: 'dexie',
        }, userId);
        if (!mapped) return null;
        const validation = validateCodeListRecord(mapped);
        if (!validation.valid) throw new Error(validation.errors.join(', '));
        return mapped;
      }).filter(Boolean);
      const otherRows = (await codeListTable().toArray()).filter((row) => row.userId !== userId);
      for (const row of prepared) {
        const collision = otherRows.find((item) => item.id === row.id);
        if (collision) throw makeRepositoryConflict({ domain: 'codeLists', operation: 'setList', record: row, existing: collision, reason: 'id-owned-by-another-principal' });
      }
      const retainedIds = new Set(prepared.map((row) => row.id));
      const removedIds = existing.filter((row) => !retainedIds.has(row.id)).map((row) => row.id);
      if (removedIds.length) await codeListTable().bulkDelete(removedIds);
      if (prepared.length) {
        const logicalKeys = new Set();
        for (const row of prepared) {
          const logicalKey = normalizeCodeListIdentityValue(row.entryValue);
          if (logicalKeys.has(logicalKey)) throw new Error(`This ${listKey} list already contains an entry with that name.`);
          logicalKeys.add(logicalKey);
        }
        await codeListTable().bulkPut(prepared);
      }
      return prepared;
    }));
  },

  async upsertEntry(userId, listKey, entry) {
    if (!userId || !listKey || !validateCodeListKey(listKey) || !entry) return null;

    const safeEntry = {
      ...entry,
      listKey,
      entryValue: String(entry.value ?? entry.entryValue ?? '').trim().replace(/\s+/g, ' '),
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
      .find((row) => normalizeCodeListIdentityValue(row.entryValue) === normalizeCodeListIdentityValue(value)) || null;

    if (existing && safeEntry.id && existing.id !== safeEntry.id) {
      throw new Error(`“${existing.label}” is already in this list. Choose a different value.`);
    }

    if (!existing && safeEntry.id) {
      const collision = await codeListTable().get(safeEntry.id);
      if (collision && collision.userId !== userId) {
        return withRepositoryConflictAudit({ principalId: userId, operation: 'codeLists.upsertEntry' }, async () => {
          throw makeRepositoryConflict({ domain: 'codeLists', operation: 'upsertEntry', record: safeEntry, existing: collision, reason: 'id-owned-by-another-principal' });
        });
      }
      if (collision && (collision.listKey !== listKey || collision.entryValue !== value)) {
        throw new Error('A saved list value is a stable identity and cannot be renamed. Edit its display name instead.');
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
        identityKey: (row) => `${row.listKey}:${normalizeCodeListIdentityValue(row.entryValue)}`,
      });
    }
    return bulkCreateUniqueRecords({
      tableName: DATABASE_TABLES.CODE_LISTS,
      records: [mapped],
      domain: 'codeLists',
      identityKey: (row) => `${row.listKey}:${normalizeCodeListIdentityValue(row.entryValue)}`,
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

  async ensureDefaults(userId) {
    if (!userId) return {};
    const result = {};

    for (const [listKey, values] of Object.entries(DEFAULT_CODE_LISTS)) {
      const existing = await this.getList(userId, listKey);
      const existingValues = new Set(existing.map((row) => normalizeCodeListIdentityValue(row.entryValue)));
      const missing = serializeCodeListEntries(values).filter((entry) => !existingValues.has(normalizeCodeListIdentityValue(entry.value)));
      if (!missing.length) {
        result[listKey] = existing;
        continue;
      }

      const merged = [
        ...existing,
        ...missing.map((entry) => mapCodeListEntry({
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
        }, userId)),
      ].filter(Boolean);

      await this.setList(userId, listKey, merged.map((row) => ({
        value: row.entryValue,
        label: row.label,
        active: row.active,
        isActive: row.isActive,
        canGenerateGreetingCards: row.canGenerateGreetingCards,
        greetingTemplate: row.greetingTemplate,
        showInDashboardUpcoming: row.showInDashboardUpcoming,
      })));
      result[listKey] = await this.getList(userId, listKey);
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
