import { parseMomentDate } from './momentDates.js';
import { getEventStatus } from './eventStatus.js';

export const MOMENT_SORT_OPTIONS = Object.freeze([
  { value: 'date', label: 'Event date' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
]);
export const TRANSACTION_SORT_OPTIONS = Object.freeze([
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'title', label: 'Title' },
]);
export const TRANSACTION_SORT_VALUES = Object.freeze(TRANSACTION_SORT_OPTIONS.flatMap(({ value }) => [`${value}-asc`, `${value}-desc`]));
export const transactionSortForField = (field) => `${field}-${field === 'title' ? 'asc' : 'desc'}`;

const momentStatusRank = { 'in-progress': 0, completed: 1, cancelled: 2, archived: 3 };
const recordedDate = (value) => {
  try { return parseMomentDate(value)?.getTime() ?? null; } catch { return null; }
};

// Sort only a copy of the visible cohort. Equal values retain their input order;
// missing recorded dates remain last in either direction, without date fallbacks.
export const sortMoments = (moments, field = 'date', direction = 'asc') => {
  const sign = direction === 'desc' ? -1 : 1;
  return [...moments].sort((first, second) => {
    if (field === 'name') return sign * String(first.name || '').localeCompare(String(second.name || ''), undefined, { sensitivity: 'base' });
    if (field === 'status') return sign * (momentStatusRank[getEventStatus(first)] - momentStatusRank[getEventStatus(second)]);
    const firstDate = recordedDate(first.date);
    const secondDate = recordedDate(second.date);
    if (firstDate === null || secondDate === null) return firstDate === null ? (secondDate === null ? 0 : 1) : -1;
    return sign * (firstDate - secondDate);
  });
};

export const momentSortSummary = (field = 'date', direction = 'asc') => {
  const descending = direction === 'desc';
  if (field === 'name') return `Name · ${descending ? 'Z to A' : 'A to Z'}`;
  if (field === 'status') return `Status · ${descending ? 'Archived first' : 'In progress first'}`;
  return `Event date · ${descending ? 'Newest to oldest' : 'Oldest to newest'}`;
};

export const transactionSortSummary = (sort = 'date-desc') => {
  const [field, direction] = sort.split('-');
  const descending = direction === 'desc';
  if (field === 'title') return `Title · ${descending ? 'Z to A' : 'A to Z'}`;
  if (field === 'amount') return `Amount · ${descending ? 'Highest first' : 'Lowest first'}`;
  return `Date · ${descending ? 'Newest first' : 'Oldest first'}`;
};
