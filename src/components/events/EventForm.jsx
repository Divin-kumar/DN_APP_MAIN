/* Event metadata form used only inside the create/edit drawer. */
import { useEffect, useState } from 'react';
import useAppStore from '../../store/useAppStore';

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

export default function EventForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Event' }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const defaultEventType = useAppStore((state) => state.preferences.defaultEventType);
  const [form, setForm] = useState(() => createDefaultState(defaultEventType));

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

    if (form.type === 'Other' && !form.customType.trim()) {
      alert('Please enter a custom event type.');
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
    <form className="form-surface" onSubmit={handleSubmit} style={styles.form}>
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Event name"
        style={styles.input}
      />

      <select name="type" value={form.type} onChange={handleChange} style={styles.input}>
        {adminValues.eventTypes.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
        <option value="Other">Other</option>
      </select>

      {form.type === 'Other' ? (
        <input
          name="customType"
          value={form.customType}
          onChange={handleChange}
          placeholder="Custom event type"
          style={styles.input}
        />
      ) : null}

      <input
        type="date"
        name="date"
        value={form.date}
        onChange={handleChange}
        style={styles.input}
      />

      <select name="recurrence" value={form.recurrence} onChange={handleChange} style={styles.input}>
        <option value="none">No recurrence</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>

      <textarea
        name="notes"
        value={form.notes}
        onChange={handleChange}
        placeholder="Notes"
        rows={4}
        style={{ ...styles.input, resize: 'vertical' }}
      />

      <div style={styles.actions}>
        <button type="submit" className="primaryButton" style={styles.primaryButton}>{submitLabel}</button>
        {onCancel ? (
          <button type="button" className="secondaryButton" onClick={onCancel} style={styles.secondaryButton}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

const styles = {
  form: {
    display: 'grid',
    gap: '12px',
    background: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '18px',
    color: 'var(--ink)',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    marginTop: '4px',
  },
  primaryButton: {
    flex: 1,
    border: 'none',
    borderRadius: '10px',
    background: '#2d6a4f',
    color: '#ffffff',
    padding: '12px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  secondaryButton: {
    flex: 1,
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
    padding: '12px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
