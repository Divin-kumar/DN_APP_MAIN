import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ListChecks, Plus } from 'lucide-react';
import ActivityList from '../components/events/ActivityList';
import AttachmentGallery from '../components/common/AttachmentGallery';
import DateField from '../components/common/DateField';
import DropdownSelect from '../components/common/DropdownSelect';
import ListControls from '../components/common/ListControls';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import RichTextEditor from '../components/common/RichTextEditor';
import SortControl from '../components/common/SortControl';
import usePersistentListState from '../hooks/usePersistentListState';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import { getActivityMomentType, projectActivities, selectActivityEntries } from '../utils/activityRecords';
import { getActiveCodeListMeta } from '../utils/codeLists';
import { formatMomentDate, parseMomentDate } from '../utils/momentDates';
import { recordId } from '../utils/recordIdentity';
import { activityCompletionPatch, activityDetailPath, activityStatus } from '../utils/activityDetail';
import { scopedRecordActions as records } from '../services/scopedRecordActions';
import { getActiveSampleScenario } from '../dev/sampleData';
import { isRecordScopeLoaded } from '../utils/scopedRecordActions';

const EMPTY = Object.freeze([]);
const DEFAULTS = Object.freeze({ search: '', filter: 'all', momentId: '', momentType: '', parentScope: 'active', field: 'date', direction: 'asc' });
const FILTERS = Object.freeze([
  ['all', 'All'], ['in-progress', 'In progress'], ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
]);
const SORTS = Object.freeze([
  { value: 'date', label: 'Due date' }, { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' }, { value: 'status', label: 'Status' },
]);
const RULES = Object.freeze({
  filter: FILTERS.map(([value]) => value), parentScope: ['active', 'archived', 'all'],
  field: SORTS.map(({ value }) => value), direction: ['asc', 'desc'],
});
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
  const expenseStore = useExpenseStore();
  const [filters, changeFilters, resetFilters] = usePersistentListState('activities', DEFAULTS, RULES);
  const [draft, setDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const activeSession = () => mounted.current && scopeKey(useAppStore.getState()) === scope;

  const { loadEvents, updateEventItem } = eventStore;
  const { loadExpenses } = expenseStore;
  useEffect(() => {
    if (!uid && !isGuest) return;
    loadEvents(uid, isGuest);
    loadExpenses(uid, isGuest);
  }, [uid, isGuest, loadEvents, loadExpenses]);

  const ready = isRecordScopeLoaded(eventStore, scope, getActiveSampleScenario(uid));
  const expensesReady = isRecordScopeLoaded(expenseStore, scope, getActiveSampleScenario(uid));
  const events = ready ? eventStore.events : EMPTY;
  const expenses = expensesReady ? expenseStore.expenses : EMPTY;
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
  const selected = selectActivityEntries(projection.entries, filters);
  const allInScope = projection.entries.filter((entry) => (
    (!filters.momentId || entry.momentId === filters.momentId)
    && (!filters.momentType || entry.momentType === filters.momentType)
    && (filters.parentScope === 'all' || entry.archived === (filters.parentScope === 'archived'))
  ));
  const visible = selected.map((entry) => projection.views.get(entry.key));
  const expensesByActivity = Object.fromEntries(projection.entries.map((entry) => [entry.key,
    expenses.filter((expense) => recordId(expense.eventId) === entry.momentId && recordId(expense.activityId) === recordId(entry.activity.id)),
  ]));
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
  const updateActivity = (target, patch) => {
    resolve(target);
    return records.mutateActivity(mutationContext, target.momentId, target.activityId, patch);
  };

  const edit = (view) => {
    if (saving.current) return;
    const target = reference(view);
    const { activity } = resolve(target);
    setSaveError('');
    setDraft({ ...target, title: activity.title || '', date: formatMomentDate(parseMomentDate(activity.date)) || today(),
      priority: activity.priority || 'medium', description: activity.description || '' });
  };
  const saveActivity = (event) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.momentId) { setSaveError('Choose a Moment and enter an activity title.'); return; }
    runAction(async () => {
      const { moment } = resolve(draft);
      const values = { title: draft.title.trim(), date: draft.date, description: draft.description, priority: draft.priority };
      if (draft.activityId) return updateActivity(draft, () => values);
      return updateEventItem(uid, isGuest, { ...moment, activities: [...(moment.activities || []), {
        ...values, id: crypto.randomUUID(), eventId: draft.momentId, completed: false, completedAt: null, createdAt: new Date().toISOString(),
      }] });
    }, () => { setDraft(null); showToast(draft.activityId ? 'Activity updated' : 'Activity added', 'success'); });
  };
  const close = (setter) => { if (!saving.current) { setter(null); setSaveError(''); } };
  const currentMoment = events.find((item) => momentId(item) === filters.momentId);
  const momentTypes = [...new Set(events.map(getActivityMomentType))].sort((a, b) => a.localeCompare(b));
  const pickerMoments = events.filter((moment) => (!filters.momentType || getActivityMomentType(moment) === filters.momentType)
    && (filters.parentScope === 'all' || Boolean(moment.archived) === (filters.parentScope === 'archived')));
  const activeCount = Number(Boolean(filters.search.trim())) + Number(Boolean(filters.momentId))
    + Number(Boolean(filters.momentType))
    + Number(filters.filter !== 'all') + Number(filters.parentScope !== 'active') + Number(filters.field !== 'date' || filters.direction !== 'asc');
  const summary = [currentMoment?.name || (filters.momentId ? 'Saved Moment (unavailable)' : 'All Moments'),
    filters.momentType,
    filters.parentScope === 'active' ? 'Unarchived Moments' : filters.parentScope === 'archived' ? 'Archived Moments' : 'Including archived Moments',
    FILTERS.find(([value]) => value === filters.filter)?.[1], `${SORTS.find(({ value }) => value === filters.field)?.label} ${filters.direction === 'asc' ? '↑' : '↓'}`].filter(Boolean).join(' · ');

  return (
    <div className="events-page life-timeline-page">
      <header className="life-timeline-heading">
        <div><span className="life-timeline-eyebrow"><ListChecks size={13} /> Across your Moments</span><h2>Activities</h2><p>Find and manage your activities in one place.</p></div>
      </header>
      <div className="event-discovery-bar">
        <ListControls title="Activity filters" hasSort activeCount={activeCount} resultCount={visible.length} resultLabel="activities"
          summary={summary} onReset={resetFilters}
          sort={<div className="dn-list-controls-field"><span>Sort by</span>
            <SortControl field={filters.field} direction={filters.direction} onFieldChange={(field) => changeFilters({ field, direction: 'asc' })}
              onToggleDirection={() => changeFilters({ direction: filters.direction === 'asc' ? 'desc' : 'asc' })} options={SORTS} label="Sort activities" />
          </div>}
          search={<input type="search" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value })} placeholder="Search activities" aria-label="Search activities and Moments" />}>
          <div className="dn-list-controls-field"><label htmlFor="activities-status-filter">Status</label>
            <DropdownSelect id="activities-status-filter" value={filters.filter} onChange={(event) => changeFilters({ filter: event.target.value })}>
              {FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </DropdownSelect>
          </div>
          <div className="dn-list-controls-field"><label htmlFor="activities-moment-filter">Moment</label>
            <DropdownSelect id="activities-moment-filter" menuMinWidth={280} value={filters.momentId} onChange={(event) => changeFilters({ momentId: event.target.value })}>
              <option value="">All Moments</option>
              {filters.momentId && !currentMoment ? <option value={filters.momentId}>Saved Moment (unavailable)</option> : null}
              {currentMoment && !pickerMoments.includes(currentMoment) ? <option value={filters.momentId}>{currentMoment.name || 'Saved Moment'} (outside filters)</option> : null}
              {pickerMoments.map((moment) => <option key={momentId(moment)} value={momentId(moment)}>{moment.name || 'Untitled Moment'}{moment.archived ? ' (Archived)' : ''}</option>)}
            </DropdownSelect>
          </div>
          <div className="dn-list-controls-field"><label htmlFor="activities-type-filter">Moment type</label>
            <DropdownSelect id="activities-type-filter" value={filters.momentType} onChange={(event) => {
              const momentType = event.target.value;
              changeFilters({ momentType, momentId: currentMoment && momentType
                && getActivityMomentType(currentMoment) !== momentType ? '' : filters.momentId });
            }}>
              <option value="">All types</option>
              {filters.momentType && !momentTypes.includes(filters.momentType) ? <option value={filters.momentType}>{filters.momentType} (unavailable)</option> : null}
              {momentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </DropdownSelect>
          </div>
          <div className="dn-list-controls-field"><label htmlFor="activities-parent-filter">Moment visibility</label>
            <DropdownSelect id="activities-parent-filter" value={filters.parentScope} onChange={(event) => {
              const parentScope = event.target.value;
              changeFilters({ parentScope, momentId: currentMoment && parentScope !== 'all'
                && Boolean(currentMoment.archived) !== (parentScope === 'archived') ? '' : filters.momentId });
            }}>
              <option value="active">Unarchived Moments</option><option value="archived">Archived Moments</option><option value="all">All Moments</option>
            </DropdownSelect>
          </div>
        </ListControls>
      </div>
      {saveError && !draft ? <p className="quick-create-error" role="alert">{saveError}</p> : null}
      {busy ? <p role="status">Saving…</p> : null}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {eventStore.error === 'Unable to load events.' ? <div className="financial-load-error" role="alert"><span>Activities couldn’t be loaded.</span><button className="settings-secondary-button" onClick={() => loadEvents(uid, isGuest)}>Try again</button></div>
        : !ready || eventStore.loading ? <LoadingSkeleton rows={4} label="Loading activities" />
          : <ActivityList eventName="your Moments" activities={visible} allActivities={allInScope.map((entry) => projection.views.get(entry.key))}
            getActivityKey={(view) => projection.context.get(view).key}
            renderAttachments={(view) => {
              const entry = projection.context.get(view);
              const parent = events.find((moment) => momentId(moment) === entry.momentId);
              return <AttachmentGallery compact uid={uid} isGuest={isGuest} attachments={(parent?.attachments || []).filter((attachment) => recordId(attachment.activityId) === recordId(entry.activity.id))} />;
            }}
            getEventName={(view) => { const entry = projection.context.get(view); return <Link to={`/events/${encodeURIComponent(entry.momentId)}/activities`}>{entry.momentName}</Link>; }}
            expensesByActivity={expensesByActivity} showCancelled={filters.filter === 'cancelled'} hasActiveFilters={Boolean(activeCount)}
            onOpen={(view) => { const target = reference(view); resolve(target); navigate(activityDetailPath(target.momentId, target.activityId)); }}
            onEdit={edit}
            onToggleComplete={(_id, view) => runAction(() => updateActivity(reference(view), (activity, moment) => activityCompletionPatch(activity, moment, activityStatus(view) !== 'completed')), () => setAnnouncement(activityStatus(view) === 'completed' ? 'Activity reopened' : 'Activity completed'))}
            onToggleCancelled={(_id, view) => runAction(() => updateActivity(reference(view), (activity) => { const cancelled = activity.cancelled || activity.status === 'cancelled'; return { cancelled: !cancelled, status: cancelled ? activity.completed ? 'completed' : 'in-progress' : 'cancelled' }; }))}
            onDelete={(_id, view) => { if (!saving.current) { setSaveError(''); setDeleteTarget({ ...reference(view), title: view.title }); } }}
 />}
      {ready && !events.length ? <p className="dn-list-controls-note">Use + to create a Moment, then add its activities.</p> : null}
      {expenseStore.error ? <div className="financial-load-error" role="alert"><span>Linked expenses couldn’t be loaded.</span><button className="settings-secondary-button" onClick={() => loadExpenses(uid, isGuest)}>Try again</button></div> : null}
      {draft ? <ModalDialog title={draft.activityId ? 'Edit activity' : 'Add activity'} className="event-activity-editor-modal" onClose={() => close(setDraft)}>
        <form className="form-surface quick-create-activity-form" onSubmit={saveActivity}>
          {saveError ? <p className="quick-create-error" role="alert">{saveError}</p> : null}
          <label htmlFor="activity-editor-moment">Moment</label>
          <DropdownSelect id="activity-editor-moment" value={draft.momentId} disabled={Boolean(draft.activityId) || busy} onChange={(event) => setDraft({ ...draft, momentId: event.target.value })}>
            <option value="">Choose a Moment</option>{events.map((moment) => <option key={momentId(moment)} value={momentId(moment)}>{moment.name || 'Untitled Moment'}{moment.archived ? ' (Archived)' : ''}</option>)}
          </DropdownSelect>
          <input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Activity title" aria-label="Activity title" disabled={busy} />
          <DateField label="Date" name="activity-date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} disabled={busy} />
          <DropdownSelect value={draft.priority} aria-label="Activity priority" disabled={busy} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
            {!getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).some((option) => option.value === draft.priority) ? <option value={draft.priority}>{draft.priority}</option> : null}
            {getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </DropdownSelect>
          <RichTextEditor label="Activity notes" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} placeholder="Description (optional)" rows={4} disabled={busy} />
          <div className="form-actions"><button className="primaryButton" type="submit" disabled={busy}>{draft.activityId ? 'Save activity' : 'Add activity'}</button><button className="secondaryButton" type="button" disabled={busy} onClick={() => close(setDraft)}>Cancel</button></div>
        </form>
      </ModalDialog> : null}
      {deleteTarget ? <ConfirmDialog title="Delete activity?" message={`Delete “${deleteTarget.title || 'Untitled activity'}”? This cannot be undone.`} onCancel={() => close(setDeleteTarget)}
        busy={busy} error={saveError} onConfirm={() => runAction(() => records.mutateActivity(mutationContext, deleteTarget.momentId, deleteTarget.activityId, () => null), () => setDeleteTarget(null))} /> : null}


    </div>
  );
}
