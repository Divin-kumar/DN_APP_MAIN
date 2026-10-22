import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import ModalDialog from './ModalDialog';
import './ListControls.css';

// Filtering stays in the caller; this surface only manages disclosure and focus.
export default function ListControls({
  title = 'Filters', activeCount = 0, resultCount, resultLabel = 'results',
  summary = '', onReset, hasSort = false, hasPanel = true, search, children,
}) {
  const [open, setOpen] = useState(false);
  const label = hasSort ? 'Filters and sort' : 'Filters';

  return (
    <div className="dn-list-controls">
      <div className="dn-list-controls-row">
        {search ? <div className="dn-list-controls-search">{search}</div> : null}
        {hasPanel ? <button type="button" className={`dn-list-controls-trigger${activeCount ? ' is-active' : ''}`}
          aria-label={`${label}${activeCount ? `, ${activeCount} active` : ''}`}
          aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          <SlidersHorizontal size={16} aria-hidden="true" /><span>Filters</span>
          {activeCount ? <span className="dn-list-controls-badge" aria-hidden="true">{activeCount}</span> : null}
        </button> : activeCount && onReset ? <button type="button" className="dn-list-controls-trigger"
          aria-label="Clear search" onClick={onReset}><X size={15} aria-hidden="true" /><span>Clear</span></button> : null}
      </div>
      <div className="dn-list-controls-topline">
        {typeof resultCount === 'number' ? <span className="dn-list-controls-context" aria-live="polite" aria-atomic="true">{resultCount} {resultLabel}</span> : null}
        {summary ? <span className="dn-list-controls-summary" title={summary}>{summary}</span> : null}
      </div>
      {hasPanel && open ? <ModalDialog title={title} className="dn-list-controls-dialog" onClose={() => setOpen(false)}>
        <div className="dn-list-controls-body">{children}</div>
        <div className="dn-list-controls-footer">
          {onReset ? <button type="button" className="dn-list-controls-reset" onClick={onReset}
            disabled={!activeCount}>Reset</button> : <span />}
          <button type="button" className="dn-list-controls-done" onClick={() => setOpen(false)}>Done</button>
        </div>
      </ModalDialog> : null}
    </div>
  );
}
