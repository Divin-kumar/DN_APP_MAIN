import { DN_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX } from '../utils/storageMigration';
/*
  Migrates guest-local records into the signed-in user's Firestore account.

  This is useful when a guest user decides to log in later:
  their saved events, expenses, and incomes are merged into the real account so nothing is lost.
*/
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getGuestExpenses } from './expenseService';
import { getGuestIncomes } from './incomeService';
import { getGuestEvents } from './eventService';

const GUEST_MODE_KEY = 'dn_guest_mode';
const GUEST_EXPENSES_KEY = 'dn_guest_expenses';
const GUEST_INCOMES_KEY = 'dn_guest_incomes';
const GUEST_EVENTS_KEY = 'dn_guest_eventGroups';

const removeFirestoreOnlyFields = ({ firestoreId, ...item }) => item;

export const mergeGuestDataIntoAccount = async (uid) => {
  if (!uid) return { expenses: 0, incomes: 0, events: 0 };

  const expenses = getGuestExpenses();
  const incomes = getGuestIncomes();
  const events = getGuestEvents();
  const batch = writeBatch(db);

  expenses.forEach((expense) => {
    const ref = doc(collection(db, 'users', uid, 'expenses'));
    batch.set(ref, removeFirestoreOnlyFields(expense));
  });

  incomes.forEach((income) => {
    const ref = doc(collection(db, 'users', uid, 'incomes'));
    batch.set(ref, removeFirestoreOnlyFields(income));
  });

  events.forEach((event) => {
    const ref = doc(collection(db, 'users', uid, 'eventGroups'));
    batch.set(ref, removeFirestoreOnlyFields(event));
  });

  if (expenses.length || incomes.length || events.length) {
    await batch.commit();
  }

  // Clear both naming generations after the batch commits. Otherwise a later
  // startup migration could resurrect old guest records and reimport duplicates.
  [GUEST_MODE_KEY, GUEST_EXPENSES_KEY, GUEST_INCOMES_KEY, GUEST_EVENTS_KEY].forEach((key) => {
    localStorage.removeItem(key);
    localStorage.removeItem(LEGACY_STORAGE_PREFIX + key.slice(DN_STORAGE_PREFIX.length));
  });

  return {
    expenses: expenses.length,
    incomes: incomes.length,
    events: events.length,
  };
};
