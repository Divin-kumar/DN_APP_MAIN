import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Landmark, Receipt, WalletCards } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';

const currency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const views = [
  { label: 'Financial overview', path: '/financials', icon: WalletCards, detail: 'Keep money tracking secondary to your life events.' },
  { label: 'Income', path: '/financials/income', icon: Landmark, detail: 'Review and manage income records.' },
  { label: 'Expenses', path: '/financials/expenses', icon: Receipt, detail: 'Review spending and event-linked costs.' },
];

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

  return (
    <div className="financials-page feature-page">
      <div className="financials-heading" style={styles.headingRow}>
        <div>
          <span className="eyebrow">Supporting view</span>
          <h2>Financials</h2>
          <p>Simple money tracking that supports the life you are organizing.</p>
        </div>

        <div style={styles.inlineBalance}>
          <span style={styles.balanceLabel}>Current balance</span>
          <strong style={{ ...styles.balanceValue, color: currentBalance >= 0 ? '#1f6f5d' : '#b14a48' }}>{currency(currentBalance)}</strong>
          <small style={styles.metaText}>Income: {currency(totalIncome)} · Spending: {currency(totalExpenses)}</small>
        </div>
      </div>

      <div className="financials-nav" aria-label="Financial views">
        {views.map((view) => {
          const Icon = view.icon;
          return (
            <NavLink key={view.path} to={view.path} end={view.path === '/financials'} className={({ isActive }) => `financials-nav-card${isActive ? ' financials-nav-card-active' : ''}`}>
              <Icon size={18} />
              <span><strong>{view.label}</strong><small>{view.detail}</small></span>
              <ArrowRight size={16} />
            </NavLink>
          );
        })}
      </div>

      {isOverview ? (
        <div className="financials-empty-state" style={styles.emptyState}>
          <WalletCards size={26} />
          <h3>Money stays in context</h3>
          <p>Use Income and Expenses when they help you understand an event. Your events remain useful with no financial records.</p>
        </div>
      ) : <Outlet />}
    </div>
  );
}

const styles = {
  headingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  inlineBalance: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    textAlign: 'right',
    lineHeight: 1.2,
    padding: '12px 14px',
    border: '1px solid rgba(31, 111, 93, 0.12)',
    borderRadius: '14px',
    background: 'linear-gradient(180deg, rgba(31, 111, 93, 0.05), rgba(31, 111, 93, 0.02))',
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.04)',
  },
  balanceLabel: {
    fontSize: '0.68rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#5f756a',
    fontWeight: 700,
  },
  balanceValue: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '-0.04em',
  },
  metaText: {
    color: '#5a6d61',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  emptyState: {
    marginTop: '10px',
  },
};
