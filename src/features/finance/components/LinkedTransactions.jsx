import { Link } from 'react-router-dom';
import useMomentFinance from '../../../hooks/useMomentFinance';
import usePersistentListState from '../../../hooks/usePersistentListState';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import DropdownSelect from '../../../components/common/DropdownSelect';
import ListControls from '../../../components/common/ListControls';
import { TransactionCard, formatTransactionMoney as momentMoney } from '../../../components/financials/TransactionHistory';
import { filterTransactions, transactionMonthOptions } from '../../../utils/transactionFilters';
import { recordId } from '../../../utils/recordIdentity';

const DEFAULTS = Object.freeze({ search: '', type: 'all', activityId: '', month: 'all' });
const RULES = Object.freeze({ type: ['all', 'income', 'expense'], month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value) });

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
  const moment = finance.events.find((item) => recordId(item.id || item.firestoreId) === eventId);
  const activities = moment?.activities || [];
  const months = transactionMonthOptions(finance.transactions);
  const monthOptions = filters.month !== 'all' && !months.some((item) => item.value === filters.month)
    ? [{ value: filters.month, label: `${filters.month} (no records)` }, ...months] : months;
  const selectedActivityAvailable = activities.some((item) => recordId(item.id) === filters.activityId);
  const filtered = filterTransactions(finance.transactions, activityId ? {} : filters)
    .filter((item) => activityId || !filters.activityId || (selectedActivityAvailable && item.activityId === filters.activityId));
  const totals = <MomentFinanceSummary summary={finance.summary} label={activityId ? 'Totals for this Activity' : 'Totals for this Moment'} showCaption={!minimal} />;
  return <div className={`moment-transactions${minimal ? ' is-minimal' : ''}`}>
    {finance.error ? <div className="financial-load-error" role="alert"><span>Transactions couldn’t be loaded.</span>
      <button type="button" className="secondaryButton" onClick={finance.retry}>Try again</button></div>
      : finance.pending ? <LoadingSkeleton rows={3} label="Loading linked transactions" /> : <>
        {!minimal ? <>{totals}<div className="moment-transactions-heading"><h3>Transaction history</h3></div></> : null}
        {!activityId && finance.transactions.length ? <ListControls title="Moment transaction filters" resultCount={filtered.length} resultLabel="transactions"
          activeCount={Number(Boolean(filters.search)) + Number(filters.type !== 'all') + Number(Boolean(filters.activityId)) + Number(filters.month !== 'all')}
          summary={[filters.type === 'all' ? 'Income + expense' : filters.type === 'income' ? 'Income' : 'Expense',
            filters.activityId ? activities.find((item) => recordId(item.id) === filters.activityId)?.title || 'Saved activity (unavailable)' : 'All Activities',
            filters.month === 'all' ? 'All months' : filters.month].join(' · ')} onReset={resetFilters}
          search={<input type="search" aria-label="Search Moment transactions" placeholder="Search transactions" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value })} />}>
          <div className="dn-list-controls-field"><label htmlFor="moment-transaction-type">Type</label><DropdownSelect id="moment-transaction-type" value={filters.type} onChange={(event) => changeFilters({ type: event.target.value })}>
            <option value="all">All</option><option value="income">Income</option><option value="expense">Expense</option></DropdownSelect></div>
          <div className="dn-list-controls-field"><label htmlFor="moment-transaction-activity">Activity</label><DropdownSelect id="moment-transaction-activity" value={filters.activityId} onChange={(event) => changeFilters({ activityId: event.target.value })}>
            <option value="">All Activities</option>{filters.activityId && !activities.some((item) => recordId(item.id) === filters.activityId) ? <option value={filters.activityId}>Saved activity (unavailable)</option> : null}
            {activities.map((item) => <option key={item.id} value={recordId(item.id)}>{item.title || 'Untitled activity'}</option>)}</DropdownSelect></div>
          {monthOptions.length > 1 || filters.month !== 'all' ? <div className="dn-list-controls-field"><label htmlFor="moment-transaction-month">Month</label><DropdownSelect id="moment-transaction-month" value={filters.month} onChange={(event) => changeFilters({ month: event.target.value })}>
            <option value="all">All months</option>{monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</DropdownSelect></div> : null}
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
