import { useId } from 'react';

export default function ActivityTimeField({ value = '', onChange, disabled = false, subject = 'Activity' }) {
  const id = useId();
  return <div className="activity-time-field">
    <label htmlFor={id}>Time (optional)</label>
    <input id={id} type="time" step="60" aria-label={`${subject} time`} value={value} disabled={disabled}
      onChange={(event) => onChange(event.target.value)} />
    {value ? <button type="button" className="settings-secondary-button" aria-label={`Clear ${subject.toLowerCase()} time`}
      disabled={disabled} onClick={() => onChange('')}>Clear time</button> : null}
  </div>;
}
