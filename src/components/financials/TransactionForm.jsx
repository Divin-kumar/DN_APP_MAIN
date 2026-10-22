import { useEffect, useMemo, useState } from 'react';
import DropdownSelect from '../common/DropdownSelect';
import DateField from '../common/DateField';
import RichTextEditor from '../common/RichTextEditor';
import useAppStore from '../../store/useAppStore';
import { getCodeListItems } from '../../utils/codeLists';
import { getMomentActivities, getTransactionMoments } from '../../utils/transactionRelations';

const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
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
  initialTransaction = null, defaultKind = 'expense', presetLink = null, events = [],
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
      ...(!initialTransaction && presetLink ? { eventId: presetLink.eventId, activityId: presetLink.activityId, ...(presetLink.date ? { date: presetLink.date } : {}) } : {}),
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
  }, [initialTransaction, defaultKind, presetLink?.eventId, presetLink?.activityId, presetLink?.date, preferences.defaultIncomeType, preferences.defaultExpenseCategory]);

  const categories = useMemo(() => {
    const isIncome = form.transactionKind === 'income';
    const list = getCodeListItems(isIncome ? 'incomeTypes' : 'expenseCategories',
      isIncome ? adminValues.incomeTypes : adminValues.expenseCategories);
    return [...new Set([...list, form.category, 'Other'].filter(Boolean))];
  }, [adminValues.incomeTypes, adminValues.expenseCategories, form.transactionKind, form.category]);

  const moments = useMemo(() => getTransactionMoments(events), [events]);
  const activities = useMemo(() => getMomentActivities(events, form.eventId), [events, form.eventId]);
  const selectedMomentExists = moments.some((moment) => moment.value === String(form.eventId));
  const selectedActivityExists = activities.some((activity) => activity.value === String(form.activityId));
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeMoment = (eventId) => setForm((current) => ({
    ...current,
    eventId,
    // Activity identifiers are only meaningful inside the previously chosen Moment.
    activityId: eventId === current.eventId ? current.activityId : '',
  }));

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
    if (busy) return;
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
        <span>Linked Moment (optional)</span>
        <DropdownSelect aria-label="Linked Moment" value={form.eventId}
          onChange={(event) => changeMoment(event.target.value)} disabled={busy}>
          <option value="">No linked moment</option>
          {moments.map((moment) => (
            <option key={moment.value} value={moment.value}>{moment.label}</option>
          ))}
          {form.eventId && !selectedMomentExists
            ? <option value={form.eventId}>Previously linked moment (unavailable)</option> : null}
        </DropdownSelect>
      </label>
      <label className="dn-transaction-field">
        <span>Linked Activity (optional)</span>
        <DropdownSelect aria-label="Linked Activity" value={form.activityId}
          onChange={(event) => change('activityId', event.target.value)}
          disabled={busy || !form.eventId || !selectedMomentExists}
          placeholder={form.eventId ? 'Choose an activity' : 'Choose a moment first'}>
          <option value="">No linked activity</option>
          {activities.map((activity) => (
            <option key={activity.value} value={activity.value}>{activity.label}</option>
          ))}
          {form.activityId && !selectedActivityExists
            ? <option value={form.activityId}>Previously linked activity (unavailable)</option> : null}
        </DropdownSelect>
        {!form.eventId ? <small className="dn-transaction-field-hint">Select a moment to see only its activities.</small>
          : selectedMomentExists && !activities.length
            ? <small className="dn-transaction-field-hint">No activities in this moment. Linking just the moment is fine.</small>
            : null}
      </label>
      <DateField label="Date *" name="date" required value={form.date}
        onChange={(event) => change('date', event.target.value)} disabled={busy} />
      <RichTextEditor label="Notes" value={form.notes} onChange={(notes) => change('notes', notes)}
        placeholder="Add details (optional)" disabled={busy} className="dn-transaction-field" />
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
