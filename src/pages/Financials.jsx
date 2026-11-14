// Single financial workspace. Existing Firestore and guest collections remain unchanged.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useScopedMoments from '../hooks/useScopedMoments';
import useTransactionManager from '../hooks/useTransactionManager';
import useExpensePlans from '../hooks/useExpensePlans';
import { getActiveSampleScenario } from '../dev/sampleData';
import { isFinancialViewReady } from '../utils/financialLoadScope';
import usePersistentListState from '../hooks/usePersistentListState';
import useListViewDefaults from '../hooks/useListViewDefaults';
import { matchesListDefaults } from '../utils/listViewDefaults';
import useConditionFilters from '../hooks/useConditionFilters';
import { transactionConditions } from '../utils/listConditionMigration';
import { filterTransactions, sortTransactions, summarizeTransactions, toTransactions } from '../utils/transactionFilters';
import { transactionsToCsv } from '../utils/transactionCsv';
import { downloadBlob } from '../utils/download';
import { TRANSACTION_SORT_VALUES } from '../utils/userListSort';
import TransactionHistory from '../components/financials/TransactionHistory';
import TransactionForm from '../components/financials/TransactionForm';
import ExpensePlans from '../components/financials/ExpensePlans';
import { changeExpensePlanDate } from '../services/expensePlanService';
import { scopedRecordActions as records } from '../services/scopedRecordActions';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);

const filterRules = { type: ['all', 'income', 'expense'], month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value), sort: TRANSACTION_SORT_VALUES };

function FinancialsContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const uid = user?.uid;
  const sample = getActiveSampleScenario(uid);
  const incomeState = useIncomeStore();
  const expenseState = useExpenseStore();
  const { incomes, loading: loadingIncome, error: incomeError, loadIncomes } = incomeState;
  const { expenses, loading: loadingExpense, error: expenseError, loadExpenses } = expenseState;
  const { events } = useScopedMoments();
  const { saveTransaction, removeTransaction } = useTransactionManager();
  const { plans, loadError: planLoadError, retry: retryPlans } = useExpensePlans(uid, isGuest, sample);
  const settingsDefaults = useListViewDefaults('transactions');
  const [filters, changeFilters, resetFilters] = usePersistentListState('transactions', settingsDefaults.filters, filterRules);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState('expense');
  const [activityPreset, setActivityPreset] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savingError, setSavingError] = useState('');
  const [planEditor, setPlanEditor] = useState(null);
  const [planAction, setPlanAction] = useState('');
  const savingPlanRef = useRef(false);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadIncomes(uid, isGuest);
    loadExpenses(uid, isGuest);
  }, [uid, isGuest, sample, loadIncomes, loadExpenses]);

  const expectedScope = (isGuest ? 'guest' : 'user') + ':' + (uid || 'anonymous');
  // Both ledgers must belong to this account AND this isolated Guest scenario.
  // A matching old loadedFor alone can expose a previous sample's totals.
  const ready = isFinancialViewReady(incomeState, expenseState, expectedScope, sample);
  const allTransactions = useMemo(
    () => ready ? toTransactions(incomes, expenses) : [],
    [ready, incomes, expenses],
  );
  const conditions = useConditionFilters('transactions', allTransactions, usePersistentListState, {
    initialGroup: transactionConditions(filters), moments: events,
    startingGroup: Object.keys(settingsDefaults.filters).every((key) => filters[key] === settingsDefaults.filters[key]) ? settingsDefaults.group : undefined,
  });
  const canResetFilters = !matchesListDefaults(filters, settingsDefaults.filters, conditions.state.group, settingsDefaults.group);
  const restoreSavedFilters = () => { resetFilters(); conditions.restore(settingsDefaults.group); };
  const searchCandidates = useMemo(() => filterTransactions(allTransactions, { search: filters.search }), [allTransactions, filters.search]);
  const filtered = useMemo(() => searchCandidates.filter(conditions.matches), [searchCandidates, conditions.matches]);
  const sorted = useMemo(() => sortTransactions(filtered, filters.sort), [filtered, filters.sort]);
  // Cards and rows always describe the same cohort, including search and OR groups.
  const summary = useMemo(() => summarizeTransactions(filtered), [filtered]);
  const hasLoadError = Boolean(incomeError || expenseError);
  const exportVisibleTransactions = () => {
    if (!ready || hasLoadError || loadingIncome || loadingExpense || !sorted.length) return;
    try {
      const date = new Date();
      const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')].join('-');
      downloadBlob(new Blob([transactionsToCsv(sorted, events)], { type: 'text/csv;charset=utf-8' }),
        `dn-transactions-filtered-${stamp}.csv`);
      showToast(`Exported ${sorted.length} matching transaction${sorted.length === 1 ? '' : 's'}`, 'success');
    } catch {
      showToast('Could not export these transactions. Try again.', 'danger');
    }
  };

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
    if (savingPlanRef.current || busy) return;
    savingPlanRef.current = true;
    setBusy(true); setSavingError('');
    try {
      const saved = await saveTransaction(form, editing);
      setDialogOpen(false); setEditing(null);
      showToast(saved.plan ? 'Expense plan saved' : editing ? 'Transaction updated' : 'Transaction added', 'success');
      if (saved.plan) navigate('/financials/transactions#expense-plans', { replace: true });
    } catch (error) {
      setSavingError(error?.message || 'Unable to save this transaction.');
      throw error;
    } finally { savingPlanRef.current = false; setBusy(false); }
  };
  const openPlan = (plan, mode) => {
    setPlanAction('');
    setSavingError('');
    setPlanEditor({ plan, mode, context: records.capture() });
  };
  const closePlan = () => {
    if (savingPlanRef.current) return;
    setPlanEditor(null); setPlanAction(''); setSavingError('');
  };
  const runPlan = async (action, message) => {
    if (savingPlanRef.current || !planEditor) return;
    const assertCurrent = () => {
      if (!records.isCurrent(planEditor.context)) throw new Error('Your session changed. Reopen the expense plan.');
    };
    savingPlanRef.current = true;
    setBusy(true); setSavingError('');
    try {
      assertCurrent();
      await action(assertCurrent);
      assertCurrent();
      setPlanEditor(null); setPlanAction('');
      showToast(message, 'success');
    } catch (error) {
      setSavingError(error?.message || 'Could not save the expense plan. Try again.');
    } finally {
      savingPlanRef.current = false;
      setBusy(false);
    }
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
    <div className="financials-page feature-page dn-financial-workspace">
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
          {planLoadError ? <div role="alert" className="financial-load-error">Unable to load expense plans.{' '}
            <button type="button" onClick={retryPlans}>Retry plans</button>
          </div> : <ExpensePlans plans={plans} busy={busy} openFromLink={location.hash === '#expense-plans'}
            onRecord={(plan) => openPlan(plan, 'payment')} onEdit={(plan) => openPlan(plan, 'edit')} />}
          <TransactionHistory transactions={sorted} candidates={searchCandidates} totalCount={allTransactions.length} filters={filters} onFilters={changeFilters} conditions={conditions}
            onResetDefaults={restoreSavedFilters} canResetDefaults={canResetFilters} savedDefaults={settingsDefaults}
            events={events} onEdit={openEdit} onDelete={setDeleteTarget} onExport={exportVisibleTransactions} />
        </section>}
      {dialogOpen ? (
        <ModalDialog title={editing ? 'Edit Transaction' : 'Add Transaction'} className="dn-transaction-dialog"
          onClose={() => { if (!savingPlanRef.current && !busy) { setDialogOpen(false); setEditing(null); } }}>
          {savingError ? <p className="dn-transaction-form-error" role="alert">{savingError}</p> : null}
          <TransactionForm initialTransaction={editing} defaultKind={defaultKind} presetLink={activityPreset} events={events}
            onSubmit={handleSave} busy={busy} onCancel={() => { setDialogOpen(false); setEditing(null); }} />
        </ModalDialog>
      ) : null}
      {planEditor && !planAction ? <ModalDialog title={planEditor.mode === 'edit' ? 'Edit expense plan' : 'Record payment'}
        className="dn-transaction-dialog" onClose={closePlan}>
        {savingError ? <p className="dn-transaction-form-error" role="alert">{savingError}</p> : null}
        <TransactionForm key={planEditor.plan.id + planEditor.mode} expensePlan={planEditor.mode === 'edit' ? planEditor.plan : null}
          paymentPlan={planEditor.mode === 'payment' ? planEditor.plan : null} busy={busy} events={events} onCancel={closePlan}
          onSubmit={(form) => runPlan(() => saveTransaction(form, null, planEditor.mode === 'edit'
            ? { expensePlan: planEditor.plan } : { paymentPlan: planEditor.plan }),
          planEditor.mode === 'edit' ? 'Expense plan saved' : 'Payment recorded. Next expense scheduled.')} />
        {planEditor.mode === 'edit' ? <div className="dn-expense-plan-actions" role="group" aria-label="Expense plan actions">
          <button type="button" disabled={busy} onClick={() => setPlanAction('skip')}>Skip this occurrence</button>
          <button type="button" disabled={busy} onClick={() => setPlanAction('end')}>End repeat</button>
        </div> : null}
      </ModalDialog> : null}
      {planEditor && planAction ? <ConfirmDialog title={planAction === 'skip' ? 'Skip this expense?' : 'End this expense plan?'}
        message={planAction === 'skip' ? 'DN will move to the next scheduled date.' : 'This ends future repeats and keeps recorded payments.'}
        confirmLabel={planAction === 'skip' ? 'Skip occurrence' : 'End repeat'} busy={busy} error={savingError}
        onCancel={() => { if (!busy) { setPlanAction(''); setSavingError(''); } }}
        onConfirm={() => runPlan((assertCurrent) => changeExpensePlanDate(planEditor.context, planEditor.plan, planAction, assertCurrent),
          planAction === 'skip' ? 'Expense skipped. Next occurrence scheduled.' : 'Expense plan ended')} /> : null}
      {deleteTarget ? <ConfirmDialog title="Delete transaction?"
        message={'Delete “' + (deleteTarget.name || deleteTarget.title || 'this transaction') + '”? This cannot be undone.'}
        onConfirm={handleDelete} onCancel={() => { if (!busy) setDeleteTarget(null); }}
        confirmLabel={busy ? 'Deleting…' : 'Delete'} /> : null}
    </div>
  );
}

 
// A new account or Guest sample must never inherit an existing account's
// edit/delete dialogs, mutation drafts or quick-create prefilled links.
export default function Financials() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const sample = getActiveSampleScenario(user?.uid);
  const identity = JSON.stringify([isGuest ? 'guest' : 'user', user?.uid || null, sample]);
  return <FinancialsContent key={identity} />;
}
