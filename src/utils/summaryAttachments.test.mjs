import test from 'node:test';
import assert from 'node:assert/strict';
import { summaryAttachmentsFor } from './summaryAttachments.js';

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
});
test('Missing media arrays and missing linked activities do not break summaries', () => {
  assert.deepEqual(summaryAttachmentsFor({}), []);
  assert.deepEqual(summaryAttachmentsFor({ attachments: [{ id: 'legacy', activityId: 'no-parent' }] }).map((a) => a.id), ['legacy']);
});
