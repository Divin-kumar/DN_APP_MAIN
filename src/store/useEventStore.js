/*
  Event state actions coordinate persistence and the Events workspace.

  This store is the central data layer for life moments and activities.
  It loads event data, saves new events, edits existing ones, and deletes them.
*/
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
import { getEventStatus } from '../utils/eventStatus';
import { createEventLoader } from '../utils/eventLoadScope';
import { recordId } from '../utils/recordIdentity';

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

const useEventStore = create((set, get) => {
  return ({
  events: [],
  loading: false,
  error: null,
  loadedFor: null,
  activeLoadKey: null,

  setEvents: (items) => set({ events: items, loading: false, error: null, loadedFor: null, activeLoadKey: null }),

  loadEvents: createEventLoader({
    get,
    set,
    readEvents: async (uid, isGuest) => {
      const sampleData = getActiveSampleData(uid);
      return sampleData ? sampleData.events : isGuest ? getGuestEvents() : getEventsForUser(uid);
    },
  }),

  addEvent: async (uid, isGuest, event) => {
    const normalized = {
      ...event,
      id: recordId(event.id) || crypto.randomUUID(),
      activities: Array.isArray(event.activities) ? event.activities : [],
    };
    normalized.status = getEventStatus(normalized);

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

    // Quick Create can be opened before a Moment page loads this account. Read
    // its actual source before choosing a destination for the new aggregate.
    const loadKey = `user:${uid || 'anonymous'}`;
    if (get().loadedFor !== loadKey || get().activeLoadKey !== loadKey) {
      await get().loadEvents(uid, false);
      if (get().loadedFor !== loadKey || get().activeLoadKey !== loadKey) {
        throw new Error('Unable to load this account’s Moments before saving. Please retry.');
      }
    }
    const previous = get().events;
    normalized.firestoreCollection = previous.length && previous.every((item) => item.firestoreCollection === 'events')
      ? 'events' : 'eventGroups';
    const optimistic = [normalized, ...previous];
    set({ events: optimistic, error: null });

    try {
      const saved = await createEvent(uid, normalized);
      if (get().activeLoadKey === loadKey) {
        set({
          events: [saved, ...get().events.filter((item) => item.id !== normalized.id && (item.firestoreId || item.id) !== (normalized.firestoreId || normalized.id))],
          error: null,
        });
      }
      return saved;
    } catch (error) {
      console.error('Failed to create event:', error);
      if (get().activeLoadKey === loadKey) {
        set({
          events: get().events.filter((item) => !sameEvent(item, normalized)),
          error: 'Unable to create the event. Your changes were restored.',
        });
      }
      throw error;
    }
  },

  updateEventItem: async (uid, isGuest, event) => {
    const normalizedEvent = { ...event, status: getEventStatus(event) };
    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = sampleData.events.map((item) => (
        sameEvent(item, normalizedEvent) ? { ...item, ...normalizedEvent } : item
      ));
      const previous = sampleData.events.find((item) => sameEvent(item, normalizedEvent));
      const updatedActivityIds = new Set((updated.find((item) => sameEvent(item, normalizedEvent))?.activities || []).map((item) => item.id));
      const removedActivityIds = new Set((previous?.activities || []).map((activity) => activity.id).filter((id) => !updatedActivityIds.has(id)));
      syncEventSampleData(sampleData, updated, { removedActivityIds });
      set({ events: updated, error: null });
      return normalizedEvent;
    }

    if (isGuest) {
      const updated = saveGuestEvent(normalizedEvent);
      set({ events: updated });
      return normalizedEvent;
    }

    const current = get().events;
    const previous = current.find((item) => sameEvent(item, normalizedEvent));
    const optimistic = current.map((item) => (
      sameEvent(item, normalizedEvent) ? { ...item, ...normalizedEvent } : item
    ));
    set({ events: optimistic, error: null });

    try {
      const updated = await updateEvent(uid, normalizedEvent);
      set({
        events: get().events.map((item) =>
          sameEvent(item, normalizedEvent) ? { ...item, ...updated } : item
        ),
      });
      return updated;
    } catch (error) {
      console.error('Failed to update event:', error);
      set({
        events: previous
          ? get().events.map((item) => (sameEvent(item, normalizedEvent) ? previous : item))
          : get().events,
        error: 'Unable to save the event. Your changes were restored.',
      });
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
      set({
        events: get().events.some((item) => sameEvent(item, event)) ? get().events : [event, ...get().events],
        error: 'Unable to delete the event. It has been restored.',
      });
      throw error;
    }
  },
  });
});

export default useEventStore;
