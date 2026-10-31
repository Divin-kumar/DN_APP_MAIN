// Moment dates represent local calendar days. Firestore and old backups may
// supply timestamps instead of the date-input string used by current forms.
export const parseMomentDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  } else if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value === 'object' && (Number.isFinite(value.seconds) || Number.isFinite(value._seconds))) {
    date = new Date((value.seconds ?? value._seconds) * 1000);
  } else {
    date = new Date(value);
  }
  return date instanceof Date && Number.isFinite(date.getTime()) ? new Date(date) : null;
};

export const formatMomentDate = (date) => date
  ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  : '';

export const getEventDate = (event = {}) => {
  if (!event || typeof event !== 'object') return null;
  for (const value of [event.date, event.startDate, event.createdAt]) {
    const date = parseMomentDate(value);
    if (date) return date;
  }
  return null;
};

export const getStartOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const isRecurringEvent = (event = {}) => Boolean(
  event.isRecurring === true
  || (event.recurrence && String(event.recurrence).trim().toLowerCase() !== 'none')
);

export const getNextOccurrenceDate = (event, referenceDate = new Date()) => {
  const original = getEventDate(event);
  if (!original) return null;
  const baseDate = getStartOfDay(original);
  const today = getStartOfDay(referenceDate);
  // A recurring Moment must not appear before its original start date.
  if (!isRecurringEvent(event) || baseDate >= today) return baseDate;

  const recurrence = String(event.recurrence || 'yearly').trim().toLowerCase();
  // JS date constructors overflow February 29/30/31 and leap-day birthdays
  // into a different month. Keep the original day as the recurrence anchor,
  // but cap each occurrence to the target month's final calendar day.
  const occurrenceIn = (year, month) => new Date(year, month,
    Math.min(baseDate.getDate(), new Date(year, month + 1, 0).getDate()));
  if (recurrence === 'monthly') {
    const candidate = occurrenceIn(today.getFullYear(), today.getMonth());
    return candidate >= today ? candidate : occurrenceIn(today.getFullYear(), today.getMonth() + 1);
  }
  const candidate = occurrenceIn(today.getFullYear(), baseDate.getMonth());
  return candidate >= today ? candidate : occurrenceIn(today.getFullYear() + 1, baseDate.getMonth());
};

export const getCalendarDaysRemaining = (date, referenceDate = new Date()) => {
  if (!date) return null;
  const dayNumber = (value) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
  return Math.max(dayNumber(date) - dayNumber(referenceDate), 0);
};

export const getNextBirthdayAge = (value, referenceDate = new Date()) => {
  const birthday = parseMomentDate(value);
  if (!birthday) return null;
  const next = getNextOccurrenceDate({ date: value, recurrence: 'yearly' }, referenceDate);
  return Math.max(0, next.getFullYear() - birthday.getFullYear());
};
