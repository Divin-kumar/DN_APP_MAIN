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

const getLoadKey = (principalId) => `device:${principalId || 'active'}`;

const projectEvents = async (principalId) => {
  const [moments, activities, memories, attachments, expenses] = await Promise.all([
    momentRepository.getAll(principalId),
    activityRepository.getAll(principalId),
    memoryRepository.getAll(principalId),
    attachmentRepository.getAll(principalId),
    expenseRepository.getAll(principalId),
  ]);

  return moments.map((moment) => {
    const momentActivityRows = activities.filter((activity) => activity.momentId === moment.id);
    const momentActivityIds = new Set(momentActivityRows.map((activity) => activity.id));
    const momentActivities = momentActivityRows.map((activity) => ({
      ...activity,
      eventId: moment.id,
      expenses: expenses.filter((expense) => expense.activityId === activity.id).map((expense) => ({
        ...expense,
        description: expense.description || expense.name || '',
        eventId: moment.id,
      })),
      attachments: attachments.filter((attachment) => attachment.parentLinks?.some((link) => link.parentType === 'activity' && link.parentId === activity.id)),
    }));
    const event = {
      ...moment,
      activities: momentActivities,
      memories: memories.filter((memory) => memory.momentId === moment.id).map((memory) => ({
        ...memory,
        eventId: moment.id,
        body: memory.body ?? memory.content ?? '',
      })),
      attachments: attachments.filter((attachment) => attachment.parentLinks?.some((link) => (link.parentType === 'moment' && link.parentId === moment.id) || (link.parentType === 'activity' && momentActivityIds.has(link.parentId))) || attachment.momentId === moment.id).map((attachment) => ({
        ...attachment,
        eventId: moment.id,
      })),
    };
    return { ...event, status: getEventStatus(event) };
  });
};

const saveChildRows = async (repository, principalId, momentId, previousRows = [], nextRows = [], map = (row) => row, { deferDeletes = false } = {}) => {
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  const nextById = new Map(nextRows.map((row) => [row.id, row]));
  for (const next of nextRows) {
    const record = map(next, momentId);
    if (previousById.has(next.id)) await repository.update(principalId, record);
    else await repository.create(principalId, record);
  }
  const removed = previousRows.filter((previous) => !nextById.has(previous.id));
  if (!deferDeletes) {
    for (const previous of removed) await repository.delete(principalId, previous.id);
  }
  return removed;
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

const saveAttachments = async (principalId, momentId, previousRows = [], nextRows = []) => {
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  const nextById = new Map(nextRows.map((row) => [row.id, row]));
  for (const row of nextRows) {
    if (previousById.has(row.id)) {
      const previous = previousById.get(row.id);
      const persistedFields = ['name', 'type', 'mimeType', 'size', 'fileReference', 'previewReference', 'availability'];
      const unchanged = persistedFields.every((field) => previous[field] === row[field]);
      if (unchanged) continue;
      const latest = await attachmentRepository.getById(principalId, row.id);
      if (latest) await attachmentRepository.update(principalId, { ...latest, ...row, momentId: latest.momentId });
      continue;
    }
    const legacyMomentLink = { parentType: 'moment', parentId: momentId };
    const links = row.parentLinks?.length ? row.parentLinks : (row.momentId ? [legacyMomentLink] : []);
    await attachmentRepository.create(principalId, { ...row, eventId: momentId, momentId: links.some((link) => link.parentType === 'moment') ? momentId : null }, { parentLinks: links, blob: row.blob || null });
  }
  for (const row of previousRows) if (!nextById.has(row.id)) await attachmentRepository.delete(principalId, row.id);
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

  loadEvents: async (uid) => {
    const loadKey = getLoadKey(uid);
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

        const principalId = await resolveRepositoryPrincipal();
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

  addEvent: async (uid, _legacyMode, event) => {
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

    const principalId = await resolveRepositoryPrincipal();
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
        DATABASE_TABLES.ATTACHMENT_LINKS,
        DATABASE_TABLES.ATTACHMENT_FILES,
        DATABASE_TABLES.EXPENSES,
      ].map((name) => db.table(name));
      let saved;
      await db.transaction('rw', ...tables, async () => {
        saved = await momentRepository.create(principalId, { ...moment, userId: principalId });
        for (const activity of activities) await activityRepository.create(principalId, { ...activity, eventId: saved.id, momentId: saved.id });
        for (const memory of memories) await memoryRepository.create(principalId, { ...memory, eventId: saved.id, momentId: saved.id, content: memory.body ?? memory.content ?? '' });
        for (const attachment of attachments) {
          const links = attachment.parentLinks?.length ? attachment.parentLinks : [{ parentType: 'moment', parentId: saved.id }];
          await attachmentRepository.create(principalId, { ...attachment, eventId: saved.id, momentId: links.some((link) => link.parentType === 'moment') ? saved.id : null }, { parentLinks: links, blob: attachment.blob || null });
        }
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

  updateEventItem: async (uid, _legacyMode, event) => {
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

    const principalId = await resolveRepositoryPrincipal();
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
        DATABASE_TABLES.ATTACHMENT_LINKS,
        DATABASE_TABLES.ATTACHMENT_FILES,
        DATABASE_TABLES.EXPENSES,
      ].map((name) => db.table(name));
      let updated;
      await db.transaction('rw', ...tables, async () => {
        updated = await momentRepository.update(principalId, { ...moment, userId: principalId });
        const removedActivities = await saveChildRows(activityRepository, principalId, updated.id, previousActivities, activities, (activity, momentId) => ({
          ...activity,
          eventId: momentId,
          momentId,
          completedAt: activity.completed ? (activity.completedAt || new Date().toISOString()) : null,
        }), { deferDeletes: true });
        await saveActivityExpenses(principalId, updated.id, previousActivities, activities);
        for (const activity of removedActivities) await activityRepository.delete(principalId, activity.id);
        await saveChildRows(memoryRepository, principalId, updated.id, previous?.memories || [], memories, (memory, momentId) => ({
          ...memory,
          eventId: momentId,
          momentId,
          content: memory.body ?? memory.content ?? '',
        }));
        await saveAttachments(principalId, updated.id, previous?.attachments || [], attachments);
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

  deleteEventItem: async (uid, _legacyMode, eventId) => {
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

    const principalId = await resolveRepositoryPrincipal();
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
        DATABASE_TABLES.ATTACHMENT_LINKS,
        DATABASE_TABLES.ATTACHMENT_FILES,
        DATABASE_TABLES.EXPENSES,
      ].map((name) => db.table(name));
      await db.transaction('rw', ...tables, async () => {
        await Promise.all([
          ...expenses.map((item) => expenseRepository.delete(principalId, item.id)),
        ]);
        await Promise.all([
          ...activities.map((item) => activityRepository.delete(principalId, item.id)),
          ...memories.map((item) => memoryRepository.delete(principalId, item.id)),
          ...attachments.map((item) => attachmentRepository.delete(principalId, item.id)),
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
  createAttachment: async (userId, attachment, parentLinks, blob = null) => {
    const principalId = userId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const created = await attachmentRepository.create(principalId, attachment, { parentLinks, blob });
    set({ events: await projectEvents(principalId), error: null });
    return created;
  },
  updateAttachmentLinks: async (userId, attachmentId, parentLinks) => {
    const principalId = userId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const links = await attachmentRepository.replaceParentLinks(principalId, attachmentId, parentLinks);
    set({ events: await projectEvents(principalId), error: null });
    return links;
  },
  relinkAttachment: async (userId, attachmentId, reference) => {
    const principalId = userId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const updated = await attachmentRepository.updateReference(principalId, attachmentId, reference);
    set({ events: await projectEvents(principalId), error: null });
    return updated;
  },
  replaceAttachmentFile: async (userId, attachmentId, file) => {
    const principalId = userId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const updated = await attachmentRepository.replaceFile(principalId, attachmentId, file);
    set({ events: await projectEvents(principalId), error: null });
    return updated;
  },
  deleteAttachment: async (userId, attachmentId) => {
    const principalId = userId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const deleted = await attachmentRepository.delete(principalId, attachmentId);
    set({ events: await projectEvents(principalId), error: null });
    return deleted;
  },
  getAttachmentBlob: async (userId, attachmentId) => {
    const principalId = userId || await resolveRepositoryPrincipal();
    if (!principalId) return null;
    return db.table(DATABASE_TABLES.ATTACHMENT_FILES).get(attachmentId).then((row) => row?.userId === principalId ? row.blob : null);
  },
  toggleActivityCompletion: async (userId, isGuest, activityId, targetEventId = null) => {
    const currentEvents = get().events;
    let foundEvent = null;
    let targetActivity = null;

    for (const event of currentEvents) {
      if (targetEventId && event.id !== targetEventId && event.firestoreId !== targetEventId) continue;
      const act = (event.activities || []).find((a) => a.id === activityId);
      if (act) {
        foundEvent = event;
        targetActivity = act;
        break;
      }
    }

    if (!foundEvent || !targetActivity) {
      throw new Error(`Activity ${activityId} not found.`);
    }

    const nextCompleted = !targetActivity.completed;
    const updatedActivity = {
      ...targetActivity,
      completed: nextCompleted,
      completedAt: nextCompleted ? (targetActivity.completedAt || new Date().toISOString()) : null,
      updatedAt: new Date().toISOString(),
    };

    const updatedActivities = (foundEvent.activities || []).map((a) =>
      a.id === activityId ? updatedActivity : a
    );

    return get().updateEventItem(userId, isGuest, {
      ...foundEvent,
      activities: updatedActivities,
    });
  },
  saveActivity: async (userId, isGuest, eventId, activityData) => {
    const currentEvents = get().events;
    const foundEvent = currentEvents.find((e) => e.id === eventId || e.firestoreId === eventId);
    if (!foundEvent) throw new Error(`Parent moment ${eventId} not found.`);

    const existingActivities = foundEvent.activities || [];
    const existingIndex = existingActivities.findIndex((a) => a.id === activityData.id);

    let nextActivities;
    if (existingIndex >= 0) {
      nextActivities = existingActivities.map((a, i) => (i === existingIndex ? { ...a, ...activityData, updatedAt: new Date().toISOString() } : a));
    } else {
      const newActivity = {
        id: activityData.id || crypto.randomUUID(),
        eventId: foundEvent.id || foundEvent.firestoreId,
        title: activityData.title || '',
        description: activityData.description || '',
        date: activityData.date || new Date().toISOString().slice(0, 10),
        time: activityData.time || '',
        priority: activityData.priority || 'medium',
        completed: Boolean(activityData.completed),
        completedAt: activityData.completed ? (activityData.completedAt || new Date().toISOString()) : null,
        createdAt: activityData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: activityData.attachments || [],
      };
      nextActivities = [...existingActivities, newActivity];
    }

    return get().updateEventItem(userId, isGuest, {
      ...foundEvent,
      activities: nextActivities,
    });
  },
  deleteActivity: async (userId, isGuest, eventId, activityId) => {
    const currentEvents = get().events;
    const foundEvent = currentEvents.find((e) => e.id === eventId || e.firestoreId === eventId);
    if (!foundEvent) return;

    const nextActivities = (foundEvent.activities || []).filter((a) => a.id !== activityId);
    return get().updateEventItem(userId, isGuest, {
      ...foundEvent,
      activities: nextActivities,
    });
  },
  });
});

export default useEventStore;
