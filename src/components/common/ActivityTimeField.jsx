import { useId } from 'react';
import { X } from 'lucide-react';

// Shared by Moment, Activity, dated content and Transaction forms. Keep the
// clear affordance alongside its time input, never as a third stacked row.
export default function ActivityTimeField({ value = '', onChange, disabled = false, subject = 'Activity' }) {
  const id = useId();
  return <div className="activity-time-field">
    <label htmlFor={id}>Time (optional)</label>
    <div className="activity-time-control">
      <input id={id} type="time" step="60" aria-label={`${subject} time`} value={value} disabled={disabled}
        onChange={(event) => onChange(event.target.value)} />
      {value ? <button type="button" className="activity-time-clear" aria-label={`Clear ${subject.toLowerCase()} time`}
        title="Clear time" disabled={disabled} onClick={() => onChange('')}>
        <X size={17} strokeWidth={1.8} aria-hidden="true" />
      </button> : null}
    </div>
  </div>;
}
