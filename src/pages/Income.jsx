import { useEffect, useMemo, useState } from 'react';
import IncomeForm from '../components/income/IncomeForm';
import IncomeList from '../components/income/IncomeList';
import IncomeSummary from '../components/income/IncomeSummary';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';

export default function Income() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { incomes, loading, loadIncomes, addIncome, updateIncomeItem, deleteIncomeItem } = useIncomeStore();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingIncome, setEditingIncome] = useState(null);

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
        setEditingIncome(null);
        return;
      }

      await addIncome(user?.uid, isGuest, formData);
    } catch (error) {
      console.error('Failed to save income:', error);
    }
  };

  const handleDelete = async (income) => {
    const targetId = income.id || income.firestoreId;
    await deleteIncomeItem(user?.uid, isGuest, targetId);
    if (editingIncome && (editingIncome.id === targetId || editingIncome.firestoreId === targetId)) {
      setEditingIncome(null);
    }
  };

  const handleEdit = (income) => {
    setEditingIncome(income);
  };

  return (
    <div className="feature-page" style={styles.page}>
      <div className="feature-header" style={styles.headerRow}>
        <div>
          <span style={styles.eyebrow}>Cash flow</span>
          <h2 style={styles.title}>Income</h2>
        </div>
      </div>

      <IncomeSummary incomes={filteredIncomes} />

      <div className="feature-content-grid" style={styles.contentGrid}>
        <div className="feature-card" style={styles.card}>
          <h3 style={styles.sectionTitle}>{editingIncome ? 'Edit Income' : 'Add Income'}</h3>
          <IncomeForm
            initialValues={editingIncome}
            submitLabel={editingIncome ? 'Update Income' : 'Save Income'}
            onSubmit={handleSubmit}
            onCancel={() => setEditingIncome(null)}
          />
        </div>

        <div className="feature-card" style={styles.card}>
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
            <IncomeList incomes={filteredIncomes} onEdit={handleEdit} onDelete={handleDelete} />
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
