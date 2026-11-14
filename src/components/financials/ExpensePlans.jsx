import { useEffect, useRef } from 'react';
import FormDisclosure from '../common/FormDisclosure';
import { formatMomentDate, parseMomentDate } from '../../utils/momentDates.js';
import { REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';
import './ExpensePlans.css';

const formatDueDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const formatAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export default function ExpensePlans({ plans, busy, openFromLink, onRecord, onEdit }) {
  const section = useRef(null);
  useEffect(() => {
    if (!openFromLink || !plans.length || !section.current) return;
    const details = section.current.querySelector('details');
    details.open = true;
    const summary = details.querySelector('summary');
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({ block: 'nearest' });
  }, [openFromLink, plans.length]);

  if (!plans.length) return null;
  const today = formatMomentDate(new Date());
  const dueCount = plans.filter((plan) => plan.dueDate <= today).length;
  const sorted = [...plans].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
  return <section id="expense-plans" className="dn-expense-plans" ref={section} aria-label="Expense plans">
    <FormDisclosure label="Upcoming expenses" hint={dueCount ? `${dueCount} due` : `${plans.length} scheduled`}>
      <ul className="dn-expense-plan-list">
        {sorted.map((plan) => <li key={plan.id} className="dn-expense-plan-row">
          <div className="dn-expense-plan-title"><strong>{plan.name}</strong><span>{formatAmount.format(plan.amount)}</span></div>
          <small>{plan.dueDate < today ? 'Overdue' : plan.dueDate === today ? 'Due today' : 'Due'} · {formatDueDate.format(parseMomentDate(plan.dueDate))} · {REPEAT_OPTIONS[plan.repeat.frequency]}</small>
          <div className="dn-expense-plan-actions">
            <button type="button" disabled={busy} aria-label={`Manage plan for ${plan.name}`} onClick={() => onEdit(plan)}>Manage</button>
            <button type="button" disabled={busy} aria-label={`Record payment for ${plan.name}`} onClick={() => onRecord(plan)}>Record payment</button>
          </div>
        </li>)}
      </ul>
    </FormDisclosure>
  </section>;
}
