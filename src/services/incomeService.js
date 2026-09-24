/* Income persistence and guest-local income storage. */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const GUEST_INCOMES_KEY = 'lifehub_guest_incomes';

export const normalizeIncome = (item) => ({
  id: item.id || crypto.randomUUID(),
  name: String(item.name ?? '').trim(),
  type: item.type || 'Other',
  amount: Number(item.amount ?? 0),
  date: item.date || new Date().toISOString().slice(0, 10),
  createdAt: item.createdAt || new Date().toISOString(),
});

export const getGuestIncomes = () => {
  try {
    const raw = localStorage.getItem(GUEST_INCOMES_KEY) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeIncome) : [];
  } catch (error) {
    console.error('Failed to load guest incomes:', error);
    return [];
  }
};

export const setGuestIncomes = (items) => {
  localStorage.setItem(GUEST_INCOMES_KEY, JSON.stringify(items));
};

export const getIncomesForUser = async (uid) => {
  const incomesRef = collection(db, 'users', uid, 'incomes');
  const snapshot = await getDocs(incomesRef);
  return snapshot.docs.map((docSnap) => ({
    firestoreId: docSnap.id,
    ...normalizeIncome(docSnap.data()),
  }));
};

export const createIncome = async (uid, income) => {
  const normalized = normalizeIncome(income);
  const incomesRef = collection(db, 'users', uid, 'incomes');
  const docRef = await addDoc(incomesRef, normalized);
  return { firestoreId: docRef.id, ...normalized };
};

export const updateIncome = async (uid, income) => {
  const normalized = normalizeIncome(income);
  const ref = doc(db, 'users', uid, 'incomes', income.firestoreId || income.id);
  await updateDoc(ref, {
    ...normalized,
    id: normalized.id,
  });
  return normalized;
};

export const deleteIncome = async (uid, income) => {
  const id = income.firestoreId || income.id;
  if (!id) return;
  const ref = doc(db, 'users', uid, 'incomes', id);
  await deleteDoc(ref);
};

export const saveGuestIncome = (income) => {
  const list = getGuestIncomes();
  const index = list.findIndex((item) => item.id === income.id || item.firestoreId === income.firestoreId);

  if (index >= 0) {
    list[index] = normalizeIncome(income);
  } else {
    list.push(normalizeIncome(income));
  }

  setGuestIncomes(list);
  return list;
};

export const removeGuestIncome = (incomeId) => {
  const list = getGuestIncomes().filter((item) => item.id !== incomeId);
  setGuestIncomes(list);
  return list;
};
