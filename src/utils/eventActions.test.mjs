import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateEventData, eventShareDetails } from './eventActions.js';

test('duplicating an event clones activities but not finance, memories or attachments', () => {
  let i = 0;
  const source = {
    id: 'original', name: 'Trip', type: 'Travel', date: '2026-10-21',
    archived: true, firestoreId: 'remote',
    activities: [{ id: 'a1', title: 'Booking', amount: 0, completed: true, expenses: [{ id: 'x', amount: 200 }] }],
    memories: [{ id: 'm' }], attachments: [{ id: 'file' }],
  };
  const copy = duplicateEventData(source, () => 'new-' + (++i));
  assert.equal(copy.name, 'Trip (copy)');
  assert.equal(copy.archived, false);
  assert.equal(copy.activities[0].id, 'new-1');
  assert.deepEqual(copy.activities[0].expenses, []);
  assert.equal(copy.activities[0].completed, false);
  assert.deepEqual(copy.memories, []);
  assert.deepEqual(copy.attachments, []);
  assert.equal('id' in copy, false);
  assert.equal('firestoreId' in copy, false);
});
test('sharing guest events never exports an inaccessible account URL', () => {
  const event = { id: 'e1', name: 'Career', date: '2026-10-21' };
  assert.equal(eventShareDetails(event, true, 'https://dn-10.web.app').url, undefined);
  assert.equal(eventShareDetails(event, false, 'https://dn-10.web.app').url, 'https://dn-10.web.app/events/e1');
});
