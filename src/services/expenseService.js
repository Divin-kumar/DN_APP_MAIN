/* Expense persistence and reconciliation of master and nested event records. */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { upsertRecord } from '../utils/transactionRelations';
import { normalizeFinancialRecord, mergeFinancialExpenses } from '../utils/financialRecords.js';
import { getEventsForUser } from './eventService';
import { recordId } from '../utils/recordIdentity.js';
import { deleteAccountFinancialRecord, getAccountTransactions, updateAccountFinancialRecord } from './accountTransactionService';
import { isPlannedExpenseId } from '../utils/expensePlans.js';

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

// Load both Firestore expense records and nested activity records for reporting pages.
export const getExpensesForUser = async (uid) => {
  const expensesRef = collection(db, 'users', uid, 'expenses');
  const [snapshot, unifiedExpenses, events] = await Promise.all([
    getDocs(expensesRef), getAccountTransactions(uid, 'expense', normalizeExpense), getEventsForUser(uid),
  ]);
  const masterExpenses = snapshot.docs.map((docSnap) => ({
    firestoreId: docSnap.id,
    firestoreCollection: 'expenses',
    ...normalizeExpense({ ...docSnap.data(), firestoreId: docSnap.id }, docSnap.id),
  }));
  const nestedExpenses = events.flatMap((event) => {
    return (event.activities || []).flatMap((activity) => (activity.expenses || []).map((expense) => ({
      ...expense,
      eventId: expense.eventId || event.id,
      activityId: expense.activityId || activity.id,
    })));
  });

  return mergeExpenseRecords([...masterExpenses, ...unifiedExpenses, ...nestedExpenses]);
};

export const createExpense = async (uid, expense, assertCurrent = () => {}) => {
  const normalized = normalizeExpense(expense);
  const expensesRef = collection(db, 'users', uid, 'expenses');
  // A backup or Guest transfer can restore a payment before its plan.
  // Keep the receipt at the same address used when recording it in Finance.
  if (isPlannedExpenseId(normalized.id)) {
    const ref = doc(expensesRef, normalized.id);
    return runTransaction(db, async (transaction) => {
      assertCurrent();
      if (auth.currentUser?.uid !== uid) throw new Error('Your account changed before the expense could be saved.');
      const snapshot = await transaction.get(ref);
      assertCurrent();
      if (auth.currentUser?.uid !== uid) throw new Error('Your account changed before the expense could be saved.');
      if (!snapshot.exists()) transaction.set(ref, normalized);
      const saved = snapshot.exists() ? normalizeExpense(snapshot.data(), ref.id) : normalized;
      return { ...saved, firestoreId: ref.id, firestoreCollection: 'expenses' };
    });
  }
  const docRef = await addDoc(expensesRef, normalized);
  return { firestoreId: docRef.id, firestoreCollection: 'expenses', ...normalized };
};

export const updateExpense = async (uid, expense) => {
  const normalized = normalizeExpense(expense);
  return updateAccountFinancialRecord(uid, 'expense', expense, normalized);
};

export const deleteExpense = async (uid, expense) => {
  return deleteAccountFinancialRecord(uid, 'expense', expense);
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
