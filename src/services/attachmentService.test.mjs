import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  MAX_ATTACHMENT_BYTES,
  attachmentAssetId,
  createAttachmentRepository,
  exportAttachmentFiles,
  restoreAttachmentFiles,
} from './attachmentService.js';

// Exercise the real repository and serialization with isolated byte stores.
// Neither Firebase initialization nor network/IndexedDB access is involved.
const guest = { isGuest: true };
const account = (uid) => ({ uid, isGuest: false });
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
const independentHash = (value) => createHash('sha256').update(value).digest('hex');
const original = () => new Blob([Uint8Array.from({ length: 70003 }, (_, index) => index % 256)], { type: 'image/png' });
const attachment = (reference, fields = {}) => ({ id: 'photo-1', name: 'original.png', ...reference, ...fields });
const fixture = () => {
  const localFiles = new Map();
  const cloudFiles = new Map();
  const calls = [];
  const local = async (scope, id, blob) => {
    calls.push([blob ? 'local-put' : 'local-get', scope, id]);
    const key = `${scope}/${id}`;
    if (blob) localFiles.set(key, blob);
    return localFiles.get(key) || null;
  };
  const remote = {
    async put(uid, id, blob) { calls.push(['cloud-put', uid, id]); cloudFiles.set(`${uid}/${id}`, blob); },
    async get(uid, id) {
      calls.push(['cloud-get', uid, id]);
      if (!cloudFiles.has(`${uid}/${id}`)) throw new Error('storage/object-not-found');
      return cloudFiles.get(`${uid}/${id}`);
    },
  };
  return { repository: createAttachmentRepository({ local, remote }), localFiles, cloudFiles, calls };
};

test('asset IDs use SHA-256 of original bytes without changing the file', async () => {
  const known = new Blob(['abc']);
  assert.equal(await attachmentAssetId(known), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const file = original();
  const before = await bytes(file);
  assert.equal(await attachmentAssetId(file), independentHash(before));
  assert.deepEqual(await bytes(file), before);
  assert.equal(await attachmentAssetId(new Blob([before], { type: 'application/octet-stream' })), await attachmentAssetId(file),
    'filenames and MIME labels do not duplicate identical originals');
});

test('saving and reading preserves binary bytes, MIME and one stored original per scoped content ID', async () => {
  const { repository, localFiles, cloudFiles } = fixture();
  const file = original();
  const first = await repository.save(file, guest);
  const second = await repository.save(new Blob([await bytes(file)], { type: file.type }), guest);
  assert.deepEqual(first, second);
  assert.equal(first.storage, 'local');
  assert.equal(localFiles.size, 1);
  const read = await repository.read(attachment(first), guest);
  assert.equal(read.type, file.type);
  assert.deepEqual(await bytes(read), await bytes(file));
  const remoteFirst = await repository.save(file, account('owner-A'));
  const remoteSecond = await repository.save(file, account('owner-A'));
  assert.deepEqual(remoteFirst, remoteSecond);
  assert.equal(remoteFirst.storage, 'firebase');
  assert.equal(cloudFiles.size, 1);
  assert.deepEqual(await bytes(await repository.read(attachment(remoteFirst), account('owner-A'))), await bytes(file));
});

test('guest, sample and distinct account originals are isolated even when the content ID matches', async () => {
  const { repository, localFiles, cloudFiles, calls } = fixture();
  const file = original();
  const localReference = await repository.save(file, guest);
  await assert.rejects(repository.read(attachment(localReference), account('owner-A')), /unavailable on this device/);
  const sample = { isGuest: true, sample: true };
  await assert.rejects(repository.read(attachment(localReference), sample), /unavailable on this device/);
  const cloudReference = await repository.save(file, account('owner-A'));
  await assert.rejects(repository.read(attachment(cloudReference), account('owner-B')), /object-not-found/);
  await assert.rejects(repository.read(attachment(cloudReference), guest), /Restore the original/);
  await assert.rejects(repository.read(attachment(cloudReference), sample), /Restore the original/);
  await repository.save(file, sample);
  assert.equal(localFiles.size, 2);
  assert.equal(cloudFiles.size, 1);
  assert.deepEqual(calls.filter(([operation]) => operation === 'cloud-get').map(([, uid]) => uid), ['owner-B'],
    'cloud reads target only the requesting owner, never the source account');
});

test('missing identity, invalid content IDs and invalid files reject before original persistence', async () => {
  const { repository, calls } = fixture();
  await assert.rejects(repository.save(original(), {}), /Sign in or enter Guest/);
  await assert.rejects(repository.save(new Blob([]), guest), /between 1 byte and 10 MB/);
  await assert.rejects(repository.save(new Blob([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)]), guest), /between 1 byte and 10 MB/);
  await assert.rejects(repository.save({ size: 5 }, guest), /between 1 byte and 10 MB/);
  await assert.rejects(repository.read({ assetId: '../other-user', storage: 'local' }, guest), /Invalid attachment/);
  assert.deepEqual(calls, []);
  const invalidHash = createAttachmentRepository({ hash: async () => 'not-a-digest', local: async () => assert.fail('invalid hash must not persist') });
  await assert.rejects(invalidHash.save(original(), guest), /Invalid attachment/);
});

test('denied cloud upload rejects with no local fallback or successful reference', async () => {
  const denied = Object.assign(new Error('Storage access denied'), { code: 'storage/unauthorized' });
  let uploads = 0;
  const repository = createAttachmentRepository({
    local: async () => assert.fail('account upload must not fall back to guest/local storage'),
    remote: { put: async () => { uploads += 1; throw denied; }, get: async () => { throw denied; } },
  });
  await assert.rejects(repository.save(original(), account('owner-A')), (error) => error === denied);
  assert.equal(uploads, 1);
  await assert.rejects(repository.read({ assetId: independentHash(Buffer.from('abc')), storage: 'firebase' }, account('owner-A')), (error) => error === denied);
});

test('legacy metadata-only attachments stay readable as metadata without inventing a file', async () => {
  const { repository, calls } = fixture();
  assert.equal(await repository.read({ id: 'old', name: 'lost-original.jpg', type: 'image/jpeg' }, guest), null);
  assert.deepEqual(calls, []);
  assert.deepEqual(await exportAttachmentFiles([{ id: 'moment', attachments: [{ id: 'old', name: 'lost-original.jpg' }] }], guest, repository), []);
});

test('backup exports each original once across Moments and Activity references with exact binary base64', async () => {
  const { repository, calls } = fixture();
  const file = original();
  const reference = await repository.save(file, guest);
  const moments = [
    { id: 'moment-1', attachments: [attachment(reference, { activityId: 'activity-1' })] },
    { id: 'moment-2', attachments: [attachment(reference, { id: 'photo-2', activityId: 'activity-2' }), { id: 'legacy', name: 'old.jpg' }] },
  ];
  const before = JSON.stringify(moments);
  const files = await exportAttachmentFiles(moments, guest, repository);
  assert.equal(files.length, 1);
  assert.deepEqual(files[0], { assetId: reference.assetId, type: file.type, size: file.size, base64: (await bytes(file)).toString('base64') });
  assert.deepEqual(Buffer.from(files[0].base64, 'base64'), await bytes(file));
  assert.equal(calls.filter(([operation]) => operation === 'local-get').length, 1);
  assert.equal(JSON.stringify(moments), before);
});

test('backup fails when a referenced original cannot be read instead of silently omitting it', async () => {
  const { repository } = fixture();
  const missing = { id: 'missing', name: 'important.png', assetId: independentHash(Buffer.from('not stored')), storage: 'local' };
  await assert.rejects(exportAttachmentFiles([{ id: 'moment', attachments: [missing] }], guest, repository), /unavailable on this device/);
  await assert.rejects(exportAttachmentFiles([{ id: 'moment', attachments: [missing] }], guest, { read: async () => null }), /important\.png.*could not be backed up/);
});

test('backup refuses incorrect original bytes even when the repository returns a same-size file', async () => {
  const file = original();
  const assetId = await attachmentAssetId(file);
  const corrupt = await bytes(file);
  corrupt[0] ^= 0xff;
  const wrongOriginal = new Blob([corrupt], { type: file.type });
  assert.equal(wrongOriginal.size, file.size, 'size alone cannot prove original byte integrity');
  await assert.rejects(exportAttachmentFiles([{ id: 'moment', attachments: [attachment({ assetId, storage: 'local' })] }],
    guest, { read: async () => wrongOriginal }), /integrity|original|match/i);
});

test('local and cloud reads reject corrupt stored bytes before showing a wrong original', async () => {
  const { repository, localFiles, cloudFiles } = fixture();
  const file = original();
  const localReference = await repository.save(file, guest);
  const remoteReference = await repository.save(file, account('owner-A'));
  const corrupted = await bytes(file);
  corrupted[0] ^= 0xff;
  const wrongOriginal = new Blob([corrupted], { type: file.type });
  localFiles.set(`guest/${localReference.assetId}`, wrongOriginal);
  cloudFiles.set(`owner-A/${remoteReference.assetId}`, wrongOriginal);
  await assert.rejects(repository.read(attachment(localReference), guest), /integrity|original|match/i);
  await assert.rejects(repository.read(attachment(remoteReference), account('owner-A')), /integrity|original|match/i);
});

test('restore uploads an original once and changes all references to the destination account preserving record links', async () => {
  const { repository, calls } = fixture();
  const file = original();
  const reference = await repository.save(file, guest);
  const moments = [
    { id: 'moment-1', name: 'Original Moment', activities: [{ id: 'activity-1' }], attachments: [attachment(reference, { activityId: 'activity-1', createdAt: '2026-10-23T00:00:00Z' })] },
    { id: 'moment-2', attachments: [attachment(reference, { id: 'photo-2', activityId: 'activity-2' }), { id: 'legacy', name: 'old.jpg' }] },
  ];
  const files = await exportAttachmentFiles(moments, guest, repository);
  const before = JSON.stringify({ moments, files });
  const restored = await restoreAttachmentFiles(moments, files, account('destination'), repository);
  assert.equal(calls.filter(([operation]) => operation === 'cloud-put').length, 1);
  assert.equal(JSON.stringify({ moments, files }), before, 'restore never mutates the imported backup or original records');
  assert.equal(restored[0].id, 'moment-1');
  assert.equal(restored[0].name, 'Original Moment');
  assert.deepEqual(restored[0].activities, [{ id: 'activity-1' }]);
  for (const record of [restored[0].attachments[0], restored[1].attachments[0]]) {
    assert.equal(record.assetId, reference.assetId);
    assert.equal(record.storage, 'firebase');
    assert.deepEqual(await bytes(await repository.read(record, account('destination'))), await bytes(file));
  }
  assert.equal(restored[0].attachments[0].id, 'photo-1');
  assert.equal(restored[0].attachments[0].activityId, 'activity-1');
  assert.equal(restored[0].attachments[0].createdAt, '2026-10-23T00:00:00Z');
  assert.equal(restored[1].attachments[0].id, 'photo-2');
  assert.equal(restored[1].attachments[0].activityId, 'activity-2');
  assert.deepEqual(restored[1].attachments[1], { id: 'legacy', name: 'old.jpg' });
});

test('account backup restored to Guest stores a new local original instead of retaining inaccessible cloud references', async () => {
  const { repository, calls } = fixture();
  const file = original();
  const reference = await repository.save(file, account('source-account'));
  const moments = [{ id: 'moment', attachments: [attachment(reference)] }];
  const files = await exportAttachmentFiles(moments, account('source-account'), repository);
  const restored = await restoreAttachmentFiles(moments, files, guest, repository);
  const destination = restored[0].attachments[0];
  assert.equal(destination.storage, 'local');
  assert.equal(destination.assetId, reference.assetId);
  assert.deepEqual(await bytes(await repository.read(destination, guest)), await bytes(file));
  assert.equal(calls.filter(([operation, scope]) => operation === 'local-put' && scope === 'guest').length, 1);
  await assert.rejects(repository.read(destination, account('other-account')), /unavailable on this device/);
});

test('restore rejects missing, corrupt and mismatched originals before persisting their references', async (t) => {
  const file = original();
  const assetId = await attachmentAssetId(file);
  const encoded = (await bytes(file)).toString('base64');
  const record = { assetId, type: file.type, size: file.size, base64: encoded };
  const moments = [{ id: 'moment', attachments: [attachment({ assetId, storage: 'firebase' })] }];
  const mutated = await bytes(file);
  mutated[0] ^= 0xff;
  const cases = [
    ['missing', [], /missing a valid original/],
    ['invalid base64', [{ ...record, base64: '!broken!' }], /missing a valid original/],
    ['wrong declared size', [{ ...record, size: file.size + 1 }], /size or integrity/],
    ['truncated original', [{ ...record, base64: encoded.slice(0, -4) }], /size or integrity/],
    ['same-length corrupt bytes', [{ ...record, base64: mutated.toString('base64') }], /size or integrity/],
    ['wrong content ID', [{ ...record, assetId: independentHash(Buffer.from('different file')) }], /missing a valid original/],
  ];
  for (const [name, files, message] of cases) await t.test(name, async () => {
    const { repository, calls } = fixture();
    await assert.rejects(restoreAttachmentFiles(moments, files, guest, repository), message);
    assert.deepEqual(calls, [], 'an invalid original is rejected before any local or cloud save');
  });
});

test('restore propagates denied destination uploads rather than returning falsely restored records', async () => {
  const file = original();
  const assetId = await attachmentAssetId(file);
  const moments = [{ id: 'moment', attachments: [attachment({ assetId, storage: 'local' })] }];
  const files = [{ assetId, type: file.type, size: file.size, base64: (await bytes(file)).toString('base64') }];
  const denied = new Error('storage/unauthorized');
  const repository = createAttachmentRepository({
    local: async () => assert.fail('account restore must not silently become local-only'),
    remote: { put: async () => { throw denied; } },
  });
  await assert.rejects(restoreAttachmentFiles(moments, files, account('destination'), repository), (error) => error === denied);
  assert.equal(moments[0].attachments[0].storage, 'local');
});
