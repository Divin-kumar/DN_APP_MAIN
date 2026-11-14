import { useEffect, useRef } from 'react';
import { CalendarDays, ChevronRight, Pencil, Repeat, SkipForward, XCircle } from 'lucide-react';
import FormDisclosure from '../common/FormDisclosure';
import ModalDialog from '../common/ModalDialog';
import { formatMomentDate } from '../../utils/momentDates.js';
import { formatScheduleDate, previewNextRepeat, REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import useDashboardClock from '../../features/dashboard/useDashboardClock';
import './ExpensePlans.css';

const formatAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const summaryHint = (plans, today) => {
  const overdue = plans.filter((plan) => plan.dueDate < today).length;
  const dueToday = plans.filter((plan) => plan.dueDate === today).length;
  if (overdue || dueToday) return [overdue && `${overdue} overdue`, dueToday && `${dueToday} due today`].filter(Boolean).join(' · ');
  const next = plans[0].dueDate;
  return plans.length === 1 ? `Next ${formatScheduleDate(next)}` : `${plans.length} scheduled`;
};

export default function ExpensePlans({ plans, busy, openFromLink, onRecord, onManage }) {
  const section = useRef(null);
  const openedFrom = useRef(null);
  useEffect(() => {
    if (!openFromLink) { openedFrom.current = null; return; }
    if (openedFrom.current === openFromLink || !plans.length || !section.current) return;
    openedFrom.current = openFromLink;
    const details = section.current.querySelector('details');
    details.open = true;
    const summary = details.querySelector('summary');
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ block: 'nearest' });
  }, [openFromLink, plans.length]);

  if (!plans.length) return null;
  return <ExpensePlanList plans={plans} busy={busy} onRecord={onRecord} onManage={onManage} section={section} />;
}

function ExpensePlanList({ plans, busy, onRecord, onManage, section }) {
  const today = formatMomentDate(useDashboardClock());
  const sorted = [...plans].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
  return <section id="expense-plans" className="dn-expense-plans" ref={section} aria-label="Expense plans">
    <FormDisclosure label="Upcoming expenses" hint={summaryHint(sorted, today)} icon={CalendarDays} className="dn-expense-plan-disclosure">
      <ul className="dn-expense-plan-list">
        {sorted.map((plan) => {
          const dueState = plan.dueDate < today ? 'overdue' : plan.dueDate === today ? 'today' : '';
          return <li key={plan.id} className="dn-expense-plan-row">
            <div className="dn-expense-plan-title"><strong>{plan.name}</strong><span>{formatAmount.format(plan.amount)}</span></div>
            <div className="dn-expense-plan-meta">
              <span className={dueState ? `dn-expense-plan-${dueState}` : undefined}>
                {dueState === 'overdue' ? 'Overdue · ' : dueState === 'today' ? 'Due today · ' : 'Due '}
                <time dateTime={plan.dueDate}>{formatScheduleDate(plan.dueDate)}</time>
              </span>
              <span><Repeat size={13} aria-hidden="true" />{REPEAT_OPTIONS[plan.repeat.frequency]}</span>
            </div>
            <div className="dn-expense-plan-actions">
              <button type="button" disabled={busy} aria-label={`Manage plan for ${plan.name}`}
                onClick={(event) => onManage(plan, event.currentTarget)}>Manage</button>
              <button type="button" className="dn-record-plan-payment" disabled={busy} aria-label={`Record payment for ${plan.name}`}
                onClick={(event) => onRecord(plan, event.currentTarget)}>Record payment<ChevronRight size={15} aria-hidden="true" /></button>
            </div>
          </li>;
        })}
      </ul>
    </FormDisclosure>
  </section>;
}

export const nextExpenseDate = (plan) => formatScheduleDate(previewNextRepeat(plan, plan.repeat.frequency, plan.dueDate));

export function ExpensePlanActions({ plan, onEdit, onSkip, onEnd, onClose, busy }) {
  const following = nextExpenseDate(plan);
  return <ModalDialog title="Manage expense plan" className="dn-expense-plan-menu" onClose={onClose} closeDisabled={busy}>
    <div className="dn-expense-plan-sheet-header">
      <div className="dn-expense-plan-title"><strong>{plan.name}</strong><span>{formatAmount.format(plan.amount)}</span></div>
      <p>{REPEAT_OPTIONS[plan.repeat.frequency]} · Due {formatScheduleDate(plan.dueDate)}</p>
    </div>
    <div className="dn-expense-plan-menu-actions">
      <button type="button" disabled={busy} onClick={onEdit}><Pencil size={18} aria-hidden="true" /><span>Edit schedule</span><ChevronRight size={16} aria-hidden="true" /></button>
      <button type="button" disabled={busy || !following} onClick={onSkip}><SkipForward size={18} aria-hidden="true" />
        <span>Skip this occurrence{following ? <small>Next due {following}</small> : null}</span><ChevronRight size={16} aria-hidden="true" />
      </button>
      <button type="button" className="is-danger" disabled={busy} onClick={onEnd}><XCircle size={18} aria-hidden="true" />
        <span>End repeat</span><ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  </ModalDialog>;
}
