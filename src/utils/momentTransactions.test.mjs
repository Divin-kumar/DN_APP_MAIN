import test from 'node:test';
import assert from 'node:assert/strict';
import { projectMomentTransactions } from './momentTransactions.js';
import { summarizeTransactions } from './transactionFilters.js';

test('Moment projection merges typed, unified and nested sources once per kind with first-record values/provenance', () => {
  const moments = [{ id: 'one', activities: [{ id: 'shared', title: 'Correct task', expenses: [
    { id: 'dup', amount: 999, date: '2026-10-01' }, { id: 'nested', name: 'Nested only', amount: 7, date: '2026-09-01' },
  ] }] }, { id: 'two', activities: [{ id: 'shared', title: 'Wrong task', expenses: [{ id: 'elsewhere', amount: 800 }] }] }];
  const incomes = [{ id: 'dup', amount: 100, date: '2026-10-25', eventId: 'one', firestoreId: 'typed-income', firestoreCollection: 'incomes' },
    { id: 'legacy-income', amount: 20, date: '2026-10-22', eventId: 'one', firestoreId: 'legacy-income', firestoreCollection: 'transactions' }];
  const expenses = [{ id: 'dup', amount: 10, date: '2026-10-24', eventId: 'one', activityId: 'shared', firestoreId: 'typed-doc', firestoreCollection: 'expenses' },
    { id: 'dup', amount: 50, date: '2026-10-21', eventId: 'one', firestoreId: 'legacy-doc', firestoreCollection: 'transactions' },
    { id: 'legacy-expense', amount: 3, date: '2026-10-23', eventId: 'one', firestoreId: 'only-legacy', firestoreCollection: 'transactions' },
    { id: 'invalid', amount: Infinity, date: '2026-09-03', eventId: 'one' }];
  const before = structuredClone({ moments, incomes, expenses });
  const result = projectMomentTransactions(moments, incomes, expenses, 'one');
  assert.deepEqual(result.map((item) => item.id), ['dup', 'dup', 'legacy-expense', 'legacy-income', 'invalid', 'nested']);
  const winner = result.find((item) => item.transactionKind === 'expense' && item.id === 'dup');
  assert.equal(winner.amount, 10);
  assert.equal(winner.activityTitle, 'Correct task');
  assert.deepEqual(winner.firestoreSources, [{ collection: 'expenses', id: 'typed-doc' }, { collection: 'transactions', id: 'legacy-doc' }]);
  assert.equal(result.some((item) => item.id === 'elsewhere'), false);
  assert.deepEqual(summarizeTransactions(result), { income: 120, expense: 20, balance: 100 });
  assert.deepEqual({ moments, incomes, expenses }, before, 'projection never writes into originals');
});

test('deduplication precedes Moment filtering and does not resurrect a nested duplicate in a different parent', () => {
  const moments = [{ id: 'one', activities: [{ id: 'same', expenses: [{ id: 'moved', amount: 80 }] }] }];
  const expense = { id: 'moved', eventId: 'two', amount: 30, firestoreId: 'source', firestoreCollection: 'expenses' };
  assert.deepEqual(projectMomentTransactions(moments, [], [expense], 'one'), []);
});
