import test from 'node:test';
import assert from 'node:assert/strict';
import { activityCancellationPatch, activityCompletionPatch, activityCoverRatio, activityDateLabel, activityDetailPath, activityStatusLabel, resolveActivityDetail, selectActivityCover } from './activityDetail.js';
import { isActivityEditable } from './scopedRecordActions.js';

test('detail resolution requires both parent and child IDs, preserving encoded application identity', () => {
  const moments = [{ id: 'trip/one', activities: [{ id: 'same', title: 'First' }] }, { id: 'two', activities: [{ id: 'same', title: 'Second' }] }];
  assert.equal(resolveActivityDetail(moments, 'two', 'same').activity.title, 'Second');
  assert.equal(resolveActivityDetail(moments, 'missing', 'same'), null);
  assert.equal(resolveActivityDetail(moments, 'two', 'other'), null);
  assert.equal(activityDetailPath('trip/one', 'A #2'), '/events/trip%2Fone/activities/A%20%232');
  assert.equal(resolveActivityDetail([{ id: 42, activities: [{ id: 7 }] }], '42', '7').activity.id, 7);
});

test('cover selection keeps order, excludes Moment-only/non-images/metadata-only records, and never adds fields', () => {
  const image = (id, extra = {}) => ({ id, activityId: 'activity', type: 'image/png', assetId: id.repeat(64), ...extra });
  const moment = { attachments: [image('a', { activityId: '' }), { id: 'pdf', activityId: 'activity', type: 'application/pdf' },
    { id: 'old', activityId: 'activity', type: 'image/png' }, image('b'), image('c')] };
  const before = structuredClone(moment);
  assert.equal(selectActivityCover(moment, 'activity'), moment.attachments[3]);
  assert.deepEqual(moment, before);
  assert.equal(selectActivityCover(moment, 'other'), null);
  assert.equal(selectActivityCover({ attachments: [image('b', { assetId: '', url: 'https://example.test/photo.png' })] }, 'activity').id, 'b');
  assert.equal(selectActivityCover({ attachments: [image('b', { assetId: '', url: 'javascript:alert(1)' })] }, 'activity'), null);
});

test('portrait/square/panoramic/tiny covers reserve a bounded landscape frame without cropping a stored asset', () => {
  for (const [width, height] of [[600, 1000], [800, 800], [9000, 500], [1, 1], [0, 0], [Infinity, 20]]) {
    const ratio = activityCoverRatio(width, height);
    assert.ok(ratio >= 16 / 9 && ratio <= 2.4);
  }
});

test('dates accept legacy strings and Firestore timestamps; missing and invalid dates remain undecided', () => {
  for (const value of ['', null, 'bad date', '2026-02-30', { toDate() { throw new Error('bad'); } }]) {
    assert.equal(activityDateLabel(value), 'Date to be decided');
    assert.equal(activityDateLabel(value, ''), ''); // Missing secondary dates never invent a recorded date.
  }
  assert.match(activityDateLabel({ seconds: Date.UTC(2026, 9, 25, 12) / 1000 }), /25 Oct 2026/);
  assert.equal(activityStatusLabel({ completed: true }), 'Completed');
  assert.equal(activityStatusLabel({ cancelled: true, completed: true }), 'Cancelled');
  assert.equal(activityStatusLabel({}), 'In progress');
});

test('state patches are idempotent, forbid cancelled swipe restoration and preserve archive restrictions', () => {
  assert.equal(activityCompletionPatch({ completed: true }, {}, true), undefined);
  assert.deepEqual(activityCompletionPatch({ completed: true }, {}, false), { completed: false, completedAt: null, status: 'in-progress' });
  assert.throws(() => activityCompletionPatch({ cancelled: true }, {}, true), /Restore this activity explicitly/);
  assert.throws(() => activityCompletionPatch({}, { archived: true }, true), /Restore this Moment/);
});

test('cancelling/restoring legacy completed work never silently reopens it or bypasses the edit restriction', () => {
  const legacy = { title: 'Keep title', status: 'completed', description: 'Keep text' };
  const cancelled = { ...legacy, ...activityCancellationPatch(legacy, true) };
  const restored = { ...cancelled, ...activityCancellationPatch(cancelled, false) };
  assert.equal(isActivityEditable(cancelled), false); assert.equal(isActivityEditable(restored), false);
  assert.equal(restored.status, 'completed'); assert.equal(restored.description, legacy.description);
  assert.equal(restored.completedAt, undefined);
  assert.equal(isActivityEditable({ ...restored, ...activityCompletionPatch(restored, {}, false) }), true);
});
