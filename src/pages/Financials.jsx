// This page is the financial hub for the app.
// It shows recorded income, expenses, and their net difference, and routes to the income/expense screens.
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { AlertCircle, Landmark, Receipt, WalletCards } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { getCodeListLabel } from '../utils/codeLists';
import StatePanel from '../components/common/StatePanel';

const currency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const dateLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date not set' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const views = [
  { label: 'Overview', path: '/financials', icon: WalletCards },
  { label: 'Income', path: '/financials/income', icon: Landmark },
  { label: 'Expenses', path: '/financials/expenses', icon: Receipt },
];

function PreviewGroup({ title, path, entries, emptyLabel, listKey, listValues, isExpense = false }) {
  return (
    <section className={`financials-overview-group${isExpense ? ' is-expense' : ' is-income'}`}>
      <header><h3>{title}</h3><Link to={path}>View all</Link></header>
      {entries.length ? entries.map((entry) => (
        <div className="financial-preview-row" key={entry.id || entry.firestoreId}>
          <span><strong>{entry.name || title}</strong><small>{getCodeListLabel(listKey, isExpense ? entry.category : entry.type, listValues)} · {dateLabel(entry.date)}</small></span>
          <strong>{currency(entry.amount)}</strong>
        </div>
      )) : <p className="financial-empty-copy">{emptyLabel}</p>}
    </section>
  );
}

export default function Financials() {
  const location = useLocation();
  const isOverview = location.pathname === '/financials';
  const principal = useAppStore((state) => state.principal);
  const adminValues = useAppStore((state) => state.adminValues);
  const user = principal ? { uid: principal.principalId, displayName: principal.deviceName } : null;
  const isGuest = false;
  const incomes = useIncomeStore((state) => state.incomes);
  const incomeLoading = useIncomeStore((state) => state.loading);
  const incomeError = useIncomeStore((state) => state.error);
  const incomeLoadedFor = useIncomeStore((state) => state.loadedFor);
  const loadIncomes = useIncomeStore((state) => state.loadIncomes);
  const expenses = useExpenseStore((state) => state.expenses);
  const expenseLoading = useExpenseStore((state) => state.loading);
  const expenseError = useExpenseStore((state) => state.error);
  const expenseLoadedFor = useExpenseStore((state) => state.loadedFor);
  const loadExpenses = useExpenseStore((state) => state.loadExpenses);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadIncomes(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [user, isGuest, loadIncomes, loadExpenses]);

  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const netRecorded = totalIncome - totalExpenses;
  const recentIncome = [...incomes].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3);
  const recentExpenses = [...expenses].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3);
  const loadError = incomeError === 'Unable to load incomes.' || expenseError === 'Unable to load expenses.';
  const loading = incomeLoading || expenseLoading || ((!incomeLoadedFor && !incomes.length && !incomeError) || (!expenseLoadedFor && !expenses.length && !expenseError));
  const showFinancialTotals = !loading && !loadError;

  return (
    <main className="financials-page feature-page">
      <section className="financial-overview-summary" aria-label="Recorded income, recorded expenses, and net recorded">
        <div><span>Income</span><strong>{showFinancialTotals ? currency(totalIncome) : '—'}</strong></div>
        <div><span>Expenses</span><strong>{showFinancialTotals ? currency(totalExpenses) : '—'}</strong></div>
        <div className={`financial-overview-balance${netRecorded < 0 ? ' is-negative' : ''}`}><span>Net recorded</span><strong>{showFinancialTotals ? currency(netRecorded) : '—'}</strong></div>
      </section>
      <p className="financial-overview-scope-note">Income minus expenses recorded in DN. This is not a bank or account balance.</p>

      <nav className="financials-nav" aria-label="Financial views">
        {views.map(({ label, path, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/financials'} className={({ isActive }) => `financials-nav-card${isActive ? ' financials-nav-card-active' : ''}`} aria-current={location.pathname === path ? 'page' : undefined}>
            <Icon size={16} aria-hidden="true" /><span><strong>{label}</strong></span>
          </NavLink>
        ))}
      </nav>

      <section className="financials-content-panel" aria-live="polite">
        {isOverview ? (
          loadError ? <StatePanel variant="error" icon={AlertCircle} title="Financial records couldn’t be loaded" description="Your saved records are unchanged. Try again to refresh the overview." actionLabel="Try again" onAction={() => { void loadIncomes(user?.uid, isGuest); void loadExpenses(user?.uid, isGuest); }} />
          : loading ? <StatePanel variant="loading" icon={WalletCards} title="Loading financial records" description="Gathering your recorded income and expenses." />
          : recentIncome.length || recentExpenses.length ? (
            <div className="financials-overview-grid">
              <PreviewGroup title="Income" path="/financials/income" entries={recentIncome} emptyLabel="Your recent income will appear here." listKey="incomeTypes" listValues={adminValues.incomeTypes} />
              <PreviewGroup title="Expenses" path="/financials/expenses" entries={recentExpenses} emptyLabel="Your recent expenses will appear here." listKey="expenseCategories" listValues={adminValues.expenseCategories} isExpense />
            </div>
          ) : (
            <StatePanel variant="empty" icon={WalletCards} title="No financial records yet" description="Income and expense entries will appear here once you start recording them." />
          )
        ) : <Outlet />}
      </section>
    </main>
  );
}
