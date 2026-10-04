import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapMomentCollection, mapMomentRecord } from './momentMapper.js';
import { readLegacyMomentRecords } from './momentLegacyAdapter.js';
import { normalizeMomentStatus, validateMomentRecord } from './momentRepository.validation.js';
import { bulkCreateUniqueRecords, createUniqueRecord, makeRepositoryConflict, updateOwnedRecord, withRepositoryConflictAudit } from './repositoryConflict.js';

const momentTable = () => db.table(DATABASE_TABLES.MOMENTS);

export const momentRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return momentTable().where('userId').equals(userId).toArray();
  },

  async getById(userId, momentId) {
    if (!userId || !momentId) return null;
    const rows = await this.getAll(userId);
    return rows.find((row) => row.id === momentId || row.firestoreId === momentId) || null;
  },

  async getByDateRange(userId, startDate, endDate) {
    if (!userId || !startDate || !endDate) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.date >= startDate && row.date <= endDate);
  },

  async getUpcoming(userId) {
    if (!userId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.status !== 'archived').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  },

  async getByType(userId, type) {
    if (!userId || !type) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.type === type || row.customType === type);
  },

  async create(userId, moment) {
    if (!userId || !moment) return null;
    const mapped = mapMomentRecord({ ...moment, userId }, userId);
    if (!mapped) return null;

    const validation = validateMomentRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = {
      ...mapped,
      status: normalizeMomentStatus(mapped.status),
      createdAt: mapped.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return createUniqueRecord({ tableName: DATABASE_TABLES.MOMENTS, record: next, domain: 'moments' });
  },

  async update(userId, moment) {
    if (!userId || !moment) return null;
    const existing = await this.getById(userId, moment.id || moment.firestoreId);
    if (!existing) {
      const collision = await momentTable().get(moment.id || moment.firestoreId);
      if (collision) {
        throw makeRepositoryConflict({ domain: 'moments', operation: 'update', record: moment, existing: collision, reason: 'id-owned-by-another-principal' });
      }
      throw new Error(`Moment record ${moment.id || moment.firestoreId} does not exist for update.`);
    }
    const mapped = mapMomentRecord({ ...existing, ...moment, userId }, userId);
    if (!mapped) return null;

    const validation = validateMomentRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = {
      ...mapped,
      status: normalizeMomentStatus(mapped.status),
      updatedAt: new Date().toISOString(),
    };

    return updateOwnedRecord({ tableName: DATABASE_TABLES.MOMENTS, record: next, domain: 'moments' });
  },

  async delete(userId, momentId) {
    if (!userId || !momentId) return false;
    return withRepositoryConflictAudit({ principalId: userId, operation: 'moments.delete' }, async () => db.transaction(
      'rw',
      momentTable(),
      db.table(DATABASE_TABLES.ACTIVITIES),
      db.table(DATABASE_TABLES.MEMORIES),
      db.table(DATABASE_TABLES.ATTACHMENTS),
      db.table(DATABASE_TABLES.EXPENSES),
      async () => {
        const match = await this.getById(userId, momentId);
        if (!match) return false;
        const [activities, memories, attachments, expenses] = await Promise.all([
          db.table(DATABASE_TABLES.ACTIVITIES).where('userId').equals(userId).toArray(),
          db.table(DATABASE_TABLES.MEMORIES).where('userId').equals(userId).toArray(),
          db.table(DATABASE_TABLES.ATTACHMENTS).where('userId').equals(userId).toArray(),
          db.table(DATABASE_TABLES.EXPENSES).where('userId').equals(userId).toArray(),
        ]);
        const children = [
          ...activities.filter((row) => row.momentId === match.id),
          ...memories.filter((row) => row.momentId === match.id),
          ...attachments.filter((row) => row.momentId === match.id),
          ...expenses.filter((row) => row.momentId === match.id || row.eventId === match.id),
        ];
        if (children.length) {
          throw makeRepositoryConflict({ domain: 'moments', operation: 'delete', record: match, existing: match, reason: 'moment-has-dependent-records', fields: ['children'] });
        }
        await momentTable().delete(match.id);
        return true;
      },
    ));
  },

  async archive(userId, momentId) {
    if (!userId || !momentId) return null;
    const existing = await this.getById(userId, momentId);
    if (!existing) return null;
    return this.update(userId, { ...existing, status: 'archived', archived: true, updatedAt: new Date().toISOString() });
  },

  async restore(userId, momentId) {
    if (!userId || !momentId) return null;
    const existing = await this.getById(userId, momentId);
    if (!existing) return null;
    return this.update(userId, { ...existing, archived: false, status: normalizeMomentStatus(existing.status === 'archived' ? 'active' : existing.status), updatedAt: new Date().toISOString() });
  },

  async bulkUpsert(userId, moments = []) {
    if (!userId || !Array.isArray(moments)) return [];
    const prepared = moments
      .map((moment) => mapMomentRecord(moment, userId))
      .filter(Boolean)
      .map((moment) => {
        const validation = validateMomentRecord(moment);
        if (!validation.valid) {
          throw new Error(validation.errors.join(', '));
        }
        return { ...moment, status: normalizeMomentStatus(moment.status) };
      });

    if (!prepared.length) return [];
    return bulkCreateUniqueRecords({ tableName: DATABASE_TABLES.MOMENTS, records: prepared, domain: 'moments' });
  },

  async reconcile(userId, moments = []) {
    if (!userId || !Array.isArray(moments)) return [];
    return this.bulkUpsert(userId, moments);
  },

  async migrateLegacy(userId = null) {
    const legacy = readLegacyMomentRecords();
    const prepared = mapMomentCollection(legacy, userId);

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

export default momentRepository;
