import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapActivityCollection, mapActivityRecord } from './activityMapper.js';
import { readLegacyActivityRecords } from './activityLegacyAdapter.js';
import { validateActivityRecord } from './activityRepository.validation.js';

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
    await activityTable().put(next);
    return next;
  },

  async update(userId, activity) {
    if (!userId || !activity) return null;
    const existing = await this.getById(userId, activity.id || activity.firestoreId);
    const mapped = mapActivityRecord({ ...existing, ...activity, userId }, userId);
    if (!mapped) return null;

    const validation = validateActivityRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, updatedAt: new Date().toISOString() };
    await activityTable().put(next);
    return next;
  },

  async delete(userId, activityId) {
    if (!userId || !activityId) return false;
    const match = await this.getById(userId, activityId);
    if (!match) return false;
    await activityTable().delete(match.id);
    return true;
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

    if (!prepared.length) return [];
    await activityTable().bulkPut(prepared);
    return prepared;
  },

  async reconcile(userId, activities = []) {
    if (!userId || !Array.isArray(activities)) return [];
    const incoming = activities;
    const existing = await this.getAll(userId);
    const deduped = new Map();

    [...existing, ...incoming].forEach((activity) => {
      const key = activity.id || activity.firestoreId || `${activity.userId}:${activity.momentId}:${activity.title}:${activity.date}`;
      const current = deduped.get(key);
      if (!current || new Date(activity.updatedAt || activity.createdAt || 0).getTime() > new Date(current.updatedAt || current.createdAt || 0).getTime()) {
        deduped.set(key, { ...activity, userId });
      }
    });

    const prepared = [...deduped.values()];
    await activityTable().bulkPut(prepared);
    return prepared;
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
