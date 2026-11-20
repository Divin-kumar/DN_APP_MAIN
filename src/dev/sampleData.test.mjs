import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuestTourDataset, GUEST_TOUR_VERSION, GUEST_TOUR_SCENARIO } from './sampleData.js';

test('versioned Guest demo showcases every current DN phase without rewriting personal data', () => {
  const demo = buildGuestTourDataset(new Date('2026-10-28T12:00:00Z'));
  assert.equal(demo.scenario, GUEST_TOUR_SCENARIO);
  assert.equal(demo.demoVersion, GUEST_TOUR_VERSION);
  assert.equal(demo.tasks.find((task) => task.repeat)?.repeat.frequency, 'weekly');
  assert.equal(demo.expensePlans[0]?.repeat.frequency, 'monthly');
  assert.ok(!demo.expenses.some((expense) => expense.name === demo.expensePlans[0].name));
  assert.equal(demo.events.length, 3);
  assert.deepEqual(demo.events.map((moment) => moment.type), ['Vacation', 'Diary', 'Project']);
  assert.deepEqual(demo.events.flatMap((moment) => moment.activities).length, 14);
  assert.deepEqual(new Set(demo.events.flatMap((m) => m.activities.map((a) => a.id))).size, 14);
  assert.ok(demo.events[1].activities.every((item) => item.date.slice(0, 7) === demo.events[1].date.slice(0, 7)));
  const statuses = demo.events[2].activities.map((activity) => activity.status);
  assert.ok(statuses.includes('in-progress') && statuses.includes('completed') && statuses.includes('cancelled'));
  assert.deepEqual(new Set([...demo.incomes, ...demo.expenses].map((item) => item.paymentMethod)), new Set(['Cash', 'Online']));
  assert.match(demo.incomes[0].notes, /pick a year when several years are available, then tap a month/);
  assert.ok(demo.expenses.every((item) => demo.events.some((moment) => moment.id === item.eventId
    && moment.activities.some((activity) => activity.id === item.activityId))));
  const journal = demo.events[0];
  assert.match(journal.notes, /We took the road into the hills before sunrise/);
  assert.ok(journal.notes.split(/\s+/).length <= 50);
  assert.doesNotMatch(journal.notes, /PDF Studio|More options|Data & Backup|Add entry/);
  assert.equal(journal.activities[0].entries.length, 1);
  assert.equal(journal.activities[0].entries[0].id, 'dn-tour-entry-j1-continued');
  assert.equal(demo.events[1].activities[0].entries.length, 2);
  assert.equal(demo.events[1].activities[0].entries[0].time, undefined);
  assert.equal(demo.events[2].activities[1].entries.length, 1);
  assert.ok(demo.events[2].notes.includes('Export CSV'));
  assert.ok(demo.events[2].notes.includes('v2.1.3'));


  assert.equal(demo.imagesReady, false);
  assert.ok(demo.events.every((event) => !event.attachments.length));
  assert.equal(buildGuestTourDataset(new Date('2026-10-28T12:00:00Z')).events[0].id, demo.events[0].id);
});

test('Guest tour version includes standalone Tasks that never become Activity rows', () => {
  const data = buildGuestTourDataset(new Date('2026-11-03T12:00:00Z'));
  assert.equal(data.tasks.length, 5);
  assert.ok(data.tasks.some(task => !task.dueDate && !task.dueTime));
  assert.ok(data.tasks.some(task => task.momentId && task.activityId));
  assert.ok(data.tasks.some(task => task.status === 'completed'));
  assert.equal(data.events.flatMap(event => event.activities).some(activity => data.tasks.some(task => task.id === activity.id)), false);
});
