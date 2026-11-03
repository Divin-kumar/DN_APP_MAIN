import { useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import SortChips from './SortChips';
import ModalDialog from './ModalDialog';
import ConditionBuilder from './ConditionBuilder';
import { conditionCount, emptyGroup } from '../../utils/conditionEngine';
import './FilterSortSheet.css';

// No persistent writes happen while this sheet is open. Cancel always discards
// its draft, including nested AND/OR edits and a sort direction change.
const cloneGroup = (value) => JSON.parse(JSON.stringify(value || emptyGroup()));

export default function FilterSortSheet({ title, refine, onClose, onReset }) {
  const { conditions, sort, defaults } = refine;
  const scopeAtOpen = useRef(conditions.editorKey);
  const [draft, setDraft] = useState(() => ({
    group: cloneGroup(conditions.state.group), field: sort.field,
    direction: sort.direction, reset: false,
  }));
  const setGroup = (change) => setDraft((current) => ({
    ...current, group: cloneGroup(typeof change === 'function' ? change(current.group) : change),
  }));
  const draftFilter = useMemo(() => ({
    ...conditions, state: { ...conditions.state, group: draft.group },
    activeCount: conditionCount(draft.group),
    editorKey: conditions.editorKey + ':sheet',
    setGroup,
    clear: () => setGroup(emptyGroup()),
    restore: (group) => setGroup(group),
  }), [conditions, draft.group]);
  const pickSort = (field) => setDraft((current) => field === current.field
    ? { ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { ...current, field, direction: 'asc' });
  const resetDraft = () => setDraft({
    group: cloneGroup(defaults?.group), field: defaults?.field || sort.field,
    direction: defaults?.direction || sort.direction, reset: true,
  });
  const apply = () => {
    // A stale sheet cannot commit after Guest/account/saved-filter scope changes.
    if (conditions.editorKey !== scopeAtOpen.current) { onClose(); return; }
    if (draft.reset) onReset?.();
    if (draft.reset || JSON.stringify(draft.group) !== JSON.stringify(conditions.state.group)) {
      conditions.restore(draft.group);
    }
    if (draft.reset || draft.field !== sort.field || draft.direction !== sort.direction) {
      sort.onChange(draft.field, draft.direction);
    }
    onClose();
  };
  return <ModalDialog title={title} className="dn-refine-sheet" onClose={onClose}>
    <div className="dn-refine-sheet-section">
      <h4>Sort by</h4>
      <SortChips field={draft.field} direction={draft.direction} options={sort.options}
        label={sort.label || 'Sort by'} onChange={(field) => pickSort(field)} />
    </div>
    <div className="dn-refine-sheet-section">
      <h4>Filters</h4>
      <ConditionBuilder filter={draftFilter} title={title + ' conditions'} immediate />
    </div>
    <div className="dn-list-controls-footer" role="group" aria-label="Apply or discard Refine changes">
      <button type="button" className="dn-refine-reset" onClick={resetDraft}><RotateCcw size={15} aria-hidden="true" />Reset</button>
      <button type="button" className="dn-refine-cancel" onClick={onClose}>Cancel</button>
      <button type="button" className="dn-refine-apply" onClick={apply}>Show results</button>
    </div>
  </ModalDialog>;
}
