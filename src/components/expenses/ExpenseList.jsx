const currency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(number);
};

export default function ExpenseList({ expenses, onEdit, onDelete }) {
  if (!expenses.length) {
    return (
      <div className="empty-state" style={styles.emptyState}>
        No expenses yet for this view.
      </div>
    );
  }

  return (
    <div className="history-scroll">
      <div style={styles.list}>
      {expenses.map((expense) => (
        <div key={expense.id || expense.firestoreId} className="history-row" style={styles.row}>
          <div style={styles.meta}>
            <strong>{expense.name}</strong>
            <span>
              {expense.category} • {expense.date}{expense.activityId ? ' • Linked activity' : ''}
            </span>
          </div>

          <div style={styles.rightSide}>
            <span style={styles.amount}>{currency(expense.amount)}</span>
            <button className="edit-control" type="button" onClick={() => onEdit(expense)} style={styles.editButton}>
              Edit
            </button>
            <button className="delete-control" type="button" onClick={() => onDelete(expense)} style={styles.deleteButton}>
              Delete
            </button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

const styles = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  row: {
    background: '#ffffff',
    border: '1px solid #dfeae3',
    borderRadius: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 16px',
    alignItems: 'center',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  rightSide: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  amount: {
    fontWeight: 700,
    color: '#1b3a2b',
    minWidth: '92px',
    textAlign: 'right',
  },
  editButton: {
    border: '1px solid #d7e3da',
    background: '#f4faf5',
    color: '#1d3f2c',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
  },
  deleteButton: {
    border: 'none',
    background: '#d9534f',
    color: '#fff',
    borderRadius: '8px',
    padding: '8px 10px',
    cursor: 'pointer',
  },
  emptyState: {
    background: '#ffffff',
    border: '1px dashed #dfeae3',
    borderRadius: '14px',
    padding: '24px',
    color: '#5a6d61',
    textAlign: 'center',
  },
};
