/*
  Event persistence, activity normalization, and guest event storage.

  This service handles how event records are saved, loaded, and normalized before they reach the UI.
  It also keeps guest-mode data in local storage so the app can work without an account.
*/
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { getEventStatus } from '../utils/eventStatus';
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
    status: getEventStatus(item),
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

export const getEventsForUser = async (uid) => {
  const eventsRef = collection(db, 'users', uid, 'eventGroups');
  let snapshot = await getDocs(eventsRef);
  // Older accounts stored the same aggregates in `events`. Read them in place;
  // never migrate/delete business data just to display it.
  const firestoreCollection = snapshot.empty ? 'events' : 'eventGroups';
  if (snapshot.empty) {
    try {
      snapshot = await getDocs(collection(db, 'users', uid, 'events'));
    } catch (error) {
      // The legacy collection is optional and some current Rules allow only
      // eventGroups. Its absence must not hide a readable standalone ledger.
      if (!['permission-denied', 'firestore/permission-denied'].includes(error?.code)) throw error;
      console.warn('Legacy Moments are unavailable under the current account permissions; using current collections.');
    }
  }
  return snapshot.docs.map((docSnap) => ({
    firestoreId: docSnap.id,
    firestoreCollection,
    ...normalizeEvent({ ...docSnap.data(), id: recordId(docSnap.data().id) || docSnap.id }),
  }));
};

const eventCollection = (event) => event.firestoreCollection === 'events' ? 'events' : 'eventGroups';

export const createEvent = async (uid, event) => {
  const normalized = normalizeEvent(event);
  const firestoreCollection = eventCollection(event);
  const eventsRef = collection(db, 'users', uid, firestoreCollection);
  const docRef = await addDoc(eventsRef, normalized);
  return { firestoreId: docRef.id, firestoreCollection, ...normalized };
};

export const updateEvent = async (uid, event) => {
  const normalized = normalizeEvent(event);
  const firestoreCollection = eventCollection(event);
  const ref = doc(db, 'users', uid, firestoreCollection, recordId(event.firestoreId) || normalized.id);
  await updateDoc(ref, {
    ...normalized,
    id: normalized.id,
  });
  return { ...normalized, firestoreCollection };
};

export const deleteEvent = async (uid, event) => {
  const id = recordId(event.firestoreId) || recordId(event.id);
  if (!id) return;
  const ref = doc(db, 'users', uid, eventCollection(event), id);
  await deleteDoc(ref);
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
