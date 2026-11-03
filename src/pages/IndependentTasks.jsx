import { useEffect, useMemo, useState } from 'react';
import { Check, Circle, ListTodo, Pencil, Plus, SlidersHorizontal, Trash2, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import TaskEditor from '../components/tasks/TaskEditor';
import TaskRefineSheet, { TASK_VIEW_DEFAULTS, TASK_VIEW_RULES, filterTaskResults } from '../components/tasks/TaskRefineSheet';
import usePersistentListState from '../hooks/usePersistentListState';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useTaskStore, { taskScopeKey } from '../store/useTaskStore';
import { groupIndependentTasks, resolveIndependentTaskParent } from '../utils/independentTasks.js';
import { formatMomentDate } from '../utils/momentDates.js';
import { getActiveSampleScenario } from '../dev/sampleData';
import { isRecordScopeLoaded } from '../utils/scopedRecordActions';
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
  const matches = useMemo(() => filterTaskResults(tasks, view, today), [tasks, view, today]);
  const groups = useMemo(() => groupIndependentTasks(matches, {
    by: view.group, direction: view.direction, sortBy: view.field, moments,
  }), [matches, view.group, view.direction, view.field, moments]);
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
  const openNew = () => { setError(''); setEditor({ kind: 'new', value: null }); };
  if (!enabled) return <main className="dn-tasks-page">
    <div className="dn-task-hero"><div><span className="dn-task-eyebrow">Independent Tasks</span><h2>Tasks</h2></div></div>
    <section className="dn-task-empty" role="status"><ListTodo size={28} aria-hidden="true" />
      <h3>Account Tasks aren’t available yet</h3>
      <p>Signed-in Task storage will be enabled after cloud permissions are verified. Your existing Task-style Activities and Moments are unchanged.</p>
      <p>Guest Tasks remain on the original device. Export a backup before changing sessions.</p>
      <Link to="/activities">Open Activities</Link>
    </section>
  </main>;

  return <main className="dn-tasks-page">
    <header className="dn-task-hero"><div><span className="dn-task-eyebrow">Independent · Guest Tasks</span>
      <h2>Tasks</h2><p>Personal plans kept outside your Moment stories.</p></div>
      <button type="button" className="dn-task-add" onClick={openNew}><Plus size={18} />New Task</button>
    </header>
    <div className="dn-task-metrics" aria-label="Task summary">
      <span><strong>{tasks.length}</strong> All</span><span><strong>{active}</strong> In progress</span>
      <span><strong>{completed}</strong> Completed</span>
    </div>
    {store.error ? <p className="dn-task-feedback" role="alert">{store.error} <button type="button" onClick={() => store.loadTasks()}>Retry</button></p> : null}
    {error && !editor && !confirm ? <p className="dn-task-feedback" role="alert">{error}</p> : null}
    {notice ? <p className="sr-only" role="status" aria-live="polite">{notice}</p> : null}
    <div className="dn-task-toolbar"><label className="dn-task-search">
      <span className="sr-only">Search Tasks</span><input type="search" aria-label="Search Tasks"
        value={view.search} onChange={(event) => changeView({ search: event.target.value })} placeholder="Search Tasks" />
    </label>
      <button type="button" className="dn-task-refine-trigger" onClick={() => setRefine(true)}><SlidersHorizontal size={17} />Refine</button>
    </div>
    {ready && !store.error && !tasks.length ? <div className="dn-task-empty"><ListTodo size={26} />
      <h3>Your list is ready</h3><p>Create a standalone Task, or link it to a Moment.</p>
      <button type="button" onClick={openNew}>Create first Task</button>
    </div> : null}
    {ready && tasks.length > 0 && matches.length === 0 ? <p className="dn-task-empty" role="status">No Tasks match your filters.</p> : null}
    <div className="dn-task-groups">
      {groups.map((group) => <section className="dn-task-group" key={group.key} aria-label={group.label + ' Tasks'}>
        <h3>{view.group === 'dueDate' && group.key !== 'undated' ? formatDate(group.key) : group.label}
          <span>{group.count}</span></h3>
        <div className="dn-task-group-rows">{group.tasks.map((task) => {
          const parent = resolveIndependentTaskParent(task, moments);
          const context = parent.kind === 'activity' ? `${parent.moment.name} · ${parent.activity.title || 'Activity'}`
            : parent.kind === 'moment' ? parent.moment.name
              : parent.kind === 'standalone' ? 'Standalone'
                : parent.kind === 'missing-activity' ? 'Activity unavailable' : 'Moment unavailable';
          const overdue = task.status === 'in-progress' && task.dueDate && task.dueDate < today;
          return <article key={task.id} className="dn-task-row" data-status={task.status}>
            <button className="dn-task-done" type="button" aria-pressed={task.status === 'completed'}
              aria-label={task.status === 'completed' ? `Reopen ${task.title}` : `Complete ${task.title}`}
              disabled={Boolean(store.error) || task.status === 'cancelled'}
              onClick={() => statusChange(task, task.status === 'completed' ? 'in-progress' : 'completed')}>
              {task.status === 'completed' ? <Check size={20} /> : <Circle size={20} />}
            </button>
            <div className="dn-task-copy"><strong>{task.title}</strong>
              <small>{context} · {task.dueDate ? formatDate(task.dueDate) + (task.dueTime ? ' · ' + task.dueTime : '') : 'No due date'}</small>
              <span className="dn-task-row-pills"><span data-priority={task.priority}>{task.priority} priority</span>
                {overdue ? <span className="is-overdue">Overdue</span> : null}
                {task.status !== 'in-progress' ? <span>{statusLabel(task.status)}</span> : null}
              </span>
            </div>
            <div className="dn-task-actions">
              <button type="button" title="Edit Task" aria-label={`Edit ${task.title}`}
                onClick={() => { setError(''); setEditor({ kind: 'edit', value: task }); }}><Pencil size={17} /></button>
              {task.status === 'cancelled'
                ? <button type="button" aria-label={`Restore ${task.title}`} onClick={() => statusChange(task, 'in-progress')}><Check size={17} /></button>
                : <button type="button" title="Cancel Task" aria-label={`Cancel ${task.title}`}
                  onClick={() => { setError(''); setConfirm({ kind: 'cancel', task }); }}><XCircle size={17} /></button>}
              <button type="button" title="Delete Task" aria-label={`Delete ${task.title}`}
                onClick={() => { setError(''); setConfirm({ kind: 'delete', task }); }}><Trash2 size={17} /></button>
            </div>
          </article>;
        })}</div>
      </section>)}
    </div>
    {editor ? <ModalDialog title={editor.kind === 'edit' ? 'Edit Task' : 'New Task'} className="dn-task-dialog"
      onClose={() => { setEditor(null); setError(''); }}>
      <TaskEditor key={editor.value?.id || 'new'} task={editor.value}
        moments={moments} onSave={save} error={error} onClose={() => { setEditor(null); setError(''); }} />
    </ModalDialog> : null}
    {refine ? <TaskRefineSheet current={view} tasks={tasks} today={today} onClose={() => setRefine(false)}
      onApply={(draft) => { changeView(draft); setRefine(false); }} /> : null}
    {confirm ? <ConfirmDialog title={confirm.kind === 'delete' ? 'Delete Task?' : 'Cancel Task?'}
      message={confirm.kind === 'delete' ? `Remove "${confirm.task.title}"? Its Moment and Activities will not be changed.`
        : `Mark "${confirm.task.title}" as cancelled? You can restore it later.`}
      confirmLabel={confirm.kind === 'delete' ? 'Delete Task' : 'Cancel Task'}
      error={error} onCancel={() => { setConfirm(null); setError(''); }}
      onConfirm={() => confirm.kind === 'delete' ? remove(confirm.task) : statusChange(confirm.task, 'cancelled')} /> : null}
  </main>;
}
