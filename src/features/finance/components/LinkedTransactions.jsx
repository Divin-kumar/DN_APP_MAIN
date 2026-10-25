import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Link2 } from 'lucide-react';
import useMomentFinance from '../../../hooks/useMomentFinance';
import usePersistentListState from '../../../hooks/usePersistentListState';
import useTransactionManager from '../../../hooks/useTransactionManager';
import useAppStore from '../../../store/useAppStore';
import useIncomeStore from '../../../store/useIncomeStore';
import useExpenseStore from '../../../store/useExpenseStore';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import DropdownSelect from '../../../components/common/DropdownSelect';
import ListControls from '../../../components/common/ListControls';
import TransactionForm from '../../../components/financials/TransactionForm';
import { TransactionCard, formatTransactionMoney as momentMoney } from '../../../components/financials/TransactionHistory';
import { filterTransactions, transactionMonthOptions } from '../../../utils/transactionFilters';
import { recordId } from '../../../utils/recordIdentity';
import { sameRecord } from '../../../utils/transactionRelations';
import { scopedRecordActions as records } from '../../../services/scopedRecordActions';
import { isRecordScopeLoaded } from '../../../utils/scopedRecordActions';

const DEFAULTS = Object.freeze({ search: '', type: 'all', activityId: '', month: 'all' });
const RULES = Object.freeze({ type: ['all', 'income', 'expense'], month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value) });

export function MomentFinanceSummary({ summary, label = 'Totals for this Moment' }) {
  return <div className="moment-finance-summary" role="group" aria-label={label}>
    <span className="moment-finance-caption">{label}</span>
    <dl><div><dt>Income</dt><dd>{momentMoney(summary.income)}</dd></div>
      <div><dt>Expense</dt><dd>{momentMoney(summary.expense)}</dd></div>
      <div><dt>Balance</dt><dd>{momentMoney(summary.balance)}</dd></div></dl>
  </div>;
}

// One contextual finance surface for a Moment or one of its activities. Forms
// and mutations stay on the current route, with no copied ledger or totals.
export default function LinkedTransactions({ eventId, activityId = '', date = '' }) {
  const finance = useMomentFinance(eventId, activityId);
  const { saveTransaction, removeTransaction } = useTransactionManager();
  const showToast = useAppStore((state) => state.showToast);
  const [filters, changeFilters, resetFilters] = usePersistentListState(
    `moment-transactions:${JSON.stringify([finance.sample, eventId, activityId])}`, DEFAULTS, RULES);
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const context = records.capture();
  const moment = finance.events.find((item) => recordId(item.id || item.firestoreId) === eventId);
  const activities = moment?.activities || [];
  const months = transactionMonthOptions(finance.transactions);
  const monthOptions = filters.month !== 'all' && !months.some((item) => item.value === filters.month)
    ? [{ value: filters.month, label: `${filters.month} (no records)` }, ...months] : months;
  const selectedActivityAvailable = activities.some((item) => recordId(item.id) === filters.activityId);
  const filtered = filterTransactions(finance.transactions, activityId ? {} : filters)
    .filter((item) => activityId || !filters.activityId || (selectedActivityAvailable && item.activityId === filters.activityId));
  const resolve = () => {
    const latest = records.resolveMoment(context, eventId);
    if (activityId) records.resolveActivity(context, eventId, activityId);
    return latest;
  };
  const run = async (operation, after) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      resolve(); await operation();
      if (mounted.current && records.isCurrent(context)) after?.();
    } catch (reason) {
      if (mounted.current && records.isCurrent(context)) setError(reason?.message || 'Could not save this transaction. Please try again.');
      throw reason;
    } finally { saving.current = false; if (mounted.current && records.isCurrent(context)) setBusy(false); }
  };
  const close = () => { if (!saving.current) { setDialog(null); setDeleteTarget(null); setLinking(false); setError(''); } };
  const openAdd = () => {
    if (saving.current) return;
    try { resolve(); setError(''); setLinking(false); setDialog({ preset: { eventId, activityId, date } }); }
    catch (reason) { setError(reason.message); }
  };
  const latestTransaction = (item) => {
    const store = item.transactionKind === 'income' ? useIncomeStore.getState() : useExpenseStore.getState();
    if (!isRecordScopeLoaded(store, context.scope, context.sample)) throw new Error('Transactions are still loading. Please retry.');
    const latest = store[item.transactionKind === 'income' ? 'incomes' : 'expenses'].find((entry) => sameRecord(entry, item));
    // A nested-only projection may not yet have a ledger-store entry.
    const nested = !latest && finance.transactions.find((entry) => entry.stableTransactionKey === item.stableTransactionKey);
    if (!latest && !nested) throw new Error('This transaction is no longer available.');
    return { ...(latest || nested), transactionKind: item.transactionKind };
  };
  const openEdit = (item) => {
    if (saving.current) return;
    try { resolve(); setDialog({ original: latestTransaction(item) }); setError(''); }
    catch (reason) { setError(reason.message); }
  };
  const expenseState = useExpenseStore();
  const linkable = isRecordScopeLoaded(expenseState, context.scope, context.sample) ? expenseState.expenses
    .filter((expense) => !expense.activityId && (!expense.eventId || recordId(expense.eventId) === eventId)) : [];
  const linkExpense = (item) => run(async () => {
    const original = latestTransaction({ ...item, transactionKind: 'expense' });
    if (original.activityId || (original.eventId && recordId(original.eventId) !== eventId)) throw new Error('This expense is no longer available to link.');
    await saveTransaction({ transactionKind: 'expense', title: original.name || 'Expense', amount: original.amount,
      category: original.category || 'Other', date: original.date, notes: original.notes || original.description || '', eventId, activityId }, original);
  }, () => { setLinking(false); showToast('Transaction linked to activity', 'success'); }).catch(() => {});

  return <div className="moment-transactions">
    {finance.error ? <div className="financial-load-error" role="alert"><span>Transactions couldn’t be loaded.</span>
      <button type="button" className="secondaryButton" onClick={finance.retry}>Try again</button></div>
      : finance.pending ? <LoadingSkeleton rows={3} label="Loading linked transactions" /> : <>
        <MomentFinanceSummary summary={finance.summary} label={activityId ? 'Totals for this Activity' : 'Totals for this Moment'} />
        <div className="moment-transactions-heading"><h3>Transaction history</h3>
          <button type="button" className="secondaryButton" onClick={openAdd}><Plus size={15} aria-hidden="true" /> Add transaction</button></div>
        {activityId ? <button type="button" className="moment-text-action" onClick={() => { setLinking(true); setError(''); }}><Link2 size={14} aria-hidden="true" /> Link existing expense</button> : null}
        {!activityId && finance.transactions.length ? <ListControls title="Moment transaction filters" resultCount={filtered.length} resultLabel="transactions"
          activeCount={Number(Boolean(filters.search)) + Number(filters.type !== 'all') + Number(Boolean(filters.activityId)) + Number(filters.month !== 'all')}
          summary={[filters.type === 'all' ? 'Income + expense' : filters.type === 'income' ? 'Income' : 'Expense',
            filters.activityId ? activities.find((item) => recordId(item.id) === filters.activityId)?.title || 'Saved activity (unavailable)' : 'All Activities',
            filters.month === 'all' ? 'All months' : filters.month].join(' · ')} onReset={resetFilters}
          search={<input type="search" aria-label="Search Moment transactions" placeholder="Search transactions" value={filters.search} onChange={(event) => changeFilters({ search: event.target.value })} />}>
          <div className="dn-list-controls-field"><label htmlFor="moment-transaction-type">Type</label><DropdownSelect id="moment-transaction-type" value={filters.type} onChange={(event) => changeFilters({ type: event.target.value })}>
            <option value="all">All</option><option value="income">Income</option><option value="expense">Expense</option></DropdownSelect></div>
          <div className="dn-list-controls-field"><label htmlFor="moment-transaction-activity">Activity</label><DropdownSelect id="moment-transaction-activity" value={filters.activityId} onChange={(event) => changeFilters({ activityId: event.target.value })}>
            <option value="">All Activities</option>{filters.activityId && !activities.some((item) => recordId(item.id) === filters.activityId) ? <option value={filters.activityId}>Saved activity (unavailable)</option> : null}
            {activities.map((item) => <option key={item.id} value={recordId(item.id)}>{item.title || 'Untitled activity'}</option>)}</DropdownSelect></div>
          {monthOptions.length > 1 || filters.month !== 'all' ? <div className="dn-list-controls-field"><label htmlFor="moment-transaction-month">Month</label><DropdownSelect id="moment-transaction-month" value={filters.month} onChange={(event) => changeFilters({ month: event.target.value })}>
            <option value="all">All months</option>{monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</DropdownSelect></div> : null}
        </ListControls> : null}
        <div className="dn-transactions-results" role="list" aria-label="Linked transactions">
          {filtered.length ? filtered.map((item) => <TransactionCard key={item.stableTransactionKey} transaction={item} events={finance.events}
            onOpen={openEdit} showActivity onEdit={openEdit} onDelete={(target) => { setDeleteTarget(target); setError(''); }} />)
            : <p className="moment-empty-state">{finance.transactions.length ? 'No transactions match these filters.' : activityId ? 'No transactions have been recorded for this Activity.' : 'No transactions have been recorded for this Moment.'}</p>}
        </div>
      </>}
    {error && !dialog && !deleteTarget && !linking ? <p className="quick-create-error" role="alert">{error}</p> : null}
    {dialog ? <ModalDialog title={dialog.original ? 'Edit Transaction' : 'Add Transaction'} className="dn-transaction-dialog" onClose={close}>
      {error ? <p className="dn-transaction-form-error" role="alert">{error}</p> : null}
      <TransactionForm initialTransaction={dialog.original} presetLink={dialog.preset} events={finance.events} busy={busy} onCancel={close}
        onSubmit={(form) => run(() => saveTransaction(form, dialog.original ? latestTransaction(dialog.original) : null), () => { setDialog(null); showToast('Transaction saved', 'success'); })} />
    </ModalDialog> : null}
    {deleteTarget ? <ConfirmDialog title="Delete transaction?" message="Delete this transaction and its linked expense mirror? This cannot be undone."
      busy={busy} error={error} onCancel={close} onConfirm={() => run(() => removeTransaction(latestTransaction(deleteTarget)), () => setDeleteTarget(null)).catch(() => {})} /> : null}
    {linking ? <ModalDialog title="Link existing expense" onClose={close}>
      {error ? <p className="quick-create-error" role="alert">{error}</p> : null}
      {linkable.length ? <div className="activity-expense-link-list">{linkable.map((item) => <button type="button" className="activity-expense-link-option" disabled={busy} key={item.id} onClick={() => linkExpense(item)}>
        <span>{item.name || 'Expense'}</span><b>{momentMoney(item.amount)}</b></button>)}</div> : <p>No unlinked expenses are available.</p>}
      <button type="button" className="moment-text-action" disabled={busy} onClick={openAdd}>Add transaction</button>
    </ModalDialog> : null}
    {activityId ? <Link className="moment-text-action" to={`/events/${encodeURIComponent(eventId)}/transactions`}>All Moment transactions</Link> : null}
  </div>;
}
