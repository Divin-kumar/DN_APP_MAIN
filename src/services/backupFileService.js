import { createBackupDocument, parseBackupDocument, validateBackupAttachmentFile, validateBackupDocument } from './backupService.js';
import { attachmentBlobFromBackup, iterateAttachmentFiles } from './attachmentService.js';

const ARRAY_FIELDS = new Set(['moments', 'activities', 'memories', 'attachments', 'attachmentFiles', 'expenses', 'incomes']);
const CHUNK_BYTES = 256 * 1024;
const whitespace = (byte) => byte === 32 || byte === 9 || byte === 10 || byte === 13;
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));
const guard = ({ signal, assertCurrent } = {}) => {
  if (signal?.aborted) throw new DOMException('Backup preparation cancelled.', 'AbortError');
  assertCurrent?.();
};
const descriptor = ({ assetId, type, size }) => ({ assetId, type, size });

// Keep v3 JSON on disk. Blob parts are created per record/original, without
// retaining all base64 strings or constructing one large JSON string in JS.
export async function createBackupFile(input, context = {}, repository) {
  guard(context);
  const backup = createBackupDocument({ ...input, attachmentFiles: [] }, { deferAttachmentFiles: true });
  const expected = new Set(backup.attachments.map((item) => item.assetId).filter(Boolean));
  backup.metadata.attachmentDataIncluded = expected.size > 0;
  const parts = [new Blob(['{'])];
  let fields = 0;
  let records = 0;
  const field = (key) => { parts.push(new Blob([(fields++ ? ',' : '') + JSON.stringify(key) + ':'])); };
  for (const [key, value] of Object.entries(backup)) {
    if (key === 'attachmentFiles') continue;
    guard(context);
    field(key);
    if (Array.isArray(value)) {
      parts.push(new Blob(['[']));
      for (let index = 0; index < value.length; index += 1) {
        guard(context);
        parts.push(new Blob([(index ? ',' : '') + JSON.stringify(value[index])]));
        if (++records % 100 === 0) {
          context.onProgress?.({ stage: 'records', records });
          await pause();
        }
      }
      parts.push(new Blob([']']));
    } else parts.push(new Blob([JSON.stringify(value)]));
  }
  field('attachmentFiles');
  parts.push(new Blob(['[']));
  const originalFiles = new Map();
  const scoped = { ...context, assertCurrent: () => guard(context) };
  for await (const file of iterateAttachmentFiles(input.moments || [], scoped, repository)) {
    guard(context);
    validateBackupAttachmentFile(file);
    parts.push(new Blob([(originalFiles.size ? ',' : '') + JSON.stringify(file)]));
    const info = descriptor(file);
    originalFiles.set(file.assetId, info);
    backup.attachmentFiles.push(info);
    context.onProgress?.({ stage: 'originals', completed: originalFiles.size, total: expected.size });
    await pause();
  }
  guard(context);
  validateBackupDocument(backup, { originalFiles });
  parts.push(new Blob([']}']));
  const blob = new Blob(parts, { type: 'application/json' });
  guard(context);
  return { blob, createdDate: backup.createdDate, originalFileCount: originalFiles.size,
    metadataOnlyCount: backup.attachments.filter((item) => !item.assetId).length };
}

// Scan UTF-8 bytes to find JSON boundaries; punctuation bytes cannot occur in
// UTF-8 continuation bytes. JSON.parse still validates each complete value.
// Only one top-level array item is decoded at once. Original byte ranges are
// retained in the immutable selected File, not copied into private storage.
export async function readJsonBackupFile(file, { onArrayItem, onProgress, chunkBytes = CHUNK_BYTES, ...context } = {}) {
  if (!file || typeof file.slice !== 'function' || !Number.isSafeInteger(file.size) || file.size < 1) {
    throw new Error('Choose a non-empty DN backup JSON file.');
  }
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1) throw new Error('Invalid backup read chunk size.');
  const result = {};
  const keys = new Set();
  let state = 'root';
  let key;
  let capture;
  let bom = 0;
  const fail = () => { throw new Error('The backup is not valid JSON. Choose a complete DN backup file.'); };
  const assign = (name, value) => Object.defineProperty(result, name, { value, enumerable: true, writable: true, configurable: true });
  const begin = (kind, start, byte) => {
    if (![34, 45, 91, 123, 116, 102, 110].includes(byte) && !(byte >= 48 && byte <= 57)) fail();
    capture = { kind, start, quoted: byte === 34, inString: byte === 34,
      escaped: false, stack: byte === 91 || byte === 123 ? [byte] : [], primitive: ![34, 91, 123].includes(byte) };
    state = 'capture';
  };
  const finish = async (end) => {
    guard(context);
    const current = capture;
    let value;
    try { value = JSON.parse(await file.slice(current.start, end).text()); }
    catch { fail(); }
    guard(context);
    if (current.kind === 'key') {
      if (typeof value !== 'string' || keys.has(value)) throw new Error('Backup contains an invalid or duplicate top-level field.');
      key = value;
      keys.add(key);
      state = 'colon';
    } else if (current.kind === 'field') {
      assign(key, value);
      state = 'after-field';
    } else {
      result[key].push(onArrayItem ? await onArrayItem(key, value, { start: current.start, end }) : value);
      guard(context);
      state = 'after-item';
    }
    capture = null;
  };
  for (let offset = 0; offset < file.size; offset += chunkBytes) {
    guard(context);
    const chunk = new Uint8Array(await file.slice(offset, offset + chunkBytes).arrayBuffer());
    guard(context);
    for (let index = 0; index < chunk.length; index += 1) {
      const byte = chunk[index], position = offset + index;
      // Blob.text()/the old reader strip an initial UTF-8 BOM. Preserve that
      // behavior even when the three bytes fall in separate read chunks.
      if (position === 0 && byte === 239) { bom = 1; continue; }
      if (bom === 1 || bom === 2) {
        if (byte !== (bom === 1 ? 187 : 191)) fail();
        bom += 1;
        continue;
      }
      if (state === 'capture') {
        if (capture.inString) {
          if (capture.escaped) capture.escaped = false;
          else if (byte === 92) capture.escaped = true;
          else if (byte === 34) {
            capture.inString = false;
            if (capture.quoted && !capture.stack.length) await finish(position + 1);
          }
        } else if (capture.primitive) {
          if (whitespace(byte) || [44, 93, 125].includes(byte)) { await finish(position); index -= 1; }
        } else if (byte === 34) capture.inString = true;
        else if (byte === 91 || byte === 123) capture.stack.push(byte);
        else if (byte === 93 || byte === 125) {
          if (capture.stack.pop() !== (byte === 93 ? 91 : 123)) fail();
          if (!capture.stack.length) await finish(position + 1);
        }
        continue;
      }
      if (whitespace(byte)) continue;
      if (state === 'root') { if (byte !== 123) fail(); state = 'key-or-end'; }
      else if (state === 'key-or-end' || state === 'key-required') {
        if (byte === 125 && state === 'key-or-end') state = 'done';
        else { if (byte !== 34) fail(); begin('key', position, byte); }
      } else if (state === 'colon') { if (byte !== 58) fail(); state = 'field-start'; }
      else if (state === 'field-start') {
        if (byte === 91 && ARRAY_FIELDS.has(key)) { assign(key, []); state = 'item-or-end'; }
        else begin('field', position, byte);
      } else if (state === 'item-or-end' || state === 'item-required') {
        if (byte === 93 && state === 'item-or-end') state = 'after-field';
        else { if (byte === 93) fail(); begin('item', position, byte); }
      } else if (state === 'after-item') {
        if (byte === 44) state = 'item-required';
        else if (byte === 93) state = 'after-field';
        else fail();
      } else if (state === 'after-field') {
        if (byte === 44) state = 'key-required';
        else if (byte === 125) state = 'done';
        else fail();
      } else fail();
    }
    onProgress?.({ stage: 'reading', completed: Math.min(offset + chunk.length, file.size), total: file.size });
    await pause();
  }
  guard(context);
  if (state !== 'done') fail();
  return result;
}

export async function readBackupFile(file, context = {}) {
  const originalFiles = new Map();
  const parsed = await readJsonBackupFile(file, { ...context,
    onArrayItem: async (key, value, range) => {
      if (key !== 'attachmentFiles') return value;
      validateBackupAttachmentFile(value);
      if (originalFiles.has(value.assetId)) throw new Error('Backup contains duplicate original attachment files.');
      await attachmentBlobFromBackup(value);
      guard(context);
      const info = { ...descriptor(value), ...range };
      originalFiles.set(value.assetId, info);
      context.onProgress?.({ stage: 'checking', completed: originalFiles.size });
      return descriptor(value);
    },
  });
  const backup = parseBackupDocument(parsed, { originalFiles });
  guard(context);
  return { backup, originalFiles, readOriginal: async (assetId) => {
    guard(context);
    const info = originalFiles.get(assetId);
    if (!info) throw new Error('Backup is missing an indexed original attachment file.');
    const value = JSON.parse(await file.slice(info.start, info.end).text());
    validateBackupAttachmentFile(value);
    if (value.assetId !== assetId || value.type !== info.type || value.size !== info.size) throw new Error('The selected backup original changed. Select the complete backup again.');
    const blob = await attachmentBlobFromBackup(value);
    guard(context);
    return blob;
  } };
}
