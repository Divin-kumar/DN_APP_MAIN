/*
  Income persistence and guest-local income storage.

  This service is responsible for reading and saving income records, whether the user is signed in or browsing in guest mode.
*/
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
import { normalizeFinancialRecord } from '../utils/financialRecords.js';

const GUEST_INCOMES_KEY = 'dn_guest_incomes';

export const normalizeIncome = (item, fallbackId = '') => normalizeFinancialRecord(item, 'income', fallbackId);

export const getGuestIncomes = () => {
  try {
    const raw = localStorage.getItem(GUEST_INCOMES_KEY) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => normalizeIncome(item)) : [];
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
    ...normalizeIncome(docSnap.data(), docSnap.id),
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
  const next = upsertRecord(getGuestIncomes(), normalizeIncome(income));
  setGuestIncomes(next);
  return next;
};

export const removeGuestIncome = (incomeId) => {
  const list = getGuestIncomes().filter((item) => item.id !== incomeId);
  setGuestIncomes(list);
  return list;
};
