/* Event metadata form used by the Events workspace and quick-create modal. */
import { useEffect, useState } from 'react';
import DateField from '../common/DateField';
import DropdownSelect from '../common/DropdownSelect';
import useAppStore from '../../store/useAppStore';
import { getActiveCodeListMeta } from '../../utils/codeLists';

const createDefaultState = (defaultEventType) => ({
  id: '',
  name: '',
  type: defaultEventType || 'Personal',
  customType: '',
  date: new Date().toISOString().slice(0, 10),
  recurrence: 'none',
  budget: '',
  notes: '',
});

export default function EventForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Moment' }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const eventTypeOptions = getActiveCodeListMeta('eventTypes', adminValues.eventTypes);
  const defaultEventType = useAppStore((state) => state.preferences.defaultEventType);
  const [form, setForm] = useState(() => createDefaultState(defaultEventType));
  const [errors, setErrors] = useState({});

  // Do not replace a user's in-progress draft if a default preference changes.
  useEffect(() => {
    if (initialValues) {
      setForm({
        ...createDefaultState(defaultEventType),
        ...initialValues,
        customType: initialValues.customType || '',
      });
    } else {
      setForm(createDefaultState(defaultEventType));
    }
    setErrors({});
  }, [initialValues]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (name === 'type' && value !== 'Other') delete next.customType;
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const nextErrors = {
      ...(!form.name.trim() ? { name: 'Enter a moment name.' } : {}),
      ...(!form.date ? { date: 'Choose a date.' } : {}),
      ...(form.type === 'Other' && !form.customType.trim() ? { customType: 'Enter a custom moment type.' } : {}),
    };
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`event-${firstInvalid === 'name' ? 'name' : firstInvalid === 'date' ? 'date' : 'custom-type'}`)?.focus();
      return;
    }

    onSubmit({
      ...form,
      name: form.name.trim(),
      type: form.type,
      customType: form.type === 'Other' ? form.customType.trim() : '',
      notes: form.notes.trim(),
    });
  };

  return (
    <form className="form-surface event-form" onSubmit={handleSubmit} noValidate>
      <p className="event-form-intro">Add the details that make this moment easy to remember.</p>

      <label htmlFor="event-name">Moment name
        <input id="event-name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. A birthday worth celebrating" required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'event-name-error' : undefined} />
        {errors.name ? <span className="form-field-error" id="event-name-error" role="alert">{errors.name}</span> : null}
      </label>

      <div className="event-form-fields">
        <label htmlFor="event-type">Moment type
          <DropdownSelect id="event-type" name="type" value={form.type} onChange={handleChange}>
            {eventTypeOptions.map((option) => (
              <option key={option.id || option.value} value={option.value}>{option.label}</option>
            ))}
            <option value="Other">Other</option>
          </DropdownSelect>
        </label>

          <div className="form-field-wrap"><DateField label="Date" id="event-date" name="date" value={form.date} onChange={handleChange} required aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'event-date-error' : undefined} />{errors.date ? <span className="form-field-error" id="event-date-error" role="alert">{errors.date}</span> : null}</div>
      </div>

      {form.type === 'Other' ? (
        <label htmlFor="event-custom-type">Custom moment type
          <input id="event-custom-type" name="customType" value={form.customType} onChange={handleChange} placeholder="What kind of moment is this?" required aria-invalid={Boolean(errors.customType)} aria-describedby={errors.customType ? 'event-custom-type-error' : undefined} />
          {errors.customType ? <span className="form-field-error" id="event-custom-type-error" role="alert">{errors.customType}</span> : null}
        </label>
      ) : null}

      <label htmlFor="event-recurrence">Repeat
        <DropdownSelect id="event-recurrence" name="recurrence" value={form.recurrence} onChange={handleChange}>
          <option value="none">Does not repeat</option>
          <option value="monthly">Every month</option>
          <option value="yearly">Every year</option>
        </DropdownSelect>
      </label>

      <label htmlFor="event-notes">Notes <span className="event-form-optional">Optional</span>
        <textarea id="event-notes" name="notes" value={form.notes} onChange={handleChange} placeholder="Add a detail you would like to remember" rows={3} />
      </label>

      <div className="event-form-actions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
        {onCancel ? (
          <button type="button" className="secondaryButton" onClick={onCancel}>Cancel</button>
        ) : null}
      </div>
    </form>
  );
}
