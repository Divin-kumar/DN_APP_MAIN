import { normalizePaymentMethod } from './paymentMethod.js';
import { isScheduleDate, nextScheduledDate, normalizeRepeatSchedule, repeatScheduleForDraft, scheduleTimestamp } from './repeatSchedule.js';

export const EXPENSE_PLAN_COLLECTION = 'expensePlans';
export const GUEST_EXPENSE_PLANS_KEY = 'dn_guest_expense_plans';

export function normalizeExpensePlan(raw) {
  const id = raw?.id;
  const name = String(raw?.name ?? '').trim();
  const category = String(raw?.category ?? '').trim();
  const amount = raw?.amount;
  const dueDate = raw?.dueDate;
  const repeat = normalizeRepeatSchedule(raw?.repeat);
  const updatedAt = raw?.updatedAt;
  if (typeof id !== 'string' || !/^[\w-]{1,100}$/.test(id)
    || !name || name.length > 140 || !category || !Number.isFinite(amount) || amount <= 0
    || !isScheduleDate(dueDate) || dueDate < repeat.anchorDate
    || typeof updatedAt !== 'string' || !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error('The expense plan needs a title, category, positive amount and valid due date.');
  }
  return { id, name, category, amount, dueDate, repeat, updatedAt,
    paymentMethod: normalizePaymentMethod(raw.paymentMethod), notes: String(raw.notes ?? '') };
}

export function normalizeExpensePlans(items) {
  if (!Array.isArray(items)) throw new Error('Expense plans could not be read.');
  const plans = items.map(normalizeExpensePlan);
  if (new Set(plans.map((plan) => plan.id)).size !== plans.length) throw new Error('Expense plans contain a duplicate ID.');
  return plans;
}

export function expensePlanFromDraft(form, previous, now, id) {
  const dueDate = form.date;
  const repeat = repeatScheduleForDraft(previous, form.repeatFrequency, dueDate);
  return normalizeExpensePlan({
    id, name: form.title, category: form.category, amount: form.amount, dueDate,
    repeat, paymentMethod: form.paymentMethod, notes: form.notes, updatedAt: scheduleTimestamp(previous?.updatedAt, now),
  });
}

export function advanceExpensePlan(plan, now = new Date()) {
  return { ...plan, dueDate: nextScheduledDate(plan.repeat, plan.dueDate), updatedAt: scheduleTimestamp(plan.updatedAt, now) };
}

export function assertCurrentExpensePlan(current, expected) {
  if (!current || current.updatedAt !== expected.updatedAt || current.dueDate !== expected.dueDate) {
    throw new Error('This expense plan changed. Close the form and reopen the plan.');
  }
}

export const plannedExpenseId = (plan) => `plan-payment-${plan.id}-${plan.dueDate}`;
export const isPlannedExpenseId = (id) => typeof id === 'string' && /^plan-payment-[\w-]{1,100}-\d{4}-\d{2}-\d{2}$/.test(id);

export function firstUnpaidExpensePlan(plan, recordedExpenses) {
  const receipts = new Set(recordedExpenses.map((expense) => expense.id));
  let next = plan;
  while (receipts.has(plannedExpenseId(next))) next = advanceExpensePlan(next);
  return next;
}
