/* Expense history rows for master financial records. */
import { Pencil, Trash2 } from 'lucide-react';

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
            <button className="edit-control" type="button" onClick={() => onEdit(expense)} style={styles.editButton} aria-label={`Edit ${expense.name}`} title="Edit expense">
              <Pencil size={15} />
            </button>
            <button className="delete-control" type="button" onClick={() => onDelete(expense)} style={styles.deleteButton} aria-label={`Delete ${expense.name}`} title="Delete expense">
              <Trash2 size={15} />
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
    background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(244,248,246,0.96))',
    border: '1px solid rgba(31, 111, 93, 0.12)',
    borderRadius: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '14px 16px',
    alignItems: 'center',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  },
  rightSide: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  amount: {
    fontWeight: 800,
    color: '#1b3a2b',
    minWidth: '92px',
    textAlign: 'right',
    letterSpacing: '-0.02em',
  },
  editButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #bfdcc8',
    background: 'linear-gradient(180deg, #f3faf5, #ebf6ef)',
    color: '#2f6d56',
    borderRadius: '10px',
    padding: 0,
    cursor: 'pointer',
    boxShadow: '0 6px 14px rgba(31, 111, 93, 0.08)',
  },
  deleteButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid #f0c9c9',
    background: 'linear-gradient(180deg, #fff8f8, #fff0f0)',
    color: '#d95b5b',
    borderRadius: '10px',
    padding: 0,
    cursor: 'pointer',
    boxShadow: '0 6px 14px rgba(217, 91, 91, 0.08)',
  },
  emptyState: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,248,246,0.96))',
    border: '1px dashed rgba(31, 111, 93, 0.2)',
    borderRadius: '14px',
    padding: '24px',
    color: '#5a6d61',
    textAlign: 'center',
    boxShadow: '0 8px 18px rgba(15, 23, 42, 0.02)',
  },
};
