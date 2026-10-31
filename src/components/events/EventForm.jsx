import ActivityTimeField from '../common/ActivityTimeField';
import { activityTime, activityTimePatch, currentEntryTime } from '../../utils/activityTime';
import { formatMomentDate } from '../../utils/momentDates';
/* Event metadata form used by the Events workspace and quick-create modal. */
import { useEffect, useRef, useState } from 'react';
import DateField from '../common/DateField';
import DropdownSelect from '../common/DropdownSelect';
import RichTextEditor from '../common/RichTextEditor';
import useAppStore from '../../store/useAppStore';
import { getCodeListItems } from '../../utils/codeLists';

const createDefaultState = (defaultEventType) => ({
  id: '',
  name: '',
  type: defaultEventType || 'Personal',
  customType: '',
  date: formatMomentDate(new Date()),
  time: currentEntryTime(),
  recurrence: 'none',
  budget: '',
  notes: '',
});

export default function EventForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Event' }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const eventTypeOptions = getCodeListItems('eventTypes', adminValues.eventTypes);
  const defaultEventType = useAppStore((state) => state.preferences.defaultEventType);
  const legacyOther = initialValues?.type === 'Other';
  const [form, setForm] = useState(() => ({ ...createDefaultState(defaultEventType),
    ...(initialValues ? { ...initialValues, time: activityTime(initialValues), customType: initialValues.customType || '' } : {}),
  }));

  const sourceRef = useRef(initialValues);
  useEffect(() => {
    if (sourceRef.current === initialValues) return;
    sourceRef.current = initialValues;
    if (initialValues) {
      setForm({
        ...createDefaultState(defaultEventType),
        ...initialValues,
        customType: initialValues.customType || '',
        time: activityTime(initialValues),
      });
    } else {
      setForm(createDefaultState(defaultEventType));
    }
  }, [initialValues, defaultEventType]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.date) {
      alert('Event name and date are required.');
      return;
    }

    if (!eventTypeOptions.includes(form.type) && !(legacyOther && form.type === 'Other')) {
      alert('Choose a configured Moment type in Settings → Code Lists.');
      return;
    }
    if (form.type === 'Other' && !form.customType.trim()) {
      alert('Please enter a custom event type.');
      return;
    }

    const { time, ...values } = form;
    onSubmit({
      ...values,
      name: form.name.trim(),
      type: form.type,
      customType: form.type === 'Other' ? form.customType.trim() : '',
      notes: form.notes,
      ...activityTimePatch(initialValues || {}, time),
    });
  };

  return (
    <form className="form-surface event-form" onSubmit={handleSubmit}>
      <p className="event-form-intro">Add the details that make this moment easy to remember.</p>

      <label htmlFor="event-name">Moment name
        <input id="event-name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. A birthday worth celebrating" required />
      </label>

      <div className="event-form-fields">
        <label htmlFor="event-type">Moment type
          <DropdownSelect id="event-type" name="type" value={form.type} onChange={handleChange}>
            {eventTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
            {legacyOther && !eventTypeOptions.includes('Other') ? <option value="Other">Other (legacy)</option> : null}
          </DropdownSelect>
        </label>

        <div className="activity-date-time-row">
          <DateField label="Date" id="event-date" name="date" value={form.date} onChange={handleChange} required />
          <ActivityTimeField subject="Moment" value={form.time || ''} onChange={(time) => setForm((current) => ({ ...current, time }))} />
        </div>
      </div>

      {form.type === 'Other' ? (
        <label htmlFor="event-custom-type">Custom moment type
          <input id="event-custom-type" name="customType" value={form.customType} onChange={handleChange} placeholder="What kind of moment is this?" required />
        </label>
      ) : null}

      <label htmlFor="event-recurrence">Repeat
        <DropdownSelect id="event-recurrence" name="recurrence" value={form.recurrence} onChange={handleChange}>
          <option value="none">Does not repeat</option>
          <option value="monthly">Every month</option>
          <option value="yearly">Every year</option>
        </DropdownSelect>
      </label>

      <RichTextEditor label="Notes (optional)" id="event-notes" name="notes" value={form.notes}
        onChange={(notes) => setForm((current) => ({ ...current, notes }))} placeholder="Add a detail you would like to remember" />

      <div className="event-form-actions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
        {onCancel ? (
          <button type="button" className="secondaryButton" onClick={onCancel}>Cancel</button>
        ) : null}
      </div>
    </form>
  );
}
