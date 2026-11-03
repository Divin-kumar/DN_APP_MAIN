import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import SortChips from '../common/SortChips';
import ConditionBuilder from '../common/ConditionBuilder';
import { conditionCount, emptyGroup, normalizeConditionGroup } from '../../utils/conditionEngine.js';
import { taskFilterFields, taskViewConditionGroup } from '../../utils/taskConditionFields.js';
import { filterTaskResults } from '../../utils/taskListFilters.js';

const EMPTY_GROUP = emptyGroup();
export const TASK_VIEW_DEFAULTS = Object.freeze({
  search: '', status: 'all', priority: 'all', due: 'all',
  group: EMPTY_GROUP, field: 'dueDate', direction: 'asc',
});
export const TASK_VIEW_RULES = Object.freeze({
  status: ['all', 'in-progress', 'completed', 'cancelled'],
  priority: ['all', 'low', 'medium', 'high'],
  due: ['all', 'overdue', 'next7', 'undated'],
  group: (value) => value?.kind === 'group' && Array.isArray(value.children)
    && JSON.stringify(value).length < 30000,
  field: ['dueDate', 'title', 'priority', 'status', 'createdAt', 'updatedAt'],
  direction: ['asc', 'desc'],
});
export const TASK_SORT_OPTIONS = Object.freeze([
  { value: 'dueDate', label: 'Due date' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
]);

export default function TaskRefineSheet({ current, onApply, onClose, tasks, moments = [], today }) {
  const [draft, setDraft] = useState(() => ({ ...current, group: taskViewConditionGroup(current),
    // Legacy choices become real rules only when Show results is selected.
    status: 'all', priority: 'all', due: 'all' }));
  const change = (patch) => setDraft((value) => ({ ...value, ...patch }));
  const schema = useMemo(() => taskFilterFields(tasks, moments, today), [tasks, moments, today]);
  const setGroup = (transform) => setDraft((value) => ({
    ...value, group: normalizeConditionGroup(typeof transform === 'function'
      ? transform(value.group) : transform),
  }));
  const activeCount = conditionCount(draft.group);
  const conditionFilter = {
    state: { group: draft.group }, schema,
    editorKey: 'task-refine-draft', activeCount, setGroup,
    clear: () => setGroup(emptyGroup()),
  };
  const count = useMemo(() => filterTaskResults(tasks, draft, today, moments).length,
    [tasks, draft, today, moments]);
  return <ModalDialog title="Refine Tasks" className="dn-refine-sheet dn-task-refine" onClose={onClose}>
    <p className="dn-refine-sheet-intro">Choose what appears in your Tasks. Filters stay in draft until Show results.</p>
    <div className="dn-refine-sheet-section">
      <h4>Sort by</h4>
      <SortChips label="Sort Tasks" field={draft.field} direction={draft.direction}
        options={TASK_SORT_OPTIONS} onChange={(field, direction) => change({ field, direction })} />
    </div>
    <div className="dn-refine-sheet-section">
      <div className="dn-task-filter-heading">
        <h4>Filters</h4>
        <span>{activeCount ? activeCount + ' selected' : 'All Tasks'}</span>
      </div>
      <ConditionBuilder filter={conditionFilter} title="Task conditions" immediate />
      <p className="dn-task-filter-help">Status, priority, due timing, dates, linked Moments, notes and more.</p>
    </div>
    <p className="dn-refine-preview-count" role="status" aria-live="polite">
      <strong>{count} matching Tasks</strong><span>Preview only. Your list updates after Show results.</span>
    </p>
    <div className="dn-list-controls-footer" role="group" aria-label="Apply or discard Task Refine changes">
      <button type="button" className="dn-refine-reset"
        onClick={() => setDraft({ ...TASK_VIEW_DEFAULTS, search: current.search, group: emptyGroup() })}>
        <RotateCcw size={15} aria-hidden="true" />Reset
      </button>
      <button type="button" className="dn-refine-cancel" onClick={onClose}>Cancel</button>
      <button type="button" className="dn-refine-apply" onClick={() => onApply(draft)}>Show results</button>
    </div>
  </ModalDialog>;
}
