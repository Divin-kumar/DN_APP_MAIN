/* Expense persistence and reconciliation of master and nested event records. */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getEventsForUser } from './eventService';
import { deleteAccountFinancialRecord, getAccountTransactions, updateAccountFinancialRecord } from './accountTransactionService';
import { isPlannedExpenseId } from '../utils/expensePlans.js';

import { mergeFinancialExpenses } from '../utils/financialRecords.js';
import { normalizeExpense } from './guestExpenseService';

export { getGuestExpenseMasters, getGuestExpenses, normalizeExpense, removeGuestExpense, saveGuestExpense, setGuestExpenses } from './guestExpenseService';

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

  return mergeFinancialExpenses([...masterExpenses, ...unifiedExpenses, ...nestedExpenses]);
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
