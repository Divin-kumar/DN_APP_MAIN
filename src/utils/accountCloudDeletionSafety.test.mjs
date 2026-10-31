import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUD_RECORD_COLLECTIONS, CLOUD_DELETE_CONFIRMATION,
  assertCloudDeleteOwner, executeCloudRecordDeletion,
} from './accountCloudDeletionSafety.js';

test('requires the exact live Firebase identity and disallows Guest/sample', () => {
  const valid = { user: { uid: 'signed-in-owner' }, firebaseUid: 'signed-in-owner', isGuest: false, sample: null };
  assert.doesNotThrow(() => assertCloudDeleteOwner('signed-in-owner', valid));
  for (const change of [
    { user: { uid: 'another-owner' } }, { firebaseUid: 'another-owner' },
    { isGuest: true }, { sample: 'guided-tour' }, { firebaseUid: null },
  ]) assert.throws(() => assertCloudDeleteOwner('signed-in-owner', { ...valid, ...change }));
  assert.equal(CLOUD_DELETE_CONFIRMATION, 'DELETE MY CLOUD DATA');
});

const makeCloud = ({ count = 3, inaccessible, injectForeign, failBatchAt, failVerify } = {}) => {
  const db = new Map(CLOUD_RECORD_COLLECTIONS.map(name => [
    name, Array.from({ length: count }, (_, i) => ({ path: `users/owner/${name}/${i}` })),
  ]));
  const batches = [];
  const listCollection = async (name) => {
    if (inaccessible === name) throw new Error('permission-denied');
    if (injectForeign && name === 'expenses') return [{ path: 'users/victim/expenses/x' }];
    if (failVerify && batches.length && name === 'events') return [{ path: 'users/owner/events/recreated' }];
    return db.get(name);
  };
  const deleteBatch = async (refs) => {
    if (failBatchAt === batches.length) throw new Error('write failed');
    batches.push(refs);
    for (const ref of refs) {
      const segments = ref.path.split('/');
      db.set(segments[2], db.get(segments[2]).filter(item => item.path !== ref.path));
    }
  };
  return { db, batches, listCollection, deleteBatch };
};

test('removes every known current and legacy collection without touching another user', async () => {
  const cloud = makeCloud({ count: 3 });
  const progress = [];
  const result = await executeCloudRecordDeletion({ uid: 'owner', assertCurrent: () => {},
    listCollection: cloud.listCollection, deleteBatch: cloud.deleteBatch, onProgress: value => progress.push(value) });
  assert.deepEqual(result, { deleted: CLOUD_RECORD_COLLECTIONS.length * 3 });
  assert.equal(cloud.batches.length, 1);
  assert.ok([...cloud.db.values()].every(docs => docs.length === 0));
  assert.deepEqual(progress.at(-1), { stage: 'deleting', deleted: 18, total: 18 });
});

test('permission failure during inventory performs zero deletes', async () => {
  const cloud = makeCloud({ inaccessible: 'events' });
  await assert.rejects(executeCloudRecordDeletion({ uid: 'owner', assertCurrent: () => {},
    listCollection: cloud.listCollection, deleteBatch: cloud.deleteBatch }), /permission-denied/);
  assert.equal(cloud.batches.length, 0);
});

test('foreign or deeply nested references are refused before deletion', async () => {
  const cloud = makeCloud({ injectForeign: true });
  await assert.rejects(executeCloudRecordDeletion({ uid: 'owner', assertCurrent: () => {},
    listCollection: cloud.listCollection, deleteBatch: cloud.deleteBatch }), /Unexpected cloud record path/);
  assert.equal(cloud.batches.length, 0);
});

test('changes in session stop remaining batches and never claim success', async () => {
  const cloud = makeCloud({ count: 60 });
  let allowed = true;
  const assertCurrent = () => { if (!allowed) throw new Error('session changed'); };
  await assert.rejects(executeCloudRecordDeletion({ uid: 'owner', assertCurrent,
    listCollection: cloud.listCollection, deleteBatch: async refs => { await cloud.deleteBatch(refs); allowed = false; } }), /session changed/);
  assert.equal(cloud.batches.length, 1);
  assert.equal(cloud.batches[0].length, 200);
});

test('partial write failure and records recreated during verification are reported', async () => {
  const writeFail = makeCloud({ count: 80, failBatchAt: 1 });
  await assert.rejects(executeCloudRecordDeletion({ uid: 'owner', assertCurrent: () => {},
    listCollection: writeFail.listCollection, deleteBatch: writeFail.deleteBatch }), /write failed/);
  assert.equal(writeFail.batches.length, 1);
  const recreated = makeCloud({ failVerify: true });
  await assert.rejects(executeCloudRecordDeletion({ uid: 'owner', assertCurrent: () => {},
    listCollection: recreated.listCollection, deleteBatch: recreated.deleteBatch }), /records remain or were recreated/);
});

test('empty online account remains a valid complete deletion', async () => {
  const cloud = makeCloud({ count: 0 });
  assert.deepEqual(await executeCloudRecordDeletion({ uid: 'owner', assertCurrent: () => {},
    listCollection: cloud.listCollection, deleteBatch: cloud.deleteBatch }), { deleted: 0 });
  assert.equal(cloud.batches.length, 0);
});
