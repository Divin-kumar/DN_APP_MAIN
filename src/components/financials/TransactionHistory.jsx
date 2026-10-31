import { activityTime } from '../../utils/activityTime';
import DebouncedFilterInput from '../common/DebouncedFilterInput';
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Pencil, ReceiptText, RotateCcw } from 'lucide-react';
import SwipeActionCard from '../common/SwipeActionCard';
import ListControls from '../common/ListControls';
import SortControl from '../common/SortControl';
import { TRANSACTION_SORT_OPTIONS, transactionSortForField, transactionSortSummary } from '../../utils/userListSort';
import RichText from '../common/RichText';
import ConditionBuilder, { ConditionChips } from '../common/ConditionBuilder';
import { Link } from 'react-router-dom';
import { activityDetailPath } from '../../utils/activityDetail';
import { paymentMethodLabel } from '../../utils/paymentMethod';
import './TransactionEmptyPremium.css';
import '../common/RecordCardPremium.css';

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

export function TransactionCard({ transaction, events = [], onEdit, onDelete, onOpen, showActivity = false, compact = false, readOnly = false }) {
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
            <small>{dateLabel(transaction.date)}{activityTime(transaction) ? ` · ${activityTime(transaction)}` : ''} · {category || 'Other'} · {paymentMethodLabel(transaction.paymentMethod)}</small>
          </span>
          <strong className={isIncome ? 'dn-transaction-value is-income' : 'dn-transaction-value is-expense'}>
            {isIncome ? '+' : '−'} {money(transaction.amount)}
          </strong>
        </div>
      </article>
    );
  }

  const Card = readOnly ? 'article' : SwipeActionCard;
  const actionProps = readOnly ? {} : {
    as: 'article', mainClassName: 'dn-transaction-swipe-content',
    label: transaction.name || transaction.title || 'Transaction', openOnTap: true,
    onOpen: onOpen ? () => onOpen(transaction) : undefined,
    otherActions: onEdit ? [{ label: 'Edit', icon: Pencil, onClick: () => onEdit(transaction) }] : [],
    onDelete: onDelete ? () => onDelete(transaction) : undefined,
  };
  return (
    <Card role="listitem" className={`dn-transaction-card dn-v2-transaction-card ${isIncome ? 'is-income' : 'is-expense'}`} {...actionProps}>
      <div className="dn-transaction-card-core">
        <span className={isIncome ? 'dn-transaction-icon is-income' : 'dn-transaction-icon is-expense'}>
          {isIncome ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
        </span>
        <div className="dn-transaction-copy">
          <strong>{transaction.name || transaction.title || (isIncome ? 'Income' : 'Expense')}</strong>
          <div className="dn-transaction-card-side">
            <strong className={isIncome ? 'dn-transaction-value is-income' : 'dn-transaction-value is-expense'}>
              {isIncome ? '+' : '−'} {money(transaction.amount)}
            </strong>
          </div>
          <span className="dn-transaction-meta">
            <span>{dateLabel(transaction.date)}{activityTime(transaction) ? ` · ${activityTime(transaction)}` : ''}</span>
            <span aria-hidden="true" className="dn-transaction-meta-separator">·</span>
            <span>{category || 'Other'}</span>
            <span aria-hidden="true" className="dn-transaction-meta-separator">·</span>
            <span>{paymentMethodLabel(transaction.paymentMethod)}</span>
          </span>
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
      </div>
    </Card>
  );
}

export default function TransactionHistory({
  transactions, totalCount = transactions.length, filters, onFilters, conditions, events, onEdit, onDelete,
  onResetDefaults, canResetDefaults = false,
}) {
  const [sortField, sortDirection] = filters.sort.split('-');
  const hasActiveFilter = Boolean(conditions.activeCount || filters.search?.trim());
  const resetAllFilters = () => onResetDefaults?.();
  return (
    <section className="transactions-panel dn-transactions-page" aria-labelledby="dn-transactions-heading">
      <header className="transactions-heading">
        <div className="dn-transactions-heading-copy">
          <h2 id="dn-transactions-heading">Transactions</h2>
        </div>
      </header>
      <ListControls title="Transaction filters" builder activeCount={conditions.activeCount} resultCount={transactions.length}
        resultLabel="transactions" summary={transactionSortSummary(filters.sort)} chips={<ConditionChips filter={conditions} />}
        sort={<SortControl field={sortField} direction={sortDirection} compactDirection options={TRANSACTION_SORT_OPTIONS} label="Sort transactions"
          onFieldChange={(field) => onFilters({ sort: transactionSortForField(field) })}
          onToggleDirection={() => onFilters({ sort: `${sortField}-${sortDirection === 'asc' ? 'desc' : 'asc'}` })} />}
        canReset={canResetDefaults} onReset={resetAllFilters}
        search={<DebouncedFilterInput scopeKey={conditions.editorKey} id="transaction-filter-search" type="search" aria-label="Search transactions" placeholder="Search transactions"
          value={filters.search} onChange={(event) => onFilters({ search: event.target.value })} />}>
        <ConditionBuilder filter={conditions} title="Transaction conditions" />
      </ListControls>
      <div className="dn-transactions-results" role="list" aria-label="Filtered transactions">
        {transactions.length ? transactions.map((item) => (
          <TransactionCard key={item.stableTransactionKey} transaction={item}
            events={events} onEdit={onEdit} onDelete={onDelete} />
        )) : (
          <div className="transactions-empty dn-transactions-empty-premium" role="status">
            <span className="dn-transactions-empty-symbol" aria-hidden="true"><ReceiptText size={23} strokeWidth={1.6} /></span>
            <strong>{totalCount ? 'No matching transactions' : 'No transactions yet'}</strong>
            <p>{totalCount
              ? 'Nothing matches your current search or filters.'
              : 'Transactions you record will appear here.'}</p>
            {hasActiveFilter && totalCount && canResetDefaults ? (
              <button type="button" className="dn-transactions-empty-reset" onClick={resetAllFilters}>
                <RotateCcw size={15} aria-hidden="true" />
                Restore saved defaults
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
