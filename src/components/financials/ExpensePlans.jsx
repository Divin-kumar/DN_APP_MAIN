import { useRef } from 'react';
import { CalendarDays, Check, ChevronRight, Pencil, Repeat, SkipForward, XCircle } from 'lucide-react';
import ModalDialog, { ConfirmActions } from '../common/ModalDialog';
import TransactionForm from './TransactionForm';
import { formatMomentDate } from '../../utils/momentDates.js';
import { formatScheduleDate, previewNextRepeat, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import useDashboardClock from '../../features/dashboard/useDashboardClock';
import './ExpensePlans.css';

const formatAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const planTitles = {
  list: 'Upcoming expenses',
  manage: 'Manage expense plan',
  payment: 'Record payment',
  edit: 'Edit expense plan',
  skip: 'Skip this expense?',
  end: 'End this expense plan?',
};

function summaryHint(plans, today) {
  const overdue = plans.filter((plan) => plan.dueDate < today).length;
  const dueToday = plans.filter((plan) => plan.dueDate === today).length;
  if (overdue || dueToday) return [overdue && `${overdue} overdue`, dueToday && `${dueToday} due today`].filter(Boolean).join(' · ');
  return plans.length === 1 ? `Next ${formatScheduleDate(plans[0].dueDate)}` : `${plans.length} scheduled`;
}

export default function ExpensePlanEntry({ plans, expanded, buttonRef, onOpen }) {
  const today = formatMomentDate(useDashboardClock());
  return <section id="expense-plans" className="dn-expense-plans" aria-label="Expense plans">
    <button ref={buttonRef} type="button" className="dn-expense-plan-entry" aria-haspopup="dialog" aria-expanded={expanded} onClick={onOpen}>
      <span className="dn-expense-plan-entry-icon"><CalendarDays size={18} aria-hidden="true" /></span>
      <span className="dn-expense-plan-entry-text"><strong>Upcoming expenses</strong><small>{summaryHint(plans, today)}</small></span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  </section>;
}

function ExpensePlanList({ plans, onSelect }) {
  const today = formatMomentDate(useDashboardClock());
  const sorted = [...plans].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
  const groups = [
    ['Due now', sorted.filter((plan) => plan.dueDate <= today)],
    ['Later', sorted.filter((plan) => plan.dueDate > today)],
  ];

  if (!sorted.length) return <p className="dn-expense-plan-empty">No upcoming expenses</p>;
  return <div className="dn-expense-plan-groups">
    {groups.filter(([, items]) => items.length).map(([label, items]) => <section key={label} aria-label={label}>
      <h4>{label}</h4>
      <ul className="dn-expense-plan-list">
        {items.map((plan) => {
          const dueState = plan.dueDate < today ? 'overdue' : plan.dueDate === today ? 'today' : '';
          return <li key={plan.id} className="dn-expense-plan-row" data-plan-id={plan.id}>
            <div className="dn-expense-plan-title"><strong>{plan.name}</strong><span>{formatAmount.format(plan.amount)}</span></div>
            <div className="dn-expense-plan-meta">
              <span className={dueState ? `dn-expense-plan-${dueState}` : undefined}>
                {dueState === 'overdue' ? 'Overdue · ' : dueState === 'today' ? 'Due today · ' : 'Due '}
                <time dateTime={plan.dueDate}>{formatScheduleDate(plan.dueDate)}</time>
              </span>
              <span><Repeat size={13} aria-hidden="true" />{REPEAT_OPTIONS[plan.repeat.frequency]}</span>
            </div>
            <div className="dn-expense-plan-actions">
              <button type="button" data-plan-action="manage" aria-label={`Manage plan for ${plan.name}`}
                onClick={(event) => onSelect(plan, 'manage', event.currentTarget)}>Manage</button>
              <button type="button" className="dn-record-plan-payment" data-plan-action="payment" aria-label={`Record payment for ${plan.name}`}
                onClick={(event) => onSelect(plan, 'payment', event.currentTarget)}>
                Record payment<ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
}

export const nextExpenseDate = (plan) => formatScheduleDate(previewNextRepeat(plan, plan.repeat.frequency, plan.dueDate));

function ExpensePlanActions({ plan, onNavigate }) {
  const following = nextExpenseDate(plan);
  return <>
    <div className="dn-expense-plan-sheet-header">
      <div className="dn-expense-plan-title"><strong>{plan.name}</strong><span>{formatAmount.format(plan.amount)}</span></div>
      <p>{REPEAT_OPTIONS[plan.repeat.frequency]} · Due {formatScheduleDate(plan.dueDate)}</p>
    </div>
    <div className="dn-expense-plan-menu-actions">
      <button type="button" onClick={() => onNavigate('edit')}><Pencil size={18} aria-hidden="true" />
        <span>Edit schedule</span><ChevronRight size={16} aria-hidden="true" />
      </button>
      <button type="button" disabled={!following} onClick={() => onNavigate('skip')}><SkipForward size={18} aria-hidden="true" />
        <span>Skip this occurrence{following ? <small>Next due {following}</small> : null}</span><ChevronRight size={16} aria-hidden="true" />
      </button>
      <button type="button" className="is-danger" onClick={() => onNavigate('end')}><XCircle size={18} aria-hidden="true" />
        <span>End repeat</span><ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  </>;
}

export function ExpensePlanSheet({ view, plans, events, busy, error, notice, onClose, onSelect, onNavigate, onSave, onConfirm }) {
  const { mode, plan } = view;
  const isList = mode === 'list';
  const previousView = mode === 'manage' || mode === 'payment' ? 'list' : 'manage';
  const goBack = () => onNavigate(previousView);
  const isForm = mode === 'edit' || mode === 'payment';
  const isSkip = mode === 'skip';
  const listReturnRef = useRef(null);

  const selectPlan = (selected, action, button) => {
    const body = button.closest('.dn-modal-body');
    listReturnRef.current = { planId: selected.id, action, scrollTop: body.scrollTop };
    onSelect(selected, action);
  };

  const restoreListPosition = (body) => {
    const anchor = listReturnRef.current;
    if (!isList || !anchor) return;
    listReturnRef.current = null;
    const rows = [...body.querySelectorAll('[data-plan-id]')];
    const previousRow = rows.find((row) => row.dataset.planId === anchor.planId);
    const previousButton = previousRow?.querySelector(`[data-plan-action="${anchor.action}"]`);
    if (!notice && previousButton) {
      previousButton.focus({ preventScroll: true });
    }
    body.scrollTop = anchor.scrollTop;
    const { top, bottom } = body.getBoundingClientRect();
    if (!notice && previousButton) {
      const rect = previousButton.getBoundingClientRect();
      body.scrollTop += rect.top < top ? rect.top - top : Math.max(0, rect.bottom - bottom);
      return;
    }
    const visibleRow = rows.find((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top >= top && rect.bottom <= bottom;
    });
    visibleRow?.querySelector('button')?.focus({ preventScroll: true });
    body.scrollTop = anchor.scrollTop;
  };

  const feedback = <div className="dn-expense-plan-notice" role="status">
    {isList && notice ? <><Check size={16} aria-hidden="true" /><span>{notice}</span></> : null}
  </div>;

  return <ModalDialog title={planTitles[mode]} className="dn-transaction-dialog dn-expense-plan-dialog" viewKey={mode}
    onViewChange={restoreListPosition}
    onBack={isList ? undefined : goBack} backLabel={previousView === 'list' ? 'Back to upcoming expenses' : 'Back to manage expense plan'}
    onClose={onClose} closeDisabled={busy} footer={feedback}>
    {isList ? <ExpensePlanList plans={plans} onSelect={selectPlan} /> : null}
    {mode === 'manage' ? <ExpensePlanActions plan={plan} onNavigate={onNavigate} /> : null}
    {isForm ? <TransactionForm key={mode} expensePlan={mode === 'edit' ? plan : null}
      paymentPlan={mode === 'payment' ? plan : null} busy={busy} events={events} onCancel={goBack} onSubmit={onSave} /> : null}
    {isSkip || mode === 'end' ? <ConfirmActions message={isSkip
      ? `Skip ${plan.name} due ${formatScheduleDate(plan.dueDate)}. Next due ${nextExpenseDate(plan)}.`
      : `End future payments for ${plan.name}. Recorded payments stay in Transactions.`}
      confirmLabel={isSkip ? 'Skip occurrence' : 'End repeat'} destructive={!isSkip}
      busy={busy} error={error} onCancel={goBack} onConfirm={onConfirm} /> : null}
  </ModalDialog>;
}
