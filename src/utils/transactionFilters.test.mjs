import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTransactions, toTransactions, transactionMonthKey, transactionMonthOptions } from './transactionFilters.js';

const incomes = [
  { id: 'a', name: 'Salary', type: 'Salary', amount: 75000, date: '2026-10-05' },
  { id: 'b', name: 'Bonus', amount: 8000, date: '2026-09-15' },
];
const expenses = [
  { id: 'a', name: 'Groceries', category: 'Food', amount: 1900, date: '2026-10-08' },
  { id: 'c', name: 'Train', category: 'Travel', amount: 1200, date: '2026-08-17' },
];
const transactions = toTransactions(incomes, expenses);

test('a shared ID across income and expense never hides either transaction', () => {
  assert.equal(transactions.length, 4);
  assert.equal(new Set(transactions.map((item) => item.stableTransactionKey)).size, 4);
  assert.equal(transactions[0].name, 'Groceries');
});
test('transaction type and month filters intersect, not override one another', () => {
  const matches = filterTransactions(transactions, { type: 'expense', month: '2026-10' });
  assert.deepEqual(matches.map((item) => item.name), ['Groceries']);
  assert.deepEqual(filterTransactions(transactions, { type: 'income', month: '2026-10' }).map((item) => item.name), ['Salary']);
});
test('search intersects with both filters and empty state has no false positives', () => {
  assert.deepEqual(filterTransactions(transactions, { type: 'expense', month: '2026-10', search: 'gro' }).map((item) => item.name), ['Groceries']);
  assert.equal(filterTransactions(transactions, { type: 'expense', month: '2026-10', search: 'salary' }).length, 0);
  assert.equal(filterTransactions(transactions, { type: 'income', month: '2026-08' }).length, 0);
  assert.equal(filterTransactions(transactions, { month: 'all', type: 'all' }).length, 4);
});
test('month selection uses recorded calendar month without timezone shifting', () => {
  assert.equal(transactionMonthKey('2026-10-01'), '2026-10');
  assert.equal(transactionMonthKey('2026-09-30T23:30:00Z'), '2026-09');
  assert.equal(transactionMonthKey('2026-13-05'), null);
  assert.equal(transactionMonthKey(''), null);
});
test('available month options include selected history and recent empty months', () => {
  const options = transactionMonthOptions(transactions, new Date('2026-10-21T12:00:00Z'));
  assert.deepEqual(options.slice(0, 3).map((o) => o.label), ['October 2026', 'September 2026', 'August 2026']);
  assert.equal(options[0].shortLabel, 'Oct 2026');
  assert.equal(options.some((o) => o.value === '2026-01'), true);
});
