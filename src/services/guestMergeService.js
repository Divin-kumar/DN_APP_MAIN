import { mergeAccountTasks } from './accountTaskService';
import { normalizeIndependentTask } from '../utils/independentTasks.js';
import { GUEST_EXPENSE_PLANS_KEY, isPlannedExpenseId } from '../utils/expensePlans.js';
import { DN_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX } from '../utils/storageMigration';
/*
  Migrates guest-local records into the signed-in user's Firestore account.

  This is useful when a guest user decides to log in later:
  their saved events, expenses, and incomes are merged into the real account so nothing is lost.
*/
import { collection, doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { createExpense, getGuestExpenses } from './expenseService';
import { getGuestIncomes } from './incomeService';
import { getGuestEvents } from './eventService';
import { exportAttachmentFiles, restoreAttachmentFiles } from './attachmentService';
import { mergeAccountExpensePlans, readGuestExpensePlans } from './expensePlanService';

const GUEST_MODE_KEY = 'dn_guest_mode';
const GUEST_EXPENSES_KEY = 'dn_guest_expenses';
const GUEST_INCOMES_KEY = 'dn_guest_incomes';
const GUEST_EVENTS_KEY = 'dn_guest_eventGroups';

const removeFirestoreOnlyFields = ({ firestoreId, ...item }) => item;

export const mergeGuestDataIntoAccount = async (uid) => {
  if (!uid) return { expenses: 0, incomes: 0, events: 0, tasksRetainedLocally: 0 };

  const expenses = getGuestExpenses();
  const incomes = getGuestIncomes();
  const events = getGuestEvents();
  const guestTaskRaw = localStorage.getItem('dn_guest_tasks');
  const guestPlansRaw = localStorage.getItem(GUEST_EXPENSE_PLANS_KEY);
  let expensePlans = [];
  let expensePlansRetainedLocally = false;
  if (guestPlansRaw) {
    try { expensePlans = readGuestExpensePlans(); }
    catch { expensePlansRetainedLocally = true; }
  }
  let tasksRetainedLocally = 0;
  let tasks = [];
  if (guestTaskRaw) {
    try {
      const guestTasks = JSON.parse(guestTaskRaw);
      if (!Array.isArray(guestTasks)) throw new Error('Invalid Guest Tasks');
      tasks = guestTasks.map((item) => normalizeIndependentTask(item));
    } catch {
      // Corrupted Guest Tasks stay on disk for manual recovery, never deleted.
      tasksRetainedLocally = 1;
    }
  }
  // Concurrent Guest changes must not be hidden by account transfer.
  const guestRecordKeys = [GUEST_EXPENSES_KEY, GUEST_INCOMES_KEY, GUEST_EVENTS_KEY, 'dn_guest_tasks', GUEST_EXPENSE_PLANS_KEY];
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
  // Copy originals into this browser's account scope before committing metadata.
  // A missing original or failed local save keeps all Guest records/files intact.
  const files = await exportAttachmentFiles(events, { isGuest: true, assertCurrent: assertMergeScope });
  assertMergeScope();
  const accountEvents = await restoreAttachmentFiles(events, files, { uid, isGuest: false, assertCurrent: assertMergeScope });
  assertMergeScope();
  const batch = writeBatch(db);

  const recordedPayments = expenses.filter((expense) => isPlannedExpenseId(expense.id));
  expenses.filter((expense) => !isPlannedExpenseId(expense.id)).forEach((expense) => {
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
  for (const expense of recordedPayments) {
    await createExpense(uid, expense, assertMergeScope);
  }
  assertMergeScope();

  // Preserve IDs and destination edits. On failure retain local Tasks for retry.
  let taskMerge = { added: 0 };
  try {
    taskMerge = await mergeAccountTasks(uid, tasks, assertMergeScope);
  } catch (error) {
    tasksRetainedLocally = tasks.length || tasksRetainedLocally;
    console.warn('Guest Tasks were retained for retry:', error);
  }
  assertMergeScope();
  if (expensePlans.length) {
    try { await mergeAccountExpensePlans(uid, expensePlans, assertMergeScope, expenses); }
    catch (error) {
      expensePlansRetainedLocally = true;
      console.warn('Guest expense plans were retained for retry:', error);
    }
  }
  assertMergeScope();
  if (!tasksRetainedLocally && guestTaskRaw) {
    localStorage.removeItem('dn_guest_tasks');
    localStorage.removeItem(LEGACY_STORAGE_PREFIX + 'guest_tasks');
  }
  if (!expensePlansRetainedLocally && guestPlansRaw) {
    localStorage.removeItem(GUEST_EXPENSE_PLANS_KEY);
    localStorage.removeItem(LEGACY_STORAGE_PREFIX + 'guest_expense_plans');
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
    tasks: taskMerge.added,
    tasksRetainedLocally,
    expensePlansRetainedLocally,
  };
};
