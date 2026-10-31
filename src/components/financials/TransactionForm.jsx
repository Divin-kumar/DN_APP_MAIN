import ActivityTimeField from '../common/ActivityTimeField';
import { activityTime, currentEntryTime } from '../../utils/activityTime';
import { useEffect, useMemo, useRef, useState } from 'react';
import DropdownSelect from '../common/DropdownSelect';
import FormDisclosure from '../common/FormDisclosure';
import DateField from '../common/DateField';
import RichTextEditor from '../common/RichTextEditor';
import useAppStore from '../../store/useAppStore';
import { getCodeListItems } from '../../utils/codeLists';
import { getMomentActivities, getTransactionMoments } from '../../utils/transactionRelations';
import { normalizePaymentMethod, requirePaymentMethod } from '../../utils/paymentMethod';

const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
const defaultValues = (preferences, defaultKind = 'expense') => ({
  transactionKind: defaultKind,
  title: '',
  amount: '',
  time: currentEntryTime(),
  paymentMethod: '',
  category: defaultKind === 'income' ? preferences.defaultIncomeType || 'Other' : preferences.defaultExpenseCategory || 'Other',
  date: today(),
  eventId: '',
  activityId: '',
  notes: '',
});

const createDraft = (preferences, initialTransaction, defaultKind, presetLink) => {
  const kind = initialTransaction?.transactionKind || defaultKind;
  return {
    ...defaultValues(preferences, kind),
    ...(!initialTransaction && presetLink ? { eventId: presetLink.eventId, activityId: presetLink.activityId, ...(presetLink.date ? { date: presetLink.date } : {}) } : {}),
    ...(initialTransaction ? {
      transactionKind: kind,
      title: initialTransaction.name || initialTransaction.title || '',
      amount: String(initialTransaction.amount ?? ''),
      paymentMethod: normalizePaymentMethod(initialTransaction.paymentMethod) || '',
      category: (kind === 'income' ? initialTransaction.type : initialTransaction.category) || 'Other',
      date: initialTransaction.date || today(),
      time: activityTime(initialTransaction),
      eventId: initialTransaction.eventId || '',
      activityId: initialTransaction.activityId || '',
      notes: initialTransaction.notes || initialTransaction.description || '',
    } : {}),
  };
};

export default function TransactionForm({
  initialTransaction = null, defaultKind = 'expense', presetLink = null, events = [],
  onSubmit, onCancel, busy = false,
}) {
  const preferences = useAppStore((state) => state.preferences);
  const adminValues = useAppStore((state) => state.adminValues);
  const [form, setForm] = useState(() => createDraft(preferences, initialTransaction, defaultKind, presetLink));
  const [error, setError] = useState('');

  const sourceRef = useRef([initialTransaction, defaultKind, presetLink?.eventId, presetLink?.activityId, presetLink?.date]);
  useEffect(() => {
    const next = [initialTransaction, defaultKind, presetLink?.eventId, presetLink?.activityId, presetLink?.date];
    // Preferences arriving after form opening must not erase a draft or refill a cleared clock.
    if (next.every((value, index) => value === sourceRef.current[index])) return;
    sourceRef.current = next;
    setForm(createDraft(preferences, initialTransaction, defaultKind, presetLink));
    setError('');
  }, [initialTransaction, defaultKind, presetLink?.eventId, presetLink?.activityId, presetLink?.date, preferences.defaultIncomeType, preferences.defaultExpenseCategory]);

  const categories = useMemo(() => {
    const isIncome = form.transactionKind === 'income';
    const list = getCodeListItems(isIncome ? 'incomeTypes' : 'expenseCategories',
      isIncome ? adminValues.incomeTypes : adminValues.expenseCategories);
    return [...new Set([...list, form.category, 'Other'].filter(Boolean))];
  }, [adminValues.incomeTypes, adminValues.expenseCategories, form.transactionKind, form.category]);

  const previousMethod = normalizePaymentMethod(initialTransaction?.paymentMethod);
  const paymentMethods = useMemo(() => [...new Set([
    ...getCodeListItems('paymentMethods', adminValues.paymentMethods), previousMethod,
  ].filter(Boolean))], [adminValues.paymentMethods, previousMethod]);

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
    try { requirePaymentMethod(form.paymentMethod, adminValues.paymentMethods, previousMethod); }
    catch (paymentError) {
      setError(paymentError.message);
      return;
    }
    setError('');
    try { await onSubmit({ ...form, title: form.title.trim(), amount }); }
    catch (saveError) { setError(saveError?.message || 'Could not save transaction. Try again.'); }
  };

  return (
    <form className="dn-transaction-form form-surface" onSubmit={handleSubmit}>
      <div className="dn-transaction-field">
        <span>Transaction Type *</span>
        <DropdownSelect aria-label="Transaction Type" value={form.transactionKind}
          onChange={(event) => handleType(event.target.value)} disabled={busy}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </DropdownSelect>
      </div>
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
      <div className="dn-transaction-field">
        <span>Category *</span>
        <DropdownSelect aria-label="Category" value={form.category}
          onChange={(event) => change('category', event.target.value)} disabled={busy}>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </DropdownSelect>
      </div>
      <fieldset className="dn-payment-method-field" aria-required="true">
        <legend>Payment method *</legend>
        <div className="dn-payment-method-options">
          {paymentMethods.map((method) => <label key={method} className="dn-payment-method-choice">
            <input type="radio" name="paymentMethod" value={method} checked={form.paymentMethod === method}
              onChange={() => change('paymentMethod', method)} disabled={busy} />
            <span>{method}</span>
          </label>)}
        </div>
        {!paymentMethods.length ? <small>Add a payment method in Settings → Code Lists before saving.</small> : null}
        {previousMethod && !getCodeListItems('paymentMethods', adminValues.paymentMethods).includes(previousMethod)
          ? <small>The saved method is no longer active. Keep it for this transaction or choose an active method.</small> : null}
        {initialTransaction && !normalizePaymentMethod(initialTransaction.paymentMethod)
          ? <small>Previously not specified. Choose a method before saving changes.</small> : null}
      </fieldset>
      <FormDisclosure label="More options" hint={form.eventId
        ? 'Linked Moment, date, time and notes' : 'Date, time, links and notes'}>
      <div className="dn-transaction-field">
        <span>Linked Moment (optional)</span>
        <DropdownSelect aria-label="Linked Moment" searchOnDemand searchLabel="Search linked moments" value={form.eventId}
          onChange={(event) => changeMoment(event.target.value)} disabled={busy}>
          <option value="">No linked moment</option>
          {moments.map((moment) => (
            <option key={moment.value} value={moment.value}>{moment.label}</option>
          ))}
          {form.eventId && !selectedMomentExists
            ? <option value={form.eventId}>Previously linked moment (unavailable)</option> : null}
        </DropdownSelect>
      </div>
      <div className="dn-transaction-field">
        <span>Linked Activity (optional)</span>
        <DropdownSelect aria-label="Linked Activity" searchOnDemand searchLabel="Search linked activities" value={form.activityId}
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
      </div>
      <div className="activity-date-time-row">
        <DateField label="Date *" name="date" required value={form.date}
          onChange={(event) => change('date', event.target.value)} disabled={busy} />
        <ActivityTimeField subject="Transaction" value={form.time} onChange={(time) => change('time', time)} disabled={busy} />
      </div>
      <RichTextEditor label="Notes" value={form.notes} onChange={(notes) => change('notes', notes)}
        placeholder="Add details (optional)" disabled={busy} className="dn-transaction-field" />
      </FormDisclosure>
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
