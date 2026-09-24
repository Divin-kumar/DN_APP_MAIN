/* Expense entry form, including optional event and activity relationships. */
import { useEffect, useState } from 'react';

const defaultState = {
  id: '',
  name: '',
  amount: '',
  category: 'Food',
  date: new Date().toISOString().slice(0, 10),
};

export default function ExpenseForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Expense', events = [] }) {
  const [form, setForm] = useState(defaultState);

  useEffect(() => {
    if (initialValues) {
      setForm({
        ...defaultState,
        ...initialValues,
        amount: String(initialValues.amount ?? ''),
        date: initialValues.date || new Date().toISOString().slice(0, 10),
      });
    } else {
      setForm(defaultState);
    }
  }, [initialValues]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value, ...(name === 'eventId' ? { activityId: '' } : {}) }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.amount || !form.date) {
      alert('Please complete all required fields.');
      return;
    }

    onSubmit({
      ...form,
      name: form.name.trim(),
      amount: Number(form.amount),
      category: form.category,
    });
  };

  return (
    <form className="form-surface" onSubmit={handleSubmit} style={styles.form}>
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Expense name"
        style={styles.input}
      />

      <input
        type="number"
        name="amount"
        value={form.amount}
        onChange={handleChange}
        placeholder="Amount"
        style={styles.input}
      />

      <select name="category" value={form.category} onChange={handleChange} style={styles.input}>
        <option value="Food">Food</option>
        <option value="Hospital">Hospital</option>
        <option value="Shopping">Shopping</option>
        <option value="Travel">Travel</option>
        <option value="Entertainment">Entertainment</option>
        <option value="Other">Other</option>
      </select>

      <select name="eventId" value={form.eventId || ''} onChange={handleChange} style={styles.input}>
        <option value="">No linked event</option>
        {events.map((event) => <option key={event.id || event.firestoreId} value={event.id || event.firestoreId}>{event.name}</option>)}
      </select>

      <select name="activityId" value={form.activityId || ''} onChange={handleChange} style={styles.input} disabled={!form.eventId}>
        <option value="">No linked activity</option>
        {(events.find((event) => (event.id || event.firestoreId) === form.eventId)?.activities || []).map((activity) => (
          <option key={activity.id} value={activity.id}>{activity.title}</option>
        ))}
      </select>

      <input
        type="date"
        name="date"
        value={form.date}
        onChange={handleChange}
        style={styles.input}
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
