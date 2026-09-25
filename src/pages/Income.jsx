/* Income management page with filtering, summaries, and persisted history. */
import { useEffect, useMemo, useState } from 'react';
import IncomeForm from '../components/income/IncomeForm';
import IncomeList from '../components/income/IncomeList';
import IncomeSummary from '../components/income/IncomeSummary';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';

export default function Income() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const { incomes, loading, loadIncomes, addIncome, updateIncomeItem, deleteIncomeItem } = useIncomeStore();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingIncome, setEditingIncome] = useState(null);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [pendingDeleteIncome, setPendingDeleteIncome] = useState(null);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadIncomes(user?.uid, isGuest);
  }, [user, isGuest, loadIncomes]);

  const filteredIncomes = useMemo(() => {
    return incomes.filter((income) => {
      const matchesSearch = [income.name, income.type].some((value) =>
        String(value || '').toLowerCase().includes(search.toLowerCase())
      );
      const matchesType = typeFilter === 'all' || income.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [incomes, search, typeFilter]);

  const handleSubmit = async (formData) => {
    try {
      if (editingIncome) {
        const updated = {
          ...editingIncome,
          ...formData,
          id: editingIncome.id || formData.id,
        };
        await updateIncomeItem(user?.uid, isGuest, updated);
        showToast('Income updated', 'success');
        setEditingIncome(null);
        setIncomeDialogOpen(false);
        return;
      }

      await addIncome(user?.uid, isGuest, formData);
      showToast('Income saved', 'success');
      setIncomeDialogOpen(false);
    } catch (error) {
      console.error('Failed to save income:', error);
      showToast('Income save failed', 'danger');
    }
  };

  const handleDelete = async (income) => {
    const targetId = income.id || income.firestoreId;
    await deleteIncomeItem(user?.uid, isGuest, targetId);
    showToast('Income deleted', 'danger');
    if (editingIncome && (editingIncome.id === targetId || editingIncome.firestoreId === targetId)) {
      setEditingIncome(null);
    }
    setPendingDeleteIncome(null);
  };

  const handleEdit = (income) => {
    setEditingIncome(income);
    setIncomeDialogOpen(true);
  };

  return (
    <div className="feature-page" style={styles.page}>
      <div className="feature-header" style={styles.headerRow}>
        <div>
          <span style={styles.eyebrow}>Cash flow</span>
          <h2 style={styles.title}>Income</h2>
        </div>
        <button type="button" className="primaryButton" onClick={() => { setEditingIncome(null); setIncomeDialogOpen(true); }} style={styles.primaryButton}>Add income</button>
      </div>

      <IncomeSummary incomes={filteredIncomes} />

      <div className="feature-content-grid" style={styles.contentGrid}>
        <div className="feature-card" style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <h3 style={styles.sectionTitle}>Income History</h3>

          <div style={styles.filters}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or type"
              style={styles.input}
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={styles.input}
            >
              <option value="all">All types</option>
              <option value="Salary">Salary</option>
              <option value="Freelance">Freelance</option>
              <option value="Bonus">Bonus</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {loading ? (
            <div style={styles.loading}>Loading income entries...</div>
          ) : (
            <IncomeList incomes={filteredIncomes} onEdit={handleEdit} onDelete={(income) => setPendingDeleteIncome(income)} />
          )}
        </div>
      </div>

      {incomeDialogOpen ? (
        <ModalDialog title={editingIncome ? 'Edit income' : 'Add income'} onClose={() => { setIncomeDialogOpen(false); setEditingIncome(null); }}>
          <IncomeForm
            initialValues={editingIncome}
            submitLabel={editingIncome ? 'Update Income' : 'Save Income'}
            onSubmit={handleSubmit}
            onCancel={() => { setIncomeDialogOpen(false); setEditingIncome(null); }}
          />
        </ModalDialog>
      ) : null}
      {pendingDeleteIncome ? (
        <ConfirmDialog
          title="Delete income?"
          message={`Delete “${pendingDeleteIncome.name || 'this income entry'}”? This cannot be undone.`}
          onCancel={() => setPendingDeleteIncome(null)}
          onConfirm={() => handleDelete(pendingDeleteIncome)}
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
    gap: '12px',
    marginBottom: '2px',
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
    border: '1px solid rgba(18, 86, 68, 0.15)',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #1f6f5d 0%, #2a8c72 100%)',
    color: '#ffffff',
    padding: '10px 15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 22px rgba(31, 111, 93, 0.18)',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 380px) minmax(0, 1fr)',
    gap: '12px',
  },
  card: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,248,246,0.96))',
    borderRadius: '14px',
    border: '1px solid rgba(31, 111, 93, 0.12)',
    padding: '16px',
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.04)',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '12px',
    fontSize: '1.08rem',
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
    border: '1px solid rgba(31, 111, 93, 0.12)',
    background: 'rgba(31, 111, 93, 0.02)',
    color: 'var(--ink)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
  },
  loading: {
    padding: '18px',
    color: 'var(--ink-soft)',
    textAlign: 'center',
  },
};
