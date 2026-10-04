import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapExpenseCollection, mapExpenseRecord } from './expenseMapper.js';
import { readLegacyExpenseRecords } from './expenseLegacyAdapter.js';
import { validateExpenseRecord } from './expenseRepository.validation.js';

const expenseTable = () => db.table(DATABASE_TABLES.EXPENSES);

export const expenseRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return expenseTable().where('userId').equals(userId).toArray();
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

  async getByEvent(userId, eventId) {
    if (!userId || !eventId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.eventId === eventId || row.momentId === eventId);
  },

  async getByActivity(userId, activityId) {
    if (!userId || !activityId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.activityId === activityId);
  },

  async getByCategory(userId, category) {
    if (!userId || !category) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.category === category);
  },

  async upsert(userId, record) {
    if (!userId || !record) return null;
    const mapped = mapExpenseRecord({ ...record, userId }, userId);
    if (!mapped) return null;

    const validation = validateExpenseRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const existing = await this.getById(userId, mapped.id);
    const next = existing ? { ...existing, ...mapped, updatedAt: new Date().toISOString() } : {
      ...mapped,
      createdAt: mapped.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await expenseTable().put(next);
    return next;
  },

  async bulkUpsert(userId, records = []) {
    if (!userId || !Array.isArray(records)) return [];

    const prepared = records
      .map((record) => mapExpenseRecord(record, userId))
      .filter(Boolean)
      .map((record) => {
        const validation = validateExpenseRecord(record);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }
        return record;
      });

    if (!prepared.length) return [];
    await expenseTable().bulkPut(prepared);
    return prepared;
  },

  async delete(userId, id) {
    if (!userId || !id) return false;
    const match = await this.getById(userId, id);
    if (!match) return false;
    await expenseTable().delete(match.id);
    return true;
  },

  async migrateLegacy(userId = null) {
    const legacy = readLegacyExpenseRecords();
    const prepared = mapExpenseCollection(legacy, userId);

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

export default expenseRepository;
