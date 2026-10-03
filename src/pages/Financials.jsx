// This page is the financial hub for the app.
// It shows income, expenses, and the current balance and also routes to income/expense detail screens.
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { Landmark, Receipt, WalletCards } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';

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
  { label: 'Expense', path: '/financials/expenses', icon: Receipt },
];

function PreviewGroup({ title, path, entries, emptyLabel, isExpense = false }) {
  return (
    <section className={`financials-overview-group${isExpense ? ' is-expense' : ' is-income'}`}>
      <header><h3>{title}</h3><Link to={path}>View all</Link></header>
      {entries.length ? entries.map((entry) => (
        <div className="financial-preview-row" key={entry.id || entry.firestoreId}>
          <span><strong>{entry.name || title}</strong><small>{entry.category || entry.type || 'General'} · {dateLabel(entry.date)}</small></span>
          <strong>{currency(entry.amount)}</strong>
        </div>
      )) : <p className="financial-empty-copy">{emptyLabel}</p>}
    </section>
  );
}

export default function Financials() {
  const location = useLocation();
  const isOverview = location.pathname === '/financials';
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { incomes, loadIncomes } = useIncomeStore();
  const { expenses, loadExpenses } = useExpenseStore();

  useEffect(() => {
    if (!user && !isGuest) return;
    loadIncomes(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [user, isGuest, loadIncomes, loadExpenses]);

  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const currentBalance = totalIncome - totalExpenses;
  const recentIncome = [...incomes].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3);
  const recentExpenses = [...expenses].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3);

  return (
    <main className="financials-page feature-page">
      <section className="financial-overview-summary" aria-label="Income, expense and balance summary">
        <div><span>Income</span><strong>{currency(totalIncome)}</strong></div>
        <div><span>Expense</span><strong>{currency(totalExpenses)}</strong></div>
        <div className={`financial-overview-balance${currentBalance < 0 ? ' is-negative' : ''}`}><span>Balance</span><strong>{currency(currentBalance)}</strong></div>
      </section>

      <nav className="financials-nav" aria-label="Financial views">
        {views.map(({ label, path, icon: Icon }) => (
          <NavLink key={path} to={path} end={path === '/financials'} className={({ isActive }) => `financials-nav-card${isActive ? ' financials-nav-card-active' : ''}`} aria-current={location.pathname === path ? 'page' : undefined}>
            <Icon size={16} aria-hidden="true" /><span><strong>{label}</strong></span>
          </NavLink>
        ))}
      </nav>

      <section className="financials-content-panel" aria-live="polite">
        {isOverview ? (
          <div className="financials-overview-grid">
            <PreviewGroup title="Income" path="/financials/income" entries={recentIncome} emptyLabel="Your recent income will appear here." />
            <PreviewGroup title="Expenses" path="/financials/expenses" entries={recentExpenses} emptyLabel="Your recent expenses will appear here." isExpense />
          </div>
        ) : <Outlet />}
      </section>
    </main>
  );
}
