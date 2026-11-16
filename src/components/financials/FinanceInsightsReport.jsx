import { useMemo, useRef, useState } from 'react';
import { ChartNoAxesColumn, Download, ListFilter } from 'lucide-react';
import { downloadBlob } from '../../utils/download';
import { activityTime } from '../../utils/activityTime';
import { parseMomentDate } from '../../utils/momentDates';
import { financeReportCategories, financeReportCategory, groupFinanceMonths } from '../../utils/financeInsights';
import { sortTransactions, summarizeTransactions, toTransactions } from '../../utils/transactionFilters';
import { transactionsToCsv } from '../../utils/transactionCsv';

const MONEY = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const SHORT_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
const DETAILS_PAGE_SIZE = 40;
const monthDate = (month) => parseMomentDate(month + '-01');
const money = (amount) => MONEY.format(Number(amount.toFixed(2)) || 0);

export default function FinanceInsightsReport({ incomes, expenses, events }) {
  const months = useMemo(() => groupFinanceMonths(toTransactions(incomes, expenses)), [incomes, expenses]);
  const [period, setPeriod] = useState(null);
  const [report, setReport] = useState(null);
  const [filter, setFilter] = useState(null);
  const [limit, setLimit] = useState(DETAILS_PAGE_SIZE);
  const transactionHeading = useRef(null);

  const selectedMonth = months.has(period) ? period : months.keys().next().value;
  const year = selectedMonth?.slice(0, 4);
  const monthsByYear = useMemo(() => {
    const years = new Map();
    for (const month of months.keys()) {
      const year = month.slice(0, 4);
      if (!years.has(year)) years.set(year, []);
      years.get(year).push(month);
    }
    return years;
  }, [months]);
  const transactions = months.get(selectedMonth);
  const sorted = useMemo(() => sortTransactions(transactions ?? []), [transactions]);
  const totals = useMemo(() => summarizeTransactions(sorted), [sorted]);
  const groups = useMemo(() => financeReportCategories(sorted), [sorted]);
  const activeFilter = filter && groups[filter.kind].some((row) => row.category === filter.category) ? filter : null;
  const rows = activeFilter
    ? sorted.filter((item) => item.transactionKind === activeFilter.kind && financeReportCategory(item) === activeFilter.category)
    : sorted;

  const chooseMonth = (month) => {
    if (month === selectedMonth) return;
    setPeriod(month);
    setFilter(null);
    setLimit(DETAILS_PAGE_SIZE);
    if (report === 'categories' || !month.startsWith(year + '-')) setReport(null);
  };
  const toggleReport = (name) => setReport((current) => current === name ? null : name);
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
    downloadBlob(new Blob([transactionsToCsv(rows, events)], { type: 'text/csv;charset=utf-8' }), `dn-finance-${selectedMonth}.csv`);
  };

  return (
    <section className="dn-finance-report" aria-labelledby="finance-report-title">
      <h2 id="finance-report-title" className="sr-only">Monthly finance</h2>
      {selectedMonth ? <>
        <div className="dn-finance-periods">
          {monthsByYear.size > 1 && <div className="dn-finance-years" role="group" aria-label="Report year">
            {[...monthsByYear].map(([optionYear, [latestMonth]]) => (
              <button type="button" key={optionYear} aria-pressed={optionYear === year}
                aria-controls="finance-report-months" onClick={() => {
                  if (optionYear !== year) chooseMonth(latestMonth);
                }}>{optionYear}</button>
            ))}
          </div>}
          <div id="finance-report-months" className="dn-finance-month-options" role="group" aria-label="Report month">
            {monthsByYear.get(year).map((month) => <button type="button" key={month}
              aria-label={MONTH_NAME.format(monthDate(month))} aria-pressed={month === selectedMonth}
              aria-controls="finance-month-details" onClick={() => chooseMonth(month)}>{SHORT_MONTH.format(monthDate(month))}</button>)}
          </div>
        </div>
        <section className="dn-finance-month-summary" aria-labelledby="finance-selected-month">
          <h3 id="finance-selected-month" className="sr-only">{MONTH_NAME.format(monthDate(selectedMonth))}</h3>
          <div className="dn-finance-summary-heading">
            <span id="finance-balance-label">Balance</span>
            <span className="dn-finance-current-month">{MONTH_NAME.format(monthDate(selectedMonth))}</span>
          </div>
          <div className="dn-finance-balance" aria-labelledby="finance-balance-label" role="group">{money(totals.balance)}</div>
          <dl>
            <div className="dn-finance-income"><dt>Income</dt><dd>{money(totals.income)}</dd></div>
            <div className="dn-finance-expense"><dt>Expenses</dt><dd>{money(totals.expense)}</dd></div>
          </dl>
        </section>

        <div className="dn-finance-tools" role="group" aria-label="Finance reports">
          <button type="button" aria-expanded={report === 'compare'} aria-controls="finance-compare"
            onClick={() => toggleReport('compare')}><ChartNoAxesColumn size={16} aria-hidden="true" /> <span>Compare months</span></button>
          <button type="button" aria-expanded={report === 'categories'} aria-controls="finance-categories"
            onClick={() => toggleReport('categories')}><ListFilter size={16} aria-hidden="true" /> <span>Breakdown</span></button>
        </div>
        <div id="finance-compare" hidden={report !== 'compare'}>
          {report === 'compare' && <table className="dn-finance-table dn-finance-months" aria-label={`Monthly finance totals for ${year}`}>
            <thead><tr><th scope="col">Month</th><th scope="col">Income</th><th scope="col">Expenses</th><th scope="col">Balance</th></tr></thead>
            <tbody>{monthsByYear.get(year).map((month) => {
              const { income, expense, balance } = summarizeTransactions(months.get(month));
              return <tr key={month} className={month === selectedMonth ? 'is-selected' : undefined}>
                <th scope="row">
                  <button type="button" aria-label={MONTH_NAME.format(monthDate(month))}
                    aria-controls="finance-month-details" aria-pressed={month === selectedMonth}
                    onClick={() => chooseMonth(month)}>{SHORT_MONTH.format(monthDate(month))}</button>
                </th>
                <td>{money(income)}</td><td>{money(expense)}</td><td>{money(balance)}</td>
              </tr>;
            })}</tbody>
          </table>}
        </div>
        <div id="finance-categories" hidden={report !== 'categories'}>
          {report === 'categories' && <div className="dn-finance-breakdown">
            <CategoryBreakdown label="Income by type" kind="income" rows={groups.income} activeFilter={activeFilter} onSelect={selectCategory} />
            <CategoryBreakdown label="Expenses by category" kind="expense" rows={groups.expense} activeFilter={activeFilter} onSelect={selectCategory} />
          </div>}
        </div>

        <section id="finance-month-details" className="dn-finance-month-details" aria-labelledby="finance-transactions">
          <div className="dn-finance-detail-head">
            <h3 id="finance-transactions" ref={transactionHeading} tabIndex={-1}>Transactions <span aria-hidden="true">{rows.length}</span></h3>
            <span className="sr-only" aria-live="polite">{rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}{activeFilter ? ` · ${activeFilter.category}` : ''}</span>
            <button className="dn-finance-report-action" type="button" onClick={exportCsv} aria-label="Export report transactions as CSV">
              <Download size={16} aria-hidden="true" /> CSV
            </button>
          </div>
          {activeFilter && <div className="dn-finance-filter">
            <span>{activeFilter.category}</span>
            <button className="dn-finance-report-action" type="button" onClick={clearCategory}>Show all transactions</button>
          </div>}
          <FinanceLedger transactions={rows.slice(0, limit)} />
          {rows.length > limit && <button type="button" className="dn-finance-report-action"
            onClick={() => setLimit((current) => current + DETAILS_PAGE_SIZE)}>Show more transactions</button>}
        </section>
      </> : <p className="insights-muted">Monthly reports appear after you add a dated transaction.</p>}
    </section>
  );
}

function FinanceLedger({ transactions }) {
  const dates = new Map();
  for (const item of transactions) {
    if (!dates.has(item.date)) dates.set(item.date, []);
    dates.get(item.date).push(item);
  }

  return <div id="finance-transaction-rows" className="dn-finance-ledger">
    {[...dates].map(([date, items]) => (
      <div key={date} className="dn-finance-ledger-day">
        <h4 id={`finance-ledger-${date}`}><time dateTime={date}>{SHORT_DATE.format(parseMomentDate(date))}</time></h4>
        <ul role="list" aria-labelledby={`finance-ledger-${date}`}>
          {items.map((item) => {
            const income = item.transactionKind === 'income';
            const time = activityTime(item);
            const amount = Number(item.amount) * (income ? 1 : -1);
            return <li key={item.stableTransactionKey} className={income ? 'dn-finance-income' : 'dn-finance-expense'}>
              <div>
                <strong>{item.name || item.title || (income ? 'Income' : 'Expense')}</strong>
                <small>
                  <span className="sr-only">{income ? 'Income: ' : 'Expense: '}</span>
                  {financeReportCategory(item)}
                  {time && <> · <time dateTime={`${date}T${time}`}>{time}</time></>}
                </small>
              </div>
              <span className="dn-finance-ledger-amount">{Number.isFinite(amount) ? `${amount > 0 ? '+' : ''}${money(amount)}` : '—'}</span>
            </li>;
          })}
        </ul>
      </div>
    ))}
  </div>;
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
          </button>
        </li>
      ))}</ul> : <p className="insights-muted">{kind === 'income' ? 'No income recorded.' : 'No expenses recorded.'}</p>}
    </section>
  );
}
