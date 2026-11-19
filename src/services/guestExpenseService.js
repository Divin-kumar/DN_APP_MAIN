/* Shared expense normalization and Guest-local persistence. */
import { upsertRecord } from '../utils/transactionRelations';
import { normalizeFinancialRecord, mergeFinancialExpenses } from '../utils/financialRecords.js';
import { recordId } from '../utils/recordIdentity.js';

const GUEST_EXPENSES_KEY = 'dn_guest_expenses';
const GUEST_EVENTS_KEY = 'dn_guest_eventGroups';

// Never persist the merged activity-expense projection to the guest master ledger.
export const getGuestExpenseMasters = () => {
  const parsed = JSON.parse(localStorage.getItem(GUEST_EXPENSES_KEY) || '[]');
  if (!Array.isArray(parsed)) throw new Error('Guest expense storage is invalid; no changes were made.');
  return parsed;
};

const mergeExpenseRecords = mergeFinancialExpenses;

// Normalize and merge guest master records with nested event activity records.
export const normalizeExpense = (item, fallbackId = '') => normalizeFinancialRecord(item, 'expense', fallbackId);

export const getGuestExpenses = () => {
  try {
    const expenseData = JSON.parse(localStorage.getItem(GUEST_EXPENSES_KEY) || '[]');
    const eventData = JSON.parse(localStorage.getItem(GUEST_EVENTS_KEY) || '[]');
    if (!Array.isArray(expenseData) || !Array.isArray(eventData)) throw new Error('Guest expense or Moment storage is invalid; no changes were made.');
    const nestedExpenses = Array.isArray(eventData)
      ? eventData.flatMap((event) => (event.activities || []).flatMap((activity) => (
        activity.expenses || []
      ).map((expense) => ({ ...expense, eventId: expense.eventId || event.id, activityId: expense.activityId || activity.id }))))
      : [];

    return mergeExpenseRecords([
      ...(Array.isArray(expenseData) ? expenseData : []),
      ...nestedExpenses,
    ]);
  } catch (error) {
    console.error('Failed to load guest expenses:', error);
    throw error;
  }
};

export const setGuestExpenses = (items) => {
  localStorage.setItem(GUEST_EXPENSES_KEY, JSON.stringify(items));
};

export const saveGuestExpense = (expense) => {
  const record = { ...normalizeExpense(expense), ...(expense.firestoreId ? { firestoreId: expense.firestoreId } : {}) };
  setGuestExpenses(upsertRecord(getGuestExpenseMasters(), record));
  return getGuestExpenses();
};

export const removeGuestExpense = (expenseId) => {
  setGuestExpenses(getGuestExpenseMasters().filter((item) =>
    recordId(item.id) !== recordId(expenseId) && recordId(item.firestoreId) !== recordId(expenseId)
  ));
  return getGuestExpenses();
};
