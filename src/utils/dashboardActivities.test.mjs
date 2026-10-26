import test from 'node:test';
import assert from 'node:assert/strict';
import { getOnThisDayDashboardActivities, getUpcomingDashboardActivities } from './dashboardActivities.js';

const referenceDate = new Date(2026, 9, 23, 18);
const ids = (items) => items.map(({ activity }) => activity.id);

test('upcoming activities use their own dates and include today through day 30', () => {
  const event = { id: 'parent', name: 'An older moment', date: '2020-01-01', activities: [
    { id: 'yesterday', date: '2026-10-22' },
    { id: 'last', date: '2026-11-22' },
    { id: 'too-late', date: '2026-11-23' },
    { id: 'today', date: '2026-10-23' },
    { id: 'no-date' },
    { id: 'invalid-date', date: '2026-02-30' },
  ] };
  const result = getUpcomingDashboardActivities([event], referenceDate);
  assert.deepEqual(ids(result), ['today', 'last']);
  assert.equal(result[0].event, event);
  assert.equal(result[0].activity, event.activities[3]);
});

test('upcoming excludes completed/cancelled activities and hidden/archived/cancelled parents', () => {
  const activity = { id: 'visible', date: '2026-10-23' };
  const events = [
    { id: 'active', activities: [activity, { ...activity, id: 'done', completed: true }, { ...activity, id: 'status-done', status: 'completed' }, { ...activity, id: 'cancelled', cancelled: true }, { ...activity, id: 'status-cancelled', status: 'cancelled' }] },
    { id: 'archived', archived: true, activities: [activity] },
    { id: 'cancelled', status: 'cancelled', activities: [activity] },
    { id: 'hidden', type: 'Private', activities: [activity] },
    { id: 'other-hidden', type: 'Other', customType: 'Private', activities: [activity] },
  ];
  const types = [{ value: 'Private', showActivitiesOnDashboard: false }];
  assert.deepEqual(ids(getUpcomingDashboardActivities(events, referenceDate, types)), ['visible']);
});

test('Activity date views use only the Activity type flag and default legacy types to visible', () => {
  const events = ['Moment hidden', 'Activities hidden', 'Legacy'].map((type) => ({ type, activities: [
    { id: `${type}-upcoming`, date: '2026-10-23' }, { id: `${type}-history`, date: '2025-10-23' },
  ] }));
  const types = [{ value: 'Moment hidden', showInDashboardUpcoming: false, showActivitiesOnDashboard: true },
    { value: 'Activities hidden', showInDashboardUpcoming: true, showActivitiesOnDashboard: false },
    { value: 'Legacy', showInDashboardUpcoming: false }];
  assert.deepEqual(ids(getUpcomingDashboardActivities(events, referenceDate, types)), ['Moment hidden-upcoming', 'Legacy-upcoming']);
  assert.deepEqual(ids(getOnThisDayDashboardActivities(events, referenceDate, types)), ['Moment hidden-history', 'Legacy-history']);
});

test('On This Day shows actual dates from past years newest first, including completed activities', () => {
  const events = [{ recurrence: 'yearly', activities: [
    { id: 'older', date: '2023-10-23' },
    { id: 'recent', date: '2025-10-23', completed: true },
    { id: 'today', date: '2026-10-23' },
    { id: 'future', date: '2027-10-23' },
    { id: 'different-day', date: '2025-10-22' },
    { id: 'cancelled', date: '2025-10-23', cancelled: true },
  ] }];
  assert.deepEqual(ids(getOnThisDayDashboardActivities(events, referenceDate)), ['recent', 'older']);
});

test('date handling accepts legacy timestamps without projecting recurrence or mutating records', () => {
  const timestamp = { seconds: new Date(2026, 9, 23, 23, 59).getTime() / 1000 };
  const events = [{ id: 'parent', recurrence: 'monthly', activities: [
    { id: 'timestamp', date: timestamp },
    { id: 'old', date: '2025-09-23' },
  ] }];
  const original = JSON.stringify(events);
  assert.deepEqual(ids(getUpcomingDashboardActivities(events, referenceDate)), ['timestamp']);
  assert.deepEqual(getOnThisDayDashboardActivities(events, referenceDate), []);
  assert.equal(JSON.stringify(events), original);
});

test('empty and malformed activity arrays safely produce no dashboard rows', () => {
  assert.deepEqual(getUpcomingDashboardActivities([{ activities: null }, { activities: [null, {}] }], referenceDate), []);
  assert.deepEqual(getOnThisDayDashboardActivities([], referenceDate), []);
});
