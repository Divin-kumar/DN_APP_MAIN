import test from 'node:test';
import assert from 'node:assert/strict';

import { getEventStatus } from '../utils/eventStatus.js';

test('events with incomplete or no activities are in progress', () => {
  assert.equal(getEventStatus({ activities: [] }), 'in-progress');
  assert.equal(getEventStatus({ activities: [{ completed: true }, { completed: false }] }), 'in-progress');
});

test('events are completed when every linked activity is completed', () => {
  assert.equal(getEventStatus({ activities: [{ completed: true }, { completed: true }] }), 'completed');
});

test('manual cancellation takes precedence over activity status', () => {
  const event = {
    status: 'cancelled',
    activities: [{ id: 'activity-1', title: 'Plan', completed: false }],
    memories: [{ id: 'memory-1', title: 'Memory' }],
    attachments: [{ id: 'attachment-1', name: 'Photo' }],
  };

  assert.equal(getEventStatus(event), 'cancelled');
  assert.equal(event.activities[0].id, 'activity-1');
  assert.equal(event.memories[0].id, 'memory-1');
  assert.equal(event.attachments[0].id, 'attachment-1');
});