/*
  Event persistence, activity normalization, and guest event storage.

  This service handles how event records are saved, loaded, and normalized before they reach the UI.
  It also keeps guest-mode data in local storage so the app can work without an account.
*/
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { getEventStatus } from '../utils/eventStatus.js';

const GUEST_EVENTS_KEY = 'lifehub_guest_eventGroups';

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
  cancelled: Boolean(item.cancelled || String(item.status || '').toLowerCase() === 'cancelled'),
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
      return parsed.map(normalizeEvent);
    }

    return [];
  } catch (error) {
    console.error('Failed to load guest events:', error);
    return [];
  }
};

export const setGuestEvents = (items) => {
  void items;
  throw new Error('Guest event writes are deprecated; use momentRepository and child repositories.');
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
  void uid;
  void event;
  throw new Error('Firestore event writes are deprecated; use momentRepository.');
};

export const updateEvent = async (uid, event) => {
  void uid;
  void event;
  throw new Error('Firestore event writes are deprecated; use momentRepository and child repositories.');
};

export const deleteEvent = async (uid, event) => {
  void uid;
  void event;
  throw new Error('Firestore event deletion is deprecated; use momentRepository and child repositories.');
};

export const saveGuestEvent = (event) => {
  void event;
  throw new Error('Guest event writes are deprecated; use momentRepository and child repositories.');
};

export const removeGuestEvent = (eventId) => {
  void eventId;
  throw new Error('Guest event deletion is deprecated; use momentRepository and child repositories.');
};
