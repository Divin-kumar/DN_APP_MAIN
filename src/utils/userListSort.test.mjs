import test from 'node:test';
import assert from 'node:assert/strict';
import { sortMoments, MOMENT_SORT_OPTIONS, TRANSACTION_SORT_VALUES, transactionSortForField } from './userListSort.js';
import { sortTransactions, toTransactions, summarizeTransactions } from './transactionFilters.js';
import { createListStateMemory, listStateKey } from './listStateMemory.js';

test('Moment date sorting defaults to recorded oldest first and keeps undecided dates last in both directions', () => {
  const moments = [
    { id: 'missing', createdAt: '2000-01-01', startDate: '2001-01-01' },
    { id: 'later', date: '2027-11-20', createdAt: '1999-01-01' },
    { id: 'invalid', date: '2026-02-30' },
    { id: 'earlier', date: '2025-01-08', updatedAt: '2030-01-01' },
    { id: 'same', date: '2025-01-08' },
  ];
  assert.deepEqual(sortMoments(moments).map(({ id }) => id), ['earlier', 'same', 'later', 'missing', 'invalid']);
  assert.deepEqual(sortMoments(moments, 'date', 'desc').map(({ id }) => id), ['later', 'earlier', 'same', 'missing', 'invalid']);
  assert.equal(moments[0].id, 'missing');
});

test('Moment name and status choices use friendly derived values without changing records', () => {
  const moments = [
    { id: 'archived', name: 'Zulu', archived: true, status: 'cancelled' },
    { id: 'cancelled', name: 'bravo', status: 'cancelled' },
    { id: 'complete', name: 'Alpha', activities: [{ completed: true }] },
    { id: 'active', name: 'alpha', activities: [{ completed: false }] },
  ];
  assert.deepEqual(sortMoments(moments, 'name').map(({ id }) => id), ['complete', 'active', 'cancelled', 'archived']);
  assert.deepEqual(sortMoments(moments, 'status').map(({ id }) => id), ['active', 'complete', 'cancelled', 'archived']);
  assert.deepEqual(sortMoments(moments, 'status', 'desc').map(({ id }) => id), ['archived', 'cancelled', 'complete', 'active']);
  assert.equal(moments[0].status, 'cancelled');
});

test('Each transaction sort choice orders the same ledger and leaves totals unchanged', () => {
  const transactions = toTransactions([{ id: 'fund', name: 'Trip fund', amount: 1000, date: '2026-10-25' }], [
    { id: 'deposit', name: 'Room deposit', amount: 100, date: '2026-10-24' },
    { id: 'train', name: 'Train', amount: 200, date: '2026-10-26' },
  ]);
  const expected = {
    'date-asc': ['Room deposit', 'Trip fund', 'Train'], 'date-desc': ['Train', 'Trip fund', 'Room deposit'],
    'amount-asc': ['Room deposit', 'Train', 'Trip fund'], 'amount-desc': ['Trip fund', 'Train', 'Room deposit'],
    'title-asc': ['Room deposit', 'Train', 'Trip fund'], 'title-desc': ['Trip fund', 'Train', 'Room deposit'],
  };
  for (const sort of TRANSACTION_SORT_VALUES) {
    const sorted = sortTransactions(transactions, sort);
    assert.deepEqual(sorted.map(({ name }) => name), expected[sort]);
    assert.deepEqual(summarizeTransactions(sorted), { income: 1000, expense: 300, balance: 700 });
  }
  assert.deepEqual(['date', 'amount', 'title'].map(transactionSortForField), ['date-desc', 'amount-desc', 'title-asc']);
  assert.equal(transactions[0].name, 'Trip fund');
});

test('Scoped sort memory preserves existing filter choices and rejects unsupported fields', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const defaults = { search: '', category: 'All moments', field: 'date', direction: 'asc' };
  const rules = { field: MOMENT_SORT_OPTIONS.map(({ value }) => value), direction: ['asc', 'desc'] };
  const guest = listStateKey('guest', 'moments'), account = listStateKey('account:owner', 'moments');
  values.set(guest, JSON.stringify({ search: 'Ooty', category: 'Vacation' }));
  let memory = createListStateMemory(() => storage);
  assert.deepEqual(memory.read(guest, defaults, rules), { ...defaults, search: 'Ooty', category: 'Vacation' });
  memory.update(guest, defaults, rules, { field: 'name', direction: 'desc' });
  memory = createListStateMemory(() => storage);
  assert.equal(memory.read(guest, defaults, rules).direction, 'desc');
  assert.deepEqual(memory.read(account, defaults, rules), defaults);
  assert.equal(memory.update(guest, defaults, rules, { field: 'firestoreId' }).field, 'date');
});

test('Scoped legacy transaction filter migration retains an already selected supported sort', () => {
  const memory = createListStateMemory(() => ({ getItem: () => null, setItem: () => {} }));
  const defaults = { type: 'all', month: 'all', search: '', sort: 'date-desc' };
  const state = memory.read('legacy-transactions', defaults, { sort: TRANSACTION_SORT_VALUES },
    () => ({ type: 'expense', month: '2026-10', search: 'Room', sort: 'amount-asc' }));
  assert.deepEqual(state, { type: 'expense', month: '2026-10', search: 'Room', sort: 'amount-asc' });
});
