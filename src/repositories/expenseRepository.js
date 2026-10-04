import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapExpenseCollection, mapExpenseRecord } from './expenseMapper.js';
import { readLegacyExpenseRecords } from './expenseLegacyAdapter.js';
import { validateExpenseRecord } from './expenseRepository.validation.js';
import { activityRepository } from './activityRepository.js';
import { momentRepository } from './momentRepository.js';
import { bulkCreateUniqueRecords, createUniqueRecord, makeRepositoryConflict, recordsEquivalent, updateOwnedRecord } from './repositoryConflict.js';

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

  async create(userId, record) {
    if (!userId || !record) return null;
    const mapped = mapExpenseRecord({ ...record, userId }, userId);
    if (!mapped) return null;

    const validation = validateExpenseRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = {
      ...mapped,
      createdAt: mapped.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return createUniqueRecord({
      tableName: DATABASE_TABLES.EXPENSES,
      record: next,
      domain: 'expenses',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS), db.table(DATABASE_TABLES.ACTIVITIES)],
      beforeInsert: async () => validateExpenseRelationships(userId, next),
    });
  },

  async update(userId, record) {
    if (!userId || !record?.id) return null;
    const existing = await this.getById(userId, record.id);
    if (!existing) {
      const collision = await expenseTable().get(record.id);
      if (collision) throw makeRepositoryConflict({ domain: 'expenses', operation: 'update', record, existing: collision, reason: 'id-owned-by-another-principal' });
      throw new Error(`Expense record ${record.id} does not exist for update.`);
    }
    const mapped = mapExpenseRecord({ ...existing, ...record, userId }, userId);
    const validation = validateExpenseRecord(mapped);
    if (!validation.valid) throw new Error(validation.errors.join(', '));
    const next = { ...mapped, updatedAt: new Date().toISOString() };
    return updateOwnedRecord({
      tableName: DATABASE_TABLES.EXPENSES,
      record: next,
      domain: 'expenses',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS), db.table(DATABASE_TABLES.ACTIVITIES)],
      beforeUpdate: async (_current, updated) => validateExpenseRelationships(userId, updated),
    });
  },

  async upsert(userId, record) {
    if (!userId || !record) return null;
    const mapped = mapExpenseRecord({ ...record, userId }, userId);
    const existing = await this.getById(userId, mapped.id);
    if (existing) {
      if (recordsEquivalent(existing, mapped)) return existing;
      throw makeRepositoryConflict({ domain: 'expenses', operation: 'upsert', record: mapped, existing, reason: 'upsert-would-overwrite-existing-record' });
    }
    return this.create(userId, mapped);
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

    return bulkCreateUniqueRecords({
      tableName: DATABASE_TABLES.EXPENSES,
      records: prepared,
      domain: 'expenses',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS), db.table(DATABASE_TABLES.ACTIVITIES)],
      beforeInsert: async (records) => {
        for (const record of records) await validateExpenseRelationships(userId, record);
      },
    });
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

const validateExpenseRelationships = async (userId, expense) => {
  const momentId = expense.momentId || expense.eventId;
  if (momentId && !(await momentRepository.getById(userId, momentId))) {
    throw makeRepositoryConflict({ domain: 'expenses', operation: 'write', record: expense, reason: 'parent-moment-missing', fields: ['momentId'] });
  }
  if (expense.activityId) {
    const activity = await activityRepository.getById(userId, expense.activityId);
    if (!activity) throw makeRepositoryConflict({ domain: 'expenses', operation: 'write', record: expense, reason: 'parent-activity-missing', fields: ['activityId'] });
    if (momentId && activity.momentId !== momentId) {
      throw makeRepositoryConflict({ domain: 'expenses', operation: 'write', record: expense, existing: activity, reason: 'activity-moment-mismatch', fields: ['momentId', 'activityId'] });
    }
  }
};
