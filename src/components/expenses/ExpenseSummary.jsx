/* Summary cards derived from the currently filtered expense collection. */
const currency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(number);
};

export default function ExpenseSummary({ expenses }) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const categories = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
    return acc;
  }, {});

  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={styles.grid}>
      <div className="summary-card" style={styles.card}>
        <span style={styles.label}>Total spending</span>
        <strong style={styles.value}>{currency(total)}</strong>
      </div>

      <div className="summary-card" style={styles.card}>
        <span style={styles.label}>Transactions</span>
        <strong style={styles.value}>{expenses.length}</strong>
      </div>

      <div className="summary-card" style={styles.card}>
        <span style={styles.label}>Top category</span>
        <strong style={styles.value}>{topCategory ? topCategory[0] : '-'}</strong>
      </div>
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '15px',
    marginBottom: '18px',
  },
  card: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,248,246,0.96))',
    border: '1px solid rgba(31, 111, 93, 0.12)',
    borderRadius: '14px',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.04)',
  },
  label: {
    color: '#5f756a',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: '1.45rem',
    color: '#132d1f',
    fontWeight: 800,
    letterSpacing: '-0.04em',
  },
};
