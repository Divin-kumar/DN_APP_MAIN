import { formatMomentDate, getNextOccurrenceDate, parseMomentDate } from './momentDates.js';

export const REPEAT_OPTIONS = Object.freeze({
  weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
});

export const isRepeatFrequency = (value) => Object.hasOwn(REPEAT_OPTIONS, value);

export const isScheduleDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value) && Boolean(parseMomentDate(value));

export function normalizeRepeatSchedule(rule) {
  if (!isRepeatFrequency(rule?.frequency) || !isScheduleDate(rule.anchorDate)) {
    throw new Error('Choose a repeat frequency and a valid first date.');
  }
  return { frequency: rule.frequency, anchorDate: rule.anchorDate };
}

// Move exactly one slot, even when the current occurrence is overdue.
// Monthly and yearly schedules retain the original day after a short month.
export function nextScheduledDate(rule, dueDate) {
  const { frequency, anchorDate } = normalizeRepeatSchedule(rule);
  if (!isScheduleDate(dueDate) || dueDate < anchorDate) throw new Error('The scheduled date is invalid.');
  const date = parseMomentDate(dueDate);
  date.setDate(date.getDate() + (frequency === 'weekly' ? 7 : 1));
  const next = formatMomentDate(frequency === 'weekly' ? date
    : getNextOccurrenceDate({ date: anchorDate, recurrence: frequency }, date));
  if (!isScheduleDate(next)) throw new Error('The repeat schedule exceeds the supported date range.');
  return next;
}

export function scheduleTimestamp(previous, now = new Date()) {
  return new Date(Math.max(now.getTime(), (Date.parse(previous) || 0) + 1)).toISOString();
}
