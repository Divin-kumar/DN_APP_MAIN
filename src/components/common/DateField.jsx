import { useId } from 'react';

export default function DateField({
  label,
  id,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  ...props
}) {
  const generatedId = useId();
  const inputId = id || `${name || 'date-field'}-${generatedId}`;

  return (
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
        {...props}
      />
    </label>
  );
}
