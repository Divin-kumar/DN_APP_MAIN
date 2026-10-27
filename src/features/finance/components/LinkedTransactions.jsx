import DebouncedFilterInput from '../../../components/common/DebouncedFilterInput';
import { Link } from 'react-router-dom';
import useMomentFinance from '../../../hooks/useMomentFinance';
import usePersistentListState from '../../../hooks/usePersistentListState';
import useConditionFilters from '../../../hooks/useConditionFilters';
import ConditionBuilder, { ConditionChips } from '../../../components/common/ConditionBuilder';
import { transactionConditions } from '../../../utils/listConditionMigration';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import ListControls from '../../../components/common/ListControls';
import SortControl from '../../../components/common/SortControl';
import { TRANSACTION_SORT_OPTIONS, TRANSACTION_SORT_VALUES, transactionSortForField, transactionSortSummary } from '../../../utils/userListSort';
import { TransactionCard, formatTransactionMoney as momentMoney } from '../../../components/financials/TransactionHistory';
import { filterTransactions, sortTransactions } from '../../../utils/transactionFilters';

const DEFAULTS = Object.freeze({ search: '', type: 'all', activityId: '', month: 'all', sort: 'date-desc' });
const RULES = Object.freeze({ type: ['all', 'income', 'expense'], month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value), sort: TRANSACTION_SORT_VALUES });

export function MomentFinanceSummary({ summary, label = 'Totals for this Moment', showCaption = true }) {
  return <div className="moment-finance-summary" role="group" aria-label={label}>
    {showCaption ? <span className="moment-finance-caption">{label}</span> : null}
    <dl><div><dt>Income</dt><dd>{momentMoney(summary.income)}</dd></div>
      <div><dt>Expense</dt><dd>{momentMoney(summary.expense)}</dd></div>
      <div><dt>Balance</dt><dd>{momentMoney(summary.balance)}</dd></div></dl>
  </div>;
}

// Contextual history is read-only. Creation uses universal +; editing stays in Finance.
export default function LinkedTransactions({ eventId, activityId = '', minimal = false }) {
  const finance = useMomentFinance(eventId, activityId);
  const [filters, changeFilters, resetFilters] = usePersistentListState(
    `moment-transactions:${JSON.stringify([finance.sample, eventId, activityId])}`, DEFAULTS, RULES);
  const conditions = useConditionFilters('moment-transactions:' + eventId + ':' + (activityId || 'all'), finance.transactions, usePersistentListState,
    { initialGroup: transactionConditions(filters), contextKey: finance.sample, moments: finance.events });
  const [sortField, sortDirection] = filters.sort.split('-');
  const filtered = activityId ? finance.transactions : sortTransactions(filterTransactions(finance.transactions, { search: filters.search }).filter(conditions.matches), filters.sort);
  const totals = <MomentFinanceSummary summary={finance.summary} label={activityId ? 'Totals for this Activity' : 'Totals for this Moment'} showCaption={!minimal} />;
  // Activity Detail has no transaction section, totals or placeholder when nothing is linked.
  if (activityId && minimal && finance.ready && !finance.error && finance.transactions.length === 0) return null;
  return <div className={`moment-transactions${minimal ? ' is-minimal' : ''}${minimal && finance.ready && !finance.error && finance.transactions.length ? ' has-linked-transactions' : ''}`}>
    {finance.error ? <div className="financial-load-error" role="alert"><span>Transactions couldn’t be loaded.</span>
      <button type="button" className="secondaryButton" onClick={finance.retry}>Try again</button></div>
      : finance.pending ? <LoadingSkeleton rows={3} label="Loading linked transactions" /> : <>
        {!minimal ? <>{totals}<div className="moment-transactions-heading"><h3>Transaction history</h3></div></> : null}
        {!activityId && finance.transactions.length ? <ListControls title="Moment transaction filters" builder resultCount={filtered.length} resultLabel="transactions"
          activeCount={conditions.activeCount} chips={<ConditionChips filter={conditions} />}
          summary={transactionSortSummary(filters.sort)} canReset={Boolean(conditions.activeCount || filters.search || filters.sort !== 'date-desc')} onReset={() => { resetFilters(); conditions.clear(); }}
          sort={<SortControl field={sortField} direction={sortDirection} options={TRANSACTION_SORT_OPTIONS} label="Sort Moment transactions"
            onFieldChange={(field) => changeFilters({ sort: transactionSortForField(field) })}
            onToggleDirection={() => changeFilters({ sort: `${sortField}-${sortDirection === 'asc' ? 'desc' : 'asc'}` })} />}
          search={<DebouncedFilterInput scopeKey={conditions.editorKey} type="search" aria-label="Search Moment transactions" placeholder="Search transactions" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value })} />}>
          <ConditionBuilder filter={conditions} title="Moment transaction conditions" />
        </ListControls> : null}
        {filtered.length || !minimal ? <div className="dn-transactions-results" role="list" aria-label="Linked transactions">
          {filtered.length ? filtered.map((item) => <TransactionCard key={item.stableTransactionKey} transaction={item} events={finance.events}
            readOnly showActivity={!minimal} />)
            : <p className="moment-empty-state">{finance.transactions.length ? 'No transactions match these filters.' : activityId ? 'No transactions have been recorded for this Activity.' : 'No transactions have been recorded for this Moment.'}</p>}
        </div> : null}
        {minimal ? totals : null}
      </>}
    {!minimal ? <><Link className="moment-text-action" to="/financials/transactions">Manage transactions</Link>
      {activityId ? <Link className="moment-text-action" to={`/events/${encodeURIComponent(eventId)}/transactions`}>All Moment transactions</Link> : null}</> : null}
  </div>;
}
