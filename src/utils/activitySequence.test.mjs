import test from 'node:test';
import assert from 'node:assert/strict';
import { projectActivities, selectActivityEntries } from './activityRecords.js';
import { resolveActivitySequence } from './activitySequence.js';

const moments = [{ id: 'one', activities: [{ id: 'same', title: 'Bravo', date: '2026-10-24' }] },
  { id: 'two', activities: [{ id: 'same', title: 'Alpha', date: '2026-10-25' }, { id: 'last', title: 'Charlie', date: '2026-10-26' }] }];
test('direct detail uses the shared filtered/sorted list and resolves reused IDs with their parent', () => {
  const entries = projectActivities(moments), selected = selectActivityEntries(entries, { field: 'title' });
  const sequence = resolveActivitySequence(entries, selected, null, 'guest', 'two', 'same');
  assert.equal(sequence.previous, null); assert.deepEqual(sequence.next, ['one', 'same']);
  assert.equal(resolveActivitySequence(entries, selected, null, 'guest', 'missing', 'same').index, -1);
});
test('history snapshots retain opening order, drop missing/duplicate entries and reject another scope', () => {
  const entries = projectActivities(moments), selected = selectActivityEntries(entries, { field: 'title' });
  const snapshot = { scope: 'A', ids: [['two', 'last'], ['one', 'same'], ['missing', 'same'], ['one', 'same']] };
  const saved = resolveActivitySequence(entries, selected, snapshot, 'A', 'one', 'same');
  assert.deepEqual(saved.ids, [['two', 'last'], ['one', 'same']]); assert.deepEqual(saved.previous, ['two', 'last']);
  assert.deepEqual(resolveActivitySequence(entries, selected, snapshot, 'B', 'one', 'same').previous, ['two', 'same']);
  assert.deepEqual(moments[0].activities[0], { id: 'same', title: 'Bravo', date: '2026-10-24' });
});

test('Moment-origin paging uses only that Moment, preserving its filter order and protecting reused IDs', () => {
  const entries = projectActivities(moments);
  const selected = selectActivityEntries(entries, { field: 'title' });
  const snapshot = { scope: 'A', momentId: 'two', ids: [['two', 'last'], ['one', 'same'], ['two', 'same']] };
  const sequence = resolveActivitySequence(entries, selected, snapshot, 'A', 'two', 'last');
  assert.deepEqual(sequence.ids, [['two', 'last'], ['two', 'same']]);
  assert.equal(sequence.previous, null);
  assert.deepEqual(sequence.next, ['two', 'same']);
  const wrongScope = resolveActivitySequence(entries, selected, snapshot, 'B', 'two', 'same');
  assert.deepEqual(wrongScope.ids, [['two', 'same'], ['two', 'last']]);
  assert.equal(wrongScope.previous, null);
  assert.deepEqual(moments[0].activities[0], { id:'same', title:'Bravo', date:'2026-10-24' });
});
