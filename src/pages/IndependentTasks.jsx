import MobileControlsSlot from '../components/common/MobileControlsSlot';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Check, ListTodo, Pencil, Repeat, RotateCcw, Search, SkipForward, SlidersHorizontal, X, XCircle } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import { RepeatActionSummary } from '../components/common/RepeatField';
import SwipeActionCard from '../components/common/SwipeActionCard';
import TaskEditor, { TaskRepeatActionSummary } from '../components/tasks/TaskEditor';
import TaskRefineSheet, { TASK_VIEW_DEFAULTS, TASK_VIEW_RULES } from '../components/tasks/TaskRefineSheet';
import { ConditionChips } from '../components/common/ConditionBuilder';
import { conditionCount, emptyGroup, normalizeConditionGroup } from '../utils/conditionEngine.js';
import { taskFilterFields, taskViewConditionGroup } from '../utils/taskConditionFields.js';
import { filterTaskResults } from '../utils/taskListFilters.js';
import { configuredConditionGroup, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES } from '../utils/listViewDefaults.js';
import usePersistentListState from '../hooks/usePersistentListState';
import useDashboardClock from '../features/dashboard/useDashboardClock';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useTaskStore, { taskScopeKey } from '../store/useTaskStore';
import { repeatingTaskOccurrenceId, sortIndependentTasks, resolveIndependentTaskParent } from '../utils/independentTasks.js';
import { formatMomentDate } from '../utils/momentDates.js';
import { previewNextRepeat, REPEAT_OPTIONS } from '../utils/repeatSchedule.js';
import { getActiveSampleScenario } from '../dev/sampleData';
import { isRecordScopeLoaded } from '../utils/scopedRecordActions';
import '../components/common/ListControls.css';
import './IndependentTasks.css';

const EMPTY = Object.freeze([]);
const formatDate = (value) => {
  if (!value) return 'No due date';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const statusLabel = (status) => status === 'in-progress' ? 'In progress' : status === 'completed' ? 'Completed' : 'Cancelled';
const taskDueLabel = (task, date = task.dueDate) => `${formatDate(date)}${task.dueTime ? ` · ${task.dueTime}` : ''}`;

export default function IndependentTasks() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  return <TaskListContent key={taskScopeKey({ user, isGuest })} />;
}
export function TaskListContent() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const toast = useAppStore((state) => state.showToast);
  const store = useTaskStore();
  const eventStore = useEventStore();
  const scope = taskScopeKey({ user, isGuest });
  const enabled = isGuest || Boolean(user?.uid);
  const pendingRef = useRef(false);
  const focusedTaskRef = useRef('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { state: arrival } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, changeView] = usePersistentListState('tasks', TASK_VIEW_DEFAULTS, TASK_VIEW_RULES);
  const [savedTaskSort] = usePersistentListState('defaults:tasks', TASK_VIEW_DEFAULTS, TASK_VIEW_RULES);
  const [savedTaskFilters] = usePersistentListState('conditions:defaults:tasks', LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES);
  const resetDefaults = useMemo(() => ({ ...savedTaskSort,
    group: configuredConditionGroup('tasks', savedTaskFilters) }), [savedTaskSort, savedTaskFilters]);
  const [editor, setEditor] = useState(null);
  const [selection, setSelection] = useState(null);
  const selectedTaskId = selection?.id;
  const [refine, setRefine] = useState(false);
  const [showAllTaskFilters, setShowAllTaskFilters] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const today = formatMomentDate(useDashboardClock());

  useEffect(() => { store.loadTasks(); }, [store.loadTasks, scope]);
  useEffect(() => { if (enabled) eventStore.loadEvents(user?.uid, isGuest); }, [enabled, eventStore.loadEvents, scope, user?.uid, isGuest]);
  useEffect(() => {
    if (!enabled || searchParams.get('create') !== '1') return;
    setEditor({ kind: 'new', value: { momentId: searchParams.get('moment') || '', activityId: searchParams.get('activity') || '' } });
    const next = new URLSearchParams(searchParams);
    next.delete('create'); next.delete('moment'); next.delete('activity');
    setSearchParams(next, { replace: true });
  }, [enabled, searchParams, setSearchParams]);

  const ready = store.loadedFor === scope;
  const tasks = enabled && ready && !store.error ? store.tasks : EMPTY;
  const eventReady = isRecordScopeLoaded(eventStore, `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`, getActiveSampleScenario(user?.uid));
  const moments = enabled && eventReady ? eventStore.events : EMPTY;
  const matches = useMemo(() => filterTaskResults(tasks, view, today, moments), [tasks, view, today, moments]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const nextTask = selection?.fromRepeat && selectedTask?.status === 'in-progress' && selectedTask.repeat ? selectedTask : null;
  const highlightedOutsideFilters = Boolean(selectedTask && !matches.some((task) => task.id === selectedTask.id));
  const displayedTasks = useMemo(() => {
    const sorted = sortIndependentTasks(matches, view.direction, view.field);
    return highlightedOutsideFilters ? [selectedTask, ...sorted] : sorted;
  }, [matches, view.direction, view.field, selectedTask, highlightedOutsideFilters]);
  const viewGroup = useMemo(() => taskViewConditionGroup(view), [view]);
  const activeFilterCount = conditionCount(viewGroup);
  const filterSchema = useMemo(() => taskFilterFields(tasks, moments, today), [tasks, moments, today]);
  const appliedFilterControls = {
    schema: filterSchema, state: { group: viewGroup }, editorKey: 'task-chips:' + scope,
    activeCount: activeFilterCount,
    setGroup: (change) => changeView({
      group: normalizeConditionGroup(typeof change === 'function' ? change(viewGroup) : change),
      status: 'all', priority: 'all', due: 'all',
    }),
  };
  useEffect(() => {
    if (!enabled || !ready || searchParams.has('create')) return;
    const requested = searchParams.get('task');
    if (!requested) return;
    // The account listener may deliver a just-created occurrence after the link is followed.
    const fromRepeat = arrival?.nextTaskId === requested;
    if (fromRepeat || tasks.some((task) => task.id === requested)) setSelection({ id: requested, fromRepeat });
    else setNotice('The selected Task is no longer available.');
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [arrival, enabled, ready, searchParams, setSearchParams, tasks]);
  useEffect(() => {
    if (!selectedTaskId) { focusedTaskRef.current = ''; return undefined; }
    if (focusedTaskRef.current === selectedTaskId || !selectedTask) return undefined;
    const frame = requestAnimationFrame(() => {
      const row = [...document.querySelectorAll('.dn-independent-task-row[data-task-id]')]
        .find((item) => item.dataset.taskId === selectedTaskId);
      if (!row) return;
      focusedTaskRef.current = selectedTaskId;
      row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      row.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedTaskId, selectedTask]);
  const active = matches.filter((task) => task.status === 'in-progress').length;
  const completed = matches.filter((task) => task.status === 'completed').length;
  const run = async (change, message) => {
    if (pendingRef.current) return null;
    pendingRef.current = true; setBusy(true);
    try {
      const result = await change();
      setError(''); setNotice(message);
      return result;
    } catch (cause) {
      setError(cause?.message || 'Task could not be saved.');
      return null;
    } finally { pendingRef.current = false; setBusy(false); }
  };
  const save = async (patch) => {
    const item = await run(() => store.saveTask(patch), patch.id ? 'Task saved' : 'Task created');
    if (item) { setEditor(null); toast(patch.id ? 'Task updated' : 'Task created', 'success'); }
  };
  const statusChange = async (task, status) => {
    const nextDate = ['completed', 'skip'].includes(status) && previewNextRepeat(task, task.repeat?.frequency, task.dueDate);
    const pausing = task.repeat && status === 'cancelled';
    const resuming = task.repeat && task.status === 'cancelled' && status === 'in-progress';
    const saved = await run(() => store.setTaskStatus(task.id, status, task.updatedAt),
      nextDate || pausing || resuming ? '' : status === 'completed' ? 'Task completed' : 'Task status updated');
    if (!saved) return false;
    setConfirm(null);
    if (task.id === nextTask?.id) setSelection(null);
    if (taskScopeKey(useAppStore.getState()) !== scope) return true;
    if (nextDate) {
      const nextTaskId = repeatingTaskOccurrenceId(task.repeat, nextDate);
      const message = `Task ${status === 'skip' ? 'skipped' : 'completed'}. Next due ${taskDueLabel(task, nextDate)}.`;
      toast(message, 'success', { label: 'View next', onClick: () => {
        if (taskScopeKey(useAppStore.getState()) === scope) {
          navigate(`/tasks?task=${encodeURIComponent(nextTaskId)}`, { replace: true, state: { nextTaskId } });
        }
      } });
    } else if (pausing) {
      toast('Repeat paused.', 'success');
    } else if (resuming) {
      toast(`Repeat resumed. Due ${taskDueLabel(saved)}.`, 'success', { duration: 5000 });
    }
    return true;
  };
  const remove = async (task) => {
    if (await run(() => store.removeTask(task.id, task.updatedAt), 'Task deleted')) {
      setConfirm(null);
      if (selectedTaskId === task.id) setSelection(null);
    }
  };
  if (!enabled) return <div className="dn-tasks-page">
    <section className="dn-task-empty" role="status"><ListTodo size={28} aria-hidden="true" />
      <h3>Open a workspace to use Tasks</h3>
      <p>Sign in to sync your Tasks, or continue as Guest to keep them on this device.</p>
      <p>Guest Tasks remain on the original device. Export a backup before changing sessions.</p>
      <Link to="/activities">Open Activities</Link>
    </section>
  </div>;

  const isSkip = confirm?.kind === 'skip';
  const isDelete = confirm?.kind === 'delete';
  const confirmLabel = isDelete ? 'Delete Task' : isSkip ? 'Skip occurrence' : confirm?.task.repeat ? 'Pause repeat' : 'Cancel Task';
  const skipNextDate = isSkip && previewNextRepeat(confirm.task, confirm.task.repeat.frequency, confirm.task.dueDate);
  return <div className="dn-tasks-page">
    <div className="dn-task-metrics" aria-label="Task summary">
      <span><strong>{matches.length}</strong> All Tasks</span>
      <span><strong>{active}</strong> In progress</span>
      <span><strong>{completed}</strong> Completed</span>
    </div>
    {store.error ? <p className="dn-task-feedback" role="alert">{store.error} <button type="button" onClick={() => store.loadTasks()}>Retry</button></p> : null}
    {error && !editor && !confirm ? <p className="dn-task-feedback" role="alert">{error}</p> : null}
    {notice ? <p className="sr-only" role="status" aria-live="polite">{notice}</p> : null}
    <div className="dn-list-controls dn-task-discovery">
      <MobileControlsSlot><div className="dn-list-controls-row">
        <div className="dn-list-controls-search">
          <Search className="dn-list-controls-search-icon" size={18} aria-hidden="true" />
          <input type="search" aria-label="Search Tasks" value={view.search}
            onChange={(event) => changeView({ search: event.target.value })} placeholder="Search Tasks" />
          {view.search ? <button type="button" className="dn-search-clear" aria-label="Clear Task search"
            title="Clear Task search" onPointerDown={(event) => event.preventDefault()}
            onClick={() => changeView({ search: '' })}><X size={17} aria-hidden="true" /></button> : null}
        </div>
        <button type="button" className={`dn-list-controls-trigger${activeFilterCount ? ' is-active' : ''}`}
          aria-label="Refine" aria-haspopup="dialog" aria-expanded={refine} onClick={() => setRefine(true)}>
          <SlidersHorizontal size={17} aria-hidden="true" /><span>Refine</span>
          {activeFilterCount ? <span className="dn-list-controls-badge" aria-hidden="true">{activeFilterCount}</span> : null}
        </button>
      </div></MobileControlsSlot>
      <div className="dn-task-discovery-summary">
        <span aria-live="polite">{displayedTasks.length} {displayedTasks.length === 1 ? 'Task' : 'Tasks'} shown · Tap or swipe for actions</span>
        {activeFilterCount ? <ConditionChips filter={appliedFilterControls}
          maxVisible={showAllTaskFilters ? undefined : 2}
          onShowMore={() => setShowAllTaskFilters(true)}
          onShowLess={showAllTaskFilters ? () => setShowAllTaskFilters(false) : undefined} /> : null}
      </div>
    </div>
    {!ready && !store.error ? <p role="status">Loading Tasks…</p> : null}
    {ready && !store.error && !tasks.length ? <div className="dn-task-empty" role="status">
      <ListTodo size={28} aria-hidden="true" />
      <h3>A clear start</h3>
      <p>Use the universal <strong>+</strong> to create a Task. Keep it standalone or link it to a Moment.</p>
    </div> : null}
    {ready && tasks.length > 0 && displayedTasks.length === 0
      ? <div className="dn-task-empty" role="status"><Search size={24} aria-hidden="true" />
        <h3>No matching Tasks</h3><p>Try another search or change your Refine selections.</p>
        <div className="dn-task-empty-actions">
          {view.search ? <button type="button" onClick={() => changeView({ search: '' })}>Clear search</button> : null}
          {activeFilterCount ? <button type="button" onClick={() => changeView({
            group: emptyGroup(), status: 'all', priority: 'all', due: 'all',
          })}>Clear filters</button> : null}
        </div>
      </div> : null}
    {selectedTask ? <div className="dn-task-dashboard-arrival">
      <div role="status" className="dn-task-arrival-status">
        {nextTask ? <strong>Next occurrence · <time dateTime={nextTask.dueTime ? `${nextTask.dueDate}T${nextTask.dueTime}` : nextTask.dueDate}>
          {taskDueLabel(nextTask)}
        </time></strong> : null}
        {highlightedOutsideFilters ? <span>Selected Task is shown outside your current filters.</span>
          : !nextTask ? <span>Selected Task highlighted. Tap it for actions.</span> : null}
      </div>
      <button type="button" onClick={() => setSelection(null)}>Dismiss</button>
    </div> : null}
    <div className="dn-task-list" aria-label="Task list">
      {displayedTasks.map((task) => {
        const parent = resolveIndependentTaskParent(task, moments);
        const context = parent.kind === 'activity' ? `${parent.moment.name} · ${parent.activity.title || 'Activity'}`
          : parent.kind === 'moment' ? parent.moment.name
            : parent.kind === 'standalone' ? 'Standalone'
              : parent.kind === 'missing-activity' ? `${parent.moment.name || 'Moment'} · Activity unavailable` : 'Moment unavailable';
        const hasActiveDueDate = task.status === 'in-progress' && Boolean(task.dueDate);
        const overdue = hasActiveDueDate && task.dueDate < today;
        const dueToday = hasActiveDueDate && task.dueDate === today;
        const dueLabel = dueToday ? 'Due today' : overdue ? 'Overdue' : '';
        const repeatLabel = task.repeat && (task.status === 'cancelled' ? 'Repeat paused' : `Repeats ${REPEAT_OPTIONS[task.repeat.frequency].toLowerCase()}`);
        const actionDescription = nextTask?.id === task.id ? `Next occurrence, ${taskDueLabel(task)}.`
          : repeatLabel ? `${[dueLabel, taskDueLabel(task), repeatLabel].filter(Boolean).join('. ')}.` : undefined;
        const edit = () => { setError(''); setEditor({ kind: 'edit', value: task }); };
        return <SwipeActionCard key={task.id} as="article" taskId={task.id}
          className={`dn-independent-task-row${selectedTaskId === task.id ? ' is-dashboard-selected' : ''}`}
          mainClassName="dn-independent-task-row-main"
          label={task.title} role="button" openOnTap disabled={busy || Boolean(store.error)}
          actionDescription={actionDescription}
          otherActions={[
            ...(task.status === 'cancelled' ? [] : [{ label: task.status === 'completed' ? 'Reopen' : 'Done', icon: Check,
              onClick: () => statusChange(task, task.status === 'completed' ? 'in-progress' : 'completed') }]),
            { label: 'Edit', icon: Pencil, onClick: edit },
            ...(task.repeat && task.status === 'in-progress'
              ? [{ label: 'Skip this occurrence', icon: SkipForward,
                onClick: () => { setError(''); setConfirm({ kind: 'skip', task }); } }] : []),
            task.status === 'cancelled'
              ? { label: task.repeat ? 'Resume repeat' : 'Restore', icon: RotateCcw, onClick: () => statusChange(task, 'in-progress') }
              : { label: task.repeat ? 'Pause repeat' : 'Cancel', icon: XCircle, onClick: () => { setError(''); setConfirm({ kind: 'cancel', task }); } },
          ]}
          onDelete={() => { setError(''); setConfirm({ kind: 'delete', task }); }}>
          <span className={`dn-task-calendar${overdue ? ' is-overdue' : ''}`} role="img"
            aria-label={`${overdue ? 'Overdue, ' : ''}${formatDate(task.dueDate)}${task.dueTime ? ', ' + task.dueTime : ''}`}>
            <strong aria-hidden="true">{task.dueDate ? task.dueDate.slice(8) : '—'}</strong>
            <small aria-hidden="true">{task.dueDate ? formatDate(task.dueDate).split(' ')[1].toUpperCase() : 'No date'}</small>
            {task.dueTime ? <small className="dn-task-calendar-time" aria-hidden="true">{task.dueTime}</small> : null}
          </span>
          <div className="dn-task-copy">
            <strong>{task.title}</strong>
            {parent.kind !== 'standalone' ? <small className="dn-task-context">{context}</small> : null}
            {task.repeat ? <small className="dn-task-context dn-task-repeat-context">
              {dueLabel ? <span className={overdue ? 'is-overdue' : 'is-today'}>{dueLabel}</span> : null}
              <span><Repeat size={14} aria-hidden="true" />{repeatLabel}</span>
            </small> : null}
          </div>
          <span className={`dn-task-signals is-${task.status}`}>
            {overdue || task.priority === 'high' ? <span role="img"
              className={overdue ? 'dn-task-flag is-overdue' : 'dn-task-flag is-high'}
              aria-label={overdue ? 'Overdue' : 'High priority'} title={overdue ? 'Overdue' : 'High priority'}>
              <Flag size={15} aria-hidden="true" />
            </span> : null}
            {task.status !== 'in-progress' ? <span role="img" aria-label={statusLabel(task.status)} title={statusLabel(task.status)}>
              {task.status === 'completed' ? <Check size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
            </span> : null}
          </span>
        </SwipeActionCard>;
      })}
    </div>
    {editor ? <ModalDialog title={editor.kind === 'edit' ? 'Edit Task' : 'New Task'} className="dn-task-dialog" formFooter closeDisabled={busy}
      onClose={() => { if (!busy) { setEditor(null); setError(''); } }}>
      <TaskEditor key={editor.value?.id || 'new'} task={editor.value}
        busy={busy} onTaskAction={async (action) => {
          const task = editor.value;
          const result = action === 'delete' ? await run(() => store.removeTask(task.id, task.updatedAt), 'Task deleted')
            : await statusChange(task, action === 'restore' ? 'in-progress' : 'cancelled');
          if (result) setEditor(null);
        }}
        moments={moments} onSave={save} error={error} onClose={() => { if (!busy) { setEditor(null); setError(''); } }} />
    </ModalDialog> : null}
    {refine ? <TaskRefineSheet current={view} resetDefaults={resetDefaults} tasks={tasks} moments={moments} today={today} onClose={() => setRefine(false)}
      onApply={(draft) => { changeView(draft); setRefine(false); }} /> : null}
    {confirm ? <ConfirmDialog title={isSkip ? 'Skip this Task?' : `${confirmLabel}?`}
      message={confirm.task.repeat ? undefined : isDelete
        ? `Remove "${confirm.task.title}"? Its Moment and Activities will not be changed.`
        : `Mark "${confirm.task.title}" as cancelled? You can restore it later.`}
      confirmLabel={confirmLabel}
      destructive={!isSkip} confirmDisabled={isSkip && !skipNextDate}
      busy={busy} error={error} onCancel={() => { setConfirm(null); setError(''); }}
      onConfirm={() => isDelete ? remove(confirm.task) : statusChange(confirm.task, isSkip ? 'skip' : 'cancelled')}>
      {isSkip ? <RepeatActionSummary name={confirm.task.title} dueDate={confirm.task.dueDate}
        nextDate={skipNextDate} dueTime={confirm.task.dueTime}>
        {skipNextDate ? 'This occurrence goes into Task history as cancelled.' : 'Edit the due date to continue the schedule.'}
      </RepeatActionSummary> : confirm.task.repeat ? <TaskRepeatActionSummary task={confirm.task} action={confirm.kind} /> : null}
    </ConfirmDialog> : null}
  </div>;
}
