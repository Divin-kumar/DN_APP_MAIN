import ActivityTimeField from '../common/ActivityTimeField';
import { activityTime, currentEntryTime } from '../../utils/activityTime';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DropdownSelect from '../common/DropdownSelect';
import FormDisclosure from '../common/FormDisclosure';
import { useDialogFormFooter } from '../common/ModalDialog';
import { RepeatDisclosure } from '../common/RepeatField';
import DateField from '../common/DateField';
import RichTextEditor from '../common/RichTextEditor';
import useAppStore from '../../store/useAppStore';
import { getCodeListItems } from '../../utils/codeLists';
import { getMomentActivities, getTransactionMoments } from '../../utils/transactionRelations';
import { normalizePaymentMethod, requirePaymentMethod } from '../../utils/paymentMethod';
import { formatScheduleDate, previewNextRepeat, repeatEditNotice } from '../../utils/repeatSchedule.js';
import { CalendarDays } from 'lucide-react';
import './ExpensePlans.css';

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
  repeatFrequency: '',
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

const paymentDraft = (plan) => ({
  transactionKind: 'expense', title: plan.name, amount: String(plan.amount),
  category: plan.category, notes: plan.notes, paymentMethod: plan.paymentMethod || '',
});

export default function TransactionForm({
  initialTransaction = null, defaultKind = 'expense', presetLink = null, events = [], expensePlan = null, paymentPlan = null,
  onSubmit, onCancel, busy = false,
}) {
  const formId = useId();
  const actionsContainer = useDialogFormFooter();
  const preferences = useAppStore((state) => state.preferences);
  const adminValues = useAppStore((state) => state.adminValues);
  const [form, setForm] = useState(() => {
    const original = createDraft(preferences, initialTransaction, defaultKind, presetLink);
    if (expensePlan) return { ...original, ...paymentDraft(expensePlan), time: '',
      date: expensePlan.dueDate, repeatFrequency: expensePlan.repeat.frequency };
    return paymentPlan ? { ...original, ...paymentDraft(paymentPlan) } : original;
  });
  const [error, setError] = useState('');
  const canRepeat = !initialTransaction && !paymentPlan && form.transactionKind === 'expense';
  const isPlan = canRepeat && Boolean(form.repeatFrequency);
  const planFlow = Boolean(paymentPlan || expensePlan || isPlan);
  const nextRepeat = previewNextRepeat(expensePlan, form.repeatFrequency, form.date);
  const repeatNotice = repeatEditNotice(expensePlan, form.repeatFrequency, form.date, nextRepeat);
  const nextPaymentDate = paymentPlan && previewNextRepeat(paymentPlan, paymentPlan.repeat.frequency, paymentPlan.dueDate);

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

  const previousMethod = normalizePaymentMethod((initialTransaction || expensePlan || paymentPlan)?.paymentMethod);
  const paymentMethods = useMemo(() => [...new Set([
    ...getCodeListItems('paymentMethods', adminValues.paymentMethods), previousMethod,
  ].filter(Boolean))], [adminValues.paymentMethods, previousMethod]);

  const moments = useMemo(() => getTransactionMoments(events), [events]);
  const activities = useMemo(() => getMomentActivities(events, form.eventId), [events, form.eventId]);
  const selectedMomentExists = moments.some((moment) => moment.value === String(form.eventId));
  const selectedActivityExists = activities.some((activity) => activity.value === String(form.activityId));
  const supportingDetails = paymentPlan ? 'Title, category, time, links and notes'
    : isPlan ? 'Default method and notes' : 'Links and notes';
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
      repeatFrequency: '',
      category: kind === 'income'
        ? preferences.defaultIncomeType || 'Other'
        : preferences.defaultExpenseCategory || 'Other',
    }));
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy || (isPlan && !nextRepeat)) return;
    const amount = Number(form.amount);
    if (!form.title.trim() || !form.category || !form.date || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a title, category, valid positive amount and date.');
      return;
    }
    try { if (!isPlan || form.paymentMethod) requirePaymentMethod(form.paymentMethod, adminValues.paymentMethods, previousMethod); }
    catch (paymentError) {
      setError(paymentError.message);
      return;
    }
    setError('');
    try { await onSubmit({ ...form, title: form.title.trim(), amount,
      repeatFrequency: isPlan ? form.repeatFrequency : '',
      ...(isPlan ? { eventId: '', activityId: '', time: '' } : {}),
    }); }
    catch (saveError) { setError(saveError?.message || 'Could not save transaction. Try again.'); }
  };

  const titleField = <label className="dn-transaction-field">
    <span>{paymentPlan ? 'Title' : 'Title *'}</span>
    <input type="text" required={!paymentPlan} maxLength={140} value={form.title}
      onChange={(event) => change('title', event.target.value)}
      placeholder={canRepeat ? 'Expense name' : 'What was this for?'} disabled={busy} />
  </label>;
  const categoryField = <div className="dn-transaction-field">
    <span>Category *</span>
    <DropdownSelect aria-label="Category" value={form.category}
      onChange={(event) => change('category', event.target.value)} disabled={busy}>
      {categories.map((category) => <option key={category} value={category}>{category}</option>)}
    </DropdownSelect>
  </div>;
  const dates = <div className="activity-date-time-row">
    <DateField label={isPlan ? 'Due date *' : paymentPlan ? 'Paid on *' : 'Date *'} name="date" required value={form.date}
      onChange={(event) => change('date', event.target.value)} disabled={busy} />
    {!planFlow ? <ActivityTimeField subject="Transaction" value={form.time} onChange={(time) => change('time', time)} disabled={busy} /> : null}
  </div>;
  const repeatField = canRepeat ? <RepeatDisclosure value={form.repeatFrequency}
    onChange={(frequency) => change('repeatFrequency', frequency)} disabled={busy}
    nextDate={nextRepeat} dueDate={form.date} notice={repeatNotice} allowOneTime={!expensePlan}>
    {presetLink?.eventId || form.eventId ? 'Choose the Moment or Activity when you record each payment.' : null}
  </RepeatDisclosure> : null;
  const amount = <label className="dn-transaction-field">
    <span>{paymentPlan ? 'Amount paid *' : isPlan ? <>Expected amount&nbsp;*</> : 'Amount *'}</span>
    <input type="number" inputMode="decimal" min="0.01" step="0.01" required
      value={form.amount} onChange={(event) => change('amount', event.target.value)}
      placeholder="0.00" disabled={busy} />
  </label>;
  const paymentMethod = <fieldset className="dn-payment-method-field" aria-required={!isPlan}>
    <legend>{isPlan ? 'Default payment method (optional)' : 'Payment method *'}</legend>
    <div className="dn-payment-method-options">
      {paymentMethods.map((method) => <label key={method} className="dn-payment-method-choice">
        <input type="radio" name="paymentMethod" value={method} checked={form.paymentMethod === method}
          onChange={() => change('paymentMethod', method)} disabled={busy} />
        <span>{method}</span>
      </label>)}
      {isPlan ? <label className="dn-payment-method-choice">
        <input type="radio" name="paymentMethod" value="" checked={!form.paymentMethod}
          onChange={() => change('paymentMethod', '')} disabled={busy} />
        <span>Choose at payment</span>
      </label> : null}
    </div>
    {!paymentMethods.length && !isPlan ? <small>Add a payment method in Settings → Code Lists before saving.</small> : null}
    {previousMethod && !getCodeListItems('paymentMethods', adminValues.paymentMethods).includes(previousMethod)
      ? <small>The saved method is no longer active. You can keep it here or choose an active method.</small> : null}
    {initialTransaction && !normalizePaymentMethod(initialTransaction.paymentMethod)
      ? <small>Previously not specified. Choose a method before saving changes.</small> : null}
  </fieldset>;

  const actions = <>{error ? <p className="dn-transaction-form-error" role="alert">{error}</p> : null}<div className="form-actions">
    <button className="primaryButton" type="submit" form={formId} disabled={busy || (isPlan && !nextRepeat)}>
      {busy ? 'Saving…' : isPlan ? 'Save expense plan' : paymentPlan ? 'Save payment' : initialTransaction ? 'Save Changes' : 'Add Transaction'}
    </button>
    <button className="secondaryButton" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
  </div></>;

  return (
    <form id={formId} className={`dn-transaction-form form-surface${planFlow ? ' dn-plan-transaction-form' : ''}${paymentPlan ? ' dn-expense-payment-form' : ''}`}
      onSubmit={handleSubmit} aria-busy={busy}>
      {paymentPlan ? <div className="dn-payment-context">
        <span className="dn-payment-context-icon"><CalendarDays size={19} aria-hidden="true" /></span>
        <div><strong>{paymentPlan.name}</strong>
          <p><time dateTime={paymentPlan.dueDate}>{formatScheduleDate(paymentPlan.dueDate)}</time> due
            {nextPaymentDate ? <> · Next <time dateTime={nextPaymentDate}>{formatScheduleDate(nextPaymentDate)}</time></> : null}</p>
        </div>
      </div> : null}
      {!paymentPlan && !expensePlan ? <div className="dn-transaction-field">
        <span>Transaction Type *</span>
        <DropdownSelect aria-label="Transaction Type" value={form.transactionKind}
          onChange={(event) => handleType(event.target.value)} disabled={busy}>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </DropdownSelect>
      </div> : null}
      {paymentPlan ? <div className="dn-payment-fields">{amount}<div className="dn-plan-form-date">{dates}</div></div>
        : canRepeat ? <div className="dn-expense-draft-fields">{titleField}{amount}</div> : <>{amount}{titleField}</>}
      {!paymentPlan ? <>
        <div className={isPlan ? 'dn-plan-form-date' : undefined}>{dates}</div>
        {repeatField}
        {categoryField}
      </> : null}
      {!isPlan ? paymentMethod : null}
      <FormDisclosure label="More options" hint={supportingDetails}>
      {isPlan ? paymentMethod : null}
      {paymentPlan ? <>{titleField}{categoryField}
        <ActivityTimeField subject="Payment" value={form.time} onChange={(time) => change('time', time)} disabled={busy} />
      </> : null}
      {!isPlan ? <>
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
      </> : null}
      <RichTextEditor label="Notes" value={form.notes} onChange={(notes) => change('notes', notes)}
        placeholder="Add details (optional)" disabled={busy} className="dn-transaction-field" />
      </FormDisclosure>
      {actionsContainer ? createPortal(actions, actionsContainer) : actions}
    </form>
  );
}
