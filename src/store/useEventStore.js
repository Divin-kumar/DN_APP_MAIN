/* Event state actions coordinate persistence and the Events workspace. */
import { create } from 'zustand';
import {
  createEvent,
  deleteEvent,
  getEventsForUser,
  getGuestEvents,
  removeGuestEvent,
  saveGuestEvent,
  updateEvent,
} from '../services/eventService';
import { getActiveSampleData, saveActiveSampleData } from '../dev/sampleData';

const sameEvent = (first, second) => Boolean(
  (first.id && second.id && first.id === second.id)
  || (first.firestoreId && second.firestoreId && first.firestoreId === second.firestoreId)
);

const syncEventSampleData = (data, events, options = {}) => {
  const eventIds = new Set(events.map((event) => event.id || event.firestoreId));
  const activityIds = new Set(events.flatMap((event) => (event.activities || []).map((activity) => activity.id)));
  const next = {
    ...data,
    events,
    activities: events.flatMap((event) => event.activities || []),
    memories: events.flatMap((event) => event.memories || []),
    attachments: events.flatMap((event) => event.attachments || []),
    expenses: (data.expenses || []).filter((expense) => (
      (!options.removedEventId || expense.eventId !== options.removedEventId)
      && (!options.removedActivityId || expense.activityId !== options.removedActivityId)
      && !(options.removedActivityIds?.has(expense.activityId))
      && eventIds.has(expense.eventId)
      && (!expense.activityId || activityIds.has(expense.activityId))
    )),
  };
  saveActiveSampleData(next);
  return next;
};

const getLoadKey = (uid, isGuest) => `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;

const useEventStore = create((set, get) => {
  const pendingLoads = new Map();

  return ({
  events: [],
  loading: false,
  error: null,
  loadedFor: null,
  activeLoadKey: null,

  setEvents: (items) => set({ events: items, loading: false, error: null, loadedFor: null, activeLoadKey: null }),

  loadEvents: async (uid, isGuest) => {
    const loadKey = getLoadKey(uid, isGuest);
    if (get().loadedFor === loadKey) return get().events;
    if (pendingLoads.has(loadKey)) return pendingLoads.get(loadKey);

    set({ loading: true, error: null, activeLoadKey: loadKey });

    const request = Promise.resolve().then(async () => {
      try {
        const sampleData = getActiveSampleData(uid);
        if (sampleData) {
          if (get().activeLoadKey === loadKey) set({ events: sampleData.events, loading: false, error: null, loadedFor: loadKey });
          return sampleData.events;
        }

        const items = isGuest ? getGuestEvents() : await getEventsForUser(uid);
        if (get().activeLoadKey === loadKey) set({ events: items, loading: false, error: null, loadedFor: loadKey });
        return items;
      } catch (error) {
        console.error('Failed to load events:', error);
        if (get().activeLoadKey === loadKey) set({ loading: false, error: 'Unable to load events.' });
        return [];
      } finally {
        pendingLoads.delete(loadKey);
      }
    });
    pendingLoads.set(loadKey, request);

    return request;
  },

  addEvent: async (uid, isGuest, event) => {
    const normalized = {
      ...event,
      id: event.id || crypto.randomUUID(),
      activities: Array.isArray(event.activities) ? event.activities : [],
    };

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = [normalized, ...sampleData.events];
      syncEventSampleData(sampleData, updated);
      set({ events: updated });
      return normalized;
    }

    if (isGuest) {
      const updated = saveGuestEvent(normalized);
      set({ events: updated });
      return normalized;
    }

    const saved = await createEvent(uid, normalized);
    set({ events: [saved, ...get().events] });
    return saved;
  },

  updateEventItem: async (uid, isGuest, event) => {
    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.events.map((item) => (
        sameEvent(item, event) ? { ...item, ...event } : item
      ));
      const previous = sampleData.events.find((item) => sameEvent(item, event));
      const updatedActivityIds = new Set((updated.find((item) => sameEvent(item, event))?.activities || []).map((item) => item.id));
      const removedActivityIds = new Set((previous?.activities || []).map((activity) => activity.id).filter((id) => !updatedActivityIds.has(id)));
      syncEventSampleData(sampleData, updated, { removedActivityIds });
      set({ events: updated, error: null });
      return event;
    }

    if (isGuest) {
      const updated = saveGuestEvent(event);
      set({ events: updated });
      return event;
    }

    const current = get().events;
    const optimistic = current.map((item) => (
      sameEvent(item, event) ? { ...item, ...event } : item
    ));
    set({ events: optimistic, error: null });

    try {
      const updated = await updateEvent(uid, event);
      set({
        events: get().events.map((item) =>
          sameEvent(item, event) ? { ...item, ...updated } : item
        ),
      });
      return updated;
    } catch (error) {
      console.error('Failed to update event:', error);
      set({ events: current, error: 'Unable to save the event. Your changes were restored.' });
      throw error;
    }
  },

  deleteEventItem: async (uid, isGuest, eventId) => {
    const current = get().events;
    const event = current.find((item) => item.id === eventId || item.firestoreId === eventId);

    if (!event) return;

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const remaining = current.filter((item) => item.id !== eventId && item.firestoreId !== eventId);
      syncEventSampleData(sampleData, remaining, { removedEventId: eventId });
      set({ events: remaining, error: null });
      return;
    }

    const remaining = current.filter((item) => item.id !== eventId && item.firestoreId !== eventId);
    set({ events: remaining, error: null });

    try {
      if (isGuest) {
        removeGuestEvent(eventId);
        return;
      }

      await deleteEvent(uid, event);
    } catch (error) {
      console.error('Failed to delete event:', error);
      set({ events: current, error: 'Unable to delete the event. It has been restored.' });
      throw error;
    }
  },
  });
});

export default useEventStore;
