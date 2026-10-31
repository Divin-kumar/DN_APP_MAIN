import { activityTime, activityTimePatch } from '../utils/activityTime.js';
import DebouncedFilterInput from '../components/common/DebouncedFilterInput';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActivityList from '../components/events/ActivityList';
import ActivityFormFields from '../components/events/ActivityFormFields';
import QuietEmptyState from '../components/common/QuietEmptyState';
import ListControls from '../components/common/ListControls';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import SortControl from '../components/common/SortControl';
import usePersistentListState from '../hooks/usePersistentListState';
import useListViewDefaults from '../hooks/useListViewDefaults';
import { matchesListDefaults } from '../utils/listViewDefaults';
import useConditionFilters from '../hooks/useConditionFilters';
import ConditionBuilder, { ConditionChips } from '../components/common/ConditionBuilder';
import { activityConditions as migrateActivityConditions, activityEntryConditionRecord } from '../utils/listConditionMigration';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import { projectActivities, selectActivityEntries } from '../utils/activityRecords';
import { formatMomentDate, parseMomentDate } from '../utils/momentDates';
import { recordId } from '../utils/recordIdentity';
import { activityCancellationPatch, activityCompletionPatch, activityDetailPath, activityStatus } from '../utils/activityDetail';
import { scopedRecordActions as records } from '../services/scopedRecordActions';
import { getActiveSampleScenario } from '../dev/sampleData';
import { assertActivityEditable, isRecordScopeLoaded } from '../utils/scopedRecordActions';
import { ACTIVITY_SORTS as SORTS, ACTIVITY_LIST_RULES as RULES } from '../utils/activityListState';

const EMPTY = Object.freeze([]);
const scopeKey = ({ user, isGuest }) => `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
const momentId = (moment) => recordId(moment.id) || recordId(moment.firestoreId);
const today = () => formatMomentDate(new Date());

export default function Activities() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const scope = scopeKey({ user, isGuest });
  // Remount drafts on account/guest changes as well as hiding stale store data.
  return <ActivitiesContent key={JSON.stringify([scope, getActiveSampleScenario(user?.uid)])} uid={user?.uid} isGuest={isGuest} scope={scope} />;
}

export function ActivitiesContent({ uid, isGuest, scope }) {
  const navigate = useNavigate();
  const mutationContext = records.capture();
  const [announcement, setAnnouncement] = useState('');
  const showToast = useAppStore((state) => state.showToast);
  const adminValues = useAppStore((state) => state.adminValues);
  const eventStore = useEventStore();
  const settingsDefaults = useListViewDefaults('activities');
  const [filters, changeFilters, resetFilters] = usePersistentListState('activities', settingsDefaults.filters, RULES);
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const activeSession = () => mounted.current && scopeKey(useAppStore.getState()) === scope;

  const { loadEvents, updateEventItem } = eventStore;
  useEffect(() => {
    if (!uid && !isGuest) return;
    loadEvents(uid, isGuest);
  }, [uid, isGuest, loadEvents]);

  const ready = isRecordScopeLoaded(eventStore, scope, getActiveSampleScenario(uid));
  const events = ready ? eventStore.events : EMPTY;
  const momentsById = useMemo(() => new Map(events.map((event) => [momentId(event), event])), [events]);
  const projection = useMemo(() => {
    const entries = projectActivities(events);
    const context = new WeakMap();
    const views = new Map(entries.map((entry) => {
      // All presentation context stays outside these copies and the stored records.
      const view = { ...entry.activity };
      context.set(view, entry);
      return [entry.key, view];
    }));
    return { entries, context, views };
  }, [events]);
  const conditionRecords = useMemo(() => projection.entries.map(activityEntryConditionRecord), [projection]);
  const conditions = useConditionFilters('activities', conditionRecords, usePersistentListState, {
    initialGroup: migrateActivityConditions(filters), contextKey: getActiveSampleScenario(uid),
    startingGroup: Object.keys(settingsDefaults.filters).every((key) => filters[key] === settingsDefaults.filters[key]) ? settingsDefaults.group : undefined,
  });
  const selected = useMemo(() => selectActivityEntries(conditionRecords, { search: filters.search, field: filters.field,
    direction: filters.direction, parentScope: 'all', includeCancelled: true }).filter(conditions.matches),
  [conditionRecords, filters.search, filters.field, filters.direction, conditions.matches]);
  const allInScope = projection.entries;
  const allViews = useMemo(() => allInScope.map((entry) => projection.views.get(entry.key)), [allInScope, projection.views]);
  const visible = selected.map((entry) => projection.views.get(entry.key));
  const reference = (view) => {
    const entry = projection.context.get(view);
    if (!entry) throw new Error('This activity is unavailable. Please reload and try again.');
    return { momentId: entry.momentId, activityId: recordId(entry.activity.id) };
  };
  const assertScope = () => {
    const current = useEventStore.getState();
    if (!activeSession() || !records.isCurrent(mutationContext) || !isRecordScopeLoaded(current, scope, getActiveSampleScenario(uid)) || current.loading) {
      throw new Error('The active account changed or its Moments are still loading. Please try again.');
    }
    return current;
  };
  const resolve = (target) => {
    const moment = assertScope().events.find((item) => momentId(item) === target.momentId);
    const activity = target.activityId && moment?.activities?.find((item) => recordId(item.id) === target.activityId);
    if (!moment || (target.activityId && !activity)) throw new Error('This Moment or activity is no longer available.');
    return { moment, activity };
  };
  const mutate = async (operation, after) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setSaveError('');
    try {
      assertScope();
      await operation();
      if (activeSession()) after?.();
    } catch (error) {
      if (activeSession()) {
        setSaveError(error?.message || 'Could not save this change. Please try again.');
        showToast(error?.message || 'Could not save this change. Please try again.', 'danger');
      }
      throw error;
    } finally {
      saving.current = false;
      if (activeSession()) setBusy(false);
    }
  };
  const runAction = (operation, after) => mutate(operation, after).catch(() => {});
  const updateActivity = (target, patch, operation = '') => {
    resolve(target);
    return records.mutateActivity(mutationContext, target.momentId, target.activityId, patch, operation);
  };

  const edit = (view) => {
    if (saving.current) return;
    try {
      const target = reference(view);
      const { activity } = resolve(target);
      assertActivityEditable(activity);
      setSaveError('');
      setDraft({ ...target, title: activity.title || '', time: activityTime(activity), date: formatMomentDate(parseMomentDate(activity.date)) || today(),
        priority: activity.priority || 'medium', description: activity.description || '' });
    } catch (error) { setSaveError(error.message); }
  };
  const saveActivity = (event) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.momentId) { setSaveError('Choose a Moment and enter an activity title.'); return; }
    runAction(async () => {
      const { moment, activity } = resolve(draft);
      const values = { title: draft.title.trim(), date: draft.date, ...activityTimePatch(activity || {}, draft.time), description: draft.description, priority: draft.priority };
      if (draft.activityId) return updateActivity(draft, () => values, 'edit');
      return updateEventItem(uid, isGuest, { ...moment, activities: [...(moment.activities || []), {
        ...values, id: crypto.randomUUID(), eventId: draft.momentId, completed: false, completedAt: null, createdAt: new Date().toISOString(),
      }] });
    }, () => { setDraft(null); showToast(draft.activityId ? 'Activity updated' : 'Activity added', 'success'); });
  };
  const close = (setter) => { if (!saving.current) { setter(null); setSaveError(''); } };
  const activeCount = conditions.activeCount;
  const resetActivityDiscovery = () => { resetFilters(); conditions.restore(settingsDefaults.group); };
  const canResetActivity = !matchesListDefaults(filters, settingsDefaults.filters, conditions.state.group, settingsDefaults.group);
  const summary = `${SORTS.find(({ value }) => value === filters.field)?.label} ${filters.direction === 'asc' ? '↑' : '↓'}`;

  return (
    <div className="events-page life-timeline-page activities-page">
      <div className="event-discovery-bar">
        <ListControls title="Activity filters" builder hasSort activeCount={activeCount} resultCount={visible.length} resultLabel="activities"
          summary={summary} chips={<ConditionChips filter={conditions} />} canReset={canResetActivity} onReset={resetActivityDiscovery}
          sort={<SortControl field={filters.field} direction={filters.direction} onFieldChange={(field) => changeFilters({ field, direction: 'asc' })}
            onToggleDirection={() => changeFilters({ direction: filters.direction === 'asc' ? 'desc' : 'asc' })} options={SORTS} label="Sort activities" />}
          search={<DebouncedFilterInput scopeKey={conditions.editorKey} type="search" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value })} placeholder="Search activities" aria-label="Search activities and Moments" />}>
          <ConditionBuilder filter={conditions} title="Activity conditions" />
        </ListControls>
      </div>
      {saveError && !draft ? <p className="quick-create-error" role="alert">{saveError}</p> : null}
      {busy ? <p role="status">Saving…</p> : null}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {eventStore.error === 'Unable to load events.' ? <div className="financial-load-error" role="alert"><span>Activities couldn’t be loaded.</span><button className="settings-secondary-button" onClick={() => loadEvents(uid, isGuest)}>Try again</button></div>
        : !ready || eventStore.loading ? <LoadingSkeleton rows={4} label="Loading activities" />
          : !visible.length ? <QuietEmptyState kind="activities" filtered={allInScope.length > 0} hasMoments={events.length > 0}
              onClear={allInScope.length && canResetActivity ? resetActivityDiscovery : undefined} />
          : <ActivityList eventName="your Moments" activities={visible} allActivities={allViews} progressActivities={allViews}
            progressLabel="overall active steps complete"
            getActivityKey={(view) => projection.context.get(view).key}
            getEventName={(view) => projection.context.get(view).momentName}
            getMoment={(view) => momentsById.get(projection.context.get(view).momentId)}
            visualCards uid={uid} isGuest={isGuest} sample={getActiveSampleScenario(uid)}
            includeCancelled hasActiveFilters={Boolean(activeCount || conditions.activeCount)}
            onOpen={(view) => { const target = reference(view); resolve(target); navigate(activityDetailPath(target.momentId, target.activityId), {
              state: { activityOrigin: '/activities',
                activitySequence: { scope: JSON.stringify([scope, getActiveSampleScenario(uid)]), ids: selected.map((entry) => [entry.momentId, recordId(entry.activity.id)]) } },
            }); }}
            onEdit={edit} disabled={busy}
            onToggleComplete={(_id, view) => runAction(() => updateActivity(reference(view), (activity, moment) => activityCompletionPatch(activity, moment, activityStatus(view) !== 'completed')), () => setAnnouncement(activityStatus(view) === 'completed' ? 'Activity reopened' : 'Activity completed'))}
            onToggleCancelled={(_id, view) => runAction(
              () => updateActivity(reference(view), (activity) => activityCancellationPatch(activity, activityStatus(activity) !== 'cancelled')),
              () => setAnnouncement(activityStatus(view) === 'cancelled' ? 'Activity restored' : 'Activity cancelled'),
            )}
            onDelete={(_id, view) => { if (!saving.current) { setSaveError(''); setDeleteTarget({ ...reference(view), title: view.title }); } }}
 />}
      {draft ? <ModalDialog title={draft.activityId ? 'Edit activity' : 'Add activity'} className="event-activity-editor-modal" onClose={() => close(setDraft)}>
        <form className="form-surface quick-create-activity-form" onSubmit={saveActivity}>
          {saveError ? <p className="quick-create-error" role="alert">{saveError}</p> : null}
          <p className="dn-form-context">Moment · <strong>{momentsById.get(draft.momentId)?.name || 'This Moment'}</strong></p>
          <ActivityFormFields namePrefix="activity-editor" value={draft}
            priorities={adminValues.activityPriorities} disabled={busy}
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))} />
          <div className="form-actions"><button className="primaryButton" type="submit" disabled={busy}>{draft.activityId ? 'Save activity' : 'Add activity'}</button><button className="secondaryButton" type="button" disabled={busy} onClick={() => close(setDraft)}>Cancel</button></div>
        </form>
      </ModalDialog> : null}
      {deleteTarget ? <ConfirmDialog title="Delete activity?" message={`Delete “${deleteTarget.title || 'Untitled activity'}”? This cannot be undone.`} onCancel={() => close(setDeleteTarget)}
        busy={busy} error={saveError} onConfirm={() => runAction(() => records.mutateActivity(mutationContext, deleteTarget.momentId, deleteTarget.activityId, () => null), () => setDeleteTarget(null))} /> : null}


    </div>
  );
}
