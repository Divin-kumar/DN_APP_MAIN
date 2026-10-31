import ActivityTimeField from '../common/ActivityTimeField';
import DateField from '../common/DateField';
import DropdownSelect from '../common/DropdownSelect';
import FormDisclosure from '../common/FormDisclosure';
import RichTextEditor from '../common/RichTextEditor';
import { getActiveCodeListMeta } from '../../utils/codeLists';
import { ENTRY_MODES } from '../../utils/activityEntries';

// Shared Activity editor, including journal/diary child entries. Only the
// destination and the scoped persistence callback vary between entry points.
export default function ActivityFormFields({
  value, onChange, priorities = [], mode = ENTRY_MODES.TASKS, disabled = false,
  namePrefix = 'dn-activity', showDate = true, showPriority = true,
  notesLabel, autoFocus = false,
}) {
  const isWriting = mode !== ENTRY_MODES.TASKS;
  const titleLabel = isWriting ? 'Entry title' : 'Activity title';
  const options = getActiveCodeListMeta('activityPriorities', priorities);
  const priority = value.priority || 'medium';
  const metadata = [showDate && 'date', 'time', showPriority && 'priority', !isWriting && 'notes']
    .filter(Boolean).join(', ');
  return <>
    <label className="dn-activity-create-title" htmlFor={`${namePrefix}-title`}>{titleLabel}
      <input id={`${namePrefix}-title`} aria-label={titleLabel} type="text"
        value={value.title || ''} disabled={disabled} required
        onChange={(event) => onChange({ title: event.target.value })}
        placeholder={titleLabel} autoFocus={autoFocus && typeof window !== 'undefined'
          && window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)').matches} />
    </label>
    {isWriting ? <RichTextEditor label={notesLabel || 'Entry notes (optional)'}
      value={value.description || ''} disabled={disabled}
      onChange={(description) => onChange({ description })}
      placeholder="Write what you want to remember" rows={4} /> : null}
    <FormDisclosure label="More options" hint={metadata}>
      <div className="activity-date-time-row">
        {showDate ? <DateField label="Date" name={`${namePrefix}-date`} value={value.date || ''}
          onChange={(event) => onChange({ date: event.target.value })} disabled={disabled} required /> : null}
        <ActivityTimeField value={value.time || ''} onChange={(time) => onChange({ time })}
          disabled={disabled} />
      </div>
      {showPriority ? <div className="dn-activity-create-priority">
        <label htmlFor={`${namePrefix}-priority`}>Priority</label>
        <DropdownSelect id={`${namePrefix}-priority`} aria-label="Activity priority"
          value={priority} disabled={disabled}
          onChange={(event) => onChange({ priority: event.target.value })}>
          {!options.some((option) => option.value === priority)
            ? <option value={priority}>{priority}</option> : null}
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </DropdownSelect>
      </div> : null}
      {!isWriting ? <RichTextEditor label={notesLabel || 'Activity notes (optional)'}
        value={value.description || ''} disabled={disabled}
        onChange={(description) => onChange({ description })} placeholder="Notes (optional)" rows={4} /> : null}
    </FormDisclosure>
  </>;
}
