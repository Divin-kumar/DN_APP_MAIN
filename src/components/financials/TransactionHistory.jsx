import { ArrowDownLeft, ArrowUpRight, CalendarDays, Pencil, Plus } from 'lucide-react';
import SwipeActionCard from '../common/SwipeActionCard';
import ListControls from '../common/ListControls';

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
    <SwipeActionCard as="article" role="listitem" className="dn-transaction-card"
      mainClassName="dn-transaction-swipe-content"
      label={transaction.name || transaction.title || 'Transaction'} openOnTap
      otherActions={[{ label: 'Edit', icon: Pencil, onClick: () => onEdit(transaction) }]}
      onDelete={() => onDelete(transaction)}>
      <div className="dn-transaction-card-core">
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
      </div>
    </SwipeActionCard>
  );
}

export default function TransactionHistory({
  transactions, filters, onFilters, monthOptions, events, onAdd, onEdit, onDelete,
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
        <button type="button" className="primaryButton dn-transaction-add" onClick={onAdd}>
          <Plus size={17} aria-hidden="true" /><span>Add Transaction</span>
        </button>
      </header>
      <ListControls title="Transaction filters" activeCount={activeCount} resultCount={transactions.length}
        resultLabel="transactions" summary={scope}
        onReset={() => onFilters({ type: 'all', month: 'all', search: '' })}
        search={<input id="transaction-filter-search" type="search" aria-label="Search transactions" placeholder="Search transactions"
          value={filters.search} onChange={(event) => onFilters({ search: event.target.value })} />}>
        <div className="dn-list-controls-field">
          <label htmlFor="transaction-filter-type">Type</label>
          <select id="transaction-filter-type" aria-label="Transaction Type" value={filters.type}
            onChange={(event) => onFilters({ type: event.target.value })}>
            <option value="all">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div className="dn-list-controls-field">
          <label htmlFor="transaction-filter-month">Month</label>
          <select id="transaction-filter-month" aria-label="Month" value={filters.month}
            onChange={(event) => onFilters({ month: event.target.value })}>
            <option value="all">All Months</option>
            {monthOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </select>
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
