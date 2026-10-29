import { compareActivityDateTime } from './activityTime.js';
import { parseMomentDate } from './momentDates.js';
import { recordId } from './recordIdentity.js';
import { activityStatus } from './activityDetail.js';

export const getActivityMomentType = (moment) => String(
  moment?.type === 'Other' ? moment.customType || 'Other' : moment?.type || 'Personal',
);

// These keys belong to the view only. Activity IDs and stored parent links stay intact.
export const getActivityEntryKey = (momentId, activityId) => {
  const parent = recordId(momentId);
  const child = recordId(activityId);
  return parent && child ? JSON.stringify([parent, child]) : '';
};

export const projectActivities = (events = []) => (Array.isArray(events) ? events : []).flatMap((moment) => {
  const momentId = recordId(moment?.id) || recordId(moment?.firestoreId);
  if (!momentId || !Array.isArray(moment.activities)) return [];
  return moment.activities.flatMap((activity) => {
    const key = getActivityEntryKey(momentId, activity?.id);
    return key ? [{
      key,
      momentId,
      momentName: String(moment.name || 'Untitled moment'),
      momentType: getActivityMomentType(moment),
      archived: Boolean(moment.archived),
      activity,
    }] : [];
  });
});

const safeDate = (value) => {
  try { return parseMomentDate(value); } catch { return null; }
};
const cancelled = (activity) => Boolean(activity.cancelled || activity.status === 'cancelled');
const priorityRank = (activity) => ({ high: 3, medium: 2, low: 1 })[String(activity.priority || 'medium').toLowerCase()] || 0;

export const selectActivityEntries = (entries = [], {
  search = '', filter = 'all', momentId = '', momentType = '', parentScope = 'active', field = 'date', direction = 'asc', includeCancelled = false,
} = {}, referenceDate = new Date()) => {
  const query = String(search).trim().toLowerCase();
  const selectedMoment = recordId(momentId);
  const today = safeDate(referenceDate) || new Date();
  today.setHours(0, 0, 0, 0);
  const sign = direction === 'desc' ? -1 : 1;
  const dates = new Map();
  const entryDate = (entry) => {
    if (!dates.has(entry)) dates.set(entry, safeDate(entry.activity.date));
    return dates.get(entry);
  };
  const compareDates = (first, second) => compareActivityDateTime(first.activity, second.activity, direction);
  const statusRank = (entry) => {
    if (cancelled(entry.activity)) return 3;
    if (activityStatus(entry.activity) === 'completed') return 2;
    const date = entryDate(entry);
    const calendarDay = date ? new Date(date).setHours(0, 0, 0, 0) : null;
    return calendarDay !== null && calendarDay > today.getTime() ? 1 : 0;
  };
  return entries.filter((entry) => {
    if (parentScope !== 'all' && Boolean(entry.archived) !== (parentScope === 'archived')) return false;
    if (selectedMoment && entry.momentId !== selectedMoment) return false;
    if (momentType && entry.momentType !== momentType) return false;
    const activity = entry.activity;
    const matchesSearch = !query || [activity.title, activity.description, entry.momentName]
      .some((value) => String(value || '').toLowerCase().includes(query));
    if (!matchesSearch) return false;
    if (filter === 'cancelled') return cancelled(activity);
    if (cancelled(activity)) return includeCancelled;
    return filter === 'all'
      || (filter === 'in-progress' && activityStatus(activity) === 'in-progress')
      || (filter === 'completed' && activityStatus(activity) === 'completed')
      || (activity.priority || 'medium') === filter;
  }).sort((first, second) => {
    let order = 0;
    if (field === 'title') order = String(first.activity.title || '').localeCompare(String(second.activity.title || ''), undefined, { sensitivity: 'base' });
    if (field === 'priority') order = priorityRank(first.activity) - priorityRank(second.activity);
    if (field === 'status') order = statusRank(first) - statusRank(second);
    return order * sign || compareDates(first, second) || (field === 'date' ? 0 : first.key.localeCompare(second.key) * sign);
  });
};
