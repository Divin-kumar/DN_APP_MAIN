import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Flag, Check, ListTodo, Pencil, RotateCcw, Search, SlidersHorizontal, X, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import SwipeActionCard from '../components/common/SwipeActionCard';
import TaskEditor from '../components/tasks/TaskEditor';
import TaskRefineSheet, { TASK_VIEW_DEFAULTS, TASK_VIEW_RULES } from '../components/tasks/TaskRefineSheet';
import { ConditionChips } from '../components/common/ConditionBuilder';
import { conditionCount, emptyGroup, normalizeConditionGroup } from '../utils/conditionEngine.js';
import { taskFilterFields, taskViewConditionGroup } from '../utils/taskConditionFields.js';
import { filterTaskResults } from '../utils/taskListFilters.js';
import usePersistentListState from '../hooks/usePersistentListState';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useTaskStore, { taskScopeKey } from '../store/useTaskStore';
import { sortIndependentTasks, resolveIndependentTaskParent } from '../utils/independentTasks.js';
import { formatMomentDate } from '../utils/momentDates.js';
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
  const enabled = isGuest && !user?.uid;
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, changeView] = usePersistentListState('tasks', TASK_VIEW_DEFAULTS, TASK_VIEW_RULES);
  const [editor, setEditor] = useState(null);
  const [requestedTask, setRequestedTask] = useState(null);
  const [refine, setRefine] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const today = formatMomentDate(new Date());

  useEffect(() => { store.loadTasks(); }, [store.loadTasks, scope]);
  useEffect(() => { if (enabled) eventStore.loadEvents(null, true); }, [enabled, eventStore.loadEvents, scope]);
  useEffect(() => {
    if (!enabled || searchParams.get('create') !== '1') return;
    setEditor({ kind: 'new', value: { momentId: searchParams.get('moment') || '', activityId: searchParams.get('activity') || '' } });
    const next = new URLSearchParams(searchParams);
    next.delete('create'); next.delete('moment'); next.delete('activity');
    setSearchParams(next, { replace: true });
  }, [enabled, searchParams, setSearchParams]);

  const ready = store.loadedFor === scope;
  const tasks = enabled && ready && !store.error ? store.tasks : EMPTY;
  const eventReady = isRecordScopeLoaded(eventStore, 'guest:anonymous', getActiveSampleScenario(null));
  const moments = enabled && eventReady ? eventStore.events : EMPTY;
  const matches = useMemo(() => filterTaskResults(tasks, view, today, moments), [tasks, view, today, moments]);
  const displayedTasks = useMemo(() => sortIndependentTasks(matches, view.direction, view.field),
    [matches, view.direction, view.field]);
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
    const selected = tasks.find((task) => task.id === requested);
    if (selected) setRequestedTask(selected);
    else setNotice('The selected Task is no longer available.');
    const next = new URLSearchParams(searchParams);
    next.delete('task');
    setSearchParams(next, { replace: true });
  }, [enabled, ready, searchParams, setSearchParams, tasks]);
  const active = tasks.filter((task) => task.status === 'in-progress').length;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const run = (change, message) => {
    try {
      const result = change();
      setError(''); setNotice(message);
      return result;
    } catch (cause) {
      setError(cause?.message || 'Task could not be saved.');
      return null;
    }
  };
  const save = (patch) => {
    const item = run(() => store.saveTask(patch), patch.id ? 'Task saved' : 'Task created');
    if (item) { setEditor(null); toast(patch.id ? 'Task updated' : 'Task created', 'success'); }
  };
  const statusChange = (task, status) => {
    if (run(() => store.setTaskStatus(task.id, status), status === 'completed' ? 'Task completed' : 'Task status updated')) setConfirm(null);
  };
  const remove = (task) => {
    if (run(() => store.removeTask(task.id), 'Task deleted')) setConfirm(null);
  };
  if (!enabled) return <div className="dn-tasks-page">
    <div className="dn-task-hero"><div><span className="dn-task-eyebrow">Independent Tasks</span><h2>Tasks</h2></div></div>
    <section className="dn-task-empty" role="status"><ListTodo size={28} aria-hidden="true" />
      <h3>Account Tasks aren’t available yet</h3>
      <p>Signed-in Task storage will be enabled after cloud permissions are verified. Your existing Task-style Activities and Moments are unchanged.</p>
      <p>Guest Tasks remain on the original device. Export a backup before changing sessions.</p>
      <Link to="/activities">Open Activities</Link>
    </section>
  </div>;

  return <div className="dn-tasks-page">
    <header className="dn-task-hero">
      <div><h2>Tasks</h2><p>Standalone and Moment-linked Tasks.</p>
      </div>
    </header>
    <div className="dn-task-metrics" aria-label="Task summary">
      <span><strong>{tasks.length}</strong> All Tasks</span>
      <span><strong>{active}</strong> In progress</span>
      <span><strong>{completed}</strong> Completed</span>
    </div>
    {store.error ? <p className="dn-task-feedback" role="alert">{store.error} <button type="button" onClick={() => store.loadTasks()}>Retry</button></p> : null}
    {error && !editor && !confirm ? <p className="dn-task-feedback" role="alert">{error}</p> : null}
    {notice ? <p className="sr-only" role="status" aria-live="polite">{notice}</p> : null}
    <div className="dn-list-controls dn-task-discovery">
      <div className="dn-list-controls-row">
        <div className="dn-list-controls-search">
          <Search className="dn-list-controls-search-icon" size={18} aria-hidden="true" />
          <input type="search" aria-label="Search Tasks" value={view.search}
            onChange={(event) => changeView({ search: event.target.value })} placeholder="Search Tasks" />
          {view.search ? <button type="button" className="dn-search-clear" aria-label="Clear Task search"
            title="Clear Task search" onPointerDown={(event) => event.preventDefault()}
            onClick={() => changeView({ search: '' })}><X size={17} aria-hidden="true" /></button> : null}
        </div>
        <button type="button" className={`dn-list-controls-trigger${activeFilterCount ? ' is-active' : ''}`}
          aria-haspopup="dialog" aria-expanded={refine} onClick={() => setRefine(true)}>
          <SlidersHorizontal size={17} aria-hidden="true" /><span>Refine</span>
          {activeFilterCount ? <span className="dn-list-controls-badge" aria-hidden="true">{activeFilterCount}</span> : null}
        </button>
      </div>
      <div className="dn-task-discovery-summary">
        <span aria-live="polite">{displayedTasks.length} {displayedTasks.length === 1 ? 'Task' : 'Tasks'} shown · Tap or swipe for actions</span>
        {activeFilterCount ? <ConditionChips filter={appliedFilterControls}
          maxVisible={4} onShowMore={() => setRefine(true)} /> : null}
      </div>
    </div>
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
    <div className="dn-task-list" aria-label="Task list">
      {displayedTasks.map((task) => {
        const parent = resolveIndependentTaskParent(task, moments);
        const context = parent.kind === 'activity' ? `${parent.moment.name} · ${parent.activity.title || 'Activity'}`
          : parent.kind === 'moment' ? parent.moment.name
            : parent.kind === 'standalone' ? 'Standalone'
              : parent.kind === 'missing-activity' ? 'Activity unavailable' : 'Moment unavailable';
        const overdue = task.status === 'in-progress' && task.dueDate && task.dueDate < today;
        const edit = () => { setError(''); setEditor({ kind: 'edit', value: task }); };
        return <SwipeActionCard key={task.id} as="article" className="dn-task-row" mainClassName="dn-task-row-main"
          label={task.title} role="button" openOnTap disabled={Boolean(store.error)}
          otherActions={[
            ...(task.status === 'cancelled' ? [] : [{ label: task.status === 'completed' ? 'Reopen' : 'Done', icon: Check,
              onClick: () => statusChange(task, task.status === 'completed' ? 'in-progress' : 'completed') }]),
            { label: 'Edit', icon: Pencil, onClick: edit },
            task.status === 'cancelled'
              ? { label: 'Restore', icon: RotateCcw, onClick: () => statusChange(task, 'in-progress') }
              : { label: 'Cancel', icon: XCircle, onClick: () => { setError(''); setConfirm({ kind: 'cancel', task }); } },
          ]}
          onDelete={() => { setError(''); setConfirm({ kind: 'delete', task }); }}>
          <span className={`dn-task-calendar${overdue ? ' is-overdue' : ''}`} role="img"
            aria-label={`${overdue ? 'Overdue, ' : ''}${formatDate(task.dueDate)}${task.dueTime ? ', ' + task.dueTime : ''}`}>
            <CalendarDays size={15} aria-hidden="true" />
            <strong aria-hidden="true">{task.dueDate ? Number(task.dueDate.slice(8)) : '—'}</strong>
            <small aria-hidden="true">{task.dueDate ? formatDate(task.dueDate).split(' ')[1] : 'No date'}</small>
          </span>
          <div className="dn-task-copy">
            <strong>{task.title}</strong>
            {parent.kind !== 'standalone' ? <small className="dn-task-context">{parent.moment?.name || context}</small> : null}
            {task.dueTime ? <small className="dn-task-context">{task.dueTime}</small> : null}
          </div>
          <span className="dn-task-signals">
            <span role="img" aria-label={`${task.priority} priority`} title={`${task.priority} priority`}>
              <Flag size={14} data-priority={task.priority} aria-hidden="true" />
            </span>
            {task.status !== 'in-progress' ? <span role="img" aria-label={statusLabel(task.status)} title={statusLabel(task.status)}>
              {task.status === 'completed' ? <Check size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
            </span> : null}
          </span>
        </SwipeActionCard>;
      })}
    </div>
    {requestedTask ? <ModalDialog title="Task actions" onClose={() => setRequestedTask(null)}>
      <p>{requestedTask.title}</p>
      <div className="dn-task-entry-actions">
        <button type="button" onClick={() => {
          statusChange(requestedTask, requestedTask.status === 'in-progress' ? 'completed' : 'in-progress');
          setRequestedTask(null);
        }}>{requestedTask.status === 'completed' ? 'Reopen' : requestedTask.status === 'cancelled' ? 'Restore' : 'Done'}</button>
        <button type="button" onClick={() => { setError(''); setEditor({ kind: 'edit', value: requestedTask }); setRequestedTask(null); }}>Edit</button>
        <button type="button" onClick={() => setRequestedTask(null)}>Close</button>
      </div>
    </ModalDialog> : null}
    {editor ? <ModalDialog title={editor.kind === 'edit' ? 'Edit Task' : 'New Task'} className="dn-task-dialog"
      onClose={() => { setEditor(null); setError(''); }}>
      <TaskEditor key={editor.value?.id || 'new'} task={editor.value}
        onTaskAction={(action) => {
          const task = editor.value;
          const result = run(() => action === 'delete' ? store.removeTask(task.id)
            : store.setTaskStatus(task.id, action === 'restore' ? 'in-progress' : 'cancelled'),
          action === 'delete' ? 'Task deleted' : 'Task status updated');
          if (result) setEditor(null);
        }}
        moments={moments} onSave={save} error={error} onClose={() => { setEditor(null); setError(''); }} />
    </ModalDialog> : null}
    {refine ? <TaskRefineSheet current={view} tasks={tasks} moments={moments} today={today} onClose={() => setRefine(false)}
      onApply={(draft) => { changeView(draft); setRefine(false); }} /> : null}
    {confirm ? <ConfirmDialog title={confirm.kind === 'delete' ? 'Delete Task?' : 'Cancel Task?'}
      message={confirm.kind === 'delete' ? `Remove "${confirm.task.title}"? Its Moment and Activities will not be changed.`
        : `Mark "${confirm.task.title}" as cancelled? You can restore it later.`}
      confirmLabel={confirm.kind === 'delete' ? 'Delete Task' : 'Cancel Task'}
      error={error} onCancel={() => { setConfirm(null); setError(''); }}
      onConfirm={() => confirm.kind === 'delete' ? remove(confirm.task) : statusChange(confirm.task, 'cancelled')} /> : null}
  </div>;
}
