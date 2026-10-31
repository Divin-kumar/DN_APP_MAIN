import { activityTime, normalizeActivityTime } from './activityTime.js';
import { formatMomentDate, parseMomentDate } from './momentDates.js';
import { recordId } from './recordIdentity.js';
import { resolveMomentStoryPresentation } from './momentStory.js';

// The three permitted creation behaviours follow the existing, configurable
// Story presentation. No unconfigured fourth behaviour or silent merge path.
export const ENTRY_MODES = Object.freeze({ DAILY: 'diary', JOURNAL: 'journey', TASKS: 'chronicle' });
export const ENTRY_MODE_LABELS = Object.freeze([
  { value: ENTRY_MODES.DAILY, label: 'Daily · One Activity per day' },
  { value: ENTRY_MODES.JOURNAL, label: 'Journal · New or append' },
  { value: ENTRY_MODES.TASKS, label: 'Tasks · Independent Activities' },
]);
export const getMomentEntryMode = (moment, momentTypes = []) =>
  resolveMomentStoryPresentation(moment, momentTypes);

const dateKey = (date) => {
  try { return formatMomentDate(parseMomentDate(date)); } catch { return ''; }
};
export const activityEntries = (activity) => Array.isArray(activity?.entries)
  ? activity.entries.filter((item) => item && typeof item === 'object')
  : [];

export const entryCount = (activity) => activityEntries(activity).length;

// Only an explicitly designated daily Activity is automatically reused.
// Legacy independent Activities stay untouched so old photo and finance links
// are never orphaned or reassigned on an unrelated create action.
export const findDailyActivity = (moment, date) =>
  (moment?.activities || []).find((activity) =>
    activity?.entryMode === ENTRY_MODES.DAILY && dateKey(activity.date) === dateKey(date)) || null;

export const journalAppendCandidates = (moment) =>
  (moment?.activities || []).filter((activity) =>
    activity && recordId(activity.id) && !activity.cancelled && activity.status !== 'cancelled');

const newEntry = ({ title = '', description = '', date, time = '' }, makeId, now) => ({
  id: makeId(), title: String(title).trim(), description: description || '',
  date: dateKey(date), time: normalizeActivityTime(time), createdAt: now,
});
export const orderedActivityEntries = (activity) => activityEntries(activity).slice().sort((a, b) => {
  const dates = dateKey(a.date).localeCompare(dateKey(b.date));
  return dates || (activityTime(a) || '99:99').localeCompare(activityTime(b) || '99:99')
    || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    || String(a.id).localeCompare(String(b.id);
});

// Pure update: the existing Activity is only changed when the caller chooses
// Append (Journal) or the parent is already a dedicated Daily container.
// Never modify independent Activity identity or existing linked files/costs.
export const createOrAppendActivity = (moment, { title, description = '', date, time = '', priority = 'medium',
  mode, targetId = '' }, { makeId = () => crypto.randomUUID(), now = new Date().toISOString() } = {}) => {
  const day = dateKey(date);
  if (!day || !String(title || '').trim()) throw new Error('Enter an entry title and a valid date.');
  if (!Object.values(ENTRY_MODES).includes(mode)) throw new Error('Choose a configured Moment activity mode.');
  const item = newEntry({ title, description, date: day, time }, makeId, now);
  const current = Array.isArray(moment?.activities) ? moment.activities : [];
  let selected = null;
  if (mode === ENTRY_MODES.DAILY) selected = findDailyActivity(moment, day);
  if (mode === ENTRY_MODES.JOURNAL && targetId) {
    selected = journalAppendCandidates(moment).find((activity) => recordId(activity.id) === recordId(targetId));
    if (!selected) throw new Error('The selected Journal entry is no longer available.');
  }
  if (mode === ENTRY_MODES.TASKS && targetId) throw new Error('Tasks must be created independently.');
  if (selected) {
    const entries = [...activityEntries(selected), item];
    const updated = { ...selected, entries };
    return { moment: { ...moment, activities: current.map((a) => a === selected ? updated : a) },
      activityId: recordId(selected.id), entryId: item.id, appended: true };
  }
  const isDaily = mode === ENTRY_MODES.DAILY;
  const activity = {
    id: makeId(), eventId: recordId(moment.id) || recordId(moment.firestoreId),
    title: isDaily ? `Diary · ${day}` : item.title,
    description: isDaily ? '' : item.description,
    date: day, time: isDaily ? '' : item.time, priority,
    completed: false, completedAt: null, createdAt: now,
    ...(isDaily ? { entryMode: ENTRY_MODES.DAILY, entries: [item] } : {}),
  };
  return { moment: { ...moment, activities: [...current, activity] }, activityId: activity.id,
    entryId: isDaily ? item.id : null, appended: false };
};

export const updateActivityEntry = (activity, entryId, patch) => {
  const entries = activityEntries(activity);
  const id = recordId(entryId);
  if (!entries.some((item) => recordId(item.id) === id)) throw new Error('Entry no longer exists.');
  return { entries: entries.map((item) => recordId(item.id) === id
    ? { ...item, ...patch, id: item.id, ...(patch?.time !== undefined ? { time: normalizeActivityTime(patch.time) } : {}) } : item) };
};
export const removeActivityEntry = (activity, entryId) => {
  const entries = activityEntries(activity);
  const result = entries.filter((item) => recordId(item.id) !== recordId(entryId));
  if (result.length === entries.length) throw new Error('Entry no longer exists.');
  return { entries: result };
};
