import { RotateCcw } from 'lucide-react';

export default function RefineActions({ count, resultLabel, onReset, onCancel, onApply }) {
  return <div className="dn-refine-actions">
    {typeof count === 'number' ? <p className="dn-refine-preview-count" role="status">
      {count} matching {resultLabel}
    </p> : null}
    <div className="dn-list-controls-footer" role="group" aria-label="Apply or discard Refine changes">
      <button type="button" className="dn-refine-reset" onClick={onReset}><RotateCcw size={15} aria-hidden="true" />Reset</button>
      <button type="button" className="dn-refine-cancel" onClick={onCancel}>Cancel</button>
      <button type="button" className="dn-refine-apply" onClick={onApply}>Show results</button>
    </div>
  </div>;
}
