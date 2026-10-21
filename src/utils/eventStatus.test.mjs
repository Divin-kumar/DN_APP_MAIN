import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventStatus } from './eventStatus.js';

test('archive is independent of cancellation and activity completion', () => {
  const finished = { activities: [{ id: '1', completed: true }] };
  assert.equal(getEventStatus(finished), 'completed');
  assert.equal(getEventStatus({ ...finished, archived: true }), 'archived');
  assert.equal(getEventStatus({ ...finished, archived: false }), 'completed');
  assert.equal(getEventStatus({ archived: true, status: 'cancelled' }), 'archived');
  assert.equal(getEventStatus({ archived: false, status: 'cancelled' }), 'cancelled');
});
