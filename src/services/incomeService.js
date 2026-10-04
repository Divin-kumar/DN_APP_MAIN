/*
  Income persistence and guest-local income storage.

  This service is responsible for reading and saving income records, whether the user is signed in or browsing in guest mode.
*/
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

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
  void items;
  throw new Error('Guest income writes are deprecated; use incomeRepository.');
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
  void uid;
  void income;
  throw new Error('Firestore income writes are deprecated; use incomeRepository.');
};

export const updateIncome = async (uid, income) => {
  void uid;
  void income;
  throw new Error('Firestore income writes are deprecated; use incomeRepository.');
};

export const deleteIncome = async (uid, income) => {
  void uid;
  void income;
  throw new Error('Firestore income deletion is deprecated; use incomeRepository.');
};

export const saveGuestIncome = (income) => {
  void income;
  throw new Error('Guest income writes are deprecated; use incomeRepository.');
};

export const removeGuestIncome = (incomeId) => {
  void incomeId;
  throw new Error('Guest income deletion is deprecated; use incomeRepository.');
};
