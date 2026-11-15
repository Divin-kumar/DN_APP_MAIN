import { useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { downloadBlob } from '../../utils/download';
import { activityTime } from '../../utils/activityTime';
import { parseMomentDate } from '../../utils/momentDates';
import { financeReportCategories, financeReportCategory, groupFinanceMonths } from '../../utils/financeInsights';
import { sortTransactions, summarizeTransactions, toTransactions } from '../../utils/transactionFilters';
import { transactionsToCsv } from '../../utils/transactionCsv';

const MONEY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const SHORT_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const DETAILS_PAGE_SIZE = 40;
const monthDate = (month) => parseMomentDate(month + '-01');
const money = (amount) => MONEY.format(Number(amount.toFixed(2)) || 0);

export default function FinanceInsightsReport({ incomes, expenses, events }) {
  const months = useMemo(() => groupFinanceMonths(toTransactions(incomes, expenses)), [incomes, expenses]);
  const [selection, setSelection] = useState({});
  const years = [...new Set([...months.keys()].map((month) => month.slice(0, 4)))];
  const year = years.includes(selection.year) ? selection.year : years[0];
  const yearMonths = [...months.keys()].filter((month) => month.startsWith(year + '-'));
  const selectedMonth = yearMonths.includes(selection.month) ? selection.month : yearMonths[0];

  const selectedTransactions = months.get(selectedMonth);
  const totals = selectedTransactions && summarizeTransactions(selectedTransactions);

  return (
    <section className="dn-finance-report" aria-labelledby="finance-report-title">
      <h2 id="finance-report-title"><CalendarDays size={18} aria-hidden="true" /> Monthly finance</h2>
      {selectedMonth ? <>
        <section className="dn-finance-month-summary" aria-labelledby="finance-selected-month">
          <h3 id="finance-selected-month" className="sr-only">{MONTH_NAME.format(monthDate(selectedMonth))}</h3>
          <div className="dn-finance-period">
            <label>
              <span className="sr-only">Report month</span>
              <select value={selectedMonth} onChange={(event) => setSelection({ year, month: event.target.value })}>
                {yearMonths.map((month) => <option key={month} value={month}>
                  {monthDate(month).toLocaleDateString('en-GB', { month: 'long' })}
                </option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Report year</span>
              <select value={year} onChange={(event) => setSelection({ year: event.target.value })}>
                {years.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <dl>
            <div className="dn-finance-balance"><dt>Balance</dt><dd>{money(totals.balance)}</dd></div>
            <div><dt><ArrowDownLeft size={15} aria-hidden="true" /> Income</dt><dd>{money(totals.income)}</dd></div>
            <div><dt><ArrowUpRight size={15} aria-hidden="true" /> Expenses</dt><dd>{money(totals.expense)}</dd></div>
          </dl>
        </section>
        <details className="dn-finance-compare" key={year}>
          <summary>Compare months <ChevronDown size={16} aria-hidden="true" /></summary>
          <table className="dn-finance-table dn-finance-months" aria-label={`Monthly finance totals for ${year}`}>
            <thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Expenses</th><th scope="col">Balance</th></tr></thead>
            <tbody>{yearMonths.map((month) => {
              const { income, expense, balance } = summarizeTransactions(months.get(month));
              return <tr key={month} className={month === selectedMonth ? 'is-selected' : undefined}>
                <th scope="row">
                  <button type="button" aria-label={MONTH_NAME.format(monthDate(month))}
                    aria-controls="finance-month-details" aria-pressed={month === selectedMonth}
                    onClick={() => setSelection({ year, month })}>{SHORT_MONTH.format(monthDate(month))}</button>
                </th>
                <td>{money(income)}</td><td>{money(expense)}</td><td>{money(balance)}</td>
              </tr>;
            })}</tbody>
          </table>
        </details>
        <FinanceMonthDetails key={selectedMonth} month={selectedMonth} transactions={selectedTransactions} events={events} />
      </> : <p className="insights-muted">Monthly reports appear after you add a dated transaction.</p>}
    </section>
  );
}

function FinanceMonthDetails({ month, transactions, events }) {
  const groups = useMemo(() => financeReportCategories(transactions), [transactions]);
  const sorted = useMemo(() => sortTransactions(transactions), [transactions]);
  const transactionHeading = useRef(null);
  const [filter, setFilter] = useState(null);
  const [limit, setLimit] = useState(DETAILS_PAGE_SIZE);
  const activeFilter = filter && groups[filter.kind].some((row) => row.category === filter.category) ? filter : null;
  const rows = activeFilter
    ? sorted.filter((item) => item.transactionKind === activeFilter.kind && financeReportCategory(item) === activeFilter.category)
    : sorted;
  const selectCategory = (kind, category) => {
    setFilter(activeFilter?.kind === kind && activeFilter.category === category ? null : { kind, category });
    setLimit(DETAILS_PAGE_SIZE);
    transactionHeading.current?.focus();
  };
  const clearCategory = () => {
    setFilter(null);
    setLimit(DETAILS_PAGE_SIZE);
    transactionHeading.current?.focus();
  };
  const exportCsv = () => {
    downloadBlob(new Blob([transactionsToCsv(rows, events)], { type: 'text/csv;charset=utf-8' }), `dn-finance-${month}.csv`);
  };

  return (
    <div id="finance-month-details" className="dn-finance-month-details">
      <div className="dn-finance-breakdown">
        <CategoryBreakdown label="Income by type" kind="income" rows={groups.income} activeFilter={activeFilter} onSelect={selectCategory} />
        <CategoryBreakdown label="Expenses by category" kind="expense" rows={groups.expense} activeFilter={activeFilter} onSelect={selectCategory} />
      </div>
      <div className="dn-finance-detail-head">
        <div>
          <h4 id="finance-transactions" ref={transactionHeading} tabIndex={-1}>Transactions</h4>
          <p aria-live="polite">{rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}{activeFilter ? ` · ${activeFilter.category}` : ''}</p>
        </div>
        <button className="dn-finance-report-action" type="button" onClick={exportCsv} aria-label="Export report transactions as CSV">
          <Download size={16} aria-hidden="true" /> CSV
        </button>
      </div>
      {activeFilter ? <button className="dn-finance-report-action" type="button" onClick={clearCategory}>Show all transactions</button> : null}
      <table className="dn-finance-table dn-finance-transactions" id="finance-transaction-rows" aria-labelledby="finance-transactions">
        <thead><tr><th scope="col">Date</th><th scope="col">Transaction</th><th scope="col">Amount</th></tr></thead>
        <tbody>{rows.slice(0, limit).map((item) => {
          const income = item.transactionKind === 'income';
          const date = parseMomentDate(item.date);
          const time = activityTime(item);
          const amount = Number(item.amount);
          return <tr key={item.stableTransactionKey}>
            <td><time dateTime={time ? `${item.date}T${time}` : item.date}>{date ? SHORT_DATE.format(date) : item.date}{time ? <small>{time}</small> : null}</time></td>
            <td><strong>{item.name || item.title || (income ? 'Income' : 'Expense')}</strong><small>{income ? 'Income' : 'Expense'} · {financeReportCategory(item)}</small></td>
            <td>{Number.isFinite(amount) ? money(amount) : '—'}</td>
          </tr>;
        })}</tbody>
      </table>
      {rows.length > limit ? <button type="button" className="dn-finance-report-action"
        onClick={() => setLimit((current) => current + DETAILS_PAGE_SIZE)}>Show more transactions</button> : null}
    </div>
  );
}

function CategoryBreakdown({ label, kind, rows, activeFilter, onSelect }) {
  return (
    <section>
      <h4>{label}</h4>
      {rows.length ? <ul>{rows.map(({ category, amount, count }) => (
        <li key={category}>
          <button type="button" aria-controls="finance-transaction-rows"
            aria-pressed={activeFilter?.kind === kind && activeFilter.category === category} onClick={() => onSelect(kind, category)}>
            <span>{category}<small>{count} {count === 1 ? 'transaction' : 'transactions'}</small></span>
            <strong>{money(amount)}</strong>
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </li>
      ))}</ul> : <p className="insights-muted">{kind === 'income' ? 'No income recorded.' : 'No expenses recorded.'}</p>}
    </section>
  );
}
