/*
  Income persistence and guest-local income storage.

  This service is responsible for reading and saving income records, whether the user is signed in or browsing in guest mode.
*/
import {
  addDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { deleteAccountFinancialRecord, getAccountTransactions, updateAccountFinancialRecord } from './accountTransactionService';

import { mergeFinancialRecords } from '../utils/financialRecords.js';
import { normalizeIncome } from './guestIncomeService';

export { getGuestIncomes, normalizeIncome, removeGuestIncome, saveGuestIncome, setGuestIncomes } from './guestIncomeService';

export const getIncomesForUser = async (uid) => {
  const incomesRef = collection(db, 'users', uid, 'incomes');
  const [snapshot, unifiedIncomes] = await Promise.all([
    getDocs(incomesRef), getAccountTransactions(uid, 'income', normalizeIncome),
  ]);
  const typedIncomes = snapshot.docs.map((docSnap) => ({
    firestoreId: docSnap.id,
    firestoreCollection: 'incomes',
    ...normalizeIncome({ ...docSnap.data(), firestoreId: docSnap.id }, docSnap.id),
  }));
  return mergeFinancialRecords([...typedIncomes, ...unifiedIncomes], 'income');
};

export const createIncome = async (uid, income) => {
  const normalized = normalizeIncome(income);
  const incomesRef = collection(db, 'users', uid, 'incomes');
  const docRef = await addDoc(incomesRef, normalized);
  return { firestoreId: docRef.id, firestoreCollection: 'incomes', ...normalized };
};

export const updateIncome = async (uid, income) => {
  const normalized = normalizeIncome(income);
  return updateAccountFinancialRecord(uid, 'income', income, normalized);
};

export const deleteIncome = async (uid, income) => {
  return deleteAccountFinancialRecord(uid, 'income', income);
};
