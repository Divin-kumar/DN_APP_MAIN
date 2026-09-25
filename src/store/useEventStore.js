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

const useEventStore = create((set, get) => ({
  events: [],
  loading: false,
  error: null,

  setEvents: (items) => set({ events: items, loading: false, error: null }),

  loadEvents: async (uid, isGuest) => {
    set({ loading: true, error: null });

    try {
      const items = isGuest ? getGuestEvents() : await getEventsForUser(uid);
      set({ events: items, loading: false, error: null });
      return items;
    } catch (error) {
      console.error('Failed to load events:', error);
      set({ loading: false, error: 'Unable to load events.' });
      return [];
    }
  },

  addEvent: async (uid, isGuest, event) => {
    const normalized = {
      ...event,
      id: event.id || crypto.randomUUID(),
      activities: Array.isArray(event.activities) ? event.activities : [],
    };

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
    if (isGuest) {
      const updated = saveGuestEvent(event);
      set({ events: updated });
      return event;
    }

    const current = get().events;
    const optimistic = current.map((item) => (
      item.id === event.id || item.firestoreId === event.firestoreId ? { ...item, ...event } : item
    ));
    set({ events: optimistic, error: null });

    try {
      const updated = await updateEvent(uid, event);
      set({
        events: get().events.map((item) =>
          item.id === event.id || item.firestoreId === event.firestoreId ? { ...item, ...updated } : item
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
}));

export default useEventStore;
