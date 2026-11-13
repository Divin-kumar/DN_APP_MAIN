import { useMemo, useState } from 'react';
import ModalDialog from '../common/ModalDialog';
import SortChips from '../common/SortChips';
import ConditionBuilder from '../common/ConditionBuilder';
import RefineActions from '../common/RefineActions';
import { conditionCount, emptyGroup, normalizeConditionGroup } from '../../utils/conditionEngine.js';
import { compactTaskRefineGroup, taskFilterFields, taskViewConditionGroup } from '../../utils/taskConditionFields.js';
import { filterTaskResults } from '../../utils/taskListFilters.js';
import { TASK_VIEW_DEFAULTS, TASK_SORT_OPTIONS } from '../../utils/taskViewDefaults.js';

export { TASK_VIEW_DEFAULTS, TASK_VIEW_RULES, TASK_SORT_OPTIONS } from '../../utils/taskViewDefaults.js';

export default function TaskRefineSheet({ current, resetDefaults = TASK_VIEW_DEFAULTS, onApply, onClose, tasks, moments = [], today }) {
  const [draft, setDraft] = useState(() => ({ ...current, group: compactTaskRefineGroup(taskViewConditionGroup(current)),
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
  const resetDraft = () => setDraft({
    ...TASK_VIEW_DEFAULTS, ...resetDefaults, search: current.search,
    group: compactTaskRefineGroup(taskViewConditionGroup(resetDefaults)),
    status: 'all', priority: 'all', due: 'all',
  });
  return <ModalDialog title="Refine Tasks" className="dn-refine-sheet dn-task-refine" onClose={onClose}
    footer={<RefineActions count={count} resultLabel="Tasks" onReset={resetDraft} onCancel={onClose} onApply={() => onApply(draft)} />}>
    <p className="dn-refine-sheet-intro">Changes apply when you select Show results.</p>
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
  </ModalDialog>;
}
