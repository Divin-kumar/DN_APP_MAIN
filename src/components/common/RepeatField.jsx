import { useId } from 'react';
import { Repeat } from 'lucide-react';
import { formatScheduleDate, previewNextRepeat, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import './RepeatField.css';

const frequencies = Object.entries(REPEAT_OPTIONS);

export default function RepeatField({ value, onChange, disabled, dueDate, previous, children, allowOneTime = true }) {
  const id = useId();
  const options = allowOneTime ? [['', 'Once'], ...frequencies] : frequencies;
  const nextDate = formatScheduleDate(previewNextRepeat(previous, value, dueDate));
  return <fieldset className="dn-repeat-field" disabled={disabled}>
    <legend><Repeat size={15} aria-hidden="true" /> Repeat</legend>
    <div className="dn-repeat-options" data-options={options.length}>
      {options.map(([frequency, label]) => <label key={frequency} className="dn-repeat-option">
        <input type="radio" name={id} value={frequency} checked={frequency === value}
          onChange={() => onChange(frequency)} />
        <span>{label}</span>
      </label>)}
    </div>
    {value ? <div className="dn-repeat-preview">
      <p role="status">{nextDate ? <>Next repeat <strong>{nextDate}</strong></>
        : dueDate ? 'Choose a date with room for another occurrence.' : 'Choose a due date to repeat.'}</p>
      {children ? <p>{children}</p> : null}
    </div> : null}
  </fieldset>;
}
