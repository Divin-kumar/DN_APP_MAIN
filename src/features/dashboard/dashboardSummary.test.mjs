import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardEncouragement, dashboardGreeting, dashboardMonthKey, dashboardProfileName,
  summarizeDashboard, summarizeDashboardMonth } from './dashboardSummary.js';

test('greeting follows local morning, afternoon and evening boundaries and trims the profile name', () => {
  for (const [hour, expected] of [[0, 'Good morning'], [11, 'Good morning'], [12, 'Good afternoon'], [17, 'Good afternoon'], [18, 'Good evening'], [23, 'Good evening']]) {
    assert.equal(dashboardGreeting(new Date(2026, 9, 26, hour)), expected);
  }
  assert.equal(dashboardProfileName({ displayName: '  Kumar   Divin ' }), 'Kumar');
  assert.equal(dashboardProfileName({ displayName: ' ', email: 'kumar@example.com' }), 'kumar');
  assert.equal(dashboardProfileName(null, true), 'Guest');
});

test('daily summary uses visible scopes, actual calendar dates and both completed representations', () => {
  const activities = [
    { date: '2026-10-26', title: 'Today' },
    { date: '2026-10-26', status: 'completed' },
    { date: '2026-10-26', completed: true },
    { date: '2026-10-20', title: 'Overdue' },
    { date: '2026-10-19', title: 'Older overdue' },
    { date: '2026-11-01', title: 'Future' },
    { date: '2026-10-26', cancelled: true },
    { date: '2026-10-26', status: 'CANCELED' },
    { date: 'invalid', title: 'Undated pending' },
    null,
  ];
  const moment = { type: 'Personal', date: '2026-10-20', activities };
  const result = summarizeDashboard([moment,
    { ...moment, date: '2026-10-26', archived: true },
    { ...moment, date: '2026-10-26', status: 'cancelled' },
    { ...moment, type: 'Hidden' },
    { date: '2026-10-27', activities: [] },
    { createdAt: '2026-10-26', activities: [] },
  ], new Date(2026, 9, 26, 23, 59), [{ value: 'Hidden', showInDashboardUpcoming: false, showActivitiesOnDashboard: false }]);
  assert.deepEqual(result, { todayActivities: 3, todayCompleted: 2, recentMoments: 1, pending: 5,
    overdue: 2, recentActivities: 4, recentCompleted: 2, totalActivities: 7 });
  assert.equal(activities.length, 10, 'projection must not mutate stored records');
});

test('daily summary applies the separate type flags to Moment and Activity counts', () => {
  const moment = (type) => ({ type, date: '2026-10-26', activities: [{ date: '2026-10-26' }, { date: '2026-10-25', completed: true }] });
  const result = summarizeDashboard([moment('Moments only'), moment('Activities only'), moment('Legacy hidden moment')], new Date(2026, 9, 26), [
    { value: 'Moments only', showInDashboardUpcoming: true, showActivitiesOnDashboard: false },
    { value: 'Activities only', showInDashboardUpcoming: false, showActivitiesOnDashboard: true },
    { value: 'Legacy hidden moment', showInDashboard: false },
  ]);
  assert.deepEqual(result, { todayActivities: 2, todayCompleted: 0, recentMoments: 1, pending: 2,
    overdue: 0, recentActivities: 4, recentCompleted: 2, totalActivities: 4 });
});

test('seven-day range crosses calendar years and accepts legacy timestamps without counting invalid dates', () => {
  const result = summarizeDashboard([
    { date: '2025-12-28', activities: [{ date: { seconds: new Date(2025, 11, 31, 12).getTime() / 1000 }, completed: true }] },
    { startDate: '2026-01-03', activities: [{ date: '2026-01-03' }] },
    { date: '2025-12-27', activities: [] },
    { date: '2026-02-30', activities: [{ date: { toDate() { throw new Error('bad legacy date'); } } }] },
  ], new Date(2026, 0, 3, 1));
  assert.equal(result.recentMoments, 2);
  assert.equal(result.recentActivities, 2);
  assert.equal(result.todayActivities, 1);
  assert.equal(result.pending, 2);
  assert.equal(result.overdue, 0);
});

test('monthly snapshot is independent of locale formatting, ignores nonfinite amounts and uses current month only', () => {
  const now = new Date(2026, 9, 26, 0, 1);
  assert.equal(dashboardMonthKey(now), '2026-10');
  assert.deepEqual(summarizeDashboardMonth([
    { id: 'i', amount: 1000, date: '2026-10-01' },
    { id: 'old', amount: 9999, date: '2026-09-01' },
  ], [
    { id: 'e', amount: '450', date: '2026-10-26' },
    { id: 'invalid', amount: Infinity, date: '2026-10-26' },
    { id: 'future', amount: 900, date: '2026-11-01' },
  ], now), { income: 1000, expense: 450, balance: 550 });
});

test('encouragement reflects overdue, remaining today and completed work without claiming undated work is finished', () => {
  assert.match(dashboardEncouragement({ overdue: 2 }, 'Kumar'), /2 pending activities.*Kumar/);
  assert.match(dashboardEncouragement({ overdue: 0, todayActivities: 4, todayCompleted: 3 }, 'Kumar'), /1 activity to finish today/);
  assert.match(dashboardEncouragement({ overdue: 0, totalActivities: 2, pending: 0 }, 'Kumar'), /up to date/);
  assert.doesNotMatch(dashboardEncouragement({ overdue: 0, totalActivities: 2, pending: 2 }, 'Kumar'), /up to date/);
});
