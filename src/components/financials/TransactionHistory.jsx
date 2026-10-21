import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import DropdownSelect from '../common/DropdownSelect';
import { resolveTransactionSwipe } from '../../utils/swipeGestures';

const money = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(amount) || 0);
const dateLabel = (date) => {
  if (!date) return 'Date not set';
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Date not set';
};

export function TransactionCard({ transaction, events = [], onEdit, onDelete, compact = false }) {
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);
  const pointerType = useRef('mouse');
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!cardRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  const isIncome = transaction.transactionKind === 'income';
  const event = events.find((item) => (item.id || item.firestoreId) === transaction.eventId);
  const activity = event?.activities?.find((item) => item.id === transaction.activityId);
  const eventTitle = event?.name || transaction.eventTitle || (transaction.eventId ? 'Unavailable moment' : '');
  const activityTitle = activity?.title || transaction.activityTitle;
  const category = isIncome ? transaction.type : transaction.category;
  const reveal = (next, touch = false) => {
    // Vibration is optional and unsupported on iOS Safari; never block the UI.
    if (next && !open && touch) {
      try { navigator.vibrate?.(8); } catch { /* Unsupported device */ }
    }
    setOpen(next);
  };

  if (compact) {
    return (
      <article className="dn-transaction-card dn-transaction-card-compact" role="listitem">
        <div className="dn-transaction-card-core">
          <span className={isIncome ? 'dn-transaction-icon is-income' : 'dn-transaction-icon is-expense'}>
            {isIncome ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
          </span>
          <span className="dn-transaction-copy">
            <strong>{transaction.name || transaction.title || (isIncome ? 'Income' : 'Expense')}</strong>
            <small>{dateLabel(transaction.date)} · {category || 'Other'}</small>
          </span>
          <strong className={isIncome ? 'dn-transaction-value is-income' : 'dn-transaction-value is-expense'}>
            {isIncome ? '+' : '−'} {money(transaction.amount)}
          </strong>
        </div>
      </article>
    );
  }

  return (
    <article ref={cardRef} className={`dn-transaction-card${open ? ' is-actions-open' : ''}`}
      role="listitem" tabIndex={0}
      aria-label={`${transaction.name || transaction.title || 'Transaction'}. Swipe left or press Enter for Edit and Delete.`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) { event.stopPropagation(); reveal(false); }
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); reveal(!open);
        }
      }}>
      <div className="dn-transaction-card-actions">
        <button type="button" className="dn-transaction-edit" onClick={() => { reveal(false); onEdit(transaction); }}
          tabIndex={open ? 0 : -1} aria-hidden={!open}><Pencil size={17} />Edit</button>
        <button type="button" className="dn-transaction-delete" onClick={() => { reveal(false); onDelete(transaction); }}
          tabIndex={open ? 0 : -1} aria-hidden={!open}><Trash2 size={17} />Delete</button>
      </div>
      <motion.div className="dn-transaction-card-core" drag={reducedMotion ? false : 'x'}
        dragDirectionLock dragConstraints={{ left: -152, right: 0 }} dragElastic={0.16} dragMomentum={false}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(event) => { pointerType.current = event.pointerType; }}
        animate={{ x: open ? -152 : 0 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, mass: 0.82 }}
        onDragEnd={(_, info) => {
          const next = resolveTransactionSwipe({
            offsetX: info.offset.x, velocityX: info.velocity.x, wasOpen: open,
          });
          reveal(next, pointerType.current === 'touch');
        }}>
        <span className={isIncome ? 'dn-transaction-icon is-income' : 'dn-transaction-icon is-expense'}>
          {isIncome ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
        </span>
        <div className="dn-transaction-copy">
          <strong>{transaction.name || transaction.title || (isIncome ? 'Income' : 'Expense')}</strong>
          <span><CalendarDays size={13} /> {dateLabel(transaction.date)} <span aria-hidden="true">·</span> {category || 'Other'}</span>
          {transaction.eventId ? <small>Moment: {eventTitle}</small> : null}
          {activityTitle ? <small>Activity: {activityTitle}</small> : null}
          {transaction.notes || transaction.description ? <small className="dn-transaction-note">{transaction.notes || transaction.description}</small> : null}
        </div>
        <div className="dn-transaction-card-side">
          <strong className={isIncome ? 'dn-transaction-value is-income' : 'dn-transaction-value is-expense'}>
            {isIncome ? '+' : '−'} {money(transaction.amount)}
          </strong>

        </div>
      </motion.div>
    </article>
  );
}

export default function TransactionHistory({
  transactions, filters, onFilters, monthOptions, events, onAdd, onEdit, onDelete,
}) {
  return (
    <section className="transactions-panel dn-transactions-page" aria-labelledby="dn-transactions-heading">
      <header className="transactions-heading">
        <div>
          <h2 id="dn-transactions-heading">Transactions</h2>
          <p>Every income and expense, in one place. Swipe a card left to edit or delete.</p>
        </div>
        <button type="button" className="primaryButton dn-transaction-add" onClick={onAdd}>
          <Plus size={18} /> Add Transaction
        </button>
      </header>
      <div className="transactions-toolbar">
        <input type="search" aria-label="Search transactions" placeholder="Search transactions"
          value={filters.search} onChange={(event) => onFilters({ search: event.target.value })} />
        <div className="transactions-filter-pair" role="group" aria-label="Transaction filters">
          <DropdownSelect aria-label="Transaction Type" value={filters.type}
            onChange={(event) => onFilters({ type: event.target.value })}>
            <option value="all" data-short-label="All">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </DropdownSelect>
          <DropdownSelect aria-label="Month" value={filters.month}
            onChange={(event) => onFilters({ month: event.target.value })}>
            <option value="all" data-short-label="All">All Months</option>
            {monthOptions.map((month) => <option key={month.value} value={month.value} data-short-label={month.shortLabel}>{month.label}</option>)}
          </DropdownSelect>
          <DropdownSelect aria-label="Sort transactions" value={filters.sort}
            onChange={(event) => onFilters({ sort: event.target.value })}>
            <option value="date-desc" data-short-label="Newest">Newest first</option>
            <option value="date-asc" data-short-label="Oldest">Oldest first</option>
            <option value="amount-desc" data-short-label="Amount ↓">Highest amount</option>
            <option value="amount-asc" data-short-label="Amount ↑">Lowest amount</option>
            <option value="title-asc" data-short-label="Title">Title A–Z</option>
          </DropdownSelect>
        </div>
      </div>
      <div className="dn-transactions-results" role="list" aria-label="Filtered transactions">
        {transactions.length ? transactions.map((item) => (
          <TransactionCard key={item.stableTransactionKey} transaction={item}
            events={events} onEdit={onEdit} onDelete={onDelete} />
        )) : (
          <div className="transactions-empty" role="status">
            <strong>No matching transactions</strong>
            <p>Try clearing a filter or search. Newly added transactions will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
