import { useRef } from 'react';
import { CalendarDays, ChevronRight } from 'lucide-react';
import ModalDialog, { ConfirmButtons } from '../common/ModalDialog';
import { RepeatActionSummary } from '../common/RepeatField';
import TransactionForm from './TransactionForm';
import { activityTime } from '../../utils/activityTime.js';
import { formatMomentDate } from '../../utils/momentDates.js';
import { paymentMethodLabel } from '../../utils/paymentMethod.js';
import { formatScheduleDate, previewNextRepeat, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import useDashboardClock from '../../features/dashboard/useDashboardClock';
import './ExpensePlans.css';

const formatAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const planTitles = {
  list: 'Upcoming expenses',
  payment: 'Record payment',
  receipt: 'Payment details',
  edit: 'Edit expense plan',
  skip: 'Skip this expense?',
  end: 'End this expense plan?',
};

function summaryHint(plans, today) {
  const overdue = plans.filter((plan) => plan.dueDate < today).length;
  const dueToday = plans.filter((plan) => plan.dueDate === today).length;
  if (overdue || dueToday) return [dueToday && `${dueToday} due today`, overdue && `${overdue} overdue`].filter(Boolean).join(' · ');
  const next = plans.reduce((first, plan) => plan.dueDate < first ? plan.dueDate : first, plans[0]?.dueDate);
  return next && `Next ${formatScheduleDate(next)}`;
}

export default function ExpensePlanEntry({ plans, expanded, buttonRef, onOpen }) {
  const today = formatMomentDate(useDashboardClock());
  return <section id="expense-plans" className="dn-expense-plans" aria-label="Expense plans">
    <button ref={buttonRef} type="button" className="dn-expense-plan-entry" aria-haspopup="dialog" aria-expanded={expanded} onClick={onOpen}>
      <span className="dn-expense-plan-entry-icon"><CalendarDays size={18} aria-hidden="true" /></span>
      <span className="dn-expense-plan-entry-text"><strong>Upcoming expenses</strong><small>{summaryHint(plans, today) || 'Nothing scheduled yet'}</small></span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  </section>;
}

function ExpensePlanList({ plans, onSelect }) {
  const today = formatMomentDate(useDashboardClock());
  const sorted = [...plans].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
  const single = sorted.length === 1;
  const currentYear = today.slice(0, 4);
  const yearSuffix = ` ${currentYear}`;
  const displaysYear = sorted.some(plan => !plan.dueDate.startsWith(currentYear));
  // All amounts reserve the same right-aligned column. Keep large values
  // readable and take the space from long names rather than clipping money.
  const widestAmount = Math.max(9, ...sorted.map(plan => formatAmount.format(plan.amount).length));
  const groups = [
    { timing: 'today', label: 'Due today', items: sorted.filter((plan) => plan.dueDate === today) },
    { timing: 'overdue', label: 'Overdue', items: sorted.filter((plan) => plan.dueDate < today) },
    { timing: 'later', label: 'Later', items: sorted.filter((plan) => plan.dueDate > today) },
  ];

  if (!sorted.length) return <div className="dn-expense-plan-empty">
    <strong>No upcoming expenses</strong>
    <p>Choose a repeat frequency when adding a transaction to schedule a bill.</p>
  </div>;

  return <div className="dn-expense-plan-groups" data-displays-year={displaysYear}
    style={{ '--dn-expense-amount-width': `${widestAmount}ch` }}>
    {groups.filter(({ items }) => items.length).map(({ timing, label, items }) => <section key={timing} aria-label={label}>
      {(!single || timing !== 'later') && <h4 data-plan-group className={`dn-expense-plan-heading is-${timing}`}>{label}</h4>}
      <ul className="dn-expense-plan-list" role="list">
        {items.map((plan) => {
          const nameId = `dn-plan-name-${plan.id}`;
          const amountId = `dn-plan-amount-${plan.id}`;
          const dateId = `dn-plan-date-${plan.id}`;
          const statusLabel = timing === 'later' ? 'Due' : label;
          const amount = formatAmount.format(plan.amount);
          const dateLabel = formatScheduleDate(plan.dueDate);
          const dayAndMonth = dateLabel.endsWith(yearSuffix) ? dateLabel.slice(0, -yearSuffix.length) : '';
          return <li key={plan.id} className="dn-expense-plan-row" data-plan-id={plan.id}>
            <div className="dn-expense-plan-data">
              <strong id={nameId} className="dn-expense-plan-name" title={plan.name}>{plan.name}</strong>
              <span className="dn-expense-plan-meta" id={dateId}>
                <span className="sr-only">{statusLabel}</span>{' '}
                <time className="dn-expense-plan-day" dateTime={plan.dueDate} title={dateLabel}>
                  {dayAndMonth ? <>{dayAndMonth}<span className="dn-expense-plan-current-year">{yearSuffix}</span></> : dateLabel}
                </time>
                {' '}<span className="dn-expense-plan-meta-separator" aria-hidden="true">·</span>{' '}
                <span className="dn-expense-plan-frequency">{REPEAT_OPTIONS[plan.repeat.frequency]}</span>
              </span>
              <span id={amountId} className="dn-expense-plan-amount" title={amount}>{amount}</span>
            </div>
            <ExpensePlanActions plan={plan} nameId={nameId} description={`${amountId} ${dateId}`} onSelect={onSelect} />
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
}

function ExpensePlanActions({ plan, nameId, description, onSelect }) {
  const following = previewNextRepeat(plan, plan.repeat.frequency, plan.dueDate);
  return <div className="dn-expense-plan-menu-actions" role="group" aria-labelledby={nameId}>
    <button type="button" data-plan-manage-action="edit" aria-label="Edit schedule" aria-describedby={nameId}
      onClick={(event) => onSelect(plan, 'edit', event.currentTarget)}>Edit</button>
    <button type="button" data-plan-manage-action="skip" aria-label="Skip this occurrence" aria-describedby={nameId}
      disabled={!following} onClick={(event) => onSelect(plan, 'skip', event.currentTarget)}>Skip</button>
    <button type="button" className="dn-expense-plan-end" data-plan-manage-action="end"
      aria-label="End repeat" aria-describedby={nameId} title="End repeat"
      onClick={(event) => onSelect(plan, 'end', event.currentTarget)}>
      <span className="dn-expense-plan-end-long" aria-hidden="true">End repeat</span>
      <span className="dn-expense-plan-end-short" aria-hidden="true">End</span>
    </button>
    <button type="button" className="dn-expense-plan-record" data-plan-action="payment"
      aria-label={`Record payment for ${plan.name}`} aria-describedby={description}
      onClick={(event) => onSelect(plan, 'payment', event.currentTarget)}><span>Record payment</span></button>
  </div>;
}

function RecordedPayment({ payment }) {
  const { expense, planName, scheduledFor, nextDue } = payment;
  const paidTime = activityTime(expense);
  return <div className="dn-expense-payment-details">
    <div className="dn-expense-receipt-head"><strong>{expense.name}</strong><span>{formatAmount.format(expense.amount)}</span></div>
    <dl>
      <dt>Paid on</dt><dd><time dateTime={paidTime ? `${expense.date}T${paidTime}` : expense.date}>
        {formatScheduleDate(expense.date)}{paidTime ? ` · ${paidTime}` : null}
      </time></dd>
      <dt>Payment method</dt><dd>{paymentMethodLabel(expense.paymentMethod)}</dd>
      {expense.name !== planName ? <><dt>Expense plan</dt><dd>{planName}</dd></> : null}
      <dt>Scheduled for</dt><dd><time dateTime={scheduledFor}>{formatScheduleDate(scheduledFor)}</time></dd>
      <dt>Next due</dt><dd><time dateTime={nextDue}>{formatScheduleDate(nextDue)}</time></dd>
    </dl>
  </div>;
}

export function ExpensePlanSheet({ view, plans, events, busy, error, notice, onClose, onSelect, onNavigate, onSave, onConfirm }) {
  const { mode, plan } = view;
  const isList = mode === 'list';
  const goBack = () => onNavigate('list');
  const isForm = mode === 'edit' || mode === 'payment';
  const isSkip = mode === 'skip';
  const isConfirm = isSkip || mode === 'end';
  const nextAfterSkip = isSkip ? previewNextRepeat(plan, plan.repeat.frequency, plan.dueDate) : undefined;
  const listReturnRef = useRef(null);
  const listBodyRef = useRef(null);
  const viewPaymentRef = useRef(null);

  const selectPlan = (selected, action, button) => {
    const body = button.closest('.dn-modal-body');
    listReturnRef.current = { planId: selected.id, action, scrollTop: body.scrollTop, notice };
    onSelect(selected, action);
  };

  const restorePosition = (body) => {
    if (!isList) return;
    listBodyRef.current = body;
    const anchor = listReturnRef.current;
    if (!anchor) return;
    listReturnRef.current = null;
    if (anchor.action === 'receipt') {
      viewPaymentRef.current?.focus({ preventScroll: true });
      body.scrollTop = anchor.scrollTop;
      return;
    }
    const rows = [...body.querySelectorAll('[data-plan-id]')];
    const previousRow = rows.find((row) => row.dataset.planId === anchor.planId);
    const previousButton = previousRow?.querySelector(`[data-plan-action="${anchor.action}"], [data-plan-manage-action="${anchor.action}"]`);
    const canRestoreButton = notice === anchor.notice && previousButton;
    if (canRestoreButton) {
      previousButton.focus({ preventScroll: true });
    }
    body.scrollTop = anchor.scrollTop;
    const { top, bottom } = body.getBoundingClientRect();
    const pinnedTop = top + body.clientTop + parseFloat(getComputedStyle(body).paddingTop);
    // A pinned heading can cover the first row even when it fits the scroll box.
    const contentTop = [...body.querySelectorAll('[data-plan-group]')].reduce((edge, heading) => {
      const rect = heading.getBoundingClientRect();
      return rect.top <= pinnedTop + 1 && rect.bottom <= bottom ? Math.max(edge, rect.bottom) : edge;
    }, top);
    if (canRestoreButton) {
      const rect = previousButton.getBoundingClientRect();
      body.scrollTop += rect.top < contentTop ? rect.top - contentTop : Math.max(0, rect.bottom - bottom);
      return;
    }
    const visibleRow = rows.find((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top >= contentTop && rect.bottom <= bottom;
    });
    visibleRow?.querySelector('[data-plan-action="payment"]')?.focus({ preventScroll: true });
    body.scrollTop = anchor.scrollTop;
  };

  const visibleNotice = isList ? notice : null;
  const feedback = <div className={`dn-expense-plan-notice${visibleNotice ? ' is-visible' : ''}`}>
    <div className="dn-expense-plan-notice-text" role="status">
      {visibleNotice ? <><strong>{visibleNotice.message}.</strong>
        {visibleNotice.nextDue ? <> <small>Next due <time dateTime={visibleNotice.nextDue}>{formatScheduleDate(visibleNotice.nextDue)}</time>.</small></> : null}</> : null}
    </div>
    {visibleNotice?.payment ? <button type="button" ref={viewPaymentRef} className="dn-expense-view-payment" onClick={() => {
      listReturnRef.current = { action: 'receipt', scrollTop: listBodyRef.current.scrollTop };
      onNavigate('receipt');
    }}>View payment</button> : null}
  </div>;

  const footer = isForm ? null : isConfirm ? <div className="dn-modal-fixed-actions">
    <ConfirmButtons confirmLabel={isSkip ? 'Skip occurrence' : 'End repeat'} destructive={!isSkip}
      busy={busy} confirmDisabled={isSkip && !nextAfterSkip} onCancel={goBack} onConfirm={onConfirm} />
  </div> : isList ? feedback : null;

  return <ModalDialog title={planTitles[mode]} className={`dn-transaction-dialog dn-expense-plan-dialog dn-expense-plan-${mode}-view`} viewKey={mode}
    onViewChange={restorePosition}
    onBack={isList ? undefined : goBack} backLabel="Back to upcoming expenses"
    onClose={onClose} closeDisabled={busy} footer={footer} formFooter={isForm}>
    {isList ? <ExpensePlanList plans={plans} onSelect={selectPlan} /> : null}
    {mode === 'receipt' && notice?.payment ? <RecordedPayment payment={notice.payment} /> : null}
    {isForm ? <TransactionForm key={mode} expensePlan={mode === 'edit' ? plan : null}
      paymentPlan={mode === 'payment' ? plan : null}
      busy={busy} events={events} onCancel={goBack} onSubmit={onSave} /> : null}
    {isConfirm ? <>
      <RepeatActionSummary name={plan.name} dueDate={plan.dueDate} dueLabel={isSkip ? 'Scheduled for' : 'Upcoming bill'}
        nextDate={nextAfterSkip}>
        {isSkip ? 'Move to the next due date without recording a payment. Spending totals stay unchanged.' : 'This removes the upcoming bill and stops future repeats. Recorded payments stay in Transactions.'}
      </RepeatActionSummary>
      {error ? <p className="quick-create-error" role="alert">{error}</p> : null}
    </> : null}
  </ModalDialog>;
}
