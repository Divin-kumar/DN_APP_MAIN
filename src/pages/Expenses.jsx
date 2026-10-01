/* Expense management page with filtering, summaries, and nested history scrolling. */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ExpenseForm from '../components/expenses/ExpenseForm';
import DropdownSelect from '../components/common/DropdownSelect';
import ExpenseList from '../components/expenses/ExpenseList';
import useAppStore from '../store/useAppStore';
import useExpenseStore from '../store/useExpenseStore';
import useEventStore from '../store/useEventStore';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';

export default function Expenses() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const { expenses, loading, loadExpenses, addExpense, updateExpenseItem, deleteExpenseItem } = useExpenseStore();
  const { events, loadEvents, updateEventItem } = useEventStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState(null);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadExpenses(user?.uid, isGuest);
    loadEvents(user?.uid, isGuest);
  }, [user, isGuest, loadExpenses, loadEvents]);

  useEffect(() => {
    if (!location.search.includes('create=expense')) return;
    setEditingExpense(null);
    setExpenseDialogOpen(true);
    navigate('/financials/expenses', { replace: true });
  }, [location.search, navigate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch = [expense.name, expense.category].some((value) =>
        String(value || '').toLowerCase().includes(search.toLowerCase())
      );
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);
  const categories = useMemo(() => [...new Set([...expenses.map((expense) => expense.category), 'Food', 'Health', 'Insurance', 'Education', 'Home', 'Vehicle', 'Celebrations', 'Other'].filter(Boolean))].sort(), [expenses]);

  const handleSubmit = async (formData) => {
    try {
      if (editingExpense) {
        const updated = {
          ...editingExpense,
          ...formData,
          id: editingExpense.id || formData.id,
        };
        await updateExpenseItem(user?.uid, isGuest, updated);
        showToast('Expense updated', 'success');
        setEditingExpense(null);
        setExpenseDialogOpen(false);
        return;
      }

      await addExpense(user?.uid, isGuest, formData);
      showToast('Expense saved', 'success');
      setExpenseDialogOpen(false);
    } catch (error) {
      console.error('Failed to save expense:', error);
      showToast('Expense save failed', 'danger');
    }
  };

  const handleDelete = async (expense) => {
    const targetId = expense.id || expense.firestoreId;
    const expenseIds = new Set([expense.id, expense.firestoreId, targetId].filter(Boolean));
    await deleteExpenseItem(user?.uid, isGuest, targetId);
    showToast('Expense deleted', 'danger');

    // Remove the activity-local copy so reconciliation cannot restore a deleted expense.
    if (expense.eventId && expense.activityId) {
      const event = events.find((item) => (item.id || item.firestoreId) === expense.eventId);
      if (event) {
        const activities = (event.activities || []).map((activity) => (
          activity.id === expense.activityId
            ? {
                ...activity,
                expenses: (activity.expenses || []).filter(
                  (item) => !expenseIds.has(item.id) && !expenseIds.has(item.firestoreId)
                ),
              }
            : activity
        ));
        await updateEventItem(user?.uid, isGuest, { ...event, activities });
      }
    }

    if (editingExpense && (editingExpense.id === targetId || editingExpense.firestoreId === targetId)) {
      setEditingExpense(null);
    }
    setPendingDeleteExpense(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  };

  return (
    <div className="financial-module-page">
      <header className="financial-module-heading">
        <h3>Expense</h3>
        <button type="button" className="primaryButton" onClick={() => { setEditingExpense(null); setExpenseDialogOpen(true); }}>Add expense</button>
      </header>
      <div className="financial-module-toolbar">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search expenses" aria-label="Search expenses" />
        <DropdownSelect value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter expense category">
          <option value="all">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </DropdownSelect>
      </div>
      <section className="financial-module-history" aria-label="Expense history">
        {loading ? <p className="financial-empty-copy">Loading expenses…</p> : <ExpenseList expenses={filteredExpenses} onEdit={handleEdit} onDelete={(expense) => setPendingDeleteExpense(expense)} />}
      </section>

      {expenseDialogOpen ? (
        <ModalDialog title={editingExpense ? 'Edit expense' : 'Add expense'} onClose={() => { setExpenseDialogOpen(false); setEditingExpense(null); }}>
          <ExpenseForm
            initialValues={editingExpense}
            submitLabel={editingExpense ? 'Update Expense' : 'Save Expense'}
            onSubmit={handleSubmit}
            onCancel={() => { setExpenseDialogOpen(false); setEditingExpense(null); }}
            events={events}
          />
        </ModalDialog>
      ) : null}
      {pendingDeleteExpense ? (
        <ConfirmDialog
          title="Delete expense?"
          message={`Delete “${pendingDeleteExpense.name || 'this expense'}”? This cannot be undone.`}
          onCancel={() => setPendingDeleteExpense(null)}
          onConfirm={() => handleDelete(pendingDeleteExpense)}
        />
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minHeight: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-soft)',
  },
  title: {
    margin: '6px 0 0',
    fontSize: '1.8rem',
    color: 'var(--ink)',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '10px',
    background: '#2d6a4f',
    color: '#ffffff',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)',
    gap: '12px',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '14px',
    boxShadow: '0 8px 18px rgba(47, 70, 58, 0.04)',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '10px',
    fontSize: '1.1rem',
  },
  filters: {
    display: 'grid',
    gap: '8px',
    marginBottom: '12px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
  },
  loading: {
    padding: '18px',
    color: 'var(--ink-soft)',
    textAlign: 'center',
  },
};
