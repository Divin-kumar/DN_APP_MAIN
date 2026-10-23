import test from 'node:test';
import assert from 'node:assert/strict';
import { getOnThisDayDashboardEvents, getUpcomingDashboardEvents } from './dashboardVisibility.js';

const today = new Date(2026, 9, 23, 12);

test('Moment memories show original dates in previous years, newest first and with dashboard visibility', () => {
  const records = [
    { id: 'older', date: '2020-10-23', type: 'Trip' },
    { id: 'recent', date: '2025-10-23', type: 'Trip', status: 'completed' },
    { id: 'this-year', date: '2026-10-23', type: 'Birthday' },
    { id: 'monthly', date: '2024-09-23', recurrence: 'monthly' },
    { id: 'wrong-day', date: '2025-10-22' },
    { id: 'archived', date: '2024-10-23', archived: true },
    { id: 'cancelled', date: '2024-10-23', status: 'cancelled' },
    { id: 'hidden', date: '2024-10-23', type: 'Hidden' },
    { id: 'invalid', date: 'not-a-date' },
  ];
  const types = [{ value: 'Hidden', label: 'Hidden', showInDashboardUpcoming: false }];
  assert.deepEqual(getOnThisDayDashboardEvents(records, today, types).map(({ id }) => id), ['recent', 'older']);
});

test('recurring birthday stays available today in Upcoming as well as historical memories', () => {
  const birthday = { id: 'birthday', date: '2000-10-23', type: 'Birthday', recurrence: 'yearly' };
  assert.deepEqual(getUpcomingDashboardEvents([birthday], today).map(({ id }) => id), ['birthday']);
  assert.deepEqual(getOnThisDayDashboardEvents([birthday], today).map(({ id }) => id), ['birthday']);
});
