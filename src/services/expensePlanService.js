import { collection, doc, getDocsFromServer, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { requireActiveSampleData, saveActiveSampleData } from '../dev/sampleData';
import {
  advanceExpensePlan, assertCurrentExpensePlan, EXPENSE_PLAN_COLLECTION, expensePlanFromDraft, firstUnpaidExpensePlan,
  GUEST_EXPENSE_PLANS_KEY, normalizeExpensePlan, normalizeExpensePlans, plannedExpenseId,
} from '../utils/expensePlans.js';
import { normalizeFinancialRecord } from '../utils/financialRecords.js';
import { activityOwnsLinkedId } from '../utils/activityEntries.js';
import { reconcileExpenseActivities, requireLinkedActivity, sameRecord, upsertRecord } from '../utils/transactionRelations.js';
import { getGuestEvents, normalizeEvent, setGuestEvents } from './eventService';
import { getGuestExpenseMasters, setGuestExpenses } from './expenseService';

const localChange = 'dn:expense-plans-changed';
const plansRef = (uid) => collection(db, 'users', uid, EXPENSE_PLAN_COLLECTION);
const readPlan = (snapshot) => normalizeExpensePlan({ ...snapshot.data(), id: snapshot.id });
const assertOwner = (uid, assertCurrent) => {
  assertCurrent();
  if (!uid || uid.includes('/') || auth.currentUser?.uid !== uid) {
    throw new Error('Your account changed. Reopen the expense plan and try again.');
  }
};

export const readGuestExpensePlans = (storage = localStorage) =>
  normalizeExpensePlans(JSON.parse(storage.getItem(GUEST_EXPENSE_PLANS_KEY) ?? '[]'));

const writeGuestExpensePlans = (items, storage = localStorage) => {
  storage.setItem(GUEST_EXPENSE_PLANS_KEY, JSON.stringify(normalizeExpensePlans(items)));
  notifyLocalChange();
};
const notifyLocalChange = () => globalThis.window?.dispatchEvent?.(new Event(localChange));

export const mergeGuestExpensePlans = (plans, assertCurrent, recordedExpenses) => withGuestPlanLock(() => {
  assertCurrent();
  const current = readGuestExpensePlans();
  const ids = new Set(current.map((plan) => plan.id));
  const added = normalizeExpensePlans(plans).filter((plan) => !ids.has(plan.id))
    .map((plan) => firstUnpaidExpensePlan(plan, recordedExpenses));
  if (added.length) writeGuestExpensePlans([...current, ...added]);
  return { added: added.length, conflicts: plans.length - added.length };
});

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

export function watchExpensePlans(context, assertCurrent, receive, fail) {
  const deliver = (read) => {
    try { assertCurrent(); receive(read()); }
    catch (error) { fail(error); }
  };
  if (context.uid) {
    assertOwner(context.uid, assertCurrent);
    return onSnapshot(plansRef(context.uid), (snapshot) => deliver(() => snapshot.docs.map(readPlan)), fail);
  }
  const load = () => deliver(() => {
    if (!context.sample) return readGuestExpensePlans();
    return normalizeExpensePlans(requireActiveSampleData(null).expensePlans ?? []);
  });
  const onStorage = (event) => {
    if (event.key === GUEST_EXPENSE_PLANS_KEY || event.key === null) load();
  };
  window.addEventListener(localChange, load);
  window.addEventListener('storage', onStorage);
  load();
  return () => {
    window.removeEventListener(localChange, load);
    window.removeEventListener('storage', onStorage);
  };
}

// Guest plans and masters occupy separate localStorage keys. Serialize across
// tabs when available and use the same receipt ID if a write must be retried.
const withGuestPlanLock = (work) => globalThis.navigator?.locks
  ? globalThis.navigator.locks.request('dn-expense-plans', work) : work();

function writeLocalPlan(context, expected, action, assertCurrent) {
  return withGuestPlanLock(() => {
    assertCurrent();
    const sample = context.sample ? requireActiveSampleData(null) : null;
    const plans = sample ? normalizeExpensePlans(sample.expensePlans ?? []) : readGuestExpensePlans();
    const current = expected && plans.find((plan) => plan.id === expected.id);
    if (expected) assertCurrentExpensePlan(current, expected);
    const result = action(current, sample, assertCurrent);
    const items = result.plan ? upsertRecord(plans, result.plan) : plans.filter((plan) => plan.id !== current.id);
    assertCurrent();
    if (sample) {
      saveActiveSampleData({ ...sample, ...result.sampleChanges, expensePlans: items });
      notifyLocalChange();
    } else writeGuestExpensePlans(items);
    return result;
  });
}

function writeAccountPlan(uid, id, expected, action, assertCurrent) {
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

function changeExpensePlan(context, expected, id, action, assertCurrent) {
  return context.uid
    ? writeAccountPlan(context.uid, id, expected, action, assertCurrent)
    : writeLocalPlan(context, expected, action, assertCurrent);
}

export const saveExpensePlan = (context, form, expected, assertCurrent) => {
  const id = expected?.id || crypto.randomUUID();
  const now = new Date();
  return changeExpensePlan(context, expected, id, (current) => ({
    plan: expensePlanFromDraft(form, current, now, id),
  }), assertCurrent);
};

export const changeExpensePlanDate = (context, expected, action, assertCurrent) => {
  if (!['skip', 'end'].includes(action)) throw new Error('Choose how to update the expense plan.');
  return changeExpensePlan(context, expected, expected.id, (plan) => ({
    plan: action === 'end' ? null : advanceExpensePlan(plan),
  }), assertCurrent);
};

function paymentFor(plan, payload, now) {
  return normalizeFinancialRecord({
    ...payload, id: plannedExpenseId(plan), source: 'recurring-plan', createdAt: now.toISOString(),
  });
}

function paymentMoment(events, expense) {
  requireLinkedActivity(events, expense);
  return reconcileExpenseActivities(events, null, { ...expense, transactionKind: 'expense' })[0];
}

function localPayment(plan, payload, now, sample, assertCurrent) {
  const payment = paymentFor(plan, payload, now);
  const next = advanceExpensePlan(plan, now);
  const expenses = sample?.expenses ?? getGuestExpenseMasters();
  const existing = expenses.find((item) => sameRecord(item, payment));
  // A failed plan write can leave a real payment behind. Keep its saved values
  // when retrying, then catch the schedule up to the committed receipt.
  const expense = existing ? normalizeFinancialRecord(existing) : payment;
  const events = sample?.events ?? (expense.eventId ? getGuestEvents() : []);
  const parent = events.find((item) => item.id === expense.eventId);
  const canMirror = parent?.activities?.some((activity) => activityOwnsLinkedId(activity, expense.activityId));
  const moment = existing && !canMirror ? undefined : paymentMoment(events, expense);
  const nextEvents = moment ? events.map((item) => item.id === moment.id ? moment : item) : events;
  const nextExpenses = existing ? expenses : [expense, ...expenses];
  if (sample) return { plan: next, expense, moment, sampleChanges: { expenses: nextExpenses, events: nextEvents,
    activities: nextEvents.flatMap((event) => event.activities || []) } };
  assertCurrent();
  if (!existing) setGuestExpenses(nextExpenses);
  if (moment) setGuestEvents(nextEvents);
  return { plan: next, expense, moment };
}

async function accountPayment(uid, plan, payload, now, selectedMoment, transaction, assertCurrent) {
  const payment = paymentFor(plan, payload, now);
  const next = advanceExpensePlan(plan, now);
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
    moment = paymentMoment(events, payment);
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

export function recordExpensePlanPayment(context, expected, payload, selectedMoment, assertCurrent) {
  const now = new Date();
  return changeExpensePlan(context, expected, expected.id, (current, transport) => context.uid
    ? accountPayment(context.uid, current, payload, now, selectedMoment, transport, assertCurrent)
    : localPayment(current, payload, now, transport, assertCurrent), assertCurrent);
}
