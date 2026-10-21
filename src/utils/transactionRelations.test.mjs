import test from 'node:test';
import assert from 'node:assert/strict';
import { isNestedOnlyAccountExpense, reconcileExpenseActivities } from './transactionRelations.js';

const events = [{
  id: 'e1', name: 'Career', activities: [
    { id: 'a1', title: 'Training', expenses: [{ id: 'x', amount: 200, eventId: 'e1', activityId: 'a1' }] },
    { id: 'a2', title: 'Travel', expenses: [] },
  ],
}];
const oldExpense = { id: 'x', transactionKind: 'expense', eventId: 'e1', activityId: 'a1', amount: 200 };
test('editing linked expense removes stale child and creates one current child', () => {
  const next = reconcileExpenseActivities(events, oldExpense, { ...oldExpense, activityId: 'a2', amount: 350 });
  assert.equal(next[0].activities[0].expenses.length, 0);
  assert.equal(next[0].activities[1].expenses.length, 1);
  assert.equal(next[0].activities[1].expenses[0].amount, 350);
  assert.equal(events[0].activities[0].expenses.length, 1);
});
test('unlink and delete remove stale child without mutating others', () => {
  const next = reconcileExpenseActivities(events, oldExpense, null);
  assert.deepEqual(next[0].activities[0].expenses, []);
  assert.equal(next[0].activities[1], events[0].activities[1]);
});
test('income records do not create expense mirrors', () => {
  const record = { id: 'i1', transactionKind: 'income', eventId: 'e1', activityId: 'a1', amount: 100 };
  assert.deepEqual(reconcileExpenseActivities(events, null, record), []);
});
test('only Firestore nested-only expense uses event-only update path', () => {
  assert.equal(isNestedOnlyAccountExpense(oldExpense, false), true);
  assert.equal(isNestedOnlyAccountExpense({ ...oldExpense, firestoreId: 'doc-x' }, false), false);
  assert.equal(isNestedOnlyAccountExpense(oldExpense, true), false);
});


test('linked transactions reject missing/unknown activity but allow unlinked transactions', async () => {
  const { requireLinkedActivity } = await import('./transactionRelations.js');
  const known = [{ id: 'e1', activities: [{ id: 'a1' }] }];
  assert.doesNotThrow(() => requireLinkedActivity(known, { eventId: null, activityId: null }));
  assert.doesNotThrow(() => requireLinkedActivity(known, { eventId: 'e1', activityId: 'a1' }));
  assert.throws(() => requireLinkedActivity(known, { eventId: 'e1', activityId: null }), /valid linked activity/);
  assert.throws(() => requireLinkedActivity(known, { eventId: 'e1', activityId: 'removed' }), /unavailable/);
  assert.throws(() => requireLinkedActivity([], { eventId: 'e1', activityId: 'a1' }), /unavailable/);
});


test('reversing a failed expense to income conversion restores the nested expense mirror', () => {
  const existing = {
    id: 'e1', name: 'Career',
    activities: [{ id: 'a1', expenses: [{ id: 'expense-old', amount: 500, date: '2026-10-02' }] }],
  };
  const original = { id: 'expense-old', transactionKind: 'expense', eventId: 'e1', activityId: 'a1', amount: 500, date: '2026-10-02' };
  const replacement = { id: 'income-new', transactionKind: 'income', eventId: 'e1', activityId: 'a1', amount: 500 };
  const removed = reconcileExpenseActivities([existing], original, replacement);
  assert.deepEqual(removed[0].activities[0].expenses, []);
  const restored = reconcileExpenseActivities(removed, replacement, original);
  assert.equal(restored[0].activities[0].expenses[0].id, original.id);
  assert.equal(restored[0].activities[0].expenses[0].amount, 500);
});
