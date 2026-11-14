import test from 'node:test';
import assert from 'node:assert/strict';
import { nextScheduledDate } from './repeatSchedule.js';
import { resolveRepeatingTask, advanceRepeatingTask, taskRepeatForDraft } from './independentTasks.js';
import { advanceExpensePlan, expensePlanFromDraft, plannedExpenseId } from './expensePlans.js';

const date = new Date('2026-11-14T09:00:00Z');
const monthly = { frequency: 'monthly', anchorDate: '2026-01-31' };
const task = {
  id: 'task', title: 'Read meters', status: 'in-progress', dueDate: '2026-01-31', dueTime: '',
  momentId: 'home', activityId: 'first-reading',
  repeat: { ...monthly, seriesId: 'meter' }, updatedAt: date.toISOString(),
};

test('repeat dates preserve their original weekday or calendar day across month and leap-year boundaries', () => {
  assert.equal(nextScheduledDate(monthly, '2026-01-31'), '2026-02-28');
  assert.equal(nextScheduledDate(monthly, '2026-02-28'), '2026-03-31');
  assert.equal(nextScheduledDate({ frequency: 'weekly', anchorDate: '2026-12-29' }, '2026-12-29'), '2027-01-05');
  const leap = { frequency: 'yearly', anchorDate: '2024-02-29' };
  assert.equal(nextScheduledDate(leap, '2024-02-29'), '2025-02-28');
  assert.equal(nextScheduledDate(leap, '2027-02-28'), '2028-02-29');
  assert.throws(() => nextScheduledDate(monthly, '2026-02-30'), /date is invalid/);
});

test('Done and Skip each resolve one Task occurrence and retain previous history', () => {
  const { current, next } = resolveRepeatingTask(task, 'complete', date);
  assert.equal(current.status, 'completed');
  assert.equal(current.repeat, undefined);
  assert.equal(current.activityId, 'first-reading');
  assert.equal(next.dueDate, '2026-02-28');
  assert.equal(next.dueTime, '');
  assert.equal(next.activityId, '');
  assert.equal(next.momentId, '');
  const skipped = resolveRepeatingTask(next, 'skip', date);
  assert.equal(skipped.current.status, 'cancelled');
  assert.equal(skipped.next.dueDate, '2026-03-31');
  assert.throws(() => advanceRepeatingTask([current, next], task.id, 'complete', task.updatedAt), /changed/);
  assert.throws(() => taskRepeatForDraft(null, 'weekly', '', () => 'series'), /first date/);
});

test('editing an expense template keeps the anchor and changing due date resets it', () => {
  const draft = { title: 'Water', amount: 150, category: 'Home', date: '2026-01-31', repeatFrequency: 'monthly' };
  const initial = expensePlanFromDraft(draft, null, date, 'water');
  const february = advanceExpensePlan(initial, date);
  const edit = expensePlanFromDraft({ ...draft, date: '2026-02-28', amount: 175 }, february, date, 'water');
  assert.equal(advanceExpensePlan(edit, date).dueDate, '2026-03-31');
  assert.equal(plannedExpenseId(edit), 'plan-payment-water-2026-02-28');
  assert.ok(edit.updatedAt > february.updatedAt);
  const rescheduled = expensePlanFromDraft({ ...draft, date: '2026-02-26' }, edit, date, 'water');
  assert.equal(advanceExpensePlan(rescheduled, date).dueDate, '2026-03-26');
  assert.equal(rescheduled.paymentMethod, null);
});
