/* Expense history rows for master financial records. */
import { Pencil, Trash2 } from 'lucide-react';
import useSwipeActions from '../../hooks/useSwipeActions';
import useAppStore from '../../store/useAppStore';
import { getCodeListLabel } from '../../utils/codeLists';

const currency = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(number);
};

function ExpenseRow({ expense, onEdit, onDelete }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const { action, setAction, swipeRootRef, handlePointerDown, handlePointerMove, handlePointerUp, consumeSwipeClick, toggleOther, close } = useSwipeActions();

  return (
    <div
      ref={swipeRootRef}
      className={`financial-swipe-row${action ? ` is-open-${action}` : ''}`}
      role="group"
      tabIndex={0}
      aria-label={`${expense.name}. Swipe left to edit, right to delete.`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(event) => {
        if (consumeSwipeClick(event)) return;
        if (event.target.closest('button')) return;
        if (action) close();
        else toggleOther();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === 'ArrowLeft') { event.preventDefault(); toggleOther(); }
        if (event.key === 'ArrowRight') { event.preventDefault(); setAction('delete'); }
      }}
    >
      <div className="financial-swipe-actions financial-swipe-actions-delete" aria-hidden={action !== 'delete'}>
        <button type="button" className="financial-swipe-action-delete" tabIndex={action === 'delete' ? 0 : -1} onClick={() => { close(); onDelete(expense); }} aria-label={`Delete ${expense.name}`}><Trash2 size={15} /><span>Delete</span></button>
      </div>
      <div className="financial-swipe-actions financial-swipe-actions-other" aria-hidden={action !== 'other'}>
        <button type="button" className="financial-swipe-action-edit" tabIndex={action === 'other' ? 0 : -1} onClick={() => { close(); onEdit(expense); }} aria-label={`Edit ${expense.name}`}><Pencil size={15} /><span>Edit</span></button>
      </div>
      <div className="history-row financial-swipe-main" style={styles.row}>
        <div style={styles.meta}>
          <strong>{expense.name}</strong>
          <span>{getCodeListLabel('expenseCategories', expense.category, adminValues.expenseCategories)} • {expense.date}{expense.activityId ? ' • Linked activity' : ''}</span>
        </div>
        <span style={styles.amount}>{currency(expense.amount)}</span>
      </div>
    </div>
  );
}

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
      {expenses.map((expense) => <ExpenseRow key={expense.id || expense.firestoreId} expense={expense} onEdit={onEdit} onDelete={onDelete} />)}
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
  amount: {
    fontWeight: 800,
    color: '#1b3a2b',
    minWidth: '92px',
    textAlign: 'right',
    letterSpacing: '-0.02em',
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
