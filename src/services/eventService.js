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

const GUEST_EVENTS_KEY = 'lifehub_guest_eventGroups';
const GUEST_SESSION_BACKUP_KEY = 'lifehub_session_backup';

export { getEventStatus };

export const normalizeActivity = (item = {}) => ({
  id: item.id || crypto.randomUUID(),
  eventId: item.eventId || null,
  title: String(item.title ?? '').trim(),
  date: item.date || new Date().toISOString().slice(0, 10),
  description: item.description || '',
  expenses: Array.isArray(item.expenses) ? item.expenses.map((expense) => ({
    id: expense.id || crypto.randomUUID(),
    description: String(expense.description ?? '').trim(),
    amount: Number(expense.amount || 0),
    date: expense.date || new Date().toISOString().slice(0, 10),
    createdAt: expense.createdAt || new Date().toISOString(),
    eventId: expense.eventId || item.eventId || null,
    activityId: expense.activityId || item.id || null,
  })) : [],
  completed: Boolean(item.completed),
  priority: typeof item.priority === 'string' && item.priority.trim()
    ? item.priority.trim()
    : 'medium',
  completedAt: item.completedAt || null,
  createdAt: item.createdAt || new Date().toISOString(),
});

export const normalizeEvent = (item = {}) => ({
  id: item.id || crypto.randomUUID(),
  name: String(item.name ?? '').trim(),
  date: item.date || new Date().toISOString().slice(0, 10),
  type: item.type || 'Personal',
  customType: item.customType || '',
  recurrence: item.recurrence || 'none',
  budget: Number(item.budget || 0),
  notes: item.notes || '',
  greetingCard: item.greetingCard && typeof item.greetingCard === 'object'
    ? {
        title: String(item.greetingCard.title || ''),
        body: String(item.greetingCard.body || ''),
        updatedAt: item.greetingCard.updatedAt || null,
      }
    : null,
  memories: Array.isArray(item.memories) ? item.memories : [],
  attachments: Array.isArray(item.attachments) ? item.attachments : [],
  activities: Array.isArray(item.activities)
    ? item.activities.map(normalizeActivity)
    : [],
  status: getEventStatus(item),
  createdAt: item.createdAt || new Date().toISOString(),
});

export const getGuestEvents = () => {
  try {
    const raw = localStorage.getItem(GUEST_EVENTS_KEY) || '[]';
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const normalized = parsed.map(normalizeEvent);
      localStorage.setItem(GUEST_SESSION_BACKUP_KEY, JSON.stringify(normalized));
      return normalized;
    }

    return [];
  } catch (error) {
    console.error('Failed to load guest events:', error);
    return [];
  }
};

export const setGuestEvents = (items) => {
  const normalized = Array.isArray(items) ? items.map(normalizeEvent) : [];
  localStorage.setItem(GUEST_EVENTS_KEY, JSON.stringify(normalized));
  localStorage.setItem(GUEST_SESSION_BACKUP_KEY, JSON.stringify(normalized));
};

export const getEventsForUser = async (uid) => {
  const eventsRef = collection(db, 'users', uid, 'eventGroups');
  const snapshot = await getDocs(eventsRef);
  return snapshot.docs.map((docSnap) => ({
    firestoreId: docSnap.id,
    ...normalizeEvent(docSnap.data()),
  }));
};

export const createEvent = async (uid, event) => {
  const normalized = normalizeEvent(event);
  const eventsRef = collection(db, 'users', uid, 'eventGroups');
  const docRef = await addDoc(eventsRef, normalized);
  return { firestoreId: docRef.id, ...normalized };
};

export const updateEvent = async (uid, event) => {
  const normalized = normalizeEvent(event);
  const ref = doc(db, 'users', uid, 'eventGroups', event.firestoreId || event.id);
  await updateDoc(ref, {
    ...normalized,
    id: normalized.id,
  });
  return normalized;
};

export const deleteEvent = async (uid, event) => {
  const id = event.firestoreId || event.id;
  if (!id) return;
  const ref = doc(db, 'users', uid, 'eventGroups', id);
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
