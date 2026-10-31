import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveQuickCreateMoment, quickActivityEntryKind } from './quickActivityContext.js';

const moments = [
  { id: 'trip', type: 'Journal', activities: [{ id: 'same' }, { id: 'scene' }] },
  { id: 'month', type: 'Diary', activities: [{ id: 'day' }] },
  { id: 'tasks', type: 'Project', activities: [{ id: 'same' }] },
  { firestoreId: 'custom/one', type: 'Other', customType: 'Planning', activities: [{ id: 'draft' }] },
];

test('Detail context selects its actual parent, even with duplicate Activity IDs', () => {
  assert.equal(resolveQuickCreateMoment(moments, { eventId: 'tasks', activityId: 'same' }), moments[2]);
  assert.equal(resolveQuickCreateMoment(moments, { eventId: 'trip', activityId: 'same' }), moments[0]);
  assert.equal(resolveQuickCreateMoment(moments, { eventId: 'custom/one', activityId: 'draft' }), moments[3]);
  assert.equal(resolveQuickCreateMoment(moments, null, moments[1]), moments[1]);
  assert.equal(resolveQuickCreateMoment(moments, null), null);
});

test('Stale, foreign or unmatched Detail IDs never silently choose another Moment', () => {
  assert.equal(resolveQuickCreateMoment(moments, { eventId: 'trip', activityId: 'day' }, moments[1]), null);
  assert.equal(resolveQuickCreateMoment(moments, { eventId: 'missing', activityId: 'same' }), null);
  assert.equal(resolveQuickCreateMoment(moments, { eventId: 'trip', activityId: '' }), null);
  assert.equal(resolveQuickCreateMoment([], { eventId: 'trip', activityId: 'same' }), null);
  assert.equal(moments[0].activities.length, 2);
});

test('Diary and Journal create chapters; task-style Moments create Activities', () => {
  assert.equal(quickActivityEntryKind(moments[1]), 'diary entry');
  assert.equal(quickActivityEntryKind(moments[0]), 'journal entry');
  assert.equal(quickActivityEntryKind({ type: 'Vacation' }), 'journal entry');
  assert.equal(quickActivityEntryKind(moments[2]), 'activity');
  assert.equal(quickActivityEntryKind(null), 'activity');
});

test('Custom Moment Type presentation metadata controls entry labeling', () => {
  const customTypes = [
    { value: 'Planning', label: 'Planning', storyPresentation: 'diary' },
    { value: 'Project', label: 'Project', storyPresentation: 'journey' },
  ];
  assert.equal(quickActivityEntryKind(moments[3], customTypes), 'diary entry');
  assert.equal(quickActivityEntryKind(moments[2], customTypes), 'journal entry');
  assert.equal(quickActivityEntryKind(moments[2], [{ value: 'Project', storyPresentation: 'chronicle' }]), 'activity');
});
