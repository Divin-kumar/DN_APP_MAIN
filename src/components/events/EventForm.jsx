import ActivityTimeField from '../common/ActivityTimeField';
import { activityTime, activityTimePatch, currentEntryTime } from '../../utils/activityTime';
import { formatMomentDate } from '../../utils/momentDates';
/* Event metadata form used by the Events workspace and quick-create modal. */
import { useEffect, useId, useRef, useState } from 'react';
import { DialogFormActions, useDialogClose } from '../common/ModalDialog';
import DateField from '../common/DateField';
import DropdownSelect from '../common/DropdownSelect';
import { motion, useReducedMotion } from 'framer-motion';
import FormDisclosure from '../common/FormDisclosure';
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

export default function EventForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Moment', busy = false, error }) {
  const formId = useId();
  const reduceMotion = useReducedMotion();
  const adminValues = useAppStore((state) => state.adminValues);
  const eventTypeOptions = getCodeListItems('eventTypes', adminValues.eventTypes);
  const defaultEventType = useAppStore((state) => state.preferences.defaultEventType);
  const legacyOther = initialValues?.type === 'Other';
  const legacyType = initialValues?.type && !eventTypeOptions.includes(initialValues.type) ? initialValues.type : '';
  const [form, setForm] = useState(() => ({ ...createDefaultState(defaultEventType),
    ...(initialValues ? { ...initialValues, time: activityTime(initialValues), customType: initialValues.customType || '' } : {}),
  }));
  const [validationError, setValidationError] = useState('');
  const guardedCancel = useDialogClose(onCancel);
  const nameInputRef = useRef(null);
  const customTypeInputRef = useRef(null);

  const sourceRef = useRef(initialValues);
  const editBaseline = useRef(form);
  useEffect(() => {
    if (sourceRef.current === initialValues) return;
    sourceRef.current = initialValues;
    setValidationError('');
    const nextForm = { ...createDefaultState(defaultEventType),
      ...(initialValues ? { ...initialValues, customType: initialValues.customType || '', time: activityTime(initialValues) } : {}),
    };
    editBaseline.current = nextForm;
    setForm(nextForm);
  }, [initialValues, defaultEventType]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setValidationError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (busy) return;

    if (!form.name.trim()) {
      setValidationError('Enter a Moment name.');
      nameInputRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!form.date) {
      setValidationError('Choose a date.');
      event.currentTarget.querySelector('#event-date')?.focus({ preventScroll: true });
      return;
    }
    if (!eventTypeOptions.includes(form.type) && form.type !== legacyType) {
      setValidationError('Choose a Moment type available in Settings → Code Lists.');
      event.currentTarget.querySelector('#event-type')?.focus({ preventScroll: true });
      return;
    }
    if (form.type === 'Other' && !form.customType.trim()) {
      setValidationError('Enter a custom Moment type.');
      customTypeInputRef.current?.focus({ preventScroll: true });
      return;
    }

    setValidationError('');
    const values = {
      name: form.name.trim(),
      date: form.date,
      recurrence: form.recurrence,
      type: form.type,
      customType: form.type === 'Other' ? form.customType.trim() : '',
      notes: form.notes,
      ...activityTimePatch(initialValues || {}, form.time),
    };
    // Background edits to other fields and linked records must survive this save.
    onSubmit(initialValues
      ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== editBaseline.current[key]))
      : { id: form.id, budget: form.budget, ...values });
  };

  return (
    <form id={formId} className="form-surface event-form" aria-busy={busy} onSubmit={handleSubmit}>
      <label htmlFor="event-name">Moment name
        <input ref={nameInputRef} id="event-name" name="name" disabled={busy} value={form.name} onChange={handleChange}
          aria-invalid={Boolean(validationError && !form.name.trim())}
          placeholder="e.g. Birthday dinner" required />
      </label>

      <label htmlFor="event-type">Moment type
        <DropdownSelect id="event-type" name="type" disabled={busy} value={form.type} onChange={handleChange}>
          {eventTypeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
          {legacyType ? <option value={legacyType}>{legacyOther ? 'Other (legacy)' : legacyType + ' (legacy)'}</option> : null}
        </DropdownSelect>
      </label>

      {form.type === 'Other' ? (
        <motion.label htmlFor="event-custom-type"
          initial={reduceMotion ? false : { opacity: .4, y: -4 }}
          animate={{ opacity: 1, y: 0 }} transition={{ duration: .14, ease: 'easeOut' }}>
          Custom moment type
          <input ref={customTypeInputRef} id="event-custom-type" name="customType" disabled={busy} value={form.customType}
            onChange={handleChange} aria-invalid={Boolean(validationError && !form.customType.trim())}
            placeholder="What kind of moment is this?" required />
        </motion.label>
      ) : null}

      <div className="activity-date-time-row">
        <DateField label="Date" id="event-date" name="date" disabled={busy} value={form.date} onChange={handleChange} required />
        <ActivityTimeField subject="Moment" disabled={busy} value={form.time || ''} onChange={(time) => setForm((current) => ({ ...current, time }))} />
      </div>

      <FormDisclosure hint={form.recurrence !== 'none' ? `Repeats ${form.recurrence}` : 'Repeat and notes'}>
        <label htmlFor="event-recurrence">Repeat
          <DropdownSelect id="event-recurrence" name="recurrence" disabled={busy} value={form.recurrence} onChange={handleChange}>
            <option value="none">Does not repeat</option>
            <option value="monthly">Every month</option>
            <option value="yearly">Every year</option>
          </DropdownSelect>
        </label>

        <RichTextEditor label="Notes (optional)" id="event-notes" disabled={busy} name="notes" value={form.notes}
          onChange={(notes) => setForm((current) => ({ ...current, notes }))} placeholder="Add a detail you would like to remember" />
      </FormDisclosure>

      <DialogFormActions>
        {validationError || error ? <p className="event-form-validation" role="alert">{validationError || error}</p> : null}
        <div className="event-form-actions">
          {onCancel ? <button type="button" className="secondaryButton" disabled={busy} onClick={guardedCancel}>Cancel</button> : null}
          <button type="submit" form={formId} className="primaryButton" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </div>
      </DialogFormActions>
    </form>
  );
}
