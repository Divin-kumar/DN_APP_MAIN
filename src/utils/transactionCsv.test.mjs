import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionsToCsv, TRANSACTION_CSV_HEADERS } from './transactionCsv.js';
import { filterTransactions, sortTransactions, toTransactions } from './transactionFilters.js';

const moments = [{ id: 'm1', name: 'Trip', activities: [
  { id: 'a1', title: 'Train tickets', mergedActivityIds: ['old-activity'] },
] }];
const transactions = toTransactions(
  [{ id: 'i1', name: 'Salary', type: 'Pay', amount: 8000, date: '2026-10-01', paymentMethod: 'Cash' }],
  [{ id: 'e1', name: 'Rail "ticket", return', category: 'Travel', amount: 125,
    date: '2026-10-02', eventId: 'm1', activityId: 'old-activity', notes: '=HYPERLINK("bad")',
    paymentMethod: 'Online' }],
);
test('exports only visible sorted records with labels and without mutation', () => {
  const original = structuredClone(transactions);
  const selected = sortTransactions(filterTransactions(transactions, { search: 'rail' }), 'date-desc');
  const csv = transactionsToCsv(selected, moments);
  assert.ok(csv.startsWith('\uFEFF' + TRANSACTION_CSV_HEADERS.map((s) => '"' + s + '"').join(',')));
  assert.equal(csv.split('\r\n').filter(Boolean).length, 2);
  assert.match(csv, /Rail ""ticket"", return/);
  assert.match(csv, /"Trip","Train tickets"/);
  assert.match(csv, /"'=HYPERLINK/);
  assert.doesNotMatch(csv, /Salary/);
  assert.deepEqual(transactions, original);
});
test('empty CSV has only headers; malicious text cannot be interpreted as a formula', () => {
  const csv = transactionsToCsv([{ transactionKind: 'expense', name: '  +cmd',
    date: '2026-10-03', amount: 3, category: '@evil', paymentMethod: '-oops' }]);
  assert.match(csv, /"'  \+cmd"/);
  assert.match(csv, /"'@evil"/);
  assert.match(csv, /"'-oops"/);
  assert.match(csv, /"3"/);
  assert.equal(transactionsToCsv([]).split('\r\n').filter(Boolean).length, 1);
});
