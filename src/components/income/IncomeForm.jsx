/* Income entry form used by the income management page. */
import { useEffect, useState } from 'react';
import DateField from '../common/DateField';
import DropdownSelect from '../common/DropdownSelect';
import useAppStore from '../../store/useAppStore';
import { getActiveCodeListMeta } from '../../utils/codeLists';

const createDefaultState = (defaultIncomeType) => ({
  id: '',
  name: '',
  type: defaultIncomeType || 'Salary',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
});

export default function IncomeForm({ initialValues, onSubmit, onCancel, submitLabel = 'Save Income' }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const incomeTypeOptions = getActiveCodeListMeta('incomeTypes', adminValues.incomeTypes);
  const defaultIncomeType = useAppStore((state) => state.preferences.defaultIncomeType);
  const [form, setForm] = useState(() => createDefaultState(defaultIncomeType));
  const [errors, setErrors] = useState({});

  // Do not replace a user's in-progress draft if a default preference changes.
  useEffect(() => {
    if (initialValues) {
      setForm({
        ...createDefaultState(defaultIncomeType),
        ...initialValues,
        amount: String(initialValues.amount ?? ''),
        date: initialValues.date || new Date().toISOString().slice(0, 10),
      });
    } else {
      setForm(createDefaultState(defaultIncomeType));
    }
    setErrors({});
  }, [initialValues]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      ...(!form.name.trim() ? { name: 'Enter an income source.' } : {}),
      ...(!amountIsValid ? { amount: form.amount.trim() ? 'Enter a valid amount.' : 'Enter an amount.' } : {}),
      ...(!form.date ? { date: 'Choose a date.' } : {}),
    };
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`income-${firstInvalid}`)?.focus();
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
    <form className="form-surface financial-entry-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor="income-name">Income source<input id="income-name" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Monthly salary" required aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'income-name-error' : undefined} />{errors.name ? <span className="form-field-error" id="income-name-error" role="alert">{errors.name}</span> : null}</label>

      <label htmlFor="income-type">Income type<DropdownSelect id="income-type" name="type" value={form.type} onChange={handleChange}>
        {incomeTypeOptions.map((option) => (
          <option key={option.id || option.value} value={option.value}>{option.label}</option>
        ))}
        <option value="Other">Other</option>
      </DropdownSelect></label>

      <label htmlFor="income-amount">Amount<input id="income-amount" type="number" step="any" name="amount" value={form.amount} onChange={handleChange} placeholder="0.00" required aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? 'income-amount-error' : undefined} />{errors.amount ? <span className="form-field-error" id="income-amount-error" role="alert">{errors.amount}</span> : null}</label>

      <div className="form-field-wrap"><DateField label="Date" id="income-date" name="date" value={form.date} onChange={handleChange} className="income-date-field" required aria-invalid={Boolean(errors.date)} aria-describedby={errors.date ? 'income-date-error' : undefined} />{errors.date ? <span className="form-field-error" id="income-date-error" role="alert">{errors.date}</span> : null}</div>

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

