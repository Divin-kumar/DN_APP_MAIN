/* Event persistence, activity normalization, and guest event storage. */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const GUEST_EVENTS_KEY = 'lifehub_guest_eventGroups';

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
  createdAt: item.createdAt || new Date().toISOString(),
});

export const normalizeEvent = (item = {}) => ({
  id: item.id || crypto.randomUUID(),
  name: String(item.name ?? '').trim(),
  date: item.date || new Date().toISOString().slice(0, 10),
  type: item.type || 'Personal',
  customType: item.customType || '',
  recurrence: item.recurrence || 'none',
  notes: item.notes || '',
  activities: Array.isArray(item.activities)
    ? item.activities.map(normalizeActivity)
    : [],
  createdAt: item.createdAt || new Date().toISOString(),
});

export const getGuestEvents = () => {
  try {
    const raw = localStorage.getItem(GUEST_EVENTS_KEY) || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeEvent) : [];
  } catch (error) {
    console.error('Failed to load guest events:', error);
    return [];
  }
};

export const setGuestEvents = (items) => {
  localStorage.setItem(GUEST_EVENTS_KEY, JSON.stringify(items));
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
  const index = list.findIndex((item) => item.id === event.id || item.firestoreId === event.firestoreId);

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
