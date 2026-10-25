import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, Pencil } from 'lucide-react';
import SwipeActionCard from '../common/SwipeActionCard';
import ListControls from '../common/ListControls';
import RichText from '../common/RichText';
import DropdownSelect from '../common/DropdownSelect';
import { Link } from 'react-router-dom';
import { activityDetailPath } from '../../utils/activityDetail';

export const formatTransactionMoney = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(amount) || 0);
const money = (amount) => Number.isFinite(Number(amount)) ? formatTransactionMoney(amount) : 'Amount unavailable';
const dateLabel = (date) => {
  if (!date) return 'Date not set';
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Date not set';
};

export function TransactionCard({ transaction, events = [], onEdit, onDelete, onOpen, showActivity = false, compact = false }) {
  const isIncome = transaction.transactionKind === 'income';
  const event = events.find((item) => (item.id || item.firestoreId) === transaction.eventId);
  const activity = event?.activities?.find((item) => item.id === transaction.activityId);
  const eventTitle = event?.name || transaction.eventTitle || (transaction.eventId ? 'Unavailable moment' : '');
  const activityTitle = activity?.title || transaction.activityTitle;
  const category = isIncome ? transaction.type : transaction.category;

  if (compact) {
    return (
      <article className="dn-transaction-card dn-transaction-card-compact" role="listitem">
        <div className="dn-transaction-card-core">
          <span className={isIncome ? 'dn-transaction-icon is-income' : 'dn-transaction-icon is-expense'}>
            {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
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
    <SwipeActionCard as="article" role="listitem" className="dn-transaction-card"
      mainClassName="dn-transaction-swipe-content"
      label={transaction.name || transaction.title || 'Transaction'} openOnTap
      onOpen={onOpen ? () => onOpen(transaction) : undefined}
      otherActions={[{ label: 'Edit', icon: Pencil, onClick: () => onEdit(transaction) }]}
      onDelete={() => onDelete(transaction)}>
      <div className="dn-transaction-card-core">
        <span className={isIncome ? 'dn-transaction-icon is-income' : 'dn-transaction-icon is-expense'}>
          {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
        </span>
        <div className="dn-transaction-copy">
          <strong>{transaction.name || transaction.title || (isIncome ? 'Income' : 'Expense')}</strong>
          <span><CalendarDays size={13} /> {dateLabel(transaction.date)} <span aria-hidden="true">·</span> {category || 'Other'}</span>
          {showActivity ? <span className="dn-transaction-activity-label">{isIncome ? 'Income' : 'Expense'}{activityTitle ? ` · ${activityTitle}` : ''}</span> : null}
          {transaction.eventId || activityTitle || transaction.notes || transaction.description ? (
            <details className="dn-transaction-details" onClick={(event) => event.stopPropagation()}>
              <summary><span>Details{eventTitle ? ` · ${eventTitle}` : ''}</span><ChevronDown size={12} aria-hidden="true" /></summary>
              <div className="dn-transaction-details-content">
                {transaction.eventId ? <small>Moment: {eventTitle}</small> : null}
                {activityTitle ? <small>Activity: {activity && event ? <Link to={activityDetailPath(event.id || event.firestoreId, activity.id)}>{activityTitle}</Link> : activityTitle}</small> : null}
                {transaction.notes || transaction.description ? <RichText className="dn-transaction-note" value={transaction.notes || transaction.description} /> : null}
              </div>
            </details>
          ) : null}
        </div>
        <div className="dn-transaction-card-side">
          <strong className={isIncome ? 'dn-transaction-value is-income' : 'dn-transaction-value is-expense'}>
            {isIncome ? '+' : '−'} {money(transaction.amount)}
          </strong>
        </div>
      </div>
    </SwipeActionCard>
  );
}

export default function TransactionHistory({
  transactions, filters, onFilters, monthOptions, events, onEdit, onDelete,
}) {
  const activeCount = Number(filters.type !== 'all') + Number(filters.month !== 'all') + Number(Boolean(filters.search));
  const period = filters.month === 'all' ? 'All months' : monthOptions.find((month) => month.value === filters.month)?.shortLabel || filters.month;
  const scope = [filters.type === 'all' ? 'Income + expense' : filters.type === 'income' ? 'Income' : 'Expense', period,
    filters.search ? `Search: ${filters.search}` : ''].filter(Boolean).join(' · ');
  return (
    <section className="transactions-panel dn-transactions-page" aria-labelledby="dn-transactions-heading">
      <header className="transactions-heading">
        <div className="dn-transactions-heading-copy">
          <h2 id="dn-transactions-heading">Transactions</h2>
          <p title="All income and expenses in one place">All income and expenses</p>
        </div>
      </header>
      <ListControls title="Transaction filters" activeCount={activeCount} resultCount={transactions.length}
        resultLabel="transactions" summary={scope}
        onReset={() => onFilters({ type: 'all', month: 'all', search: '' })}
        search={<input id="transaction-filter-search" type="search" aria-label="Search transactions" placeholder="Search transactions"
          value={filters.search} onChange={(event) => onFilters({ search: event.target.value })} />}>
        <div className="dn-list-controls-field">
          <label htmlFor="transaction-filter-type">Type</label>
          <DropdownSelect id="transaction-filter-type" aria-label="Transaction Type" value={filters.type}
            onChange={(event) => onFilters({ type: event.target.value })}>
            <option value="all">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </DropdownSelect>
        </div>
        <div className="dn-list-controls-field">
          <label htmlFor="transaction-filter-month">Month</label>
          <DropdownSelect id="transaction-filter-month" aria-label="Month" value={filters.month}
            onChange={(event) => onFilters({ month: event.target.value })}>
            <option value="all">All Months</option>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </DropdownSelect>
        </div>
      </ListControls>
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
