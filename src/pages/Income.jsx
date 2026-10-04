/*
  Income management page with filtering, summaries, and persisted history.

  This page helps the user track incoming money, search through records, and create or edit income entries.
*/
import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import IncomeForm from '../components/income/IncomeForm';
import DropdownSelect from '../components/common/DropdownSelect';
import IncomeList from '../components/income/IncomeList';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import { getCodeListItems } from '../utils/codeLists';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import SortControl from '../components/common/SortControl';
import usePersistentSort from '../hooks/usePersistentSort';

export default function Income() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const showToast = useAppStore((state) => state.showToast);
  const { incomes, loading, error, loadIncomes, addIncome, updateIncomeItem, deleteIncomeItem } = useIncomeStore();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const { field: incomeSort, direction: incomeSortDirection, setField: setIncomeSort, toggleDirection: toggleIncomeSortDirection } = usePersistentSort('income', 'date', 'desc');
  const [editingIncome, setEditingIncome] = useState(null);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [pendingDeleteIncome, setPendingDeleteIncome] = useState(null);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadIncomes(user?.uid, isGuest);
  }, [user, isGuest, loadIncomes]);

  const filteredIncomes = useMemo(() => {
    const filtered = incomes.filter((income) => {
      const matchesSearch = [income.name, income.type].some((value) =>
        String(value || '').toLowerCase().includes(search.toLowerCase())
      );
      const matchesType = typeFilter === 'all' || income.type === typeFilter;
      return matchesSearch && matchesType;
    });
    return filtered.sort((first, second) => {
      if (incomeSort === 'amount') {
        const order = Number(first.amount || 0) - Number(second.amount || 0);
        return incomeSortDirection === 'desc' ? -order : order;
      }
      if (incomeSort === 'name') {
        const order = String(first.name || '').localeCompare(String(second.name || ''), undefined, { sensitivity: 'base' });
        return incomeSortDirection === 'desc' ? -order : order;
      }
      const firstDate = new Date(first.date || 0).getTime();
      const secondDate = new Date(second.date || 0).getTime();
      const order = (Number.isFinite(firstDate) ? firstDate : 0) - (Number.isFinite(secondDate) ? secondDate : 0);
      return incomeSortDirection === 'desc' ? -order : order;
    });
  }, [incomes, search, typeFilter, incomeSort, incomeSortDirection]);
  const incomeTypes = useMemo(() => {
    const configured = getCodeListItems('incomeTypes', adminValues.incomeTypes);
    const known = [...new Set([...incomes.map((income) => income.type), ...configured].filter(Boolean))];
    return known.sort();
  }, [adminValues.incomeTypes, incomes]);

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
    <div className="financial-module-page">
      <header className="financial-module-heading">
        <h3>Income</h3>
        <button type="button" className="primaryButton" onClick={() => { setEditingIncome(null); setIncomeDialogOpen(true); }}><Plus size={16} aria-hidden="true" /> Add income</button>
      </header>
      <div className="financial-module-toolbar">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search income" aria-label="Search income" />
        <DropdownSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter income type">
          <option value="all">All types</option>
          {incomeTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </DropdownSelect>
        <SortControl field={incomeSort} direction={incomeSortDirection} onFieldChange={setIncomeSort} onToggleDirection={toggleIncomeSortDirection} options={[{ value: 'date', label: 'Date' }, { value: 'amount', label: 'Amount' }, { value: 'name', label: 'Name' }]} label="Sort income" />
      </div>
      <section className="financial-module-history" aria-label="Income history">
        {loading ? <LoadingSkeleton rows={3} variant="financial" label="Loading income" /> : error === 'Unable to load incomes.' ? <div className="financial-load-error" role="alert"><span>Income couldn’t be loaded.</span><button type="button" className="settings-secondary-button" onClick={() => loadIncomes(user?.uid, isGuest)}>Try again</button></div> : <IncomeList incomes={filteredIncomes} onEdit={handleEdit} onDelete={(income) => setPendingDeleteIncome(income)} />}
      </section>

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
