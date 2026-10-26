// Single financial workspace. Existing Firestore and guest collections remain unchanged.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useEventStore from '../store/useEventStore';
import useTransactionManager from '../hooks/useTransactionManager';
import usePersistentListState from '../hooks/usePersistentListState';
import useConditionFilters from '../hooks/useConditionFilters';
import ConditionBuilder from '../components/common/ConditionBuilder';
import { filterTransactions, sortTransactions, summarizeTransactions, toTransactions, transactionMonthOptions } from '../utils/transactionFilters';
import TransactionHistory from '../components/financials/TransactionHistory';
import TransactionForm from '../components/financials/TransactionForm';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);

const defaultFilters = Object.freeze({ type: 'all', month: 'all', search: '' });
const filterRules = { type: ['all', 'income', 'expense'], month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value) };

export default function Financials() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const uid = user?.uid;
  const { incomes, loading: loadingIncome, error: incomeError, loadedFor: incomeScope, loadIncomes } = useIncomeStore();
  const { expenses, loading: loadingExpense, error: expenseError, loadedFor: expenseScope, loadExpenses } = useExpenseStore();
  const { events, loadEvents } = useEventStore();
  const { saveTransaction, removeTransaction } = useTransactionManager();
  const [filters, changeFilters] = usePersistentListState('transactions', defaultFilters, filterRules);
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
    loadEvents(uid, isGuest);
  }, [uid, isGuest, user, loadIncomes, loadExpenses, loadEvents]);

  const expectedScope = (isGuest ? 'guest' : 'user') + ':' + (uid || 'anonymous');
  // Never display transactions belonging to a previous signed-in user while
  // the new account's stores are still loading.
  const ready = incomeScope === expectedScope && expenseScope === expectedScope;
  const allTransactions = useMemo(
    () => ready ? toTransactions(incomes, expenses) : [],
    [ready, incomes, expenses],
  );
  const conditions = useConditionFilters('transactions', allTransactions);
  const monthOptions = useMemo(() => {
    const options = transactionMonthOptions(allTransactions);
    // Loading, deletion and a temporarily empty account must not erase a choice.
    if (filters.month !== 'all' && !options.some((item) => item.value === filters.month)) {
      const date = new Date(`${filters.month}-01T00:00:00`);
      options.unshift({ value: filters.month, label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        shortLabel: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) });
    }
    return options;
  }, [allTransactions, filters.month]);
  const filtered = useMemo(() => filterTransactions(allTransactions, filters).filter(conditions.matches), [allTransactions, filters, conditions.matches]);
  const sorted = useMemo(() => sortTransactions(filtered, 'date-desc'), [filtered]);
  // Summary is tied to the selected month, not list search or the type selector.
  // Selecting Expense must not artificially zero out the Income and Balance cards.
  const summary = useMemo(() => summarizeTransactions(
    filterTransactions(allTransactions, { month: filters.month }),
  ), [allTransactions, filters.month]);
  const summaryPeriod = filters.month === 'all' ? 'All months'
    : monthOptions.find((item) => item.value === filters.month)?.label || 'Selected month';
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

  const openAdd = (kind = 'expense') => {
    setEditing(null); setActivityPreset(null); setDefaultKind(kind); setSavingError(''); setDialogOpen(true);
  };
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
          <section className="dn-finance-summary" aria-label={`Financial totals for ${summaryPeriod}`}>
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
          <ConditionBuilder filter={conditions} resultCount={sorted.length} resultLabel="transactions" title="Transaction conditions" />
          <TransactionHistory transactions={sorted} filters={filters} onFilters={changeFilters}
            monthOptions={monthOptions} events={events} onAdd={() => openAdd()} onEdit={openEdit}
            onDelete={setDeleteTarget} />
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
