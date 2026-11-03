import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import SortChips from '../common/SortChips';
import { filterTaskResults } from '../../utils/taskListFilters.js';

export const TASK_VIEW_DEFAULTS = Object.freeze({
  search: '', status: 'all', priority: 'all', due: 'all', field: 'dueDate', direction: 'asc',
});
export const TASK_VIEW_RULES = Object.freeze({
  status: ['all', 'in-progress', 'completed', 'cancelled'],
  priority: ['all', 'low', 'medium', 'high'],
  due: ['all', 'overdue', 'next7', 'undated'],
  field: ['dueDate', 'title'], direction: ['asc', 'desc'],
});
const CONTROL_GROUPS = [
  { field: 'status', label: 'Status', values: [['all', 'All'], ['in-progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] },
  { field: 'priority', label: 'Priority', values: [['all', 'All'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
  { field: 'due', label: 'Due', values: [['all', 'Any time'], ['overdue', 'Overdue'], ['next7', 'Next 7 days'], ['undated', 'Undated']] },
];


export default function TaskRefineSheet({ current, onApply, onClose, tasks, today }) {
  const [draft, setDraft] = useState(() => ({ ...current }));
  const change = (patch) => setDraft((value) => ({ ...value, ...patch }));
  const count = filterTaskResults(tasks, draft, today).length;
  return <ModalDialog title="Refine Tasks" className="dn-refine-sheet dn-task-refine" onClose={onClose}>
    <p className="dn-refine-sheet-intro">Choose how your Tasks appear. Changes apply only when you select Show results.</p>
    <div className="dn-refine-sheet-section">
      <h4>Sort by</h4>
      <SortChips field={draft.field} direction={draft.direction}
        options={[{ value: 'dueDate', label: 'Due date' }, { value: 'title', label: 'Title' }]}
        onChange={(field, direction) => change({ field, direction })} />
    </div>
    <div className="dn-refine-sheet-section">
      <h4>Filters</h4>
      {CONTROL_GROUPS.map(({ field, label, values }) => <fieldset key={field} className="dn-task-refine-field">
        <legend>{label}</legend>
        <div role="group" aria-label={label + ' filter'} className="dn-task-choice-row dn-refine-choice-row">
          {values.map(([value, caption]) => <button type="button" key={value}
            aria-pressed={draft[field] === value} onClick={() => change({ [field]: value })}>{caption}</button>)}
        </div>
      </fieldset>)}
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
