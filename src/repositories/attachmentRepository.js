import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapAttachmentCollection, mapAttachmentRecord } from './attachmentMapper.js';
import { readLegacyAttachmentRecords } from './attachmentLegacyAdapter.js';
import { validateAttachmentRecord } from './attachmentRepository.validation.js';

const attachmentTable = () => db.table(DATABASE_TABLES.ATTACHMENTS);

export const attachmentRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    return attachmentTable().where('userId').equals(userId).toArray();
  },

  async getById(userId, attachmentId) {
    if (!userId || !attachmentId) return null;
    const rows = await this.getAll(userId);
    return rows.find((row) => row.id === attachmentId || row.firestoreId === attachmentId) || null;
  },

  async getByMoment(userId, momentId) {
    if (!userId || !momentId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.momentId === momentId || row.eventId === momentId);
  },

  async create(userId, attachment) {
    if (!userId || !attachment) return null;
    const mapped = mapAttachmentRecord({ ...attachment, userId }, userId);
    if (!mapped) return null;

    const validation = validateAttachmentRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, createdAt: mapped.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    await attachmentTable().put(next);
    return next;
  },

  async update(userId, attachment) {
    if (!userId || !attachment) return null;
    const existing = await this.getById(userId, attachment.id || attachment.firestoreId);
    const mapped = mapAttachmentRecord({ ...existing, ...attachment, userId }, userId);
    if (!mapped) return null;

    const validation = validateAttachmentRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, updatedAt: new Date().toISOString() };
    await attachmentTable().put(next);
    return next;
  },

  async delete(userId, attachmentId) {
    if (!userId || !attachmentId) return false;
    const match = await this.getById(userId, attachmentId);
    if (!match) return false;
    await attachmentTable().delete(match.id);
    return true;
  },

  async bulkUpsert(userId, attachments = []) {
    if (!userId || !Array.isArray(attachments)) return [];

    const prepared = attachments
      .map((attachment) => mapAttachmentRecord(attachment, userId))
      .filter(Boolean)
      .map((attachment) => {
        const validation = validateAttachmentRecord(attachment);
        if (!validation.valid) throw new Error(validation.errors.join(', '));
        return attachment;
      });

    if (!prepared.length) return [];
    await attachmentTable().bulkPut(prepared);
    return prepared;
  },

  async migrateLegacy(userId = null) {
    const legacy = readLegacyAttachmentRecords();
    const prepared = mapAttachmentCollection(legacy, userId);

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

export default attachmentRepository;
