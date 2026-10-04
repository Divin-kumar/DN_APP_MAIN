import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapMemoryCollection, mapMemoryRecord } from './memoryMapper.js';
import { readLegacyMemoryRecords } from './memoryLegacyAdapter.js';
import { validateMemoryRecord } from './memoryRepository.validation.js';
import { momentRepository } from './momentRepository.js';
import { bulkCreateUniqueRecords, createUniqueRecord, makeRepositoryConflict, updateOwnedRecord } from './repositoryConflict.js';

const memoryTable = () => db.table(DATABASE_TABLES.MEMORIES);

export const memoryRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return memoryTable().where('userId').equals(userId).toArray();
  },

  async getById(userId, memoryId) {
    if (!userId || !memoryId) return null;
    const rows = await this.getAll(userId);
    return rows.find((row) => row.id === memoryId || row.firestoreId === memoryId) || null;
  },

  async getByMoment(userId, momentId) {
    if (!userId || !momentId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.momentId === momentId || row.eventId === momentId);
  },

  async create(userId, memory) {
    if (!userId || !memory) return null;
    const mapped = mapMemoryRecord({ ...memory, userId }, userId);
    if (!mapped) return null;

    const validation = validateMemoryRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, createdAt: mapped.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    return createUniqueRecord({
      tableName: DATABASE_TABLES.MEMORIES,
      record: next,
      domain: 'memories',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS)],
      beforeInsert: async () => {
        if (!(await momentRepository.getById(userId, next.momentId))) {
          throw makeRepositoryConflict({ domain: 'memories', operation: 'create', record: next, reason: 'parent-moment-missing', fields: ['momentId'] });
        }
      },
    });
  },

  async update(userId, memory) {
    if (!userId || !memory) return null;
    const existing = await this.getById(userId, memory.id || memory.firestoreId);
    if (!existing) {
      const collision = await memoryTable().get(memory.id || memory.firestoreId);
      if (collision) throw makeRepositoryConflict({ domain: 'memories', operation: 'update', record: memory, existing: collision, reason: 'id-owned-by-another-principal' });
      throw new Error(`Memory record ${memory.id || memory.firestoreId} does not exist for update.`);
    }
    const mapped = mapMemoryRecord({ ...existing, ...memory, userId }, userId);
    if (!mapped) return null;

    const validation = validateMemoryRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, updatedAt: new Date().toISOString() };
    return updateOwnedRecord({
      tableName: DATABASE_TABLES.MEMORIES,
      record: next,
      domain: 'memories',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS)],
      beforeUpdate: async (_existing, record) => {
        if (!(await momentRepository.getById(userId, record.momentId))) {
          throw makeRepositoryConflict({ domain: 'memories', operation: 'update', record, reason: 'parent-moment-missing', fields: ['momentId'] });
        }
      },
    });
  },

  async delete(userId, memoryId) {
    if (!userId || !memoryId) return false;
    const match = await this.getById(userId, memoryId);
    if (!match) return false;
    await memoryTable().delete(match.id);
    return true;
  },

  async bulkUpsert(userId, memories = []) {
    if (!userId || !Array.isArray(memories)) return [];

    const prepared = memories
      .map((memory) => mapMemoryRecord(memory, userId))
      .filter(Boolean)
      .map((memory) => {
        const validation = validateMemoryRecord(memory);
        if (!validation.valid) throw new Error(validation.errors.join(', '));
        return memory;
      });

    return bulkCreateUniqueRecords({
      tableName: DATABASE_TABLES.MEMORIES,
      records: prepared,
      domain: 'memories',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS)],
      beforeInsert: async (records) => {
        for (const record of records) {
          if (!(await momentRepository.getById(userId, record.momentId))) {
            throw makeRepositoryConflict({ domain: 'memories', operation: 'bulk-create', record, reason: 'parent-moment-missing', fields: ['momentId'] });
          }
        }
      },
    });
  },

  async migrateLegacy(userId = null) {
    const legacy = readLegacyMemoryRecords();
    const prepared = mapMemoryCollection(legacy, userId);

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

export default memoryRepository;
