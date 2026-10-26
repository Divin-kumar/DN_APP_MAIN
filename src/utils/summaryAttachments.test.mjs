import test from 'node:test';
import assert from 'node:assert/strict';
import { sortedSummaryActivities, summaryAttachmentsFor } from './summaryAttachments.js';

test('Moment and Activity photos render next to their own story only', () => {
  const moment = { activities: [{ id: 'a' }, { id: 'b' }],
    attachments: [
      { id: 'event-photo' }, { id: 'first-photo', activityId: 'a' },
      { id: 'second-photo', activityId: 'b' }, { id: 'more-first', activityId: 'a' },
      { id: 'orphan', activityId: 'deleted-activity' },
    ] };
  assert.deepEqual(summaryAttachmentsFor(moment).map((a) => a.id), ['event-photo', 'orphan']);
  assert.deepEqual(summaryAttachmentsFor(moment, 'a').map((a) => a.id), ['first-photo', 'more-first']);
  assert.deepEqual(summaryAttachmentsFor(moment, 'b').map((a) => a.id), ['second-photo']);
  assert.deepEqual(summaryAttachmentsFor(moment, 'deleted-activity'), []);
});
test('Missing media arrays and missing linked activities do not break summaries', () => {
  assert.deepEqual(summaryAttachmentsFor({}), []);
  assert.deepEqual(summaryAttachmentsFor({ attachments: [{ id: 'legacy', activityId: 'no-parent' }] }).map((a) => a.id), ['legacy']);
});

test('Numeric legacy Activity IDs preserve photo ownership, including zero', () => {
  const moment = { activities: [{ id: 0 }, { id: 7 }], attachments: [
    { id: 'zero', activityId: 0 }, { id: 'seven', activityId: '7' }, { id: 'moment', activityId: '' },
  ] };
  assert.deepEqual(summaryAttachmentsFor(moment).map((item) => item.id), ['moment']);
  assert.deepEqual(summaryAttachmentsFor(moment, '0').map((item) => item.id), ['zero']);
  assert.deepEqual(summaryAttachmentsFor(moment, 7).map((item) => item.id), ['seven']);
  assert.deepEqual(summaryAttachmentsFor(moment, '').map((item) => item.id), []);
});

test('Summary chronology uses only recorded dates, handles legacy timestamps and does not mutate stored order', () => {
  const activities = [
    { id: 'future', date: '2030-10-20', createdAt: '2000-01-01' },
    { id: 'first-tie', date: '2026-10-26' },
    { id: 'missing', createdAt: '1900-01-01' },
    { id: 'second-tie', date: '2026-10-26' },
    { id: 'legacy', date: { seconds: new Date(2024, 0, 1).getTime() / 1000 } },
    { id: 'invalid', date: '2026-02-30' },
  ];
  const before = JSON.stringify(activities);
  assert.deepEqual(sortedSummaryActivities(activities).map((item) => item.id), ['legacy', 'first-tie', 'second-tie', 'future', 'missing', 'invalid']);
  assert.equal(JSON.stringify(activities), before);
  assert.deepEqual(sortedSummaryActivities(), []);
  assert.deepEqual(sortedSummaryActivities(null), []);
  assert.deepEqual(sortedSummaryActivities({}), []);
  assert.deepEqual(sortedSummaryActivities([null, undefined, 'invalid', [], { id:'valid' }]), [{ id:'valid' }]);
  assert.deepEqual(summaryAttachmentsFor({ activities:{}, attachments:{ length:2 } }), []);
});
