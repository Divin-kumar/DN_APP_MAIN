// Single financial workspace. Existing Firestore and guest collections remain unchanged.
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Plus, WalletCards, ArrowLeftRight } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useEventStore from '../store/useEventStore';
import useTransactionManager from '../hooks/useTransactionManager';
import { filterTransactions, sortTransactions, summarizeTransactions, toTransactions, transactionMonthOptions } from '../utils/transactionFilters';
import TransactionHistory, { TransactionCard } from '../components/financials/TransactionHistory';
import TransactionForm from '../components/financials/TransactionForm';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);
const defaultFilters = { type: 'all', month: 'all', search: '', sort: 'date-desc' };
const storageKey = (scope) => 'dn_transactions_filters_' + scope;
const readFilters = (scope) => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey(scope)) || '{}');
    return {
      type: ['all', 'income', 'expense'].includes(parsed.type) ? parsed.type : 'all',
      month: parsed.month === 'all' || /^\d{4}-\d{2}$/.test(parsed.month || '') ? parsed.month : 'all',
      search: typeof parsed.search === 'string' ? parsed.search : '',
      sort: ['date-desc', 'date-asc', 'amount-asc', 'amount-desc', 'title-asc'].includes(parsed.sort) ? parsed.sort : 'date-desc',
    };
  } catch { return { ...defaultFilters }; }
};

export default function Financials() {
  const location = useLocation();
  const navigate = useNavigate();
  const isTransactions = location.pathname.startsWith('/financials/transactions');
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const uid = user?.uid;
  const scope = uid || (isGuest ? 'guest' : 'local');
  const { incomes, loading: loadingIncome, error: incomeError, loadedFor: incomeScope, loadIncomes } = useIncomeStore();
  const { expenses, loading: loadingExpense, error: expenseError, loadedFor: expenseScope, loadExpenses } = useExpenseStore();
  const { events, loadEvents } = useEventStore();
  const { saveTransaction, removeTransaction } = useTransactionManager();
  const [filters, setFilters] = useState(() => readFilters(scope));
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

  useEffect(() => { setFilters(readFilters(scope)); }, [scope]);
  const changeFilters = (patch) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      try { sessionStorage.setItem(storageKey(scope), JSON.stringify(next)); } catch { /* Optional persistence */ }
      return next;
    });
  };

  const expectedScope = (isGuest ? 'guest' : 'user') + ':' + (uid || 'anonymous');
  // Never display transactions belonging to a previous signed-in user while
  // the new account's stores are still loading.
  const ready = incomeScope === expectedScope && expenseScope === expectedScope;
  const allTransactions = useMemo(
    () => ready ? toTransactions(incomes, expenses) : [],
    [ready, incomes, expenses],
  );
  const monthOptions = useMemo(() => transactionMonthOptions(allTransactions), [allTransactions]);
  useEffect(() => {
    // Keep a saved month across reloads until BOTH store loads have completed.
    if (!ready || filters.month === 'all') return;
    if (!monthOptions.some((item) => item.value === filters.month)) {
      changeFilters({ month: 'all' });
    }
  }, [ready, filters.month, monthOptions]);
  const filtered = useMemo(() => filterTransactions(allTransactions, filters), [allTransactions, filters]);
  const sorted = useMemo(() => sortTransactions(filtered, filters.sort), [filtered, filters.sort]);
  const totals = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const hasLoadError = Boolean(incomeError || expenseError);

  useEffect(() => {
    if (!isTransactions) return;
    const requested = new URLSearchParams(location.search).get('create');
    if (requested !== 'expense' && requested !== 'income' && requested !== 'transaction') return;
    setDefaultKind(requested === 'income' ? 'income' : 'expense');
    const params = new URLSearchParams(location.search);
    const eventId = params.get('event');
    const activityId = params.get('activity');
    setActivityPreset(eventId && activityId ? { eventId, activityId } : null);
    setEditing(null);
    setDialogOpen(true);
    navigate('/financials/transactions', { replace: true });
  }, [isTransactions, location.search, navigate]);

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
      <section className="financial-overview-summary" aria-label="Filtered income, expense and balance summary">
        <div><span>Income</span><strong>{formatMoney(totals.income)}</strong></div>
        <div><span>Expense</span><strong>{formatMoney(totals.expense)}</strong></div>
        <div className={'financial-overview-balance' + (totals.balance < 0 ? ' is-negative' : '')}>
          <span>Balance</span><strong>{formatMoney(totals.balance)}</strong>
        </div>
      </section>
      <nav className="financials-nav dn-financial-tabs" aria-label="Financial views">
        <NavLink to="/financials" end className={({ isActive }) => 'financials-nav-card' + (isActive ? ' financials-nav-card-active' : '')}>
          <WalletCards size={17} aria-hidden="true" /><strong>Overview</strong>
        </NavLink>
        <NavLink to="/financials/transactions" className={({ isActive }) => 'financials-nav-card' + (isActive ? ' financials-nav-card-active' : '')}>
          <ArrowLeftRight size={17} aria-hidden="true" /><strong>Transactions</strong>
        </NavLink>
      </nav>
      {hasLoadError ? <div role="alert" className="financial-load-error">
        Unable to load all transactions. <button type="button" onClick={() => { loadIncomes(uid, isGuest); loadExpenses(uid, isGuest); }}>Retry</button>
      </div> : null}
      {(!ready || loadingIncome || loadingExpense) && !allTransactions.length ? <LoadingSkeleton rows={4} variant="financial" label="Loading transactions" /> : null}
      <section className="financials-content-panel">
        {isTransactions ? (
          <TransactionHistory transactions={sorted} filters={filters} onFilters={changeFilters}
            monthOptions={monthOptions} events={events} onAdd={() => openAdd()} onEdit={openEdit}
            onDelete={setDeleteTarget} />
        ) : (
          <section className="dn-financial-overview" aria-labelledby="dn-overview-title">
            <div className="dn-overview-topline">
              <div><h2 id="dn-overview-title">Your money at a glance</h2>
                <p>{filters.month === 'all' ? 'All months' : monthOptions.find((o) => o.value === filters.month)?.label || 'Filtered month'}
                  {filters.type !== 'all' ? ' · ' + (filters.type === 'income' ? 'Income' : 'Expense') + ' only' : ''}</p>
              </div>
              <button type="button" className="primaryButton dn-transaction-add" onClick={() => openAdd()}>
                <Plus size={17} /> Add Transaction
              </button>
            </div>
            <div className="dn-overview-recent-heading">
              <h3>Recent transactions</h3>
              <Link to="/financials/transactions">View all transactions</Link>
            </div>
            <div className="dn-transactions-results" role="list">
              {sorted.length ? sorted.slice(0, 5).map((item) => (
                <TransactionCard key={item.stableTransactionKey} transaction={item} events={events} compact />
              )) : <div className="transactions-empty" role="status">
                <strong>No matching transactions</strong>
                <p>Adjust the filters in Transactions or add your first record.</p>
              </div>}
            </div>
          </section>
        )}
      </section>
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
