import { DATABASE_TABLES } from '../database/tables.js';
import { VALID_ATTACHMENT_SOURCES } from './attachmentRepository.validation.js';

export const mapAttachmentRecord = (record = {}, userId = null) => {
  if (!record || typeof record !== 'object') return null;

  const now = new Date().toISOString();
  const id = String(record.id ?? record.firestoreId ?? crypto.randomUUID());
  const attachmentType = typeof record.type === 'string' ? record.type.trim() : String(record.mimeType ?? 'file');
  const fileReference = record.fileReference ?? record.url ?? record.fileUrl ?? '';

  return {
    id,
    userId,
    momentId: record.momentId ?? record.eventId ?? null,
    name: typeof record.name === 'string' ? record.name.trim() : String(record.name ?? 'Attachment').trim() || 'Attachment',
    type: attachmentType,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType.trim() : attachmentType,
    size: Number.isFinite(Number(record.size)) ? Number(record.size) : 0,
    url: typeof fileReference === 'string' ? fileReference.trim() : '',
    fileReference: typeof fileReference === 'string' ? fileReference.trim() : '',
    previewReference: typeof record.previewReference === 'string' ? record.previewReference.trim() : '',
    availability: record.availability || (fileReference ? 'reference' : 'metadata-only'),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    source: VALID_ATTACHMENT_SOURCES.includes(record.source) ? record.source : 'legacy',
    firestoreId: record.firestoreId || null,
    table: DATABASE_TABLES.ATTACHMENTS,
  };
};

export const mapAttachmentCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapAttachmentRecord(record, userId))
    .filter(Boolean);
