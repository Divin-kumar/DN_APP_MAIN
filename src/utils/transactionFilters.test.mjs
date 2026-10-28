import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterTransactions, toTransactions, transactionMonthKey, transactionMonthOptions,
  sortTransactions, summarizeTransactions, transactionPayload,
} from './transactionFilters.js';

const incomes = [
  { id: 'a', name: 'Salary', type: 'Salary', amount: 25000, date: '2026-10-05' },
  { id: 'b', name: 'Bonus', amount: 8000, date: '2026-09-15' },
];
const expenses = [
  { id: 'a', name: 'Groceries', category: 'Food', amount: 15000, date: '2026-10-08' },
  { id: 'c', name: 'Train', category: 'Travel', amount: 1200, date: '2026-08-17' },
];
const transactions = toTransactions(incomes, expenses);

test('income and expense IDs use separate key namespaces', () => {
  assert.equal(transactions.length, 4);
  assert.equal(new Set(transactions.map((item) => item.stableTransactionKey)).size, 4);
});
test('transaction type and month filters intersect', () => {
  assert.deepEqual(filterTransactions(transactions, { type: 'expense', month: '2026-10' }).map((i) => i.name), ['Groceries']);
  assert.deepEqual(filterTransactions(transactions, { type: 'income', month: '2026-10' }).map((i) => i.name), ['Salary']);
});
test('search respects type and month; reset returns all', () => {
  assert.deepEqual(filterTransactions(transactions, { type: 'expense', month: '2026-10', search: 'gro' }).map((i) => i.name), ['Groceries']);
  assert.equal(filterTransactions(transactions, { type: 'expense', month: '2026-10', search: 'salary' }).length, 0);
  assert.equal(filterTransactions(transactions, { type: 'income', month: '2026-08' }).length, 0);
  assert.equal(filterTransactions(transactions, { type: 'all', month: 'all' }).length, 4);
});
test('month keys honor calendar dates without UTC drift', () => {
  assert.equal(transactionMonthKey('2026-10-01'), '2026-10');
  assert.equal(transactionMonthKey('2026-09-30T23:30:00Z'), '2026-09');
  assert.equal(transactionMonthKey('2026-13-05'), null);
  assert.equal(transactionMonthKey(''), null);
});
test('month dropdown includes only months actually holding transactions', () => {
  const options = transactionMonthOptions(transactions);
  assert.deepEqual(options.map((o) => o.value), ['2026-10', '2026-09', '2026-08']);
  assert.deepEqual(options.map((o) => o.label), ['October 2026', 'September 2026', 'August 2026']);
  assert.equal(options[0].shortLabel, 'Oct 2026');
  assert.deepEqual(transactionMonthOptions([]), []);
});
test('filtered summary totals always reconcile income minus expense', () => {
  assert.deepEqual(summarizeTransactions(filterTransactions(transactions, { month: '2026-10' })), {
    income: 25000, expense: 15000, balance: 10000,
  });
  assert.deepEqual(summarizeTransactions(filterTransactions(transactions, { month: '2026-10', type: 'expense' })), {
    income: 0, expense: 15000, balance: -15000,
  });
  assert.deepEqual(summarizeTransactions([]), { income: 0, expense: 0, balance: 0 });
});
test('date, amount and title sorting are non-mutating', () => {
  const sorted = sortTransactions(transactions, 'date-desc');
  assert.deepEqual(sorted.map((o) => o.name), ['Groceries','Salary','Bonus','Train']);
  assert.deepEqual(sortTransactions(transactions, 'amount-desc').map((o) => o.name), ['Salary','Groceries','Bonus','Train']);
  assert.deepEqual(sortTransactions(transactions, 'title-asc').map((o) => o.name), ['Bonus','Groceries','Salary','Train']);
  assert.equal(transactions[0].name, 'Salary');
});
test('unified transaction payload keeps legacy income/expense keys and activity links', () => {
  const common = { title: 'Refund', amount: '450', date: '2026-10-21', notes: 'For supplies', category: 'Gift', paymentMethod: 'Cash', eventId: 'event-1', activityId: 'activity-1' };
  const inc = transactionPayload({ ...common, transactionKind: 'income' });
  assert.equal(inc.type, 'Gift');
  assert.equal(inc.name, 'Refund');
  assert.equal(inc.paymentMethod, 'Cash');
  assert.equal(inc.activityId, 'activity-1');
  assert.equal(inc.description, 'For supplies');
  assert.equal(transactionPayload({ ...common, transactionKind: 'expense' }).category, 'Gift');
  assert.throws(() => transactionPayload({ ...common, transactionKind: 'other' }), /transaction type/);
});

test('Phase 5 requires only Cash or Online for saved transaction payloads', () => {
  const form = { transactionKind:'expense', title:'Taxi', amount:125,date:'2026-10-28',category:'Travel' };
  assert.throws(() => transactionPayload(form), /Cash or Online/);
  assert.throws(() => transactionPayload({...form,paymentMethod:'Card'}), /Cash or Online/);
  assert.deepEqual(['Cash','Online'].map(method=>transactionPayload({...form,paymentMethod:method}).paymentMethod),['Cash','Online']);
  assert.equal(transactionPayload({...form,transactionKind:'income',paymentMethod:'Online'}).paymentMethod,'Online');
});
