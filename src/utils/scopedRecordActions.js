import { recordId } from './recordIdentity.js';

export const recordScopeKey = ({ user, isGuest }) => `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
export const momentRecordId = (moment) => recordId(moment?.id) || recordId(moment?.firestoreId);
export const isRecordScopeLoaded = (state, scope, sample = null) => Boolean(state
  && state.loadedFor === scope && state.activeLoadKey === scope
  && (state.loadedSample ?? null) === sample && (state.activeSample ?? null) === sample);

// A client-side queue shared by every Activity view and finance mirror writer.
// Context is runtime-only; no routing/scope information is added to a record.
export function createScopedRecordActions({ getSession, getEvents, getSample = () => null }) {
  const parents = new Map();
  const operations = new Map();
  const capture = () => {
    const session = getSession();
    return { scope: recordScopeKey(session), uid: session.user?.uid || null, isGuest: Boolean(session.isGuest),
      sample: getSample(session.user?.uid), revision: getEvents().scopeRevision || 0 };
  };
  const isCurrent = (context) => {
    const session = getSession();
    return Boolean(context && (session.user?.uid || session.isGuest)
      && context.scope === recordScopeKey(session) && context.uid === (session.user?.uid || null)
      && context.isGuest === Boolean(session.isGuest) && context.sample === getSample(session.user?.uid)
      && context.revision === (getEvents().scopeRevision || 0));
  };
  const resolveMoment = (context, eventId) => {
    const state = getEvents();
    if (!isCurrent(context) || !isRecordScopeLoaded(state, context.scope, context.sample) || state.loading) {
      throw new Error('Your session changed or Moments are still loading. Reopen the record and try again.');
    }
    const moment = state.events.find((item) => momentRecordId(item) === recordId(eventId));
    if (!moment) throw new Error('This Moment is no longer available.');
    return moment;
  };
  const resolveActivity = (context, eventId, activityId) => {
    const moment = resolveMoment(context, eventId);
    const activity = moment.activities?.find((item) => recordId(item.id) === recordId(activityId));
    if (!activity) throw new Error('This activity is no longer available in this Moment.');
    return { moment, activity };
  };
  const mutateMoment = (context, eventId, updater, operation = '') => {
    // The same physical parent keeps its queue through A → B → A. A new load
    // revision must not send a second parent write ahead of an older request.
    const key = JSON.stringify([context.scope, context.sample, recordId(eventId)]);
    const operationKey = operation && JSON.stringify([key, context.revision, operation]);
    if (operationKey && operations.has(operationKey)) return Promise.resolve(false);
    const previous = parents.get(key) || Promise.resolve();
    const task = previous.catch(() => {}).then(async () => {
      const moment = resolveMoment(context, eventId);
      const next = updater(moment);
      if (!next || next === moment) return false;
      await getEvents().updateEventItem(context.uid, context.isGuest, next);
      return true;
    });
    parents.set(key, task);
    if (operationKey) operations.set(operationKey, task);
    const clear = () => {
      if (parents.get(key) === task) parents.delete(key);
      if (operationKey && operations.get(operationKey) === task) operations.delete(operationKey);
    };
    task.then(clear, clear);
    return task;
  };
  const mutateActivity = (context, eventId, activityId, updater, operation = '') => mutateMoment(context, eventId, (moment) => {
    const activity = moment.activities?.find((item) => recordId(item.id) === recordId(activityId));
    if (!activity) throw new Error('This activity is no longer available in this Moment.');
    const patch = updater(activity, moment);
    if (patch === undefined) return moment;
    return { ...moment, activities: patch === null
      ? moment.activities.filter((item) => recordId(item.id) !== recordId(activityId))
      : moment.activities.map((item) => item === activity ? { ...item, ...patch, id: item.id } : item) };
  }, operation && `${recordId(activityId)}:${operation}`);
  return { capture, isCurrent, resolveMoment, resolveActivity, mutateMoment, mutateActivity };
}
