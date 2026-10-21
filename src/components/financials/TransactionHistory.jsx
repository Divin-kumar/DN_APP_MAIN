import { useEffect, useMemo, useState } from 'react';
import DropdownSelect from '../common/DropdownSelect';
import { filterTransactions, toTransactions, transactionMonthOptions } from '../../utils/transactionFilters';

const STORAGE_PREFIX = 'dn_transactions_filters_';
const defaultFilters = { type: 'all', month: 'all', search: '' };
const getSaved = (scope) => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + scope);
    const stored = raw ? JSON.parse(raw) : {};
    return {
      type: ['all', 'income', 'expense'].includes(stored.type) ? stored.type : 'all',
      month: stored.month === 'all' || /^\d{4}-\d{2}$/.test(stored.month || '') ? stored.month : 'all',
      search: typeof stored.search === 'string' ? stored.search : '',
    };
  } catch { return { ...defaultFilters }; }
};

const money = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(amount) || 0);
const dateLabel = (date) => {
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set';
};

export default function TransactionHistory({ incomes, expenses, scope = 'guest' }) {
  const [filters, setFilters] = useState(() => getSaved(scope));
  useEffect(() => setFilters(getSaved(scope)), [scope]);
  const changeFilter = (patch) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      try { window.sessionStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(next)); } catch { /* Session storage optional */ }
      return next;
    });
  };
  const transactions = useMemo(() => toTransactions(incomes, expenses), [incomes, expenses]);
  const monthOptions = useMemo(() => transactionMonthOptions(transactions), [transactions]);
  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);

  return (
    <section className="transactions-panel" aria-labelledby="dn-transactions-heading">
      <header className="transactions-heading">
        <h3 id="dn-transactions-heading">Transactions</h3>
        <span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}</span>
      </header>
      <div className="transactions-toolbar">
        <input type="search" aria-label="Search transactions" placeholder="Search transactions"
          value={filters.search} onChange={(event) => changeFilter({ search: event.target.value })} />
        <div className="transactions-filter-pair" role="group" aria-label="Transaction filters">
          <DropdownSelect aria-label="Transaction Type" value={filters.type}
            onChange={(event) => changeFilter({ type: event.target.value })}>
            <option value="all" data-short-label="All">All transactions</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </DropdownSelect>
          <DropdownSelect aria-label="Month" value={filters.month}
            onChange={(event) => changeFilter({ month: event.target.value })}>
            <option value="all" data-short-label="All">All months</option>
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value} data-short-label={month.shortLabel}>{month.label}</option>
            ))}
          </DropdownSelect>
        </div>
      </div>
      <div className="transactions-results" role="list" aria-label="Filtered transactions">
        {filtered.length ? filtered.map((item) => (
          <div className="financial-preview-row transaction-result-row" role="listitem" key={item.stableTransactionKey}>
            <span>
              <strong>{item.name || item.title || (item.transactionKind === 'income' ? 'Income' : 'Expense')}</strong>
              <small>{item.category || item.type || (item.transactionKind === 'income' ? 'Income' : 'Expense')} · {dateLabel(item.date)}</small>
            </span>
            <strong className={item.transactionKind === 'income' ? 'transaction-amount-income' : 'transaction-amount-expense'}>
              {item.transactionKind === 'income' ? '+' : '−'}{money(item.amount)}
            </strong>
          </div>
        )) : (
          <div className="transactions-empty" role="status">
            <strong>No matching transactions</strong>
            <p>{transactions.length ? 'Try a different type, month, or search term.' : 'Your income and expenses will appear here once added.'}</p>
          </div>
        )}
      </div>
    </section>
  );
}
