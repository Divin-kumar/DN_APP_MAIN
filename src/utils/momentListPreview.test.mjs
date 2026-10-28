import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMomentListPreview } from './momentListPreview.js';

const options = { now: '2026-10-28' };
test('uses recorded Story order and keeps future open work separate', () => {
  const moment = { id: 'm', activities: [
    { id: 'later', date: '2026-10-20', title: 'Later done', completed: true },
    { id: 'future', date: '2026-11-03', title: 'Upcoming' },
    { id: 'earlier', date: '2026-10-01', title: 'Earlier' },
  ] };
  const before = JSON.stringify(moment);
  const result = selectMomentListPreview(moment, options);
  assert.equal(result.latest.id, 'later');
  assert.equal(result.upcoming.id, 'future');
  assert.equal(JSON.stringify(moment), before);
});
test('falls back to upcoming, then undated without invented dates', () => {
  assert.equal(selectMomentListPreview({ activities: [{ id: 'future', date: '2026-11-02' }] }, options).latest.id, 'future');
  const undated = selectMomentListPreview({ activities: [{ id: 'undated', createdAt: '2020-01-01' }] }, options);
  assert.equal(undated.latest.id, 'undated');
  assert.equal(undated.latest.date, null);
  assert.equal(selectMomentListPreview({}, options).latest, null);
});
test('cover preserves Moment-level and child-photo ownership, no original availability claims', () => {
  const moment = {
    activities: [{ id: 'a', date: '2026-10-22' }],
    attachments: [
      { id: 'child', activityId: 'a', type: 'image/jpeg', assetId: 'a'.repeat(64) },
      { id: 'unrelated', type: 'application/pdf' },
    ],
  };
  assert.equal(selectMomentListPreview(moment, options).cover.id, 'child');
  moment.attachments.push({ id: 'parent', type: 'image/png' });
  const result = selectMomentListPreview(moment, options);
  assert.equal(result.cover.id, 'parent');
  assert.equal(Object.hasOwn(result.cover, 'originalAvailable'), false);
  assert.equal(result.cover, moment.attachments[2]);
});
test('status is derived, not from dates or list sorting', () => {
  assert.equal(selectMomentListPreview({ archived: true }, options).status, 'archived');
  assert.equal(selectMomentListPreview({ activities: [{ id: 'x', completed: true }] }, options).status, 'completed');
  assert.equal(selectMomentListPreview({ activities: [{ id: 'x', completed: false }] }, options).status, 'in-progress');
});
