/*
  Event state actions coordinate persistence and the Events workspace.

  This store is the central data layer for life moments and activities.
  It loads event data, saves new events, edits existing ones, and deletes them.
*/
import { create } from 'zustand';
import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { activityRepository, attachmentRepository, expenseRepository, memoryRepository, momentRepository } from '../repositories/index.js';
import { getActiveSampleData, saveActiveSampleData } from '../dev/sampleData.js';
import { getEventStatus } from '../utils/eventStatus.js';
import { resolveRepositoryPrincipal } from './repositoryRuntime.js';

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

const projectEvents = async (principalId) => {
  const [moments, activities, memories, attachments, expenses] = await Promise.all([
    momentRepository.getAll(principalId),
    activityRepository.getAll(principalId),
    memoryRepository.getAll(principalId),
    attachmentRepository.getAll(principalId),
    expenseRepository.getAll(principalId),
  ]);

  return moments.map((moment) => {
    const momentActivities = activities.filter((activity) => activity.momentId === moment.id).map((activity) => ({
      ...activity,
      eventId: moment.id,
      expenses: expenses.filter((expense) => expense.activityId === activity.id).map((expense) => ({
        ...expense,
        description: expense.description || expense.name || '',
        eventId: moment.id,
      })),
    }));
    const event = {
      ...moment,
      activities: momentActivities,
      memories: memories.filter((memory) => memory.momentId === moment.id).map((memory) => ({
        ...memory,
        eventId: moment.id,
        body: memory.body ?? memory.content ?? '',
      })),
      attachments: attachments.filter((attachment) => attachment.momentId === moment.id).map((attachment) => ({
        ...attachment,
        eventId: moment.id,
      })),
    };
    return { ...event, status: getEventStatus(event) };
  });
};

const saveChildRows = async (repository, principalId, momentId, previousRows = [], nextRows = [], map = (row) => row) => {
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  const nextById = new Map(nextRows.map((row) => [row.id, row]));
  for (const next of nextRows) {
    const record = map(next, momentId);
    if (previousById.has(next.id)) await repository.update(principalId, record);
    else await repository.create(principalId, record);
  }
  for (const previous of previousRows) {
    if (!nextById.has(previous.id)) await repository.delete(principalId, previous.id);
  }
};

const saveActivityExpenses = async (principalId, momentId, previousActivities, nextActivities) => {
  const previous = previousActivities.flatMap((activity) => activity.expenses || []);
  const next = nextActivities.flatMap((activity) => activity.expenses || []);
  await saveChildRows(expenseRepository, principalId, momentId, previous, next, (expense, eventId) => ({
    ...expense,
    name: expense.name || expense.description || 'Expense',
    eventId,
    momentId: eventId,
    source: expense.source || 'manual',
  }));
};

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

    const accountChanged = get().activeLoadKey && get().activeLoadKey !== loadKey;
    set({ loading: true, error: null, activeLoadKey: loadKey, ...(accountChanged ? { events: [] } : {}) });

    const request = Promise.resolve().then(async () => {
      try {
        const sampleData = getActiveSampleData(uid);
        if (sampleData) {
          if (get().activeLoadKey === loadKey) set({ events: sampleData.events, loading: false, error: null, loadedFor: loadKey });
          return sampleData.events;
        }

        const principalId = await resolveRepositoryPrincipal(uid, isGuest);
        if (!principalId) throw new Error('No active repository principal is available.');
        const items = await projectEvents(principalId);
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
    normalized.status = getEventStatus(normalized);

    const sampleData = getActiveSampleData(uid);
    if (sampleData) {
      const updated = [normalized, ...sampleData.events];
      syncEventSampleData(sampleData, updated);
      set({ events: updated });
      return normalized;
    }

    const principalId = await resolveRepositoryPrincipal(uid, isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = get().events;
    const optimistic = [normalized, ...previous];
    set({ events: optimistic, error: null });

    try {
      const { activities = [], memories = [], attachments = [], ...moment } = normalized;
      const tables = [
        DATABASE_TABLES.MOMENTS,
        DATABASE_TABLES.ACTIVITIES,
        DATABASE_TABLES.MEMORIES,
        DATABASE_TABLES.ATTACHMENTS,
        DATABASE_TABLES.EXPENSES,
      ].map((name) => db.table(name));
      let saved;
      await db.transaction('rw', ...tables, async () => {
        saved = await momentRepository.create(principalId, { ...moment, userId: principalId });
        for (const activity of activities) await activityRepository.create(principalId, { ...activity, eventId: saved.id, momentId: saved.id });
        for (const memory of memories) await memoryRepository.create(principalId, { ...memory, eventId: saved.id, momentId: saved.id, content: memory.body ?? memory.content ?? '' });
        for (const attachment of attachments) await attachmentRepository.create(principalId, { ...attachment, eventId: saved.id, momentId: saved.id });
        await saveActivityExpenses(principalId, saved.id, [], activities);
      });
      const projected = await projectEvents(principalId);
      set({
        events: projected,
        error: null,
      });
      return saved;
    } catch (error) {
      console.error('Failed to create event:', error);
      set({
        events: get().events.filter((item) => !sameEvent(item, normalized)),
        error: 'Unable to create the event. Your changes were restored.',
      });
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

    const principalId = await resolveRepositoryPrincipal(uid, isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const current = get().events;
    const previous = current.find((item) => sameEvent(item, normalizedEvent));
    const optimistic = current.map((item) => (
      sameEvent(item, normalizedEvent) ? { ...item, ...normalizedEvent } : item
    ));
    set({ events: optimistic, error: null });

    try {
      const { activities = [], memories = [], attachments = [], ...moment } = normalizedEvent;
      const previousActivities = previous?.activities || [];
      const tables = [
        DATABASE_TABLES.MOMENTS,
        DATABASE_TABLES.ACTIVITIES,
        DATABASE_TABLES.MEMORIES,
        DATABASE_TABLES.ATTACHMENTS,
        DATABASE_TABLES.EXPENSES,
      ].map((name) => db.table(name));
      let updated;
      await db.transaction('rw', ...tables, async () => {
        updated = await momentRepository.update(principalId, { ...moment, userId: principalId });
        await saveChildRows(activityRepository, principalId, updated.id, previousActivities, activities, (activity, momentId) => ({
          ...activity,
          eventId: momentId,
          momentId,
          completedAt: activity.completed ? (activity.completedAt || new Date().toISOString()) : null,
        }));
        await saveActivityExpenses(principalId, updated.id, previousActivities, activities);
        await saveChildRows(memoryRepository, principalId, updated.id, previous?.memories || [], memories, (memory, momentId) => ({
          ...memory,
          eventId: momentId,
          momentId,
          content: memory.body ?? memory.content ?? '',
        }));
        await saveChildRows(attachmentRepository, principalId, updated.id, previous?.attachments || [], attachments, (attachment, momentId) => ({
          ...attachment,
          eventId: momentId,
          momentId,
        }));
      });
      set({ events: await projectEvents(principalId), error: null });
      return { ...updated, activities, memories, attachments, status: getEventStatus({ ...updated, activities }) };
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

    const principalId = await resolveRepositoryPrincipal(uid, isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const remaining = current.filter((item) => item.id !== eventId && item.firestoreId !== eventId);
    set({ events: remaining, error: null });

    try {
      const momentId = event.id;
      const [activities, memories, attachments, expenses] = await Promise.all([
        activityRepository.getByMoment(principalId, momentId),
        memoryRepository.getByMoment(principalId, momentId),
        attachmentRepository.getByMoment(principalId, momentId),
        expenseRepository.getByEvent(principalId, momentId),
      ]);
      const tables = [
        DATABASE_TABLES.MOMENTS,
        DATABASE_TABLES.ACTIVITIES,
        DATABASE_TABLES.MEMORIES,
        DATABASE_TABLES.ATTACHMENTS,
        DATABASE_TABLES.EXPENSES,
      ].map((name) => db.table(name));
      await db.transaction('rw', ...tables, async () => {
        await Promise.all([
          ...activities.map((item) => activityRepository.delete(principalId, item.id)),
          ...memories.map((item) => memoryRepository.delete(principalId, item.id)),
          ...attachments.map((item) => attachmentRepository.delete(principalId, item.id)),
          ...expenses.map((item) => expenseRepository.delete(principalId, item.id)),
        ]);
        await momentRepository.delete(principalId, momentId);
      });
      set({ events: await projectEvents(principalId), error: null });
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
