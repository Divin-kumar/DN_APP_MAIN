import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvent, deleteEvent, getGuestEvents, saveGuestEvent, setGuestEvents, updateEvent } from './eventService.js';
import { createExpense, deleteExpense, getGuestExpenses, saveGuestExpense, setGuestExpenses, updateExpense } from './expenseService.js';
import { createIncome, deleteIncome, getGuestIncomes, saveGuestIncome, setGuestIncomes, updateIncome } from './incomeService.js';
import { mergeGuestDataIntoAccount } from './guestMergeService.js';

const makeStorage = (seed = {}) => {
  const values = new Map(Object.entries(seed));
  const writes = [];
  return {
    writes,
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => { writes.push(['set', key]); values.set(key, String(value)); },
    removeItem: (key) => { writes.push(['remove', key]); values.delete(key); },
  };
};

test('legacy service mutation APIs are blocked and compatibility reads are read-only', async () => {
  const previousStorage = globalThis.localStorage;
  const storage = makeStorage({
    lifehub_guest_eventGroups: '[]',
    lifehub_guest_expenses: '[]',
    lifehub_guest_incomes: '[]',
    lifehub_guest_mode: 'true',
  });
  globalThis.localStorage = storage;

  try {
    assert.deepEqual(getGuestEvents(), []);
    assert.deepEqual(getGuestExpenses(), []);
    assert.deepEqual(getGuestIncomes(), []);
    assert.deepEqual(await mergeGuestDataIntoAccount('account-1'), {
      requiresExplicitMigration: true,
      migrated: false,
      expenses: 0,
      incomes: 0,
      events: 0,
    });
    assert.deepEqual(storage.writes, []);

    assert.throws(() => saveGuestEvent({ id: 'event-1' }), /deprecated/);
    assert.throws(() => setGuestEvents([]), /deprecated/);
    assert.throws(() => saveGuestExpense({ id: 'expense-1' }), /deprecated/);
    assert.throws(() => setGuestExpenses([]), /deprecated/);
    assert.throws(() => saveGuestIncome({ id: 'income-1' }), /deprecated/);
    assert.throws(() => setGuestIncomes([]), /deprecated/);
    await assert.rejects(createEvent('account-1', {}), /deprecated/);
    await assert.rejects(updateEvent('account-1', {}), /deprecated/);
    await assert.rejects(deleteEvent('account-1', {}), /deprecated/);
    await assert.rejects(createExpense('account-1', {}), /deprecated/);
    await assert.rejects(updateExpense('account-1', {}), /deprecated/);
    await assert.rejects(deleteExpense('account-1', {}), /deprecated/);
    await assert.rejects(createIncome('account-1', {}), /deprecated/);
    await assert.rejects(updateIncome('account-1', {}), /deprecated/);
    await assert.rejects(deleteIncome('account-1', {}), /deprecated/);
    assert.deepEqual(storage.writes, []);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
