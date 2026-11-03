import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import SortChips from '../common/SortChips';
import { TASK_GROUPS } from '../../utils/independentTasks.js';

export const TASK_VIEW_DEFAULTS = Object.freeze({
  search: '', status: 'all', priority: 'all', due: 'all', group: 'dueDate', field: 'dueDate', direction: 'asc',
});
export const TASK_VIEW_RULES = Object.freeze({
  status: ['all', 'in-progress', 'completed', 'cancelled'],
  priority: ['all', 'low', 'medium', 'high'],
  due: ['all', 'overdue', 'next7', 'undated'],
  group: TASK_GROUPS, field: ['dueDate', 'title'], direction: ['asc', 'desc'],
});
const CONTROL_GROUPS = [
  { field: 'status', label: 'Status', values: [['all', 'All'], ['in-progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] },
  { field: 'priority', label: 'Priority', values: [['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
  { field: 'due', label: 'Due', values: [['all', 'Any time'], ['overdue', 'Overdue'], ['next7', 'Next 7 days'], ['undated', 'Undated']] },
];
const GROUPS = [['dueDate', 'Due date'], ['moment', 'Moment'], ['activity', 'Activity'], ['status', 'Status']];
const utcDay = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
export const filterTaskResults = (tasks, view, today) => tasks.filter((task) => {
  if (view.search && ![task.title, task.notes].some((text) => String(text || '').toLowerCase().includes(view.search.toLowerCase()))) return false;
  if (view.status !== 'all' && task.status !== view.status) return false;
  if (view.priority !== 'all' && task.priority !== view.priority) return false;
  if (view.due === 'all') return true;
  if (view.due === 'undated') return !task.dueDate;
  if (!task.dueDate || task.status !== 'in-progress') return false;
  const days = utcDay(task.dueDate) - utcDay(today);
  return view.due === 'overdue' ? days < 0 : days >= 0 && days <= 7;
});

export default function TaskRefineSheet({ current, onApply, onClose, tasks, today }) {
  const [draft, setDraft] = useState(() => ({ ...current }));
  const change = (patch) => setDraft((value) => ({ ...value, ...patch }));
  const count = filterTaskResults(tasks, draft, today).length;
  return <ModalDialog title="Refine Tasks" className="dn-refine-sheet dn-task-refine" onClose={onClose}>
    <div className="dn-refine-sheet-section">
      <h4>Sort by</h4>
      <SortChips field={draft.field} direction={draft.direction}
        options={[{ value: 'dueDate', label: 'Due date' }, { value: 'title', label: 'Title' }]}
        onChange={(field, direction) => change({ field, direction })} />
    </div>
    <div className="dn-refine-sheet-section">
      <h4>Filters</h4>
      {CONTROL_GROUPS.map(({ field, label, values }) => <div key={field} className="dn-task-refine-field">
        <span>{label}</span>
        <div role="group" aria-label={label + ' filter'} className="dn-task-choice-row">
          {values.map(([value, caption]) => <button type="button" key={value}
            aria-pressed={draft[field] === value} onClick={() => change({ [field]: value })}>{caption}</button>)}
        </div>
      </div>)}
    </div>
    <div className="dn-refine-sheet-section">
      <h4>Group by</h4>
      <div role="group" aria-label="Group Tasks by" className="dn-task-choice-row">
        {GROUPS.map(([value, caption]) => <button type="button" key={value}
          aria-pressed={draft.group === value} onClick={() => change({ group: value })}>{caption}</button>)}
      </div>
    </div>
    <p className="dn-refine-preview-count" role="status" aria-live="polite">
      <strong>{count} matching Tasks</strong><span>Preview only. Your list updates after Show results.</span>
    </p>
    <div className="dn-list-controls-footer" role="group" aria-label="Apply or discard Task Refine changes">
      <button type="button" className="dn-refine-reset" onClick={() => setDraft({ ...TASK_VIEW_DEFAULTS, search: current.search })}><RotateCcw size={15} />Reset</button>
      <button type="button" className="dn-refine-cancel" onClick={onClose}>Cancel</button>
      <button type="button" className="dn-refine-apply" onClick={() => onApply(draft)}>Show results</button>
    </div>
  </ModalDialog>;
}
