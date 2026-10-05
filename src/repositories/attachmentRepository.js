import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { mapAttachmentCollection, mapAttachmentRecord } from './attachmentMapper.js';
import { readLegacyAttachmentRecords } from './attachmentLegacyAdapter.js';
import { validateAttachmentRecord } from './attachmentRepository.validation.js';
import { momentRepository } from './momentRepository.js';
import { activityRepository } from './activityRepository.js';
import { bulkCreateUniqueRecords, createUniqueRecord, makeRepositoryConflict, updateOwnedRecord } from './repositoryConflict.js';

const attachmentTable = () => db.table(DATABASE_TABLES.ATTACHMENTS);
const linkTable = () => db.table(DATABASE_TABLES.ATTACHMENT_LINKS);
const fileTable = () => db.table(DATABASE_TABLES.ATTACHMENT_FILES);

const normalizeParentLinks = (attachmentId, userId, links = []) => {
  const normalized = links
    .filter((link) => ['moment', 'activity'].includes(link.parentType) && link.parentId)
    .map((link) => ({
      id: `${attachmentId}:${link.parentType}:${link.parentId}`,
      attachmentId,
      userId,
      parentType: link.parentType,
      parentId: String(link.parentId),
      createdAt: link.createdAt || new Date().toISOString(),
    }));
  return [...new Map(normalized.map((link) => [`${link.parentType}:${link.parentId}`, link])).values()];
};

export const attachmentRepository = {
  async getAll(userId = null) {
    if (!userId) return [];
    const [rows, links, files] = await Promise.all([
      attachmentTable().where('userId').equals(userId).toArray(),
      linkTable().where('userId').equals(userId).toArray(),
      fileTable().where('userId').equals(userId).toArray(),
    ]);
    const fileIds = new Set(files
      .filter((file) => typeof Blob !== 'undefined' && file.blob instanceof Blob)
      .map((file) => file.attachmentId));
    return rows.map((row) => {
      const parentLinks = links.filter((link) => link.attachmentId === row.id);
      if (!parentLinks.length && row.momentId) parentLinks.push({ id: `${row.id}:moment:${row.momentId}`, attachmentId: row.id, userId, parentType: 'moment', parentId: row.momentId, legacy: true });
      return { ...row, hasLocalCopy: fileIds.has(row.id), parentLinks };
    });
  },

  async getById(userId, attachmentId) {
    if (!userId || !attachmentId) return null;
    const rows = await this.getAll(userId);
    return rows.find((row) => row.id === attachmentId || row.firestoreId === attachmentId) || null;
  },

  async getByMoment(userId, momentId) {
    if (!userId || !momentId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.parentLinks.some((link) => link.parentType === 'moment' && link.parentId === momentId) || row.momentId === momentId || row.eventId === momentId);
  },

  async getByActivity(userId, activityId) {
    if (!userId || !activityId) return [];
    const rows = await this.getAll(userId);
    return rows.filter((row) => row.parentLinks.some((link) => link.parentType === 'activity' && link.parentId === activityId));
  },

  async getLinks(userId = null) {
    if (!userId) return [];
    return linkTable().where('userId').equals(userId).toArray();
  },

  async create(userId, attachment, { parentLinks = null, blob = null } = {}) {
    if (!userId || !attachment) return null;
    const mapped = mapAttachmentRecord({ ...attachment, userId }, userId);
    if (!mapped) return null;

    const validation = validateAttachmentRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, createdAt: mapped.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    const links = normalizeParentLinks(mapped.id, userId, parentLinks || (mapped.momentId ? [{ parentType: 'moment', parentId: mapped.momentId }] : []));
    if (!links.length) throw new Error('Link the attachment to a Moment or Activity.');
    return createUniqueRecord({
      tableName: DATABASE_TABLES.ATTACHMENTS,
      record: next,
      domain: 'attachments',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS), db.table(DATABASE_TABLES.ACTIVITIES), linkTable(), fileTable()],
      beforeInsert: async () => {
        for (const link of links) {
          const parent = link.parentType === 'moment'
            ? await momentRepository.getById(userId, link.parentId)
            : await activityRepository.getById(userId, link.parentId);
          if (!parent) throw makeRepositoryConflict({ domain: 'attachments', operation: 'create', record: next, reason: `parent-${link.parentType}-missing`, fields: ['parentId'] });
        }
        await linkTable().bulkPut(links);
        if (blob) await fileTable().put({ attachmentId: next.id, userId, blob, mimeType: next.mimeType, size: blob.size, updatedAt: new Date().toISOString() });
      },
    });
  },

  async update(userId, attachment) {
    if (!userId || !attachment) return null;
    const existing = await this.getById(userId, attachment.id || attachment.firestoreId);
    if (!existing) {
      const collision = await attachmentTable().get(attachment.id || attachment.firestoreId);
      if (collision) throw makeRepositoryConflict({ domain: 'attachments', operation: 'update', record: attachment, existing: collision, reason: 'id-owned-by-another-principal' });
      throw new Error(`Attachment record ${attachment.id || attachment.firestoreId} does not exist for update.`);
    }
    const mapped = mapAttachmentRecord({ ...existing, ...attachment, userId }, userId);
    if (!mapped) return null;

    const validation = validateAttachmentRecord(mapped);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const next = { ...mapped, updatedAt: new Date().toISOString() };
    return updateOwnedRecord({
      tableName: DATABASE_TABLES.ATTACHMENTS,
      record: next,
      domain: 'attachments',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS)],
      beforeUpdate: async (_existing, record) => {
        if (!(await momentRepository.getById(userId, record.momentId))) {
          throw makeRepositoryConflict({ domain: 'attachments', operation: 'update', record, reason: 'parent-moment-missing', fields: ['momentId'] });
        }
      },
    });
  },

  async updateReference(userId, attachmentId, { fileReference, previewReference = '' } = {}) {
    if (!userId || !attachmentId) throw new Error('An attachment and local profile are required to relink a file.');
    let parsedReference;
    try {
      parsedReference = new URL(String(fileReference || '').trim());
    } catch {
      throw new Error('Enter a valid http:// or https:// file reference.');
    }
    if (!['http:', 'https:'].includes(parsedReference.protocol)) throw new Error('Enter a valid http:// or https:// file reference.');

    const existing = await this.getById(userId, attachmentId);
    if (!existing) throw new Error(`Attachment ${attachmentId} was not found for this local profile.`);
    const next = mapAttachmentRecord({
      ...existing,
      fileReference: parsedReference.href,
      url: parsedReference.href,
      previewReference: String(previewReference || '').trim(),
      availability: 'reference',
      updatedAt: new Date().toISOString(),
    }, userId);
    const validation = validateAttachmentRecord(next);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    return updateOwnedRecord({
      tableName: DATABASE_TABLES.ATTACHMENTS,
      record: next,
      domain: 'attachments',
      transactionTables: [linkTable(), fileTable()],
    });
  },

  async replaceFile(userId, attachmentId, { blob, name, mimeType } = {}) {
    if (!userId || !attachmentId) throw new Error('An attachment and local profile are required to replace a file.');
    if (typeof Blob === 'undefined' || !(blob instanceof Blob)) throw new Error('Choose a readable local file to replace this attachment.');
    if (blob.size > 20 * 1024 * 1024) throw new Error('Local attachment copies are limited to 20 MB each.');

    const existing = await this.getById(userId, attachmentId);
    if (!existing) throw new Error(`Attachment ${attachmentId} was not found for this local profile.`);
    const next = mapAttachmentRecord({
      ...existing,
      name: String(name || existing.name || 'Attachment').trim(),
      type: mimeType || blob.type || 'application/octet-stream',
      mimeType: mimeType || blob.type || 'application/octet-stream',
      size: blob.size,
      fileReference: '',
      url: '',
      previewReference: '',
      availability: 'local-copy',
      updatedAt: new Date().toISOString(),
    }, userId);
    const validation = validateAttachmentRecord(next);
    if (!validation.valid) throw new Error(validation.errors.join(', '));

    return updateOwnedRecord({
      tableName: DATABASE_TABLES.ATTACHMENTS,
      record: next,
      domain: 'attachments',
      transactionTables: [fileTable()],
      beforeUpdate: async () => {
        await fileTable().put({
          attachmentId: next.id,
          userId,
          blob,
          mimeType: next.mimeType,
          size: blob.size,
          updatedAt: new Date().toISOString(),
        });
      },
    });
  },

  async delete(userId, attachmentId) {
    if (!userId || !attachmentId) return false;
    const match = await this.getById(userId, attachmentId);
    if (!match) return false;
    await db.transaction('rw', attachmentTable(), linkTable(), fileTable(), async () => {
      await attachmentTable().delete(match.id);
      const links = await linkTable().where('attachmentId').equals(match.id).toArray();
      if (links.length) await linkTable().bulkDelete(links.map((link) => link.id));
      await fileTable().delete(match.id);
    });
    return true;
  },

  async replaceParentLinks(userId, attachmentId, parentLinks = []) {
    const attachment = await this.getById(userId, attachmentId);
    if (!attachment) throw new Error(`Attachment ${attachmentId} was not found for this local profile.`);
    const links = normalizeParentLinks(attachmentId, userId, parentLinks);
    if (!links.length) throw new Error('An attachment must remain linked to at least one Moment or Activity.');
    return db.transaction('rw', attachmentTable(), linkTable(), db.table(DATABASE_TABLES.MOMENTS), db.table(DATABASE_TABLES.ACTIVITIES), async () => {
      for (const link of links) {
        const parent = link.parentType === 'moment'
          ? await momentRepository.getById(userId, link.parentId)
          : await activityRepository.getById(userId, link.parentId);
        if (!parent) throw makeRepositoryConflict({ domain: 'attachments', operation: 'link', record: link, reason: `parent-${link.parentType}-missing`, fields: ['parentId'] });
      }
      const existing = await linkTable().where('attachmentId').equals(attachmentId).toArray();
      if (existing.length) await linkTable().bulkDelete(existing.map((link) => link.id));
      await linkTable().bulkPut(links);
      await attachmentTable().put({ ...attachment, momentId: links.find((link) => link.parentType === 'moment')?.parentId || null, updatedAt: new Date().toISOString() });
      return links;
    });
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

    const links = prepared.flatMap((attachment) => normalizeParentLinks(attachment.id, userId, attachment.momentId ? [{ parentType: 'moment', parentId: attachment.momentId }] : []));
    return bulkCreateUniqueRecords({
      tableName: DATABASE_TABLES.ATTACHMENTS,
      records: prepared,
      domain: 'attachments',
      transactionTables: [db.table(DATABASE_TABLES.MOMENTS), linkTable()],
      beforeInsert: async (records) => {
        for (const record of records) {
          if (!(await momentRepository.getById(userId, record.momentId))) {
            throw makeRepositoryConflict({ domain: 'attachments', operation: 'bulk-create', record, reason: 'parent-moment-missing', fields: ['momentId'] });
          }
        }
        if (links.length) await linkTable().bulkPut(links);
      },
    });
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
