import test from 'node:test';
import assert from 'node:assert/strict';
import { financialDate, financialTimestamp, normalizeFinancialRecord, mergeFinancialExpenses } from './financialRecords.js';
import { filterTransactions, summarizeTransactions, toTransactions, transactionMonthOptions } from './transactionFilters.js';

test('legacy numeric IDs and links match string IDs without changing existing identity', () => {
  const raw = { id: 123, eventId: 45, activityId: 67, title: 'Legacy expense', amount: '1200', date: '2026-10-18' };
  const record = normalizeFinancialRecord(raw);
  assert.equal(record.id, '123');
  assert.equal(record.eventId, '45');
  assert.equal(record.activityId, '67');
  assert.equal(record.name, 'Legacy expense');
  assert.equal(raw.id, 123);
  const merged = mergeFinancialExpenses([
    { ...raw, firestoreId: 'master-doc' },
    { id: '123', eventId: '45', activityId: '67', amount: 1200 },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].firestoreId, 'master-doc');
});

test('account documents without stored IDs use stable provider identity across reloads', () => {
  const raw = { name: 'Salary', amount: 18000, date: '2026-10-01' };
  assert.equal(normalizeFinancialRecord(raw, 'income', 'income-document').id, 'income-document');
  assert.equal(normalizeFinancialRecord(raw, 'income', 'income-document').id, 'income-document');
  assert.equal(normalizeFinancialRecord({ ...raw, id: 'saved-id' }, 'income', 'document').id, 'saved-id');
});

test('Timestamp and serialized Timestamp dates remain selectable and sortable in finance', () => {
  const date = new Date(2026, 9, 18, 12);
  const timestamp = { toDate: () => date };
  assert.equal(financialDate(timestamp), '2026-10-18');
  assert.equal(financialDate({ seconds: date.getTime() / 1000, nanoseconds: 0 }), '2026-10-18');
  assert.equal(financialDate({ _seconds: date.getTime() / 1000 }), '2026-10-18');
  assert.equal(financialDate('2026-10-01'), '2026-10-01');
  assert.equal(financialDate('invalid', 'fallback'), 'fallback');
  const transactions = toTransactions([
    normalizeFinancialRecord({ id: 1, amount: 18000, date: timestamp }, 'income'),
  ], [normalizeFinancialRecord({ id: 2, amount: 1200, date: timestamp })]);
  assert.equal(transactionMonthOptions(transactions)[0].value, '2026-10');
  assert.equal(filterTransactions(transactions, { month: '2026-10' }).length, 2);
  assert.deepEqual(summarizeTransactions(transactions), { income: 18000, expense: 1200, balance: 16800 });
});

test('legacy creation timestamps retain the exact instant instead of being truncated to midnight', () => {
  const date = new Date('2026-10-18T15:45:12.345Z');
  const raw = { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 345000000 };
  assert.equal(financialTimestamp(raw), date.toISOString());
  assert.equal(financialTimestamp({ toDate: () => date }), date.toISOString());
  assert.equal(normalizeFinancialRecord({ id: 1, createdAt: raw }).createdAt, date.toISOString());
});

test('Phase 5 payment method is optional for historical data and normalized for both financial types', () => {
  for (const kind of ['income','expense']) {
    const old = normalizeFinancialRecord({ id: 'legacy', name: 'Older', amount: 50 }, kind);
    assert.equal(old.paymentMethod, null);
    for (const method of ['Cash','Online']) {
      const record = normalizeFinancialRecord({ id: method, paymentMethod: method }, kind);
      assert.equal(record.paymentMethod, method);
    }
    assert.equal(normalizeFinancialRecord({ paymentMethod: 'Bank' }, kind).paymentMethod, null);
  }
  const entries = toTransactions([normalizeFinancialRecord({id:'income',amount:250,paymentMethod:'Online'},'income')],
    [normalizeFinancialRecord({id:'expense',amount:100,paymentMethod:'Cash'})]);
  assert.equal(entries[0].paymentMethod, 'Online');
  assert.equal(entries[1].paymentMethod, 'Cash');
  assert.deepEqual(summarizeTransactions(entries), { income:250, expense:100, balance:150 });
});
