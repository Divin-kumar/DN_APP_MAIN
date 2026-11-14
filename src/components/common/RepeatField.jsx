import { useId } from 'react';
import { Repeat } from 'lucide-react';
import { formatScheduleDate, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import './RepeatField.css';

const frequencies = Object.entries(REPEAT_OPTIONS);

function RepeatDatePreview({ nextDate, dueDate }) {
  if (nextDate) return <>Next repeat <strong><time dateTime={nextDate}>{formatScheduleDate(nextDate)}</time></strong></>;
  return dueDate ? 'Choose a date with room for another occurrence.' : 'Choose a due date to repeat.';
}

export function RepeatSummary({ value, dueDate, nextDate, notice, showDueDate = false }) {
  if (!value) return <span className="dn-repeat-edit-note">{notice}</span>;
  const firstDate = showDueDate && formatScheduleDate(dueDate);
  return <>{REPEAT_OPTIONS[value]}{firstDate ? <> · Due <time dateTime={dueDate}>{firstDate}</time></> : null}
    <span className="dn-repeat-summary-date"><RepeatDatePreview nextDate={nextDate} dueDate={dueDate} /></span>
    {notice ? <span className="dn-repeat-edit-note">{notice}</span> : null}
  </>;
}

export function RepeatSkipSummary({ name, dueDate, nextDate, dueTime, children }) {
  return <div className="dn-repeat-skip-summary">
    <p className="dn-repeat-skip-name">{name}</p>
    <dl>
      {[['Scheduled for', dueDate], ['Next due', nextDate]].map(([label, date]) => <div key={label}>
        <dt>{label}</dt>
        <dd>{date ? <time dateTime={dueTime ? `${date}T${dueTime}` : date}>
          {formatScheduleDate(date)}{dueTime ? ` · ${dueTime}` : null}
        </time> : 'Unavailable'}</dd>
      </div>)}
    </dl>
    {children ? <p>{children}</p> : null}
  </div>;
}

export default function RepeatField({ value, onChange, disabled, nextDate, dueDate, notice, children, allowOneTime = true }) {
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
    {value || notice ? <div className="dn-repeat-preview">
      <p role="status">
        {value ? <RepeatDatePreview nextDate={nextDate} dueDate={dueDate} /> : null}
        {notice ? <span className="dn-repeat-edit-note">{notice}</span> : null}
      </p>
      {value && children ? <p>{children}</p> : null}
    </div> : null}
  </fieldset>;
}
