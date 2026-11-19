import { requireActiveSampleData, saveActiveSampleData } from '../dev/sampleData';
import {
  advanceExpensePlan, assertCurrentExpensePlan, expensePlanFromDraft, firstUnpaidExpensePlan,
  GUEST_EXPENSE_PLANS_KEY, normalizeExpensePlans, plannedExpenseId,
} from '../utils/expensePlans.js';
import { normalizeFinancialRecord } from '../utils/financialRecords.js';
import { activityOwnsLinkedId } from '../utils/activityEntries.js';
import { reconcileExpenseActivities, requireLinkedActivity, sameRecord, upsertRecord } from '../utils/transactionRelations.js';
import { getGuestEvents, setGuestEvents } from './guestEventService';
import { getGuestExpenseMasters, setGuestExpenses } from './guestExpenseService';
import { deferSubscription } from '../utils/deferSubscription';

const loadAccountExpensePlanService = () => import('./accountExpensePlanService');

const localChange = 'dn:expense-plans-changed';
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

export const listAccountExpensePlans = async (...args) => {
  const { listAccountExpensePlans: list } = await loadAccountExpensePlanService();
  return list(...args);
};
export const mergeAccountExpensePlans = async (...args) => {
  const { mergeAccountExpensePlans: merge } = await loadAccountExpensePlanService();
  return merge(...args);
};

export function watchExpensePlans(context, assertCurrent, receive, fail) {
  const deliver = (read) => {
    try { assertCurrent(); receive(read()); }
    catch (error) { fail(error); }
  };
  if (context.uid) {
    return deferSubscription(loadAccountExpensePlanService, ({ watchAccountExpensePlans }) => (
      watchAccountExpensePlans(context.uid, assertCurrent, receive, fail)
    ), fail);
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

function changeExpensePlan(context, expected, id, action, assertCurrent) {
  return context.uid
    ? loadAccountExpensePlanService().then(({ writeAccountPlan }) => writeAccountPlan(context.uid, id, expected, action, assertCurrent))
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

export function recordExpensePlanPayment(context, expected, payload, selectedMoment, assertCurrent) {
  const now = new Date();
  if (context.uid) {
    return loadAccountExpensePlanService().then(({ writeAccountPlan, recordAccountPayment }) => (
      writeAccountPlan(context.uid, expected.id, expected, (current, transaction) => (
        recordAccountPayment(context.uid, paymentFor(current, payload, now), advanceExpensePlan(current, now),
          selectedMoment, transaction, assertCurrent)
      ), assertCurrent)
    ));
  }
  return writeLocalPlan(context, expected, (current, sample) => (
    localPayment(current, payload, now, sample, assertCurrent)
  ), assertCurrent);
}
