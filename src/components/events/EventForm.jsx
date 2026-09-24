import { useEffect, useState } from 'react';

const defaultState = {
  id: '',
  name: '',
  type: 'Personal',
  customType: '',
  date: new Date().toISOString().slice(0, 10),
  recurrence: 'none',
  budget: '',
  notes: '',
};

export default function EventForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Event' }) {
  const [form, setForm] = useState(defaultState);

  useEffect(() => {
    if (initialValues) {
      setForm({
        ...defaultState,
        ...initialValues,
        customType: initialValues.customType || '',
      });
    } else {
      setForm(defaultState);
    }
  }, [initialValues]);

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
        <option value="Birthday">Birthday</option>
        <option value="Festival">Festival</option>
        <option value="Function">Function</option>
        <option value="Personal">Personal</option>
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
        <button type="submit" style={styles.primaryButton}>{submitLabel}</button>
        {onCancel ? (
          <button type="button" onClick={onCancel} style={styles.secondaryButton}>
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
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #dfeae3',
    padding: '18px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d7e3da',
    background: '#fbfdfb',
    color: '#1d3f2c',
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
    border: '1px solid #d7e3da',
    borderRadius: '10px',
    background: '#f3f8f4',
    color: '#1d3f2c',
    padding: '12px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
