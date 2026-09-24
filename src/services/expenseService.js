import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const GUEST_EXPENSES_KEY = 'lifehub_guest_expenses';

export const normalizeExpense = (item) => ({
  id: item.id || crypto.randomUUID(),
  name: String(item.name ?? '').trim(),
  amount: Number(item.amount ?? 0),
  category: item.category || 'Other',
  date: item.date || new Date().toISOString().slice(0, 10),
  createdAt: item.createdAt || new Date().toISOString(),
  eventId: item.eventId || null,
  activityId: item.activityId || null,
  source: item.source || 'manual',
});

export const getGuestExpenses = () => {
  try {
    const raw = localStorage.getItem(GUEST_EXPENSES_KEY) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeExpense) : [];
  } catch (error) {
    console.error('Failed to load guest expenses:', error);
    return [];
  }
};

export const setGuestExpenses = (items) => {
  localStorage.setItem(GUEST_EXPENSES_KEY, JSON.stringify(items));
};

export const getExpensesForUser = async (uid) => {
  const expensesRef = collection(db, 'users', uid, 'expenses');
  const snapshot = await getDocs(expensesRef);
  return snapshot.docs.map((docSnap) => ({
    firestoreId: docSnap.id,
    ...normalizeExpense(docSnap.data()),
  }));
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
  const list = getGuestExpenses();
  const index = list.findIndex((item) => item.id === expense.id || item.firestoreId === expense.firestoreId);

  if (index >= 0) {
    list[index] = normalizeExpense(expense);
  } else {
    list.push(normalizeExpense(expense));
  }

  setGuestExpenses(list);
  return list;
};

export const removeGuestExpense = (expenseId) => {
  const list = getGuestExpenses().filter((item) => item.id !== expenseId);
  setGuestExpenses(list);
  return list;
};
