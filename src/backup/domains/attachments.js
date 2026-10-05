import { DATABASE_TABLES as T } from '../../database/tables.js';
import { registerBackupDomain } from '../registry.js';

const blobToBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  return btoa(binary);
};

const hashBlob = async (blob) => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const base64ToBlob = (value, mimeType = 'application/octet-stream') => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
};

const serializeAttachmentFiles = async (rows) => {
  const serialized = [];
  let totalBytes = 0;
  for (const row of rows) {
    const blob = row.blob;
    if (!(blob instanceof Blob)) throw new Error(`Attachment ${row.attachmentId} has no readable local file content.`);
    totalBytes += blob.size;
    if (totalBytes > 50 * 1024 * 1024) throw new Error('Included attachments exceed the 50 MB backup limit. Choose Metadata Only or fewer files.');
    serialized.push({
      attachmentId: row.attachmentId,
      userId: row.userId,
      mimeType: row.mimeType || blob.type || 'application/octet-stream',
      size: blob.size,
      sha256: await hashBlob(blob),
      base64: await blobToBase64(blob),
      updatedAt: row.updatedAt,
    });
  }
  return serialized;
};

const restoreAttachmentFiles = async (rows) => {
  const restored = [];
  for (const row of rows) {
    if (row.blob instanceof Blob) {
      restored.push(row);
      continue;
    }
    if (typeof row.base64 !== 'string') throw new Error(`Included file content is missing for attachment ${row.attachmentId}.`);
    const blob = base64ToBlob(row.base64, row.mimeType);
    if (blob.size !== Number(row.size)) throw new Error(`Included file size does not match for attachment ${row.attachmentId}.`);
    if (row.sha256 && await hashBlob(blob) !== row.sha256) throw new Error(`Included file integrity check failed for attachment ${row.attachmentId}.`);
    restored.push({ attachmentId: row.attachmentId, userId: row.userId, blob, mimeType: row.mimeType, size: blob.size, updatedAt: row.updatedAt || new Date().toISOString() });
  }
  return restored;
};

export const ATTACHMENT_FILE_BACKUP_DOMAIN = registerBackupDomain({
  domain: 'attachment-files',
  tables: [T.ATTACHMENT_FILES],
  tier: 'tier1-user-data',
  ownershipPolicy: { type: 'principal-field', field: 'userId' },
  restorePolicy: 'table',
  descriptorVersion: 1,
  defaultIncluded: false,
  backupMode: 'include-attachments',
  exportRows: serializeAttachmentFiles,
  restoreRows: restoreAttachmentFiles,
});
