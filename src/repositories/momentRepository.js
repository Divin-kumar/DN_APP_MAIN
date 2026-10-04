import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapMomentCollection, mapMomentRecord } from './momentMapper.js';
import { readLegacyMomentRecords } from './momentLegacyAdapter.js';
import { normalizeMomentStatus, validateMomentRecord } from './momentRepository.validation.js';

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

    await momentTable().put(next);
    return next;
  },

  async update(userId, moment) {
    if (!userId || !moment) return null;
    const existing = await this.getById(userId, moment.id || moment.firestoreId);
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

    await momentTable().put(next);
    return next;
  },

  async delete(userId, momentId) {
    if (!userId || !momentId) return false;
    const match = await this.getById(userId, momentId);
    if (!match) return false;
    await momentTable().delete(match.id);
    return true;
  },

  async archive(userId, momentId) {
    if (!userId || !momentId) return null;
    const existing = await this.getById(userId, momentId);
    if (!existing) return null;
    const next = { ...existing, status: 'archived', archived: true, updatedAt: new Date().toISOString() };
    await momentTable().put(next);
    return next;
  },

  async restore(userId, momentId) {
    if (!userId || !momentId) return null;
    const existing = await this.getById(userId, momentId);
    if (!existing) return null;
    const next = { ...existing, archived: false, status: normalizeMomentStatus(existing.status === 'archived' ? 'active' : existing.status), updatedAt: new Date().toISOString() };
    await momentTable().put(next);
    return next;
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
    await momentTable().bulkPut(prepared);
    return prepared;
  },

  async reconcile(userId, moments = []) {
    if (!userId || !Array.isArray(moments)) return [];
    const incoming = this.bulkUpsert ? moments : moments;
    const existing = await this.getAll(userId);
    const deduped = new Map();

    [...existing, ...incoming].forEach((moment) => {
      const key = moment.id || moment.firestoreId || `${moment.userId}:${moment.name}:${moment.date}:${moment.type}`;
      const current = deduped.get(key);
      if (!current || new Date(moment.updatedAt || moment.createdAt || 0).getTime() > new Date(current.updatedAt || current.createdAt || 0).getTime()) {
        deduped.set(key, { ...moment, userId, status: normalizeMomentStatus(moment.status || current?.status || 'active') });
      }
    });

    const prepared = [...deduped.values()];
    await momentTable().bulkPut(prepared);
    return prepared;
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
