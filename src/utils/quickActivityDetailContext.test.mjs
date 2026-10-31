import test from 'node:test';
import assert from 'node:assert/strict';
import { detailQuickActivityContext } from './quickActivityDetailContext.js';

const moments = [
  { id: 'journal', type: 'Journal', activities: [{ id: 'shared', title: 'First memory', date: '2026-10-30' }] },
  { id: 'daily', type: 'Diary', activities: [{ id: 'day', title: 'Diary · 30 October 2026', date: '2026-10-30', entryMode: 'diary', entries: [] }] },
  { id: 'tasks', type: 'Project', activities: [{ id: 'shared', title: 'Plan', date: '2026-10-30' }] },
  { id: 'cancelled', type: 'Journal', activities: [{ id: 'gone', status: 'cancelled', date: '2026-10-30' }] },
  { firestoreId: 'custom/path', type: 'Other', customType: 'Notes', activities: [{ id: 'x', date: '2026-10-30' }] },
];
test('Journal Detail automatically selects the opened Activity as append target', () => {
  const ctx = detailQuickActivityContext(moments, { eventId: 'journal', activityId: 'shared' });
  assert.equal(ctx.moment, moments[0]);
  assert.equal(ctx.activity, moments[0].activities[0]);
  assert.equal(ctx.choice, 'append');
  assert.equal(ctx.targetId, 'shared');
  assert.equal(ctx.date, '');
});
test('Diary Detail inherits the same daily container date', () => {
  const ctx = detailQuickActivityContext(moments, { eventId: 'daily', activityId: 'day' });
  assert.equal(ctx.mode, 'diary');
  assert.equal(ctx.date, '2026-10-30');
  assert.equal(ctx.targetId, '');
});
test('Tasks remain independent even with duplicate Activity IDs', () => {
  const ctx = detailQuickActivityContext(moments, { eventId: 'tasks', activityId: 'shared' });
  assert.equal(ctx.moment, moments[2]);
  assert.equal(ctx.choice, 'new');
  assert.equal(ctx.targetId, '');
});
test('Unmatched or stale Detail does not silently select another Moment', () => {
  assert.equal(detailQuickActivityContext(moments, { eventId: 'daily', activityId: 'shared' }), null);
  assert.equal(detailQuickActivityContext(moments, { eventId: 'missing', activityId: 'shared' }), null);
  assert.equal(detailQuickActivityContext(moments, null), null);
});
test('Cancelled Journal target is not silently appended to', () => {
  const ctx = detailQuickActivityContext(moments, { eventId: 'cancelled', activityId: 'gone' });
  assert.equal(ctx.choice, 'new');
  assert.equal(ctx.targetId, '');
});
test('Custom presentation metadata controls the inherited mode', () => {
  const ctx = detailQuickActivityContext(moments, { eventId: 'custom/path', activityId: 'x' },
    [{ value: 'Notes', storyPresentation: 'chronicle' }]);
  assert.equal(ctx.mode, 'chronicle');
  assert.equal(ctx.choice, 'new');
});
