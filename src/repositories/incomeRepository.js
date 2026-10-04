import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapIncomeCollection, mapIncomeRecord } from './incomeMapper.js';
import { readLegacyIncomeRecords } from './incomeLegacyAdapter.js';
import { validateIncomeRecord } from './incomeRepository.validation.js';
import { bulkCreateUniqueRecords, createUniqueRecord, makeRepositoryConflict, recordsEquivalent, updateOwnedRecord } from './repositoryConflict.js';

const incomeTable = () => db.table(DATABASE_TABLES.INCOMES);

export const incomeRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return incomeTable().where('userId').equals(userId).toArray();
  },

  async getById(userId, id) {
    if (!userId || !id) return null;
    const rows = await this.getAll(userId);
    return rows.find((row) => row.id === id || row.firestoreId === id) || null;
  },

  async getByDateRange(userId, startDate, endDate) {
    if (!userId || !startDate || !endDate) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.date >= startDate && row.date <= endDate);
  },

  async getByType(userId, type) {
    if (!userId || !type) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.type === type);
  },

  async create(userId, record) {
    if (!userId || !record) return null;
    const mapped = mapIncomeRecord({ ...record, userId }, userId);
    if (!mapped) return null;

    const validation = validateIncomeRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = {
      ...mapped,
      createdAt: mapped.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return createUniqueRecord({ tableName: DATABASE_TABLES.INCOMES, record: next, domain: 'incomes' });
  },

  async update(userId, record) {
    if (!userId || !record?.id) return null;
    const existing = await this.getById(userId, record.id);
    if (!existing) {
      const collision = await incomeTable().get(record.id);
      if (collision) throw makeRepositoryConflict({ domain: 'incomes', operation: 'update', record, existing: collision, reason: 'id-owned-by-another-principal' });
      throw new Error(`Income record ${record.id} does not exist for update.`);
    }
    const mapped = mapIncomeRecord({ ...existing, ...record, userId }, userId);
    const validation = validateIncomeRecord(mapped);
    if (!validation.valid) throw new Error(validation.errors.join(', '));
    return updateOwnedRecord({ tableName: DATABASE_TABLES.INCOMES, record: { ...mapped, updatedAt: new Date().toISOString() }, domain: 'incomes' });
  },

  async upsert(userId, record) {
    if (!userId || !record) return null;
    const mapped = mapIncomeRecord({ ...record, userId }, userId);
    const existing = await this.getById(userId, mapped.id);
    if (existing) {
      if (recordsEquivalent(existing, mapped)) return existing;
      throw makeRepositoryConflict({ domain: 'incomes', operation: 'upsert', record: mapped, existing, reason: 'upsert-would-overwrite-existing-record' });
    }
    return this.create(userId, mapped);
  },

  async bulkUpsert(userId, records = []) {
    if (!userId || !Array.isArray(records)) return [];

    const prepared = records
      .map((record) => mapIncomeRecord(record, userId))
      .filter(Boolean)
      .map((record) => {
        const validation = validateIncomeRecord(record);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }
        return record;
      });

    return bulkCreateUniqueRecords({ tableName: DATABASE_TABLES.INCOMES, records: prepared, domain: 'incomes' });
  },

  async delete(userId, id) {
    if (!userId || !id) return false;
    const match = await this.getById(userId, id);
    if (!match) return false;
    await incomeTable().delete(match.id);
    return true;
  },

  async migrateLegacy(userId = null) {
    const legacy = readLegacyIncomeRecords();
    const prepared = mapIncomeCollection(legacy, userId);

    if (userId && prepared.length) {
      await this.bulkUpsert(userId, prepared);
    }

    return {
      migrated: true,
      count: prepared.length,
      records: prepared,
      source: 'guest-local-storage',
    };
  },
};

export default incomeRepository;
