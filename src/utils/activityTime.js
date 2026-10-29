import { parseMomentDate } from './momentDates.js';

// Capture the browser’s local clock once when starting a new entry draft.
export const currentEntryTime = (now = new Date()) => `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

// Explicit local wall-clock time, never inferred from creation/completion metadata.
export const normalizeActivityTime = (value) => {
  if (typeof value !== 'string') return '';
  const match = /^(\d{1,2}):(\d{2})(?::([0-5]\d))?$/.exec(value.trim());
  return match && Number(match[1]) < 24 && Number(match[2]) < 60
    ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
};
export const activityTime = (activity = {}) => Object.prototype.hasOwnProperty.call(activity, 'time')
  ? normalizeActivityTime(activity.time)
  : normalizeActivityTime(activity.dueTime) || normalizeActivityTime(activity.startTime);
export const compareActivityTimes = (a, b, direction = 'asc') => {
  const first = activityTime(a), second = activityTime(b);
  if (!first || !second) return first ? -1 : second ? 1 : 0;
  return first.localeCompare(second) * (direction === 'desc' ? -1 : 1);
};
export const compareActivityDateTime = (a, b, direction = 'asc') => {
  const day = (value) => { try { const date = parseMomentDate(value); return date ? date.setHours(0, 0, 0, 0) : null; } catch { return null; } };
  const first = day(a.date), second = day(b.date);
  if (first === null || second === null) return first !== null ? -1 : second !== null ? 1 : 0;
  return (first - second) * (direction === 'desc' ? -1 : 1) || compareActivityTimes(a, b, direction);
};

export const activityTimePatch = (activity, value) => !Object.prototype.hasOwnProperty.call(activity, 'time')
  && !Object.prototype.hasOwnProperty.call(activity, 'dueTime') && !Object.prototype.hasOwnProperty.call(activity, 'startTime') && !value
  ? {} : { time: normalizeActivityTime(value) };
