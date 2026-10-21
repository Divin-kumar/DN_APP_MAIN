import { useEffect, useMemo, useState } from 'react';
import DropdownSelect from '../common/DropdownSelect';
import DateField from '../common/DateField';
import useAppStore from '../../store/useAppStore';
import { getCodeListItems } from '../../utils/codeLists';

const today = () => new Date().toLocaleDateString('en-CA');
const defaultValues = (preferences, defaultKind = 'expense') => ({
  transactionKind: defaultKind,
  title: '',
  amount: '',
  category: defaultKind === 'income' ? preferences.defaultIncomeType || 'Other' : preferences.defaultExpenseCategory || 'Other',
  date: today(),
  eventId: '',
  activityId: '',
  notes: '',
});

export default function TransactionForm({
  initialTransaction = null, defaultKind = 'expense', events = [],
  onSubmit, onCancel, busy = false,
}) {
  const preferences = useAppStore((state) => state.preferences);
  const adminValues = useAppStore((state) => state.adminValues);
  const [form, setForm] = useState(() => defaultValues(preferences, defaultKind));
  const [error, setError] = useState('');

  useEffect(() => {
    const kind = initialTransaction?.transactionKind || defaultKind;
    setForm({
      ...defaultValues(preferences, kind),
      ...(initialTransaction ? {
        transactionKind: kind,
        title: initialTransaction.name || initialTransaction.title || '',
        amount: String(initialTransaction.amount ?? ''),
        category: (kind === 'income' ? initialTransaction.type : initialTransaction.category) || 'Other',
        date: initialTransaction.date || today(),
        eventId: initialTransaction.eventId || '',
        activityId: initialTransaction.activityId || '',
        notes: initialTransaction.notes || initialTransaction.description || '',
      } : {}),
    });
    setError('');
  }, [initialTransaction, defaultKind, preferences.defaultIncomeType, preferences.defaultExpenseCategory]);

  const categories = useMemo(() => {
    const isIncome = form.transactionKind === 'income';
    const list = getCodeListItems(isIncome ? 'incomeTypes' : 'expenseCategories',
      isIncome ? adminValues.incomeTypes : adminValues.expenseCategories);
    return [...new Set([...list, form.category, 'Other'].filter(Boolean))];
  }, [adminValues.incomeTypes, adminValues.expenseCategories, form.transactionKind, form.category]);

  const activities = useMemo(() => events.flatMap((event) =>
    (event.activities || []).map((activity) => ({
      eventId: event.id || event.firestoreId,
      activityId: activity.id,
      label: [event.name, activity.title || 'Untitled activity'].filter(Boolean).join(' · '),
    }))
  ), [events]);
  const activityValue = form.eventId && form.activityId
    ? JSON.stringify([form.eventId, form.activityId]) : '';
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleType = (kind) => {
    setForm((current) => ({
      ...current, transactionKind: kind,
      category: kind === 'income'
        ? preferences.defaultIncomeType || 'Other'
        : preferences.defaultExpenseCategory || 'Other',
    }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !form.category || !form.date || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a title, category, valid positive amount and date.');
      return;
    }
    setError('');
    try { await onSubmit({ ...form, title: form.title.trim(), amount }); }
    catch (saveError) { setError(saveError?.message || 'Could not save transaction. Try again.'); }
  };

  return (
    <form className="dn-transaction-form form-surface" onSubmit={handleSubmit}>
      <label className="dn-transaction-field">
        <span>Transaction Type *</span>
        <DropdownSelect aria-label="Transaction Type" value={form.transactionKind}
          onChange={(event) => handleType(event.target.value)} disabled={busy}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </DropdownSelect>
      </label>
      <label className="dn-transaction-field">
        <span>Amount *</span>
        <input type="number" inputMode="decimal" min="0.01" step="0.01" required
          value={form.amount} onChange={(event) => change('amount', event.target.value)}
          placeholder="0.00" disabled={busy} />
      </label>
      <label className="dn-transaction-field">
        <span>Title *</span>
        <input type="text" required maxLength={140} value={form.title}
          onChange={(event) => change('title', event.target.value)}
          placeholder="What was this for?" disabled={busy} />
      </label>
      <label className="dn-transaction-field">
        <span>Category *</span>
        <DropdownSelect aria-label="Category" value={form.category}
          onChange={(event) => change('category', event.target.value)} disabled={busy}>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </DropdownSelect>
      </label>
      <label className="dn-transaction-field">
        <span>Linked Activity (optional)</span>
        <DropdownSelect aria-label="Linked Activity" value={activityValue}
          onChange={(event) => {
            if (!event.target.value) { setForm((cur) => ({ ...cur, eventId: '', activityId: '' })); return; }
            const [eventId, activityId] = JSON.parse(event.target.value);
            setForm((cur) => ({ ...cur, eventId, activityId }));
          }} disabled={busy}>
          <option value="">No linked activity</option>
          {activities.map((item) => <option key={JSON.stringify([item.eventId, item.activityId])}
            value={JSON.stringify([item.eventId, item.activityId])}>{item.label}</option>)}
          {activityValue && !activities.some((item) => JSON.stringify([item.eventId,item.activityId]) === activityValue)
            ? <option value={activityValue}>Previously linked activity (unavailable)</option> : null}
        </DropdownSelect>
      </label>
      <DateField label="Date *" name="date" required value={form.date}
        onChange={(event) => change('date', event.target.value)} disabled={busy} />
      <label className="dn-transaction-field">
        <span>Notes</span>
        <textarea rows={3} maxLength={3000} value={form.notes}
          onChange={(event) => change('notes', event.target.value)}
          placeholder="Add details (optional)" disabled={busy} />
      </label>
      {error ? <p className="dn-transaction-form-error" role="alert">{error}</p> : null}
      <div className="form-actions">
        <button className="primaryButton" type="submit" disabled={busy}>
          {busy ? 'Saving…' : initialTransaction ? 'Save Changes' : 'Add Transaction'}
        </button>
        <button className="secondaryButton" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
