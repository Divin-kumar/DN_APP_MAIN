import { useId } from 'react';
import { Repeat } from 'lucide-react';
import { formatScheduleDate, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import './RepeatField.css';

const frequencies = Object.entries(REPEAT_OPTIONS);

function RepeatDatePreview({ nextDate, dueDate }) {
  if (nextDate) return <>Next repeat <strong><time dateTime={nextDate}>{formatScheduleDate(nextDate)}</time></strong></>;
  return dueDate ? 'Choose a date with room for another occurrence.' : 'Choose a due date to repeat.';
}

export function RepeatSummary({ value, dueDate, nextDate, showDueDate = false }) {
  const firstDate = showDueDate && formatScheduleDate(dueDate);
  return <>{REPEAT_OPTIONS[value]}{firstDate ? <> · Due <time dateTime={dueDate}>{firstDate}</time></> : null}
    <span className="dn-repeat-summary-date"><RepeatDatePreview nextDate={nextDate} dueDate={dueDate} /></span>
  </>;
}

export default function RepeatField({ value, onChange, disabled, nextDate, dueDate, children, allowOneTime = true }) {
  const id = useId();
  const options = allowOneTime ? [['', 'Once'], ...frequencies] : frequencies;
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
      <p role="status"><RepeatDatePreview nextDate={nextDate} dueDate={dueDate} /></p>
      {children ? <p>{children}</p> : null}
    </div> : null}
  </fieldset>;
}
