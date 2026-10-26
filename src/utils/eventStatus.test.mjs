import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventStatus, getStoredEventStatus } from './eventStatus.js';

test('archive is independent of cancellation and activity completion', () => {
  const finished = { activities: [{ id: '1', completed: true }] };
  assert.equal(getEventStatus(finished), 'completed');
  assert.equal(getEventStatus({ ...finished, archived: true }), 'archived');
  assert.equal(getEventStatus({ ...finished, archived: false }), 'completed');
  assert.equal(getEventStatus({ archived: true, status: 'cancelled' }), 'archived');
  assert.equal(getEventStatus({ archived: false, status: 'cancelled' }), 'cancelled');
});

test('persisted cancellation survives archive and restore while the UI displays archive first', () => {
  const event = { id: 'stable', status: 'cancelled', archived: false, activities: [] };
  const archived = { ...event, archived: true, status: getStoredEventStatus({ ...event, archived: true }) };
  assert.equal(archived.status, 'cancelled');
  assert.equal(getEventStatus(archived), 'archived');
  assert.equal(getStoredEventStatus({ ...archived, archived: false }), 'cancelled');
  assert.equal(getStoredEventStatus({ activities: [{ completed: true }] }), 'completed');
});
