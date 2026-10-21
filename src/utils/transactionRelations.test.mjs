import test from 'node:test';
import assert from 'node:assert/strict';
import { isNestedOnlyAccountExpense, reconcileExpenseActivities, requireLinkedActivity } from './transactionRelations.js';

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
  assert.doesNotThrow(() => requireLinkedActivity(known, { eventId: 'e1', activityId: null }));
  assert.throws(() => requireLinkedActivity(known, { eventId: 'e1', activityId: 'removed' }), /unavailable/);
  assert.throws(() => requireLinkedActivity([], { eventId: 'e1', activityId: 'a1' }), /moment is unavailable/);
  assert.throws(() => requireLinkedActivity(known, { eventId: null, activityId: 'a1' }), /Choose a moment/);
  assert.throws(() => requireLinkedActivity(known, { eventId: 'e1', activityId: 'not-in-this-moment' }), /chosen moment/);
  assert.throws(() => requireLinkedActivity(known, { eventId: 'removed', activityId: null }), /moment is unavailable/);
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


test('financial matches require real IDs and upserts do not clobber unrelated rows', async () => {
  const { sameRecord, upsertRecord } = await import('./transactionRelations.js');
  assert.equal(sameRecord({ id: 'a' }, { id: 'b' }), false);
  assert.equal(sameRecord({ id: 'a' }, { id: 'a' }), true);
  assert.equal(sameRecord({ firestoreId: undefined }, { firestoreId: undefined }), false);
  assert.equal(sameRecord({ id: 'a', firestoreId: undefined }, { id: 'b', firestoreId: undefined }), false);
  assert.equal(sameRecord({ firestoreId: 'doc' }, { firestoreId: 'doc' }), true);
  const original = [{ id: 'a', amount: 1 }, { id: 'b', amount: 2 }];
  const inserted = upsertRecord(original, { id: 'c', amount: 3 });
  const updated = upsertRecord(inserted, { id: 'b', amount: 99 });
  assert.deepEqual(updated.map((item) => [item.id,item.amount]), [['a',1],['b',99],['c',3]]);
  assert.deepEqual(original.map((item) => item.amount), [1,2]);
});


test('nested activity expenses retain transaction title, category, notes and identifier', async () => {
  const { normalizeActivityExpense } = await import('./transactionRelations.js');
  const incoming = {
    id: 'finance-7', name: 'Workshop fee', category: 'Education',
    description: 'Registration', notes: 'Paid by UPI', source: 'manual',
    amount: 1500, date: '2026-10-21',
  };
  const nested = normalizeActivityExpense(incoming, 'event-3', 'activity-9');
  assert.equal(nested.id, 'finance-7');
  assert.equal(nested.name, 'Workshop fee');
  assert.equal(nested.category, 'Education');
  assert.equal(nested.notes, 'Paid by UPI');
  assert.equal(nested.description, 'Registration');
  assert.equal(nested.source, 'manual');
  assert.equal(nested.eventId, 'event-3');
  assert.equal(nested.activityId, 'activity-9');
  assert.deepEqual(incoming, {
    id: 'finance-7', name: 'Workshop fee', category: 'Education',
    description: 'Registration', notes: 'Paid by UPI', source: 'manual',
    amount: 1500, date: '2026-10-21',
  });
  assert.equal(normalizeActivityExpense({ id: 'legacy', amount: 1, description: 'Historical' }).notes, 'Historical');
});

test('expense mirrors share the transaction metadata normalizer', () => {
  const incoming = {
    id: 'x', transactionKind: 'expense', eventId: 'e1', activityId: 'a1',
    name: 'Registration', category: 'Education', notes: 'Early bird',
    description: 'Conference pass', amount: 250, date: '2026-10-01',
  };
  const updated = reconcileExpenseActivities([{ id: 'e1', activities: [{ id: 'a1', expenses: [] }] }], null, incoming);
  const expense = updated[0].activities[0].expenses[0];
  assert.equal(expense.name, 'Registration');
  assert.equal(expense.category, 'Education');
  assert.equal(expense.notes, 'Early bird');
  assert.equal(expense.description, 'Conference pass');
  assert.equal(expense.id, 'x');
});

test('moment options contain one label per Moment and are alphabetically sorted', async () => {
  const { getTransactionMoments } = await import('./transactionRelations.js');
  const events = [
    { id: 'z', name: 'Wedding', activities: [{ id: 'a' }] },
    { firestoreId: 'f', name: 'Birthday' },
    { id: 'archived', name: 'Career', archived: true },
  ];
  assert.deepEqual(getTransactionMoments(events), [
    { value: 'f', label: 'Birthday' },
    { value: 'archived', label: 'Career' },
    { value: 'z', label: 'Wedding' },
  ]);
  assert.deepEqual(getTransactionMoments([]), []);
});
test('activity options belong only to selected Moment, even with reused activity IDs', async () => {
  const { getMomentActivities, requireLinkedActivity } = await import('./transactionRelations.js');
  const events = [
    { id: 'first', activities: [{ id: 'shared', title: 'Catering' }, { id: 'a1', title: 'Venue' }] },
    { id: 'second', activities: [{ id: 'shared', title: 'Book flight' }, { id: 'a2', title: 'Hotel' }] },
  ];
  assert.deepEqual(getMomentActivities(events, 'first'), [
    { value: 'shared', label: 'Catering' }, { value: 'a1', label: 'Venue' },
  ]);
  assert.deepEqual(getMomentActivities(events, 'second'), [
    { value: 'shared', label: 'Book flight' }, { value: 'a2', label: 'Hotel' },
  ]);
  assert.deepEqual(getMomentActivities(events, ''), []);
  assert.deepEqual(getMomentActivities(events, 'not-present'), []);
  assert.doesNotThrow(() => requireLinkedActivity(events, { eventId: 'second', activityId: 'a2' }));
  assert.throws(() => requireLinkedActivity(events, { eventId: 'first', activityId: 'a2' }), /unavailable/);
});
test('editing an activity expense into a Moment-only expense removes stale mirror', () => {
  const momentOnly = { ...oldExpense, activityId: null };
  assert.doesNotThrow(() => requireLinkedActivity(events, momentOnly));
  const patches = reconcileExpenseActivities(events, oldExpense, momentOnly);
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].activities[0].expenses, []);
  assert.deepEqual(patches[0].activities[1].expenses, []);
});
