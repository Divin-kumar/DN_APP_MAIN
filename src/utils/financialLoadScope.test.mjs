import test from 'node:test';
import assert from 'node:assert/strict';
import { beginFinancialLoad, isFinancialScopeLoaded, isFinancialViewReady } from './financialLoadScope.js';

for (const field of ['incomes', 'expenses']) {
  test(`switching user or guest scope clears stale ${field} and invalidates ownership`, () => {
    const old = { activeLoadKey: 'user:A', loadedFor: 'user:A', [field]: [{ id: 'private-A' }], loading: false, error: 'old' };
    const pending = beginFinancialLoad(old, 'guest:anonymous', field);
    assert.deepEqual(pending[field], []);
    assert.equal(pending.loadedFor, null);
    assert.equal(pending.activeLoadKey, 'guest:anonymous');
    assert.equal(pending.loading, true);
    assert.equal(pending.error, null);
    assert.equal(isFinancialScopeLoaded(pending, 'user:A'), false);
    assert.deepEqual(old[field], [{ id: 'private-A' }]);
  });
  test(`switching back while a load is in flight never reuses ${field} from the old scope`, () => {
    const old = { activeLoadKey: 'user:A', loadedFor: 'user:A', [field]: [{ id: 'old-A' }] };
    const onB = { ...old, ...beginFinancialLoad(old, 'user:B', field) };
    const onA = { ...onB, ...beginFinancialLoad(onB, 'user:A', field) };
    assert.equal(isFinancialScopeLoaded(onA, 'user:A'), false);
    assert.equal(isFinancialScopeLoaded(onA, 'user:B'), false);
    assert.deepEqual(onA[field], []);
    const settled = { ...onA, [field]: [{ id: 'new-A' }], loadedFor: 'user:A' };
    assert.equal(isFinancialScopeLoaded(settled, 'user:A'), true);
  });
  test(`refreshing an active scope retains already-loaded ${field} while joining its request`, () => {
    const current = { activeLoadKey: 'user:A', loadedFor: null, [field]: [{ id: 'optimistic' }] };
    const pending = beginFinancialLoad(current, 'user:A', field);
    assert.equal(Object.hasOwn(pending, field), false);
    assert.equal(Object.hasOwn(pending, 'loadedFor'), false);
    assert.equal(pending.activeLoadKey, 'user:A');
    assert.equal(isFinancialScopeLoaded(current, 'user:A'), false);
  });
}

test('Transactions requires both ledgers from the same active account and same Guest sample', () => {
  const ledger = (key, sample, field, rows) => ({
    loadedFor: key, activeLoadKey: key, loadedSample: sample, activeSample: sample,
    [field]: rows, loading: false, error: null,
  });
  const guestIncome = ledger('guest:anonymous', null, 'incomes', [{ id: 'salary', amount: 1000 }]);
  const guestExpense = ledger('guest:anonymous', null, 'expenses', [{ id: 'food', amount: 200 }]);
  assert.equal(isFinancialViewReady(guestIncome, guestExpense, 'guest:anonymous', null), true);
  assert.equal(isFinancialViewReady(guestIncome, guestExpense, 'user:alice', null), false);
  assert.equal(isFinancialViewReady({ ...guestIncome, activeLoadKey: 'user:bob' }, guestExpense, 'guest:anonymous'), false);
  assert.equal(isFinancialViewReady(guestIncome, { ...guestExpense, loadedFor: 'user:alice' }, 'guest:anonymous'), false);

  // The load key remains guest:anonymous when the guided demo is enabled.
  // Both lists must also match the current sample, never reuse private Guest
  // totals while demo records are being selected.
  assert.equal(isFinancialViewReady(guestIncome, guestExpense, 'guest:anonymous', 'tour'), false);
  assert.equal(isFinancialViewReady({ ...guestIncome, activeSample: 'tour' }, guestExpense, 'guest:anonymous'), false);
  const tourIncome = ledger('guest:anonymous', 'tour', 'incomes', [{ id: 'demo', amount: 9999 }]);
  const tourExpense = ledger('guest:anonymous', 'tour', 'expenses', []);
  assert.equal(isFinancialViewReady(tourIncome, tourExpense, 'guest:anonymous', 'tour'), true);
  assert.equal(isFinancialViewReady(tourIncome, guestExpense, 'guest:anonymous', 'tour'), false);
  assert.equal(isFinancialViewReady(tourIncome, tourExpense, 'guest:anonymous', null), false);
});

test('Transactions never renders a partially replaced income or expense projection', () => {
  const state = { loadedFor: 'user:alice', activeLoadKey: 'user:alice',
    activeSample: null, loadedSample: null, incomes: [{ id: 'one' }], expenses: [{ id: 'two' }] };
  assert.equal(isFinancialViewReady(state, state, 'user:alice'), true);
  assert.equal(isFinancialViewReady({ ...state, incomes: undefined }, state, 'user:alice'), false);
  assert.equal(isFinancialViewReady(state, { ...state, expenses: null }, 'user:alice'), false);
  assert.equal(isFinancialViewReady(null, state, 'user:alice'), false);
  assert.equal(isFinancialViewReady(state, null, 'user:alice'), false);
});
