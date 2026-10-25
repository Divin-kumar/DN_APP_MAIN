import { useEffect, useMemo, useState } from 'react';
import useScopedMoments from './useScopedMoments';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import { isRecordScopeLoaded } from '../utils/scopedRecordActions';
import { projectMomentTransactions } from '../utils/momentTransactions';
import { summarizeTransactions } from '../utils/transactionFilters';
import { getGuestExpenseMasters } from '../services/expenseService';
import { requireActiveSampleData } from '../dev/sampleData';
import { recordId } from '../utils/recordIdentity';

export default function useMomentFinance(eventId, activityId = '') {
  const moments = useScopedMoments();
  const income = useIncomeStore();
  const expense = useExpenseStore();
  const { uid, isGuest, sample, scope } = moments;
  const [projectionRevision, setProjectionRevision] = useState(0);
  const { loadIncomes } = income;
  const { loadExpenses } = expense;
  useEffect(() => {
    if (uid || isGuest) { loadIncomes(uid, isGuest); loadExpenses(uid, isGuest); }
  }, [uid, isGuest, sample, loadIncomes, loadExpenses]);
  const ready = moments.ready && isRecordScopeLoaded(income, scope, sample) && isRecordScopeLoaded(expense, scope, sample);
  const projection = useMemo(() => {
    if (!ready) return { transactions: [], reason: null };
    try {
      // The expense store also caches nested projections. Rebuild that final
      // tier from live Moments so deleting a child cannot retain a ghost cost;
      // standalone Guest/Sample masters must still survive child deletion.
      const ledger = sample ? requireActiveSampleData(uid).expenses : isGuest ? getGuestExpenseMasters()
        : expense.expenses.filter((item) => item.firestoreId || item.firestoreSources?.length
          || expense.pendingCreateIds?.includes(recordId(item.id)));
      return { transactions: projectMomentTransactions(moments.events, income.incomes, ledger, eventId)
        .filter((item) => !activityId || item.activityId === activityId), reason: null };
    } catch (reason) { return { transactions: [], reason }; }
  }, [ready, moments.events, income.incomes, expense.expenses, expense.pendingCreateIds, eventId, activityId, uid, isGuest, sample, projectionRevision]);
  const { transactions } = projection;
  useEffect(() => { if (projection.reason) console.error('Unable to project linked transactions:', projection.reason); }, [projection.reason]);
  const summary = useMemo(() => summarizeTransactions(transactions), [transactions]);
  const error = Boolean(projection.reason) || (income.activeLoadKey === scope && income.error === 'Unable to load incomes.')
    || (expense.activeLoadKey === scope && expense.error === 'Unable to load expenses.');
  return { ...moments, ready, transactions, summary, error,
    pending: !ready || income.loading || expense.loading, retry: () => {
      setProjectionRevision((value) => value + 1);
      moments.retry(); loadIncomes(uid, isGuest); loadExpenses(uid, isGuest);
    } };
}
