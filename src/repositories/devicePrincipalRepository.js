import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { normalizeCodeListIdentityValue } from '../utils/codeLists.js';

const DEVICE_PRINCIPAL_KEY = 'devicePrincipal';
const LEGACY_GUEST_PRINCIPAL_KEY = 'migration.guestPrincipalId';
const OWNED_TABLES = [
  DATABASE_TABLES.MOMENTS,
  DATABASE_TABLES.ACTIVITIES,
  DATABASE_TABLES.MEMORIES,
  DATABASE_TABLES.ATTACHMENTS,
  DATABASE_TABLES.EXPENSES,
  DATABASE_TABLES.INCOMES,
  DATABASE_TABLES.SETTINGS,
  DATABASE_TABLES.CODE_LISTS,
];

const createPrincipalId = () => `device_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
const inferDeviceName = () => {
  const platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || 'Device';
  return String(platform).trim().slice(0, 64) || 'Device';
};

const deduplicateOwnedRows = async (table, rows, targetPrincipalId, kind) => {
  const candidates = rows.map((row) => ({ ...row, userId: targetPrincipalId }));
  if (kind === DATABASE_TABLES.SETTINGS) {
    const byKey = new Map();
    for (const row of candidates) {
      const current = byKey.get(row.key);
      if (!current || String(row.updatedAt || '') > String(current.updatedAt || '')) byKey.set(row.key, row);
    }
    const keep = new Set([...byKey.values()].map((row) => row.id));
    for (const row of rows) if (!keep.has(row.id)) await table.delete(row.id);
    return [...byKey.values()];
  }
  if (kind === DATABASE_TABLES.CODE_LISTS) {
    const byValue = new Map();
    for (const row of candidates) {
      const key = `${row.listKey}::${normalizeCodeListIdentityValue(row.entryValue ?? row.value)}`;
      const current = byValue.get(key);
      if (!current || String(row.updatedAt || '') > String(current.updatedAt || '')) byValue.set(key, row);
    }
    const keep = new Set([...byValue.values()].map((row) => row.id));
    for (const row of rows) if (!keep.has(row.id)) await table.delete(row.id);
    return [...byValue.values()];
  }
  return candidates;
};

export const devicePrincipalRepository = {
  async get() {
    const record = await db.table(DATABASE_TABLES.METADATA).get(DEVICE_PRINCIPAL_KEY);
    return record?.value || null;
  },

  async listLegacyPrincipals() {
    const candidates = new Map();
    const addCandidate = (principalId, tableName = null) => {
      if (!principalId) return;
      const candidate = candidates.get(principalId) || { principalId, recordCount: 0, domains: {} };
      if (tableName) {
        candidate.recordCount += 1;
        candidate.domains[tableName] = (candidate.domains[tableName] || 0) + 1;
      }
      candidates.set(principalId, candidate);
    };

    const legacyGuest = await db.table(DATABASE_TABLES.METADATA).get(LEGACY_GUEST_PRINCIPAL_KEY);
    if (legacyGuest?.value) addCandidate(String(legacyGuest.value));
    for (const tableName of OWNED_TABLES) {
      const rows = await db.table(tableName).toArray();
      for (const row of rows) addCandidate(row.userId, tableName);
    }
    return [...candidates.values()].sort((first, second) => first.principalId.localeCompare(second.principalId));
  },

  async getOrCreate({ deviceName, approveLegacyMigration = false } = {}) {
    const metadata = db.table(DATABASE_TABLES.METADATA);
    const existing = await metadata.get(DEVICE_PRINCIPAL_KEY);
    if (existing?.value?.principalId) {
      const principal = {
        ...existing.value,
        deviceName: deviceName?.trim() || existing.value.deviceName || inferDeviceName(),
        lastSeenAt: new Date().toISOString(),
      };
      await metadata.put({ ...existing, value: principal, status: 'ready', updatedAt: principal.lastSeenAt });
      return principal;
    }

    const legacyPrincipals = await this.listLegacyPrincipals();
    if (legacyPrincipals.length > 1 && !approveLegacyMigration) {
      const error = new Error('Multiple local data profiles were found. Review and approve their consolidation before continuing.');
      error.code = 'DEVICE_PRINCIPAL_MIGRATION_APPROVAL_REQUIRED';
      error.legacyPrincipals = legacyPrincipals;
      throw error;
    }

    const principalId = createPrincipalId();
    const createdAt = new Date().toISOString();
    const principal = {
      principalId,
      principalType: 'device',
      deviceName: deviceName?.trim() || inferDeviceName(),
      createdAt,
      lastSeenAt: createdAt,
      legacyPrincipalIds: [],
    };

    const tables = [metadata, ...OWNED_TABLES.map((name) => db.table(name))];
    await db.transaction('rw', ...tables, async () => {
      const concurrent = await metadata.get(DEVICE_PRINCIPAL_KEY);
      if (concurrent?.value?.principalId) return;

      const legacyGuest = await metadata.get(LEGACY_GUEST_PRINCIPAL_KEY);
      const legacyPrincipalIds = new Set(legacyGuest?.value ? [String(legacyGuest.value)] : []);
      for (const tableName of OWNED_TABLES) {
        const table = db.table(tableName);
        const rows = await table.toArray();
        const ownedRows = rows.filter((row) => typeof row.userId === 'string' && row.userId.length > 0);
        for (const row of ownedRows) legacyPrincipalIds.add(row.userId);
        const remapped = await deduplicateOwnedRows(table, ownedRows, principalId, tableName);
        if (remapped.length) await table.bulkPut(remapped);
      }

      principal.legacyPrincipalIds = [...legacyPrincipalIds].filter((id) => id !== principalId);
      await metadata.put({ key: DEVICE_PRINCIPAL_KEY, value: principal, status: 'ready', updatedAt: createdAt });
      if (legacyGuest) {
        await metadata.put({ ...legacyGuest, value: principalId, status: 'migrated-to-device-principal', updatedAt: createdAt });
      }
    });

    return (await this.get()) || principal;
  },

  async updateDeviceName(deviceName) {
    const current = await this.get();
    if (!current) throw new Error('Device Principal has not been initialized.');
    const normalized = String(deviceName || '').trim().slice(0, 64);
    if (!normalized) throw new Error('Device name cannot be empty.');
    const updatedAt = new Date().toISOString();
    const value = { ...current, deviceName: normalized, lastSeenAt: updatedAt };
    await db.table(DATABASE_TABLES.METADATA).put({ key: DEVICE_PRINCIPAL_KEY, value, status: 'ready', updatedAt });
    return value;
  },
};
