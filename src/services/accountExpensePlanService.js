import { collection, doc, getDocsFromServer, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import {
  advanceExpensePlan, assertCurrentExpensePlan, EXPENSE_PLAN_COLLECTION, firstUnpaidExpensePlan,
  normalizeExpensePlan, normalizeExpensePlans, plannedExpenseId,
} from '../utils/expensePlans.js';
import { reconcileExpenseActivities, requireLinkedActivity } from '../utils/transactionRelations.js';
import { normalizeEvent } from './guestEventService';

const plansRef = (uid) => collection(db, 'users', uid, EXPENSE_PLAN_COLLECTION);
const readPlan = (snapshot) => normalizeExpensePlan({ ...snapshot.data(), id: snapshot.id });
const assertOwner = (uid, assertCurrent) => {
  assertCurrent();
  if (!uid || uid.includes('/') || auth.currentUser?.uid !== uid) {
    throw new Error('Your account changed. Reopen the expense plan and try again.');
  }
};

export const listAccountExpensePlans = async (uid, assertCurrent) => {
  assertOwner(uid, assertCurrent);
  const result = await getDocsFromServer(plansRef(uid));
  assertOwner(uid, assertCurrent);
  return result.docs.map(readPlan);
};

export const mergeAccountExpensePlans = async (uid, plans, assertCurrent, recordedExpenses) => {
  let added = 0;
  for (const entry of normalizeExpensePlans(plans)) {
    const plan = firstUnpaidExpensePlan(entry, recordedExpenses);
    const created = await runTransaction(db, async (transaction) => {
      assertOwner(uid, assertCurrent);
      const ref = doc(plansRef(uid), plan.id);
      const saved = await transaction.get(ref);
      assertOwner(uid, assertCurrent);
      if (saved.exists()) return false;
      let next = plan;
      while ((await transaction.get(doc(collection(db, 'users', uid, 'expenses'), plannedExpenseId(next)))).exists()) {
        assertOwner(uid, assertCurrent);
        next = advanceExpensePlan(next);
      }
      assertOwner(uid, assertCurrent);
      transaction.set(ref, next);
      return true;
    });
    assertOwner(uid, assertCurrent);
    if (created) added++;
  }
  return { added, conflicts: plans.length - added };
};

export function watchAccountExpensePlans(uid, assertCurrent, receive, fail) {
  assertOwner(uid, assertCurrent);
  return onSnapshot(plansRef(uid), (snapshot) => {
    try { assertOwner(uid, assertCurrent); receive(snapshot.docs.map(readPlan)); }
    catch (error) { fail(error); }
  }, fail);
}

export function writeAccountPlan(uid, id, expected, action, assertCurrent) {
  assertOwner(uid, assertCurrent);
  return runTransaction(db, async (transaction) => {
    assertOwner(uid, assertCurrent);
    const ref = doc(plansRef(uid), id);
    const snapshot = await transaction.get(ref);
    assertOwner(uid, assertCurrent);
    const current = snapshot.exists() ? readPlan(snapshot) : null;
    if (expected) assertCurrentExpensePlan(current, expected);
    else if (current) throw new Error('This expense plan already exists.');
    const result = await action(current, transaction);
    assertOwner(uid, assertCurrent);
    if (result.plan) transaction.set(ref, result.plan);
    else transaction.delete(ref);
    return result;
  });
}

export async function recordAccountPayment(uid, payment, next, selectedMoment, transaction, assertCurrent) {
  const paymentRef = doc(collection(db, 'users', uid, 'expenses'), payment.id);
  const existing = await transaction.get(paymentRef);
  if (existing.exists()) {
    assertOwner(uid, assertCurrent);
    throw new Error('This scheduled date already has a recorded payment. Skip to the next date or edit the plan.');
  }
  let moment;
  if (payment.eventId) {
    const source = selectedMoment?.firestoreCollection === 'events' ? 'events' : 'eventGroups';
    const momentRef = doc(collection(db, 'users', uid, source), selectedMoment?.firestoreId || payment.eventId);
    const snapshot = await transaction.get(momentRef);
    const data = snapshot.exists() ? snapshot.data() : null;
    const events = data ? [normalizeEvent({ ...data, id: data.id || snapshot.id,
      firestoreId: snapshot.id, firestoreCollection: source })] : [];
    requireLinkedActivity(events, payment);
    moment = reconcileExpenseActivities(events, null, { ...payment, transactionKind: 'expense' })[0];
    assertOwner(uid, assertCurrent);
    if (moment) {
      const sourceActivities = data.activities;
      transaction.update(momentRef, { activities: sourceActivities.map((activity, index) => {
        const previous = events[0].activities[index];
        const updated = moment.activities[index];
        return previous === updated ? activity : { ...activity, expenses: updated.expenses };
      }) });
    }
  }
  assertOwner(uid, assertCurrent);
  transaction.set(paymentRef, payment);
  return { plan: next, expense: { ...payment, firestoreId: payment.id, firestoreCollection: 'expenses' }, moment };
}
