import { activityTime, normalizeActivityTime } from './activityTime.js';
import { formatMomentDate, parseMomentDate } from './momentDates.js';
import { recordId } from './recordIdentity.js';
import { resolveMomentEntryMode } from './momentEntryMode.js';

// The three permitted creation behaviours follow the existing, configurable
// Story presentation. No unconfigured fourth behaviour or silent merge path.
export const ENTRY_MODES = Object.freeze({ DAILY: 'diary', JOURNAL: 'journey', TASKS: 'chronicle' });
export const ENTRY_MODE_LABELS = Object.freeze([
  { value: ENTRY_MODES.DAILY, label: 'Daily · One Activity per day' },
  { value: ENTRY_MODES.JOURNAL, label: 'Journal · New or append' },
  { value: ENTRY_MODES.TASKS, label: 'Tasks · Independent Activities' },
]);
export const getMomentEntryMode = (moment, momentTypes = []) =>
  resolveMomentEntryMode(moment, momentTypes);

const dateKey = (date) => {
  try { return formatMomentDate(parseMomentDate(date)); } catch { return ''; }
};
const dailyActivityTitle = (date) => {
  const parsed = parseMomentDate(date);
  return `Diary · ${parsed ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : date}`;
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

// Optional, reversible, same-Moment references. Never change record ownership.
const journalLinks = (activity) => Array.isArray(activity?.linkedJournalActivityIds)
  ? [...new Set(activity.linkedJournalActivityIds.map(recordId).filter(Boolean))] : [];
export const linkJournalActivities = (moment, destinationId, sourceId) => {
  const candidates = journalAppendCandidates(moment);
  const destination = candidates.find((a) => recordId(a.id) === recordId(destinationId));
  const source = candidates.find((a) => recordId(a.id) === recordId(sourceId));
  if (!destination || !source || destination === source) throw new Error('Choose two different available Journal memories.');
  const fromId = recordId(source.id), toId = recordId(destination.id);
  if (journalLinks(destination).includes(fromId)) return moment;
  const nodes = new Map(candidates.map((a) => [recordId(a.id), a]));
  const visited = new Set();
  const pathToDestination = (id) => {
    if (id === toId) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    return journalLinks(nodes.get(id)).some(pathToDestination);
  };
  if (pathToDestination(fromId)) throw new Error('Journal memories cannot link in a circle.');
  return { ...moment, activities: moment.activities.map((a) => a === destination
    ? { ...a, linkedJournalActivityIds: [...journalLinks(a), fromId] } : a) };
};
export const unlinkJournalActivities = (moment, destinationId, sourceId) => {
  const destination = (moment?.activities || []).find((a) => recordId(a?.id) === recordId(destinationId));
  const id = recordId(sourceId);
  if (!destination || !id || !journalLinks(destination).includes(id)) throw new Error('These Journal memories are not linked.');
  return { ...moment, activities: moment.activities.map((a) => a === destination
    ? { ...a, linkedJournalActivityIds: journalLinks(a).filter((linkedId) => linkedId !== id) } : a) };
};

const newEntry = ({ title = '', description = '', date, time = '' }, makeId, now) => ({
  id: makeId(), title: String(title).trim(), description: description || '',
  date: dateKey(date), time: normalizeActivityTime(time), createdAt: now,
});
export const orderedActivityEntries = (activity) => activityEntries(activity).slice().sort((a, b) => {
  const dates = dateKey(a.date).localeCompare(dateKey(b.date));
  return dates || (activityTime(a) || '99:99').localeCompare(activityTime(b) || '99:99')
    || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    || String(a.id).localeCompare(String(b.id));
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
    const updated = { ...selected, entries, ...(mode === ENTRY_MODES.DAILY ? {
      completed: false, cancelled: false, completedAt: null, status: 'in-progress',
    } : {}) };
    return { moment: { ...moment, activities: current.map((a) => a === selected ? updated : a) },
      activityId: recordId(selected.id), entryId: item.id, appended: true };
  }
  const isDaily = mode === ENTRY_MODES.DAILY;
  const activity = {
    id: makeId(), eventId: recordId(moment.id) || recordId(moment.firestoreId),
    title: isDaily ? dailyActivityTitle(day) : item.title,
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

const aliasesFor = (activity) => (Array.isArray(activity?.mergedActivityIds) ? activity.mergedActivityIds : [])
  .map(recordId).filter(Boolean);
const legacyAsEntry = (activity) => ({
  id: recordId(activity.id),
  sourceActivityId: recordId(activity.id),
  title: String(activity.title || '').trim(),
  description: activity.description || '',
  date: dateKey(activity.date),
  time: activityTime(activity),
  createdAt: activity.createdAt || null,
  status: activity.status || (activity.completed ? 'completed' : 'in-progress'),
  // A lossless record snapshot excluding the separately preserved expense
  // mirrors and flattened child entries. Custom legacy metadata survives.
  legacyActivityFields: Object.fromEntries(Object.entries(activity)
    .filter(([key]) => key !== 'expenses' && key !== 'entries')),
});
// Merge ownership into the original target ID. References to old Activity IDs
// are kept as aliases for finance, and existing photo originals are relinked
// to the target with their source entry IDs for precise historical ownership.
const mergeRecords = (moment, target, sources, { daily = false } = {}) => {
  const sourceIds = new Set(sources.map((activity) => recordId(activity.id)));
  const entries = [
    ...(daily
      ? (target.entryMode === ENTRY_MODES.DAILY ? activityEntries(target) : [legacyAsEntry(target)])
      : activityEntries(target)),
    ...sources.flatMap((source) => source.entryMode === ENTRY_MODES.DAILY
      ? activityEntries(source) : [legacyAsEntry(source), ...activityEntries(source)]),
  ];
  const targetId = recordId(target.id);
  const aliases = [...new Set([
    ...aliasesFor(target), ...sources.flatMap((source) => [recordId(source.id), ...aliasesFor(source)]),
  ])].filter((id) => id !== targetId);
  // Do not discard historical nested ledger copies here. Existing finance
  // projections perform precedence/deduplication while data stays recoverable.
  const storedExpenses = [...(target.expenses || []), ...sources.flatMap((source) => source.expenses || [])];
  const merged = {
    ...target, linkedJournalActivityIds: [...new Set([...journalLinks(target), ...sources.flatMap(journalLinks)])]
      .filter((id) => id !== targetId && !sourceIds.has(id)), ...(daily ? {
      title: dailyActivityTitle(dateKey(target.date)), description: '', time: '',
      status: 'in-progress', completed: false, completedAt: null, cancelled: false,
      entryMode: ENTRY_MODES.DAILY,
    } : {}),
    entries: orderedActivityEntries({ entries }),
    mergedActivityIds: aliases, expenses: storedExpenses,
  };
  const ownerById = new Map(sources.map((activity) => [recordId(activity.id), recordId(activity.id)]));
  const attachments = (moment.attachments || []).map((file) => {
    const originalId = recordId(file.activityId);
    if (!sourceIds.has(originalId)) return file;
    return { ...file, activityId: targetId, entryId: file.entryId || ownerById.get(originalId) };
  });
  return { ...moment,
    activities: (moment.activities || []).filter((activity) => !sourceIds.has(recordId(activity.id)))
      .map((activity) => {
        if (activity === target) return merged;
        if (!journalLinks(activity).some((id) => sourceIds.has(id))) return activity;
        const ids = journalLinks(activity).map((id) => sourceIds.has(id) ? targetId : id);
        return { ...activity, linkedJournalActivityIds: [...new Set(ids)]
          .filter((id) => id !== recordId(activity.id)) };
      }),
    attachments,
  };
};

// Idempotent per-Moment migration. Do not touch undated legacy records; never
// create a second record with a new ID or overwrite independent Journal/Tasks.
export const mergeLegacyDiaryActivities = (moment) => {
  const activities = Array.isArray(moment?.activities) ? moment.activities : [];
  const dates = new Map();
  for (const activity of activities) {
    const date = dateKey(activity.date);
    if (!date) continue;
    if (!dates.has(date)) dates.set(date, []);
    dates.get(date).push(activity);
  }
  let next = moment;
  for (const date of dates.keys()) {
    const pending = (next.activities || []).filter((activity) => dateKey(activity.date) === date);
    if (!pending.length || (pending.length === 1 && pending[0].entryMode === ENTRY_MODES.DAILY)) continue;
    const target = pending.find((activity) => activity.entryMode === ENTRY_MODES.DAILY) || pending[0];
    next = mergeRecords(next, target, pending.filter((activity) => activity !== target), { daily: true });
  }
  return next;
};

// Journal consolidation is ALWAYS deliberate, never automatic.
export const mergeJournalActivities = (moment, targetId, sourceId) => {
  const valid = journalAppendCandidates(moment);
  const target = valid.find((activity) => recordId(activity.id) === recordId(targetId));
  const source = valid.find((activity) => recordId(activity.id) === recordId(sourceId));
  if (!target || !source || target === source) throw new Error('Choose two different available Journal entries.');
  return mergeRecords(moment, target, [source]);
};
export const activityOwnsLinkedId = (activity, id) => recordId(activity?.id) === recordId(id)
  || aliasesFor(activity).includes(recordId(id));
