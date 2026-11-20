import { useId } from 'react';
import { formatScheduleDate } from '../../utils/repeatSchedule.js';

export default function DateField({
  label,
  id,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  showReadableDate = false,
  'aria-describedby': describedBy,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || `${name || 'date-field'}-${generatedId}`;
  const readableDate = showReadableDate ? formatScheduleDate(value) : '';
  const descriptionId = readableDate ? `${inputId}-readable` : undefined;

  return <>
    <label className={`field-group date-field${className ? ` ${className}` : ''}`} htmlFor={inputId}>
      {label ? <span>{label}</span> : null}
      <input
        id={inputId}
        type="date"
        name={name}
        value={value ?? ''}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="date-field-input"
        aria-describedby={[describedBy, descriptionId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
    </label>
    {readableDate ? <time className="dn-date-field-readable" dateTime={value} id={descriptionId}>{readableDate}</time> : null}
  </>;
}
