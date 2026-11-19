/* Account Moment persistence, including legacy collections. */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { recordId } from '../utils/recordIdentity';
import { normalizeEvent } from './guestEventService';

export { getEventStatus, getGuestEvents, normalizeActivity, normalizeEvent, removeGuestEvent, saveGuestEvent, setGuestEvents } from './guestEventService';

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
