import { useEffect, useState } from 'react';

const defaultState = {
  id: '',
  name: '',
  type: 'Salary',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
};

export default function IncomeForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Income' }) {
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
    setForm((prev) => ({ ...prev, [name]: value }));
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
      type: form.type,
    });
  };

  return (
    <form className="form-surface" onSubmit={handleSubmit} style={styles.form}>
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Income source"
        style={styles.input}
      />

      <select name="type" value={form.type} onChange={handleChange} style={styles.input}>
        <option value="Salary">Salary</option>
        <option value="Freelance">Freelance</option>
        <option value="Bonus">Bonus</option>
        <option value="Other">Other</option>
      </select>

      <input
        type="number"
        name="amount"
        value={form.amount}
        onChange={handleChange}
        placeholder="Amount"
        style={styles.input}
      />

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
