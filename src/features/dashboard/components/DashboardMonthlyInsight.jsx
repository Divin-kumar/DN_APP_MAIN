import { useEffect, useMemo } from 'react';
import useAppStore from '../../../store/useAppStore';
import useIncomeStore from '../../../store/useIncomeStore';
import useExpenseStore from '../../../store/useExpenseStore';
import { getActiveSampleScenario } from '../../../dev/sampleData';
import { isRecordScopeLoaded } from '../../../utils/scopedRecordActions';
import { filterTransactions, summarizeTransactions, toTransactions } from '../../../utils/transactionFilters';
import './DashboardMonthlyInsight.css';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);

// Read the same deduplicated ledgers as Transactions; this is display-only.
export default function DashboardMonthlyInsight({ events = [] }) {
  const uid = useAppStore((state) => state.user?.uid);
  const isGuest = useAppStore((state) => state.isGuest);
  const incomesState = useIncomeStore();
  const expensesState = useExpenseStore();
  const { loadIncomes } = incomesState;
  const { loadExpenses } = expensesState;
  const scope = `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;
  const sample = getActiveSampleScenario(uid);
  useEffect(() => {
    if (!uid && !isGuest) return;
    loadIncomes(uid, isGuest);
    loadExpenses(uid, isGuest);
  }, [uid, isGuest, sample, loadIncomes, loadExpenses]);
  const ready = isRecordScopeLoaded(incomesState, scope, sample)
    && isRecordScopeLoaded(expensesState, scope, sample);
  const period = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const month = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit' }).slice(0, 7);
  const summary = useMemo(() => ready ? summarizeTransactions(
    filterTransactions(toTransactions(incomesState.incomes, expensesState.expenses), { month }),
  ) : null, [ready, incomesState.incomes, expensesState.expenses, month]);
  const activeActivities = events.reduce((count, moment) => count + (moment.archived ? 0
    : (moment.activities || []).filter((activity) => !activity.completed
      && !activity.cancelled && activity.status !== 'cancelled').length), 0);
  return <section className="dashboard-insight-strip" aria-label="At a glance">
    <div><span>Activities to do</span><strong>{activeActivities}</strong></div>
    <div><span>{period} spending</span><strong>{ready ? money(summary?.expense) : '…'}</strong></div>
    <div><span>{period} balance</span><strong>{ready ? money(summary?.balance) : '…'}</strong></div>
  </section>;
}
