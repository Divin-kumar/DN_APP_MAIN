/* Shared Moment normalization and Guest-local persistence. */
import { getEventStatus, getStoredEventStatus } from '../utils/eventStatus';
import { normalizeActivityExpense } from '../utils/transactionRelations';
import { formatMomentDate, getEventDate, parseMomentDate } from '../utils/momentDates';
import { recordId } from '../utils/recordIdentity';

const GUEST_EVENTS_KEY = 'dn_guest_eventGroups';
const GUEST_SESSION_BACKUP_KEY = 'dn_session_backup';

const storedFields = (item) => Object.fromEntries(Object.entries(item)
  .filter(([key]) => !['firestoreId', 'firestoreCollection', 'firestoreSources'].includes(key)));
const activityDate = (item) => {
  try { return formatMomentDate(parseMomentDate(item.date ?? item.startDate)) || item.date || ''; }
  catch { return ''; }
};

export { getEventStatus };

const normalizeEventChild = (item) => {
  if (!item || typeof item !== 'object') return item;
  const id = recordId(item.id) || recordId(item.firestoreId);
  const eventId = recordId(item.eventId);
  return { ...item, ...(id ? { id } : {}), ...(eventId ? { eventId } : {}) };
};

export const normalizeActivity = (item = {}) => {
  const id = recordId(item.id) || crypto.randomUUID();
  const eventId = recordId(item.eventId) || null;
  return {
    ...storedFields(item),
    id,
    eventId,
    title: String(item.title ?? '').trim(),
    date: activityDate(item),
    description: item.description || '',
    expenses: Array.isArray(item.expenses)
      ? item.expenses.map((expense) => ({ ...storedFields(expense || {}), ...normalizeActivityExpense({
        ...expense,
        id: recordId(expense.id) || recordId(expense.firestoreId) || undefined,
        eventId: recordId(expense.eventId) || eventId,
        activityId: recordId(expense.activityId) || id,
      }, eventId, id) }))
      : [],
    completed: Boolean(item.completed),
    cancelled: Boolean(item.cancelled || String(item.status || '').toLowerCase() === 'cancelled'),
    priority: typeof item.priority === 'string' && item.priority.trim()
      ? item.priority.trim()
      : 'medium',
    completedAt: item.completedAt || null,
    createdAt: item.createdAt || new Date().toISOString(),
  };
};

export const normalizeEvent = (item = {}) => {
  const id = recordId(item.id) || recordId(item.firestoreId) || crypto.randomUUID();
  return {
    ...storedFields(item),
    id,
    name: String(item.name ?? item.title ?? '').trim(),
    date: formatMomentDate(getEventDate(item)) || item.date || formatMomentDate(new Date()),
    type: item.type || 'Personal',
    customType: item.customType || '',
    recurrence: item.recurrence || (item.isRecurring === true ? 'yearly' : 'none'),
    budget: Number(item.budget || 0),
    notes: item.notes || '',
    greetingCard: item.greetingCard && typeof item.greetingCard === 'object'
      ? {
        title: String(item.greetingCard.title || ''),
        body: String(item.greetingCard.body || ''),
        updatedAt: item.greetingCard.updatedAt || null,
      }
      : null,
    memories: Array.isArray(item.memories) ? item.memories.map(normalizeEventChild) : [],
    attachments: Array.isArray(item.attachments) ? item.attachments.map(normalizeEventChild) : [],
    activities: Array.isArray(item.activities)
      ? item.activities.map((activity) => normalizeActivity({ ...activity, eventId: recordId(activity.eventId) || id }))
      : [],
    archived: Boolean(item.archived),
    status: getStoredEventStatus(item),
    createdAt: item.createdAt || new Date().toISOString(),
  };
};

export const getGuestEvents = () => {
  try {
    const raw = localStorage.getItem(GUEST_EVENTS_KEY) || '[]';
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const normalized = parsed.map(normalizeEvent);
      localStorage.setItem(GUEST_SESSION_BACKUP_KEY, JSON.stringify(normalized));
      return normalized;
    }

    throw new Error('Guest Moment storage is invalid; no changes were made.');
  } catch (error) {
    console.error('Failed to load guest events:', error);
    throw error;
  }
};

export const setGuestEvents = (items) => {
  const normalized = Array.isArray(items) ? items.map(normalizeEvent) : [];
  localStorage.setItem(GUEST_EVENTS_KEY, JSON.stringify(normalized));
  localStorage.setItem(GUEST_SESSION_BACKUP_KEY, JSON.stringify(normalized));
};

export const saveGuestEvent = (event) => {
  const list = getGuestEvents();
  const index = list.findIndex((item) => (
    (item.id && event.id && item.id === event.id)
    || (item.firestoreId && event.firestoreId && item.firestoreId === event.firestoreId)
  ));

  if (index >= 0) {
    list[index] = normalizeEvent(event);
  } else {
    list.push(normalizeEvent(event));
  }

  setGuestEvents(list);
  return list;
};

export const removeGuestEvent = (eventId) => {
  const list = getGuestEvents().filter((item) => item.id !== eventId);
  setGuestEvents(list);
  return list;
};
