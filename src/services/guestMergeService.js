/*
  Migrates guest-local records into the signed-in user's Firestore account.

  This is useful when a guest user decides to log in later:
  their saved events, expenses, and incomes are merged into the real account so nothing is lost.
*/
import { getGuestExpenses } from './expenseService.js';
import { getGuestIncomes } from './incomeService.js';
import { getGuestEvents } from './eventService.js';

// Retained for compatibility only. Account adoption must use the explicit local migration flow.
export const inspectGuestDataForMigration = () => {
  const expenses = getGuestExpenses();
  const incomes = getGuestIncomes();
  const events = getGuestEvents();

  return {
    requiresExplicitMigration: true,
    migrated: false,
    expenses: expenses.length,
    incomes: incomes.length,
    events: events.length,
  };
};

export const mergeGuestDataIntoAccount = async () => inspectGuestDataForMigration();
