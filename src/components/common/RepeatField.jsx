import { useId } from 'react';
import { CalendarDays, Repeat } from 'lucide-react';
import { formatScheduleDate, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import FormDisclosure from './FormDisclosure';
import './RepeatField.css';

const frequencies = Object.entries(REPEAT_OPTIONS);

function RepeatDatePreview({ nextDate, dueDate }) {
  if (nextDate) return <span className="dn-repeat-next">
    <CalendarDays size={16} aria-hidden="true" /><span>Next repeat</span>{' '}<strong><time dateTime={nextDate}>{formatScheduleDate(nextDate)}</time></strong>
  </span>;
  return dueDate ? 'Choose a date with room for another occurrence.' : 'Choose a due date to repeat.';
}

export function RepeatDisclosure({ paused = false, ...props }) {
  const { value, dueDate, nextDate, notice } = props;
  return <FormDisclosure label={<><Repeat size={15} aria-hidden="true" /> Repeat</>}
    className="dn-repeat-disclosure"
    hint={<><span className="dn-repeat-frequency">{value && paused ? `${REPEAT_OPTIONS[value]} · Paused` : REPEAT_OPTIONS[value] || 'Once'}</span>
      {value && !paused && nextDate ? <span className="dn-repeat-summary-date">Next <time dateTime={nextDate}>{formatScheduleDate(nextDate)}</time></span> : null}
      {notice || (value && !nextDate) ? <span className="dn-repeat-edit-note">
        {notice || <RepeatDatePreview dueDate={dueDate} />}
      </span> : null}</>}>
    <RepeatField {...props} paused={paused} />
  </FormDisclosure>;
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

function RepeatField({ value, onChange, disabled, nextDate, dueDate, notice, children, allowOneTime = true, paused = false }) {
  const id = useId();
  const options = allowOneTime ? [['', 'Once'], ...frequencies] : frequencies;
  return <fieldset className="dn-repeat-field" disabled={disabled}>
    <legend className="sr-only">Repeat</legend>
    <div className="dn-repeat-options" data-options={options.length}>
      {options.map(([frequency, label]) => <label key={frequency} className="dn-repeat-option">
        <input type="radio" name={id} value={frequency} checked={frequency === value}
          onChange={() => onChange(frequency)} />
        <span>{label}</span>
      </label>)}
    </div>
    {value || notice ? <div className="dn-repeat-preview">
      <p role="status">
        {value ? paused ? 'Repeat paused. Resume it from Task actions.' : <RepeatDatePreview nextDate={nextDate} dueDate={dueDate} /> : null}
        {notice ? <span className="dn-repeat-edit-note">{notice}</span> : null}
      </p>
      {value && children ? <p>{children}</p> : null}
    </div> : null}
  </fieldset>;
}
