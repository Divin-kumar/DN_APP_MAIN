import ActivityTimeField from '../common/ActivityTimeField';
import DateField from '../common/DateField';
import DropdownSelect from '../common/DropdownSelect';
import FormDisclosure from '../common/FormDisclosure';
import RichTextEditor from '../common/RichTextEditor';
import { entryDateTimeSummary } from '../../utils/activityTime';
import { getActiveCodeListMeta } from '../../utils/codeLists';

// Shared Activity editor. All supported Moment modes expose the same writing
// fields and preserve the same independent Activity storage contract.
export default function ActivityFormFields({
  value, onChange, priorities = [], disabled = false, children,
  namePrefix = 'dn-activity', showDate = true, showPriority = true, dateLocked = false,
  notesLabel, titleLabel: labelOverride, autoFocus = false,
}) {
  const titleLabel = labelOverride || 'Activity title';
  const options = getActiveCodeListMeta('activityPriorities', priorities);
  const priority = value.priority || 'medium';
  // Show existing editable values before expanding More options.
  const metadata = [
    entryDateTimeSummary(showDate ? (value.date || '') : undefined, value.time),
    value.description && 'Description added',
  ].filter(Boolean).join(' · ');
  return <>
    <label className="dn-activity-create-title" htmlFor={`${namePrefix}-title`}>{titleLabel}
      <input id={`${namePrefix}-title`} aria-label={titleLabel} type="text"
        value={value.title || ''} disabled={disabled} required
        onChange={(event) => onChange({ title: event.target.value })}
        placeholder={titleLabel} autoFocus={autoFocus && typeof window !== 'undefined'
          && window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)').matches} />
    </label>
    {children}
    <FormDisclosure hint={metadata}>
      <div className="activity-date-time-row">
        {showDate ? <DateField label="Date" name={`${namePrefix}-date`} value={value.date || ''}
          onChange={(event) => onChange({ date: event.target.value })} disabled={disabled || dateLocked} required /> : null}
        <ActivityTimeField value={value.time || ''} onChange={(time) => onChange({ time })}
          disabled={disabled} />
      </div>
      {dateLocked ? <p className="dn-entry-mode-help">Diary entries stay on this day. You can change the time below.</p> : null}
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
      <RichTextEditor label={notesLabel || 'Description (optional)'}
        value={value.description || ''} disabled={disabled}
        onChange={(description) => onChange({ description })}
        placeholder="Write what you want to remember" rows={4} />
    </FormDisclosure>
  </>;
}
