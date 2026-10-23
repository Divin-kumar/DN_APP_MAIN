import { DN_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX } from '../utils/storageMigration';
/*
  Migrates guest-local records into the signed-in user's Firestore account.

  This is useful when a guest user decides to log in later:
  their saved events, expenses, and incomes are merged into the real account so nothing is lost.
*/
import { collection, doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getGuestExpenses } from './expenseService';
import { getGuestIncomes } from './incomeService';
import { getGuestEvents } from './eventService';
import { exportAttachmentFiles, restoreAttachmentFiles } from './attachmentService';

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
  const guestRecordKeys = [GUEST_EXPENSES_KEY, GUEST_INCOMES_KEY, GUEST_EVENTS_KEY];
  const readGuestSnapshot = () => JSON.stringify(guestRecordKeys.flatMap((key) => [
    localStorage.getItem(key), localStorage.getItem(LEGACY_STORAGE_PREFIX + key.slice(DN_STORAGE_PREFIX.length)),
  ]));
  const guestSnapshot = readGuestSnapshot();
  const assertMergeScope = () => {
    if (auth.currentUser?.uid !== uid) throw new Error('The signed-in account changed before guest data could be merged. Guest records were kept.');
    if (readGuestSnapshot() !== guestSnapshot) {
      throw new Error('Guest records changed during sign-in. They were kept so the merge can be retried.');
    }
  };
  assertMergeScope();
  // Upload each original once before committing references to the account. A
  // missing original or failed upload leaves every guest record/file intact.
  const files = await exportAttachmentFiles(events, { isGuest: true, assertCurrent: assertMergeScope });
  assertMergeScope();
  const accountEvents = await restoreAttachmentFiles(events, files, { uid, isGuest: false, assertCurrent: assertMergeScope });
  assertMergeScope();
  const batch = writeBatch(db);

  expenses.forEach((expense) => {
    const ref = doc(collection(db, 'users', uid, 'expenses'));
    batch.set(ref, removeFirestoreOnlyFields(expense));
  });

  incomes.forEach((income) => {
    const ref = doc(collection(db, 'users', uid, 'incomes'));
    batch.set(ref, removeFirestoreOnlyFields(income));
  });

  accountEvents.forEach((event) => {
    const ref = doc(collection(db, 'users', uid, 'eventGroups'));
    batch.set(ref, removeFirestoreOnlyFields(event));
  });

  if (expenses.length || incomes.length || events.length) {
    assertMergeScope();
    await batch.commit();
  }
  assertMergeScope();

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
