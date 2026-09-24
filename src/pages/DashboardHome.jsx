import { useEffect, useMemo, useState } from 'react';
import useAppStore from '../store/useAppStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';

const currency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getMonthKey = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const monthLabel = (monthKey) => {
  if (!monthKey) return 'Current month';
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const monthOrder = (a, b) => {
  const [yearA, monthA] = a.split('-').map(Number);
  const [yearB, monthB] = b.split('-').map(Number);
  return new Date(yearB, monthB - 1).getTime() - new Date(yearA, monthA - 1).getTime();
};

const compareMonth = (monthKey, target) => {
  const [year, month] = monthKey.split('-').map(Number);
  const [targetYear, targetMonth] = target.split('-').map(Number);
  return new Date(year, month - 1).getTime() < new Date(targetYear, targetMonth - 1).getTime();
};

export default function DashboardHome() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);

  const { expenses, loadExpenses } = useExpenseStore();
  const { incomes, loadIncomes } = useIncomeStore();

  const currentMonthKey = getMonthKey(new Date()) || '2024-01';
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadExpenses(user?.uid, isGuest);
    loadIncomes(user?.uid, isGuest);
  }, [user, isGuest, loadExpenses, loadIncomes]);

  const availableMonths = useMemo(() => {
    const months = new Set([
      ...expenses.map((expense) => getMonthKey(expense.date)).filter(Boolean),
      ...incomes.map((income) => getMonthKey(income.date)).filter(Boolean),
      currentMonthKey,
    ]);

    return [...months].sort(monthOrder);
  }, [expenses, incomes, currentMonthKey]);

  useEffect(() => {
    if (!availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[availableMonths.length - 1] || currentMonthKey);
    }
  }, [availableMonths, selectedMonth, currentMonthKey]);

  const monthExpenses = useMemo(
    () => expenses.filter((expense) => getMonthKey(expense.date) === selectedMonth),
    [expenses, selectedMonth]
  );

  const monthIncome = useMemo(
    () => incomes.filter((income) => getMonthKey(income.date) === selectedMonth),
    [incomes, selectedMonth]
  );

  const expenseTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const incomeTotal = monthIncome.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const previousIncome = incomes
    .filter((item) => getMonthKey(item.date) && compareMonth(getMonthKey(item.date), selectedMonth))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const previousExpenses = expenses
    .filter((item) => getMonthKey(item.date) && compareMonth(getMonthKey(item.date), selectedMonth))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const openingBalance = previousIncome - previousExpenses;
  const closingBalance = openingBalance + incomeTotal - expenseTotal;

  const categoryBreakdown = Object.entries(
    monthExpenses.reduce((acc, item) => {
      const name = item.category || 'Other';
      acc[name] = (acc[name] || 0) + Number(item.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const recentExpenses = [...monthExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const recentIncomes = [...monthIncome].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  return (
    <div className="dashboard-page" style={styles.page}>
      <div className="dashboard-header" style={styles.headerRow}>
        <div>
          <span style={styles.eyebrow}>Overview</span>
          <h2 style={styles.title}>
            {user?.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Your overview'}
          </h2>
          <p style={styles.period}>Here is your {monthLabel(selectedMonth).toLowerCase()} at a glance.</p>
        </div>

        <select
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          style={styles.select}
        >
          {availableMonths.map((monthKey) => (
            <option key={monthKey} value={monthKey}>
              {monthLabel(monthKey)}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.summaryGrid}>
        <div className="dashboard-summary-card" style={styles.summaryCard}>
          <span style={styles.label}>Balance</span>
          <strong className="dashboard-value" style={styles.value}>{currency(closingBalance)}</strong>
        </div>

        <div className="dashboard-summary-card" style={styles.summaryCard}>
          <span style={styles.label}>Income</span>
          <strong className="dashboard-value" style={styles.value}>{currency(incomeTotal)}</strong>
        </div>

        <div className="dashboard-summary-card" style={styles.summaryCard}>
          <span style={styles.label}>Expenses</span>
          <strong className="dashboard-value" style={styles.value}>{currency(expenseTotal)}</strong>
        </div>

        <div className="dashboard-summary-card" style={styles.summaryCard}>
          <span style={styles.label}>Transactions</span>
          <strong className="dashboard-value" style={styles.value}>{monthExpenses.length + monthIncome.length}</strong>
        </div>
      </div>

      <div style={styles.detailGrid}>
        <div className="dashboard-panel" style={styles.panel}>
          <h3 style={styles.sectionTitle}>Financial snapshot</h3>

          <div style={styles.breakdownRow}>
            <span>Opening balance</span>
            <strong>{currency(openingBalance)}</strong>
          </div>

          <div style={styles.breakdownRow}>
            <span>Income this month</span>
            <strong>{currency(incomeTotal)}</strong>
          </div>

          <div style={styles.breakdownRow}>
            <span>Expenses this month</span>
            <strong>{currency(expenseTotal)}</strong>
          </div>

          <div style={styles.breakdownRow}>
            <span>Closing balance</span>
            <strong>{currency(closingBalance)}</strong>
          </div>
        </div>

        <div className="dashboard-panel" style={styles.panel}>
          <h3 style={styles.sectionTitle}>Top spending categories</h3>

          {categoryBreakdown.length ? (
            categoryBreakdown.slice(0, 4).map(([category, value]) => (
              <div key={category} style={styles.breakdownRow}>
                <span>{category}</span>
                <strong>{currency(value)}</strong>
              </div>
            ))
          ) : (
            <p style={styles.emptyText}>No expense entries for this period yet.</p>
          )}
        </div>
      </div>

      <div style={styles.listGrid}>
        <div className="dashboard-panel" style={styles.panel}>
          <h3 style={styles.sectionTitle}>Recent expenses</h3>
          {recentExpenses.length ? (
            <div className="history-scroll">
              {recentExpenses.map((item) => (
              <div key={item.id || item.firestoreId} style={styles.listRow}>
                <div>
                  <strong>{item.name}</strong>
                  <div style={styles.muted}>{item.category} • {item.date}</div>
                </div>
                <span style={styles.expenseAmount}>{currency(item.amount)}</span>
              </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>No expenses logged this month.</p>
          )}
        </div>

        <div className="dashboard-panel" style={styles.panel}>
          <h3 style={styles.sectionTitle}>Recent income</h3>
          {recentIncomes.length ? (
            <div className="history-scroll">
              {recentIncomes.map((item) => (
              <div key={item.id || item.firestoreId} style={styles.listRow}>
                <div>
                  <strong>{item.name}</strong>
                  <div style={styles.muted}>{item.type} • {item.date}</div>
                </div>
                <span style={styles.incomeAmount}>{currency(item.amount)}</span>
              </div>
              ))}
            </div>
          ) : (
            <p style={styles.emptyText}>No income logged this month.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '18px',
  },
  eyebrow: {
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#6a7d71',
  },
  title: {
    margin: '6px 0 0',
    fontSize: '1.8rem',
  },
  period: {
    margin: '6px 0 0',
    color: '#5a6d61',
    fontSize: '0.9rem',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '15px',
  },
  summaryCard: {
    padding: '18px',
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #dfeae3',
    boxShadow: '0 8px 18px rgba(47, 70, 58, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#5a6d61',
    fontSize: '0.82rem',
  },
  value: {
    fontSize: '1.55rem',
    color: '#132d1f',
  },
  select: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #d7e3da',
    background: '#fbfdfb',
    color: '#1d3f2c',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '18px',
  },
  listGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '18px',
  },
  panel: {
    background: '#ffffff',
    borderRadius: '18px',
    border: '1px solid #dfeae3',
    padding: '18px',
    boxShadow: '0 8px 18px rgba(47, 70, 58, 0.04)',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '14px',
    fontSize: '1.15rem',
  },
  breakdownRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid #edf3ee',
    color: '#294736',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid #edf3ee',
  },
  muted: {
    color: '#5a6d61',
    fontSize: '0.8rem',
    marginTop: '4px',
  },
  expenseAmount: {
    color: '#9d3c3c',
    fontWeight: 700,
  },
  incomeAmount: {
    color: '#20704a',
    fontWeight: 700,
  },
  emptyText: {
    margin: 0,
    color: '#5a6d61',
    lineHeight: 1.6,
  },
};
