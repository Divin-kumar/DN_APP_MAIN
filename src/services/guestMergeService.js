/* Migrates guest-local records into the signed-in user's Firestore account. */
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getGuestExpenses } from './expenseService';
import { getGuestIncomes } from './incomeService';
import { getGuestEvents } from './eventService';

const GUEST_MODE_KEY = 'lifehub_guest_mode';
const GUEST_EXPENSES_KEY = 'lifehub_guest_expenses';
const GUEST_INCOMES_KEY = 'lifehub_guest_incomes';
const GUEST_EVENTS_KEY = 'lifehub_guest_eventGroups';

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

  localStorage.removeItem(GUEST_MODE_KEY);
  localStorage.removeItem(GUEST_EXPENSES_KEY);
  localStorage.removeItem(GUEST_INCOMES_KEY);
  localStorage.removeItem(GUEST_EVENTS_KEY);

  return {
    expenses: expenses.length,
    incomes: incomes.length,
    events: events.length,
  };
};
