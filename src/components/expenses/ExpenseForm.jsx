/* Expense entry form, including optional event and activity relationships. */
import { useEffect, useState } from 'react';
import DateField from '../common/DateField';
import DropdownSelect from '../common/DropdownSelect';
import useAppStore from '../../store/useAppStore';
import { getActiveCodeListMeta } from '../../utils/codeLists';

const createDefaultState = (defaultCategory) => ({
  id: '',
  name: '',
  amount: '',
  category: defaultCategory || 'Food',
  date: new Date().toISOString().slice(0, 10),
});

export default function ExpenseForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Expense', events = [] }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const expenseCategoryOptions = getActiveCodeListMeta('expenseCategories', adminValues.expenseCategories);
  const defaultExpenseCategory = useAppStore((state) => state.preferences.defaultExpenseCategory);
  const [form, setForm] = useState(() => createDefaultState(defaultExpenseCategory));
  const [errors, setErrors] = useState({});

  // Do not replace a user's in-progress draft if a default preference changes.
  useEffect(() => {
    if (initialValues) {
      setForm({
        ...createDefaultState(defaultExpenseCategory),
        ...initialValues,
        amount: String(initialValues.amount ?? ''),
        date: initialValues.date || new Date().toISOString().slice(0, 10),
      });
    } else {
      setForm(createDefaultState(defaultExpenseCategory));
    }
    setErrors({});
  }, [initialValues]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value, ...(name === 'eventId' ? { activityId: '' } : {}) }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const amountIsValid = form.amount.trim() !== '' && Number.isFinite(Number(form.amount));
    const nextErrors = {
      ...(!form.name.trim() ? { name: 'Enter an expense name.' } : {}),
      ...(!amountIsValid ? { amount: form.amount.trim() ? 'Enter a valid amount.' : 'Enter an amount.' } : {}),
      ...(!form.date ? { date: 'Choose a date.' } : {}),
    };
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`expense-${firstInvalid}`)?.focus();
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
    <form className="form-surface financial-entry-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="expense-name">Expense name<input id="expense-name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Weekly groceries" required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'expense-name-error' : undefined} />{errors.name ? <span className="form-field-error" id="expense-name-error" role="alert">{errors.name}</span> : null}</label>

      <label htmlFor="expense-amount">Amount<input id="expense-amount" type="number" step="any" name="amount" value={form.amount} onChange={handleChange} placeholder="0.00" required aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'expense-amount-error' : undefined} />{errors.amount ? <span className="form-field-error" id="expense-amount-error" role="alert">{errors.amount}</span> : null}</label>

      <label htmlFor="expense-category">Category<DropdownSelect id="expense-category" name="category" value={form.category} onChange={handleChange}>
        {expenseCategoryOptions.map((option) => (
          <option key={option.id || option.value} value={option.value}>{option.label}</option>
        ))}
        <option value="Other">Other</option>
      </DropdownSelect></label>

      <label htmlFor="expense-event">Link to Moment<DropdownSelect id="expense-event" name="eventId" value={form.eventId || ''} onChange={handleChange}>
        <option value="">No linked event</option>
        {events.map((event) => <option key={event.id || event.firestoreId} value={event.id || event.firestoreId}>{event.name}</option>)}
      </DropdownSelect></label>

      <label htmlFor="expense-activity">Link to Activity<DropdownSelect id="expense-activity" name="activityId" value={form.activityId || ''} onChange={handleChange} disabled={!form.eventId}>
        <option value="">No linked activity</option>
        {(events.find((event) => (event.id || event.firestoreId) === form.eventId)?.activities || []).map((activity) => (
          <option key={activity.id} value={activity.id}>{activity.title}</option>
        ))}
      </DropdownSelect></label>

      <div className="form-field-wrap"><DateField label="Date" id="expense-date" name="date" value={form.date} onChange={handleChange} className="expense-date-field" required aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'expense-date-error' : undefined} />{errors.date ? <span className="form-field-error" id="expense-date-error" role="alert">{errors.date}</span> : null}</div>

      <div className="form-actions">
        <button type="submit" className="primaryButton">{submitLabel}</button>
        {onCancel ? (
          <button type="button" className="secondaryButton" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

