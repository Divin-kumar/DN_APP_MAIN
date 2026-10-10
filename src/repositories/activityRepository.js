import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapActivityCollection, mapActivityRecord } from './activityMapper.js';
import { readLegacyActivityRecords } from './activityLegacyAdapter.js';
import { validateActivityRecord } from './activityRepository.validation.js';
import { momentRepository } from './momentRepository.js';
import { bulkCreateUniqueRecords, createUniqueRecord, makeRepositoryConflict, updateOwnedRecord, withRepositoryConflictAudit } from './repositoryConflict.js';

const activityTable = () => db.table(DATABASE_TABLES.ACTIVITIES);

export const activityRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return activityTable().where('userId').equals(userId).toArray();
  },

  async getById(userId, activityId) {
    if (!userId || !activityId) return null;
    const rows = await this.getAll(userId);
    return rows.find((row) => row.id === activityId || row.firestoreId === activityId) || null;
  },

  async getByMoment(userId, momentId) {
    if (!userId || !momentId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.momentId === momentId || row.eventId === momentId);
  },

  async getPending(userId) {
    if (!userId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => !row.completed && !row.cancelled);
  },

  async getCompleted(userId) {
    if (!userId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.completed && !row.cancelled);
  },

  async create(userId, activity) {
    if (!userId || !activity) return null;
    const mapped = mapActivityRecord({ ...activity, userId }, userId);
    if (!mapped) return null;

    const validation = validateActivityRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, createdAt: mapped.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    return createUniqueRecord({
      tableName: DATABASE_TABLES.ACTIVITIES,
      record: next,
      domain: 'activities',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS)],
      beforeInsert: async () => {
        if (next.momentId && !(await momentRepository.getById(userId, next.momentId))) {
          throw makeRepositoryConflict({ domain: 'activities', operation: 'create', record: next, reason: 'parent-moment-missing', fields: ['momentId'] });
        }
      },
    });
  },

  async update(userId, activity) {
    if (!userId || !activity) return null;
    const existing = await this.getById(userId, activity.id || activity.firestoreId);
    if (!existing) {
      const collision = await activityTable().get(activity.id || activity.firestoreId);
      if (collision) throw makeRepositoryConflict({ domain: 'activities', operation: 'update', record: activity, existing: collision, reason: 'id-owned-by-another-principal' });
      throw new Error(`Activity record ${activity.id || activity.firestoreId} does not exist for update.`);
    }
    const mapped = mapActivityRecord({ ...existing, ...activity, userId }, userId);
    if (!mapped) return null;

    const validation = validateActivityRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, updatedAt: new Date().toISOString() };
    return updateOwnedRecord({
      tableName: DATABASE_TABLES.ACTIVITIES,
      record: next,
      domain: 'activities',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS)],
      beforeUpdate: async (_existing, record) => {
        if (record.momentId && !(await momentRepository.getById(userId, record.momentId))) {
          throw makeRepositoryConflict({ domain: 'activities', operation: 'update', record, reason: 'parent-moment-missing', fields: ['momentId'] });
        }
      },
    });
  },

  async delete(userId, activityId) {
    if (!userId || !activityId) return false;
    return withRepositoryConflictAudit({ principalId: userId, operation: 'activities.delete' }, async () => db.transaction(
      'rw', activityTable(), db.table(DATABASE_TABLES.EXPENSES), db.table(DATABASE_TABLES.ATTACHMENT_LINKS), db.table(DATABASE_TABLES.ATTACHMENTS), async () => {
        const match = await this.getById(userId, activityId);
        if (!match) return false;
        const linkedExpenses = await db.table(DATABASE_TABLES.EXPENSES)
          .where('userId').equals(userId).filter((row) => row.activityId === match.id).toArray();
        if (linkedExpenses.length) {
          throw makeRepositoryConflict({ domain: 'activities', operation: 'delete', record: match, existing: match, reason: 'activity-has-linked-expenses', fields: ['activityId'] });
        }
        const linkedAttachments = await db.table(DATABASE_TABLES.ATTACHMENT_LINKS)
          .where('[userId+parentType+parentId]').equals([userId, 'activity', match.id]).toArray();
        for (const link of linkedAttachments) {
          await db.table(DATABASE_TABLES.ATTACHMENT_LINKS).delete(link.id);
          if (match.momentId) {
            const momentLinkId = `${link.attachmentId}:moment:${match.momentId}`;
            await db.table(DATABASE_TABLES.ATTACHMENT_LINKS).put({ id: momentLinkId, attachmentId: link.attachmentId, userId, parentType: 'moment', parentId: match.momentId, createdAt: new Date().toISOString() });
            const attachment = await db.table(DATABASE_TABLES.ATTACHMENTS).get(link.attachmentId);
            if (attachment?.userId === userId) await db.table(DATABASE_TABLES.ATTACHMENTS).put({ ...attachment, momentId: match.momentId, updatedAt: new Date().toISOString() });
          }
        }
        await activityTable().delete(match.id);
        return true;
      },
    ));
  },

  async bulkUpsert(userId, activities = []) {
    if (!userId || !Array.isArray(activities)) return [];

    const prepared = activities
      .map((activity) => mapActivityRecord(activity, userId))
      .filter(Boolean)
      .map((activity) => {
        const validation = validateActivityRecord(activity);
        if (!validation.valid) throw new Error(validation.errors.join(', '));
        return activity;
      });

    return bulkCreateUniqueRecords({
      tableName: DATABASE_TABLES.ACTIVITIES,
      records: prepared,
      domain: 'activities',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS)],
      beforeInsert: async (records) => {
        for (const record of records) {
          if (record.momentId && !(await momentRepository.getById(userId, record.momentId))) {
            throw makeRepositoryConflict({ domain: 'activities', operation: 'bulk-create', record, reason: 'parent-moment-missing', fields: ['momentId'] });
          }
        }
      },
    });
  },

  async reconcile(userId, activities = []) {
    if (!userId || !Array.isArray(activities)) return [];
    return this.bulkUpsert(userId, activities);
  },

  async migrateLegacy(userId = null) {
    const legacy = readLegacyActivityRecords();
    const prepared = mapActivityCollection(legacy, userId);

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

export default activityRepository;
