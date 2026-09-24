/* Expense management page with filtering, summaries, and nested history scrolling. */
import { useEffect, useMemo, useState } from 'react';
import ExpenseForm from '../components/expenses/ExpenseForm';
import ExpenseList from '../components/expenses/ExpenseList';
import ExpenseSummary from '../components/expenses/ExpenseSummary';
import useAppStore from '../store/useAppStore';
import useExpenseStore from '../store/useExpenseStore';
import useEventStore from '../store/useEventStore';

export default function Expenses() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { expenses, loading, loadExpenses, addExpense, updateExpenseItem, deleteExpenseItem } = useExpenseStore();
  const { events, loadEvents, updateEventItem } = useEventStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editingExpense, setEditingExpense] = useState(null);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadExpenses(user?.uid, isGuest);
    loadEvents(user?.uid, isGuest);
  }, [user, isGuest, loadExpenses, loadEvents]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch = [expense.name, expense.category].some((value) =>
        String(value || '').toLowerCase().includes(search.toLowerCase())
      );
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, search, categoryFilter]);

  const handleSubmit = async (formData) => {
    try {
      if (editingExpense) {
        const updated = {
          ...editingExpense,
          ...formData,
          id: editingExpense.id || formData.id,
        };
        await updateExpenseItem(user?.uid, isGuest, updated);
        setEditingExpense(null);
        return;
      }

      await addExpense(user?.uid, isGuest, formData);
    } catch (error) {
      console.error('Failed to save expense:', error);
    }
  };

  const handleDelete = async (expense) => {
    const targetId = expense.id || expense.firestoreId;
    const expenseIds = new Set([expense.id, expense.firestoreId, targetId].filter(Boolean));
    await deleteExpenseItem(user?.uid, isGuest, targetId);

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
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
  };

  return (
    <div className="feature-page" style={styles.page}>
      <div className="feature-header" style={styles.headerRow}>
        <div>
          <span style={styles.eyebrow}>Cash flow</span>
          <h2 style={styles.title}>Expenses</h2>
        </div>
      </div>

      <ExpenseSummary expenses={filteredExpenses} />

      <div className="feature-content-grid" style={styles.contentGrid}>
        <div className="feature-card" style={styles.card}>
          <h3 style={styles.sectionTitle}>{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
          <ExpenseForm
            initialValues={editingExpense}
            submitLabel={editingExpense ? 'Update Expense' : 'Save Expense'}
            onSubmit={handleSubmit}
            onCancel={() => setEditingExpense(null)}
            events={events}
          />
        </div>

        <div className="feature-card" style={styles.card}>
          <h3 style={styles.sectionTitle}>Expense History</h3>

          <div style={styles.filters}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or category"
              style={styles.input}
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={styles.input}
            >
              <option value="all">All categories</option>
              <option value="Food">Food</option>
              <option value="Hospital">Hospital</option>
              <option value="Shopping">Shopping</option>
              <option value="Travel">Travel</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {loading ? (
            <div style={styles.loading}>Loading expenses...</div>
          ) : (
            <ExpenseList expenses={filteredExpenses} onEdit={handleEdit} onDelete={handleDelete} />
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
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)',
    gap: '18px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '18px',
    border: '1px solid #dfeae3',
    padding: '18px',
    boxShadow: '0 8px 18px rgba(47, 70, 58, 0.04)',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '14px',
    fontSize: '1.25rem',
  },
  filters: {
    display: 'grid',
    gap: '10px',
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid #d7e3da',
    background: '#fbfdfb',
    color: '#1d3f2c',
  },
  loading: {
    padding: '18px',
    color: '#5a6d61',
    textAlign: 'center',
  },
};
