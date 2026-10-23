// Originals are content-addressed once per guest/account; Moment records hold references only.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ASSET_ID = /^[a-f0-9]{64}$/;
const DB_NAME = 'dn_attachment_originals';
let database;
const scopeName = ({ uid, isGuest, sample = false }) => sample ? 'sample' : isGuest ? 'guest' : uid ? `account:${uid}` : (() => { throw new Error('Sign in or enter Guest mode before adding a file.'); })();
const validId = (id) => { if (!ASSET_ID.test(id || '')) throw new Error('Invalid attachment file reference.'); return id; };
const cloudPath = (uid, id) => {
  if (!uid || /[/\\]/.test(uid)) throw new Error('This account cannot access that attachment.');
  return `users/${uid}/attachments/${validId(id)}`;
};
const openDatabase = () => {
  if (!globalThis.indexedDB) return Promise.reject(new Error('File storage is unavailable in this browser.'));
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = null; reject(request.error); };
    request.onblocked = () => { database = null; reject(new Error('Close other DN tabs and try file storage again.')); };
  });
  return database;
};
const localFile = async (scope, id, blob) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('files', blob ? 'readwrite' : 'readonly');
    const store = transaction.objectStore('files');
    const request = blob ? store.put({ key: `${scope}:${validId(id)}`, blob }) : store.get(`${scope}:${validId(id)}`);
    let result;
    request.onsuccess = () => { result = blob || request.result?.blob || null; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('The original file could not be stored.'));
    transaction.onabort = transaction.onerror;
  });
};
const firebaseStorage = async () => {
  const [sdk, { firebaseApp }] = await Promise.all([import('firebase/storage'), import('../firebase/config')]);
  return { ...sdk, storage: sdk.getStorage(firebaseApp) };
};
const cloud = {
  async put(uid, id, blob) {
    const sdk = await firebaseStorage();
    const reference = sdk.ref(sdk.storage, cloudPath(uid, id));
    try { await sdk.getMetadata(reference); }
    catch (error) {
      if (error.code !== 'storage/object-not-found') throw error;
      await sdk.uploadBytes(reference, blob, { contentType: blob.type || 'application/octet-stream' });
    }
  },
  async get(uid, id) {
    const sdk = await firebaseStorage();
    return sdk.getBlob(sdk.ref(sdk.storage, cloudPath(uid, id)), MAX_ATTACHMENT_BYTES);
  },
};
export const attachmentAssetId = async (blob) => {
  const bytes = await blob.arrayBuffer();
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((value) => value.toString(16).padStart(2, '0')).join('');
};
export const createAttachmentRepository = ({ local = localFile, remote = cloud, hash = attachmentAssetId } = {}) => ({
  async save(blob, context) {
    context.assertCurrent?.();
    if (!(blob instanceof Blob) || blob.size === 0 || blob.size > MAX_ATTACHMENT_BYTES) throw new Error('Choose a file between 1 byte and 10 MB.');
    const scope = scopeName(context);
    const assetId = validId(await hash(blob));
    context.assertCurrent?.();
    if (context.isGuest || context.sample) await local(scope, assetId, blob);
    else await remote.put(context.uid, assetId, blob);
    context.assertCurrent?.();
    return { assetId, storage: context.isGuest || context.sample ? 'local' : 'firebase' };
  },
  async read(attachment, context) {
    context.assertCurrent?.();
    const scope = scopeName(context);
    if (!attachment.assetId) return null; // A historical metadata-only entry cannot recover its file.
    let blob;
    if (attachment.storage === 'firebase') {
      if (context.isGuest || context.sample) throw new Error('Restore the original file into this session before opening it.');
      blob = await remote.get(context.uid, validId(attachment.assetId));
    } else blob = await local(scope, validId(attachment.assetId));
    context.assertCurrent?.();
    if (!blob) throw new Error('The original file is unavailable on this device. Restore a backup containing the file.');
    if (blob.size > MAX_ATTACHMENT_BYTES || await hash(blob) !== attachment.assetId) throw new Error('The original file failed its integrity check. Restore it from a complete backup.');
    return blob;
  },
});
export const attachmentRepository = createAttachmentRepository();

const toBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 32768) binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
  return btoa(binary);
};
export const exportAttachmentFiles = async (moments, context, repository = attachmentRepository) => {
  const files = new Map();
  for (const attachment of moments.flatMap((moment) => moment.attachments || [])) {
    context.assertCurrent?.();
    if (!attachment.assetId || files.has(attachment.assetId)) continue;
    const blob = await repository.read(attachment, context);
    context.assertCurrent?.();
    if (!blob) throw new Error(`The original for ${attachment.name || 'a file'} could not be backed up.`);
    if (await attachmentAssetId(blob) !== attachment.assetId) throw new Error('An attachment failed its integrity check and could not be backed up.');
    files.set(attachment.assetId, { assetId: attachment.assetId, type: blob.type || attachment.type || 'application/octet-stream', size: blob.size, base64: await toBase64(blob) });
  }
  return [...files.values()];
};
export const restoreAttachmentFiles = async (moments, files = [], context, repository = attachmentRepository) => {
  const byId = new Map(files.map((file) => [file.assetId, file]));
  const restored = new Map();
  const result = [];
  for (const moment of moments) {
    const attachments = [];
    for (const attachment of moment.attachments || []) {
      context.assertCurrent?.();
      if (!attachment.assetId) { attachments.push(attachment); continue; }
      if (!restored.has(attachment.assetId)) {
        const file = byId.get(attachment.assetId);
        if (!file || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64 || '')) throw new Error('Backup is missing a valid original attachment file.');
        const bytes = Uint8Array.from(atob(file.base64), (character) => character.charCodeAt(0));
        const blob = new Blob([bytes], { type: file.type });
        if (blob.size !== file.size || await attachmentAssetId(blob) !== attachment.assetId) throw new Error('An attachment backup failed its size or integrity check.');
        context.assertCurrent?.();
        restored.set(attachment.assetId, await repository.save(blob, context));
      }
      attachments.push({ ...attachment, ...restored.get(attachment.assetId) });
    }
    result.push({ ...moment, attachments });
  }
  return result;
};
