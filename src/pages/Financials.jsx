// Single financial workspace. Existing Firestore and guest collections remain unchanged.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useScopedMoments from '../hooks/useScopedMoments';
import useTransactionManager from '../hooks/useTransactionManager';
import usePersistentListState from '../hooks/usePersistentListState';
import useListViewDefaults from '../hooks/useListViewDefaults';
import { matchesListDefaults } from '../utils/listViewDefaults';
import useConditionFilters from '../hooks/useConditionFilters';
import { transactionConditions } from '../utils/listConditionMigration';
import { filterTransactions, sortTransactions, summarizeTransactions, toTransactions } from '../utils/transactionFilters';
import { TRANSACTION_SORT_VALUES } from '../utils/userListSort';
import TransactionHistory from '../components/financials/TransactionHistory';
import TransactionForm from '../components/financials/TransactionForm';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);

const defaultFilters = Object.freeze({ type: 'all', month: 'all', search: '', sort: 'date-desc' });
const filterRules = { type: ['all', 'income', 'expense'], month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value), sort: TRANSACTION_SORT_VALUES };

export default function Financials() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const uid = user?.uid;
  const { incomes, loading: loadingIncome, error: incomeError, loadedFor: incomeScope, loadIncomes } = useIncomeStore();
  const { expenses, loading: loadingExpense, error: expenseError, loadedFor: expenseScope, loadExpenses } = useExpenseStore();
  const { events } = useScopedMoments();
  const { saveTransaction, removeTransaction } = useTransactionManager();
  const settingsDefaults = useListViewDefaults('transactions');
  const [filters, changeFilters, resetFilters] = usePersistentListState('transactions', settingsDefaults.filters, filterRules);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState('expense');
  const [activityPreset, setActivityPreset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savingError, setSavingError] = useState('');

  useEffect(() => {
    if (!user && !isGuest) return;
    loadIncomes(uid, isGuest);
    loadExpenses(uid, isGuest);
  }, [uid, isGuest, user, loadIncomes, loadExpenses]);

  const expectedScope = (isGuest ? 'guest' : 'user') + ':' + (uid || 'anonymous');
  // Never display transactions belonging to a previous signed-in user while
  // the new account's stores are still loading.
  const ready = incomeScope === expectedScope && expenseScope === expectedScope;
  const allTransactions = useMemo(
    () => ready ? toTransactions(incomes, expenses) : [],
    [ready, incomes, expenses],
  );
  const conditions = useConditionFilters('transactions', allTransactions, usePersistentListState, { initialGroup: transactionConditions(filters), moments: events });
  const canResetFilters = !matchesListDefaults(filters, settingsDefaults.filters, conditions.state.group, settingsDefaults.group);
  const restoreSavedFilters = () => { resetFilters(); conditions.restore(settingsDefaults.group); };
  const filtered = useMemo(() => filterTransactions(allTransactions, { search: filters.search }).filter(conditions.matches), [allTransactions, filters, conditions.matches]);
  const sorted = useMemo(() => sortTransactions(filtered, filters.sort), [filtered, filters.sort]);
  // Cards and rows always describe the same cohort, including search and OR groups.
  const summary = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const hasLoadError = Boolean(incomeError || expenseError);

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('create');
    if (requested !== 'expense' && requested !== 'income' && requested !== 'transaction') return;
    setDefaultKind(requested === 'income' ? 'income' : 'expense');
    const params = new URLSearchParams(location.search);
    const eventId = params.get('event');
    const activityId = params.get('activity');
    setActivityPreset(eventId ? { eventId, activityId: activityId || '' } : null);
    setEditing(null);
    setDialogOpen(true);
    navigate('/financials/transactions', { replace: true });
  }, [location.search, navigate]);

  const openEdit = (transaction) => {
    setEditing(transaction); setActivityPreset(null); setDefaultKind(transaction.transactionKind);
    setSavingError(''); setDialogOpen(true);
  };
  const handleSave = async (form) => {
    setBusy(true); setSavingError('');
    try {
      await saveTransaction(form, editing);
      setDialogOpen(false); setEditing(null);
      showToast(editing ? 'Transaction updated' : 'Transaction added', 'success');
    } catch (error) {
      setSavingError(error?.message || 'Unable to save this transaction.');
      throw error;
    } finally { setBusy(false); }
  };
  const handleDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await removeTransaction(deleteTarget);
      setDeleteTarget(null);
      showToast('Transaction deleted', 'success');
    } catch (error) {
      showToast(error?.message || 'Could not delete this transaction', 'danger');
    } finally { setBusy(false); }
  };

  return (
    <main className="financials-page feature-page dn-financial-workspace">
      {hasLoadError ? <div role="alert" className="financial-load-error">
        Unable to load all transactions. <button type="button" onClick={() => { loadIncomes(uid, isGuest); loadExpenses(uid, isGuest); }}>Retry</button>
      </div> : null}
      {hasLoadError ? null : (!ready || loadingIncome || loadingExpense)
        ? <LoadingSkeleton rows={4} variant="financial" label="Loading transactions" />
        : <section className="financials-content-panel">
          <section className="dn-finance-summary" aria-label="Financial totals for matching transactions">
            <span className="moment-finance-caption">Matching transactions</span>
            <div className="dn-finance-summary-grid">
              <div className="dn-finance-metric dn-finance-metric-income">
                <span className="dn-finance-metric-heading"><ArrowDownLeft size={18} aria-hidden="true" /> Income</span>
                <strong>{formatMoney(summary.income)}</strong>
              </div>
              <div className="dn-finance-metric dn-finance-metric-expense">
                <span className="dn-finance-metric-heading"><ArrowUpRight size={18} aria-hidden="true" /> Expense</span>
                <strong>{formatMoney(summary.expense)}</strong>
              </div>
              <div className={`dn-finance-metric dn-finance-metric-balance${summary.balance < 0 ? ' is-negative' : ''}`}>
                <span className="dn-finance-metric-heading"><Wallet size={18} aria-hidden="true" /> Balance</span>
                <strong>{formatMoney(summary.balance)}</strong>
              </div>
            </div>
          </section>
          <TransactionHistory transactions={sorted} totalCount={allTransactions.length} filters={filters} onFilters={changeFilters} conditions={conditions}
            onResetDefaults={restoreSavedFilters} canResetDefaults={canResetFilters}
            events={events} onEdit={openEdit} onDelete={setDeleteTarget} />
        </section>}
      {dialogOpen ? (
        <ModalDialog title={editing ? 'Edit Transaction' : 'Add Transaction'} className="dn-transaction-dialog"
          onClose={() => { if (!busy) { setDialogOpen(false); setEditing(null); } }}>
          {savingError ? <p className="dn-transaction-form-error" role="alert">{savingError}</p> : null}
          <TransactionForm initialTransaction={editing} defaultKind={defaultKind} presetLink={activityPreset} events={events}
            onSubmit={handleSave} busy={busy} onCancel={() => { setDialogOpen(false); setEditing(null); }} />
        </ModalDialog>
      ) : null}
      {deleteTarget ? <ConfirmDialog title="Delete transaction?"
        message={'Delete “' + (deleteTarget.name || deleteTarget.title || 'this transaction') + '”? This cannot be undone.'}
        onConfirm={handleDelete} onCancel={() => { if (!busy) setDeleteTarget(null); }}
        confirmLabel={busy ? 'Deleting…' : 'Delete'} /> : null}
    </main>
  );
}
