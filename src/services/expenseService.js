/* Expense persistence and reconciliation of master and nested event records. */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { upsertRecord } from '../utils/transactionRelations';

const GUEST_EXPENSES_KEY = 'dn_guest_expenses';
const GUEST_EVENTS_KEY = 'dn_guest_eventGroups';

// Never persist the merged activity-expense projection to the guest master ledger.
const getGuestExpenseMasters = () => {
  const parsed = JSON.parse(localStorage.getItem(GUEST_EXPENSES_KEY) || '[]');
  if (!Array.isArray(parsed)) throw new Error('Guest expense storage is invalid; no changes were made.');
  return parsed;
};

const expenseKey = (expense) => expense.id || expense.firestoreId;

const mergeExpenseRecords = (records) => {
  const merged = new Map();
  records.forEach((record) => {
    const normalized = {
      ...normalizeExpense(record),
      ...(record.firestoreId ? { firestoreId: record.firestoreId } : {}),
    };
    const key = expenseKey(normalized) || crypto.randomUUID();
    if (!merged.has(key)) merged.set(key, normalized);
  });
  return [...merged.values()];
};

// Normalize and merge guest master records with nested event activity records.
export const normalizeExpense = (item) => ({
  id: item.id || crypto.randomUUID(),
  name: String(item.name ?? '').trim(),
  amount: Number(item.amount ?? 0),
  category: item.category || 'Other',
  description: String(item.description ?? '').trim(),
  notes: String(item.notes ?? item.description ?? '').trim(),
  date: item.date || new Date().toISOString().slice(0, 10),
  createdAt: item.createdAt || new Date().toISOString(),
  eventId: item.eventId || null,
  activityId: item.activityId || null,
  source: item.source || 'manual',
});

export const getGuestExpenses = () => {
  try {
    const expenseData = JSON.parse(localStorage.getItem(GUEST_EXPENSES_KEY) || '[]');
    const eventData = JSON.parse(localStorage.getItem(GUEST_EVENTS_KEY) || '[]');
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
    return [];
  }
};

export const setGuestExpenses = (items) => {
  localStorage.setItem(GUEST_EXPENSES_KEY, JSON.stringify(items));
};

// Load both Firestore expense records and nested activity records for reporting pages.
export const getExpensesForUser = async (uid) => {
  const expensesRef = collection(db, 'users', uid, 'expenses');
  const eventsRef = collection(db, 'users', uid, 'eventGroups');
  const [snapshot, eventSnapshot] = await Promise.all([getDocs(expensesRef), getDocs(eventsRef)]);
  const masterExpenses = snapshot.docs.map((docSnap) => ({
    firestoreId: docSnap.id,
    ...normalizeExpense(docSnap.data()),
  }));
  const nestedExpenses = eventSnapshot.docs.flatMap((eventSnap) => {
    const event = eventSnap.data();
    return (event.activities || []).flatMap((activity) => (activity.expenses || []).map((expense) => ({
      ...expense,
      eventId: expense.eventId || event.id || eventSnap.id,
      activityId: expense.activityId || activity.id,
    })));
  });

  return mergeExpenseRecords([...masterExpenses, ...nestedExpenses]);
};

export const createExpense = async (uid, expense) => {
  const normalized = normalizeExpense(expense);
  const expensesRef = collection(db, 'users', uid, 'expenses');
  const docRef = await addDoc(expensesRef, normalized);
  return { firestoreId: docRef.id, ...normalized };
};

export const updateExpense = async (uid, expense) => {
  const normalized = normalizeExpense(expense);
  const ref = doc(db, 'users', uid, 'expenses', expense.firestoreId || expense.id);
  await updateDoc(ref, {
    ...normalized,
    id: normalized.id,
  });
  return normalized;
};

export const deleteExpense = async (uid, expense) => {
  const id = expense.firestoreId || expense.id;
  if (!id) return;
  const ref = doc(db, 'users', uid, 'expenses', id);
  await deleteDoc(ref);
};

export const saveGuestExpense = (expense) => {
  const record = { ...normalizeExpense(expense), ...(expense.firestoreId ? { firestoreId: expense.firestoreId } : {}) };
  setGuestExpenses(upsertRecord(getGuestExpenseMasters(), record));
  return getGuestExpenses();
};

export const removeGuestExpense = (expenseId) => {
  setGuestExpenses(getGuestExpenseMasters().filter((item) =>
    item.id !== expenseId && item.firestoreId !== expenseId
  ));
  return getGuestExpenses();
};
