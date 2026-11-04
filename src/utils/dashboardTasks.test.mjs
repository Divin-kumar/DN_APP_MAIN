import test from 'node:test';
import assert from 'node:assert/strict';
import { selectUpcomingIndependentTasks, dashboardTaskDueLabel } from './dashboardTasks.js';

const task = (id, dueDate, status = 'in-progress', dueTime = '') =>
  ({ id, title: id, dueDate, dueTime, status });
test('upcoming Task projection includes overdue first and excludes completed/undated/too far', () => {
  const input = [
    task('due-later', '2026-11-18'), task('old', '2026-10-20'),
    task('completed', '2026-11-04', 'completed'),
    task('undated', ''), task('too-far', '2027-02-01'),
    task('today', '2026-11-03'), task('same-day-later', '2026-11-03', 'in-progress', '18:30'),
  ];
  assert.deepEqual(selectUpcomingIndependentTasks(input, new Date(2026, 10, 3, 12)).map(item => item.id),
    ['old', 'same-day-later', 'today', 'due-later']);
  assert.equal(input.length, 7);
});
test('30-day horizon and year rollover use local calendar dates', () => {
  assert.deepEqual(selectUpcomingIndependentTasks([
    task('in', '2027-01-30'), task('out', '2027-01-31'),
  ], new Date(2026, 11, 31, 12)).map(item => item.id), ['in']);
});

test('Dashboard due countdown uses calendar days and distinguishes overdue and today', () => {
  const today = new Date(2026, 10, 4, 22, 30);
  assert.equal(dashboardTaskDueLabel('2026-11-07', today), '3 days away');
  assert.equal(dashboardTaskDueLabel('2026-11-05', today), '1 day away');
  assert.equal(dashboardTaskDueLabel('2026-11-04', today), 'Due today');
  assert.equal(dashboardTaskDueLabel('2026-11-03', today), '1 day overdue');
  assert.equal(dashboardTaskDueLabel('2026-10-30', today), '5 days overdue');
});
