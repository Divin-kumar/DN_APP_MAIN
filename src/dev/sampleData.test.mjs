import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuestTourDataset, GUEST_TOUR_VERSION, GUEST_TOUR_SCENARIO } from './sampleData.js';

test('versioned Guest demo showcases every current DN phase without rewriting personal data', () => {
  const demo = buildGuestTourDataset(new Date('2026-10-28T12:00:00Z'));
  assert.equal(demo.scenario, GUEST_TOUR_SCENARIO);
  assert.equal(demo.demoVersion, GUEST_TOUR_VERSION);
  assert.equal(demo.events.length, 3);
  assert.deepEqual(demo.events.map((moment) => moment.type), ['Vacation', 'Diary', 'Project']);
  assert.deepEqual(demo.events.flatMap((moment) => moment.activities).length, 14);
  assert.deepEqual(new Set(demo.events.flatMap((m) => m.activities.map((a) => a.id))).size, 14);
  assert.ok(demo.events[1].activities.every((item) => item.date.slice(0, 7) === demo.events[1].date.slice(0, 7)));
  const statuses = demo.events[2].activities.map((activity) => activity.status);
  assert.ok(statuses.includes('in-progress') && statuses.includes('completed') && statuses.includes('cancelled'));
  assert.deepEqual(new Set([...demo.incomes, ...demo.expenses].map((item) => item.paymentMethod)), new Set(['Cash', 'Online']));
  assert.ok(demo.expenses.every((item) => demo.events.some((moment) => moment.id === item.eventId
    && moment.activities.some((activity) => activity.id === item.activityId))));
  assert.ok(demo.events[0].notes.includes('Customize PDF'));
  assert.equal(demo.imagesReady, false);
  assert.ok(demo.events.every((event) => !event.attachments.length));
  assert.equal(buildGuestTourDataset(new Date('2026-10-28T12:00:00Z')).events[0].id, demo.events[0].id);
});
