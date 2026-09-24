const currency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(number);
};

export default function IncomeSummary({ incomes }) {
  const total = incomes.reduce((sum, income) => sum + Number(income.amount || 0), 0);

  return (
    <div style={styles.grid}>
      <div className="summary-card" style={styles.card}>
        <span style={styles.label}>Total income</span>
        <strong style={styles.value}>{currency(total)}</strong>
      </div>

      <div className="summary-card" style={styles.card}>
        <span style={styles.label}>Entries</span>
        <strong style={styles.value}>{incomes.length}</strong>
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
    background: '#ffffff',
    border: '1px solid #dfeae3',
    borderRadius: '16px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: '#5a6d61',
    fontSize: '0.82rem',
  },
  value: {
    fontSize: '1.4rem',
    color: '#132d1f',
  },
};
