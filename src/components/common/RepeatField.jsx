import { useId, useState } from 'react';
import { ChevronDown, Repeat } from 'lucide-react';
import { formatScheduleDate, previewNextRepeat, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import './RepeatField.css';

const frequencies = Object.entries(REPEAT_OPTIONS);

export default function RepeatField({ value, onChange, disabled, dueDate, previous, children, allowOneTime = true }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const options = allowOneTime ? [['', 'Once'], ...frequencies] : frequencies;
  const nextDate = formatScheduleDate(previewNextRepeat(previous, value, dueDate));
  return <div className="dn-repeat-field">
    <button className="dn-repeat-trigger" type="button" aria-label="Repeat"
      aria-describedby={id + '-value'} aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={() => setOpen((current) => !current)}>
      <span className="dn-repeat-trigger-label"><Repeat size={16} aria-hidden="true" /> Repeat</span>
      <span className="dn-repeat-trigger-value">
        <span id={id + '-value'}>{REPEAT_OPTIONS[value] || 'Doesn’t repeat'}</span><ChevronDown size={16} aria-hidden="true" />
      </span>
    </button>
    <fieldset id={id} className="dn-repeat-options" data-options={options.length} hidden={!open} disabled={disabled}>
      <legend className="sr-only">Repeat frequency</legend>
      {options.map(([frequency, label]) => <label key={frequency} className="dn-repeat-option">
        <input type="radio" name={id} value={frequency} checked={frequency === value}
          onChange={() => onChange(frequency)} />
        <span>{label}</span>
      </label>)}
    </fieldset>
    {value ? <div className="dn-repeat-preview">
      <p role="status">{nextDate ? <>Next repeat <strong>{nextDate}</strong></>
        : dueDate ? 'Choose a date with room for another occurrence.' : 'Choose a due date to repeat.'}</p>
      {open && children ? <p>{children}</p> : null}
    </div> : null}
  </div>;
}
