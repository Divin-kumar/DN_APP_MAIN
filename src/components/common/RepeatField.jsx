import { useId } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatScheduleDate, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import './RepeatField.css';
import FormReveal from './FormReveal';

const frequencies = Object.entries(REPEAT_OPTIONS);

function RepeatDatePreview({ nextDate, dueDate }) {
  if (nextDate) return <span className="dn-repeat-next">
    <CalendarDays size={16} aria-hidden="true" /><span>Next repeat</span>{' '}<strong><time dateTime={nextDate}>{formatScheduleDate(nextDate)}</time></strong>
  </span>;
  return dueDate ? 'Choose a date with room for another occurrence.' : 'Choose a due date to repeat.';
}

export function RepeatSummary({ value, paused = false, dueDate, nextDate, notice }) {
  return <span className="dn-repeat-summary">
    <span className="dn-repeat-frequency">{value && paused ? `${REPEAT_OPTIONS[value]} · Paused` : REPEAT_OPTIONS[value] || 'Once'}</span>
    {value && !paused && nextDate ? <span className="dn-repeat-summary-date">Next <time dateTime={nextDate}>{formatScheduleDate(nextDate)}</time></span> : null}
    {notice || (value && !nextDate) ? <span className="dn-repeat-edit-note">
      {notice || <RepeatDatePreview dueDate={dueDate} />}
    </span> : null}
  </span>;
}

export function RepeatActionSummary({ name, dueDate, nextDate, dueTime, dueLabel = 'Scheduled for', children }) {
  const dates = [[dueLabel, dueDate]];
  if (nextDate !== undefined) dates.push(['Next due', nextDate]);
  return <div className="dn-repeat-action-summary">
    <p className="dn-repeat-action-name">{name}</p>
    <dl>
      {dates.map(([label, date]) => <div key={label}>
        <dt>{label}</dt>
        <dd>{date ? <time dateTime={dueTime ? `${date}T${dueTime}` : date}>
          {formatScheduleDate(date)}{dueTime ? ` · ${dueTime}` : null}
        </time> : 'Unavailable'}</dd>
      </div>)}
    </dl>
    {children ? <p>{children}</p> : null}
  </div>;
}

export function RepeatField({ value, onChange, disabled, nextDate, dueDate, notice, children, allowOneTime = true, paused = false }) {
  const id = useId();
  const options = allowOneTime ? [['', 'Once'], ...frequencies] : frequencies;
  return <fieldset className="dn-repeat-field" disabled={disabled}>
    <legend>Repeat</legend>
    <div className="dn-repeat-options" data-options={options.length}>
      {options.map(([frequency, label]) => <label key={frequency} className="dn-repeat-option">
        <input type="radio" name={id} value={frequency} checked={frequency === value}
          onChange={() => onChange(frequency)} />
        <span>{label}</span>
      </label>)}
    </div>
    <FormReveal show={Boolean(value || notice)}>
      <div className="dn-repeat-preview">
        <p role="status"><span key={value || 'once'} className="dn-repeat-preview-message">
          {value ? paused ? 'Repeat paused. Resume it from Task actions.' : <RepeatDatePreview nextDate={nextDate} dueDate={dueDate} /> : null}
          {notice ? <span className="dn-repeat-edit-note">{notice}</span> : null}
        </span></p>
        {value && children ? <p>{children}</p> : null}
      </div>
    </FormReveal>
  </fieldset>;
}
