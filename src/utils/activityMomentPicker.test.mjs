import test from 'node:test';
import assert from 'node:assert/strict';
import { activityMomentTypes, filterActivityMoments } from './activityMomentPicker.js';

test('activity picker keeps existing and archived Moments available, including disabled historical types', () => {
  const events = [
    { id: 'birthday', type: 'Birthday' },
    { id: 'old', type: 'Legacy', archived: true },
    { id: 'birthday2', type: 'Birthday' },
  ];
  const types = activityMomentTypes(events, [{ value: 'Legacy', label: 'Historic type', active: false }]);
  assert.deepEqual(types.map((type) => type.label), ['Birthday', 'Historic type']);
  assert.deepEqual(filterActivityMoments(events).map((event) => event.id), ['birthday', 'old', 'birthday2']);
  assert.deepEqual(filterActivityMoments(events, 'type:Legacy').map((event) => event.id), ['old']);
});

test('custom Other types narrow Moments without colliding with named types or changing source records', () => {
  const events = [
    { id: 'custom', type: 'Other', customType: ' Family ' },
    { id: 'named', type: 'Family' },
    { id: 'personal' },
    { id: 'other', type: 'Other' },
  ];
  assert.equal(activityMomentTypes(events).length, 4);
  assert.deepEqual(filterActivityMoments(events, 'custom:Family').map((event) => event.id), ['custom']);
  assert.deepEqual(filterActivityMoments(events, 'type:Family').map((event) => event.id), ['named']);
  assert.deepEqual(filterActivityMoments(events, 'type:Personal').map((event) => event.id), ['personal']);
  assert.deepEqual(filterActivityMoments(events, 'deleted-type'), []);
  assert.equal(events[0].customType, ' Family ');
});
