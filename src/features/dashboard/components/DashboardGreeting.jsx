import { useEffect, useMemo } from 'react';
import { CalendarDays, CheckCheck, Clock3, Images, Sparkles, Sunrise, Sun, Moon, Wallet } from 'lucide-react';
import useAppStore from '../../../store/useAppStore';
import useIncomeStore from '../../../store/useIncomeStore';
import useExpenseStore from '../../../store/useExpenseStore';
import { getActiveSampleScenario } from '../../../dev/sampleData';
import { isRecordScopeLoaded } from '../../../utils/scopedRecordActions';
import { dashboardEncouragement, dashboardGreeting, dashboardMonthKey, dashboardProfileName,
  summarizeDashboard, summarizeDashboardMonth } from '../dashboardSummary';
import './DashboardGreeting.css';

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(value);

function SummaryMetric({ icon: Icon, label, value, detail, pending }) {
  return <div className="dashboard-summary-metric" aria-busy={pending || undefined}>
    <span className="dashboard-summary-metric-icon"><Icon size={16} aria-hidden="true" /></span>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </div>;
}

export default function DashboardGreeting({ events, eventsReady, eventsError, momentTypes, now, onRetryEvents }) {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const incomeState = useIncomeStore();
  const expenseState = useExpenseStore();
  const { loadIncomes } = incomeState;
  const { loadExpenses } = expenseState;
  const uid = user?.uid;
  const scope = `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;
  const sample = getActiveSampleScenario(uid);
  useEffect(() => {
    if (!uid && !isGuest) return;
    loadIncomes(uid, isGuest);
    loadExpenses(uid, isGuest);
  }, [uid, isGuest, sample, loadIncomes, loadExpenses]);
  const expenseError = expenseState.error === 'Unable to load expenses.';
  const incomeError = incomeState.error === 'Unable to load incomes.';
  const expenseReady = isRecordScopeLoaded(expenseState, scope, sample) && !expenseState.loading && !expenseError;
  const incomeReady = isRecordScopeLoaded(incomeState, scope, sample) && !incomeState.loading && !incomeError;
  const dayKey = now.toDateString();
  const monthKey = dashboardMonthKey(now);
  const summary = useMemo(() => eventsReady ? summarizeDashboard(events, now, momentTypes) : null,
    [events, eventsReady, momentTypes, dayKey]);
  const finance = useMemo(() => expenseReady ? summarizeDashboardMonth(incomeReady ? incomeState.incomes : [], expenseState.expenses, now) : null,
    [incomeReady, expenseReady, incomeState.incomes, expenseState.expenses, monthKey]);
  const name = dashboardProfileName(user, isGuest);
  const GreetingIcon = now.getHours() < 12 ? Sunrise : now.getHours() < 18 ? Sun : Moon;
  const count = (key) => summary ? summary[key] : eventsError ? '—' : '…';
  const pendingEvents = !eventsReady && !eventsError;
  const period = now.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  return <header className="dashboard-greeting dashboard-summary-greeting" aria-label="Your daily summary">
    <div className="dashboard-summary-heading">
      <div className="dashboard-summary-salutation"><GreetingIcon size={22} aria-hidden="true" /><h2>{dashboardGreeting(now)}, {name}</h2></div>
      <time dateTime={`${dashboardMonthKey(now)}-${String(now.getDate()).padStart(2, '0')}`}>{now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</time>
    </div>
    <div className="dashboard-summary-metrics">
      <SummaryMetric icon={CalendarDays} label="Activities today" value={count('todayActivities')}
        detail={summary ? `${summary.todayCompleted} completed` : 'Scheduled today'} pending={pendingEvents} />
      <SummaryMetric icon={Images} label="Recent moments" value={count('recentMoments')} detail="Dated in the past 7 days" pending={pendingEvents} />
      <SummaryMetric icon={Clock3} label="Pending activities" value={count('pending')}
        detail={summary ? `${summary.overdue} dated before today` : 'Across your moments'} pending={pendingEvents} />
      <SummaryMetric icon={Wallet} label={`Spent · ${period}`} value={expenseReady ? money(finance.expense) : expenseError ? '—' : '…'}
        detail={expenseReady && incomeReady ? `Balance ${money(finance.balance)}` : 'Balance unavailable'} pending={!expenseReady && !expenseError} />
    </div>
    {summary ? <div className="dashboard-summary-footer">
      <p className="dashboard-summary-recent"><CheckCheck size={15} aria-hidden="true" /><span>Past 7 days: {summary.recentActivities} {summary.recentActivities === 1 ? 'activity' : 'activities'}, {summary.recentCompleted} completed.</span></p>
      <p><Sparkles size={15} aria-hidden="true" /><span>{dashboardEncouragement(summary, name)}</span></p>
    </div> : <p className="dashboard-summary-status" role={eventsError ? 'alert' : 'status'}>{eventsError
      ? <>Your summary couldn’t be loaded. <button type="button" onClick={onRetryEvents}>Retry summary</button></>
      : 'Preparing your daily summary…'}</p>}
    {expenseError || incomeError ? <p className="dashboard-summary-status" role="alert">
      {expenseError ? 'Spending couldn’t be loaded.' : 'Balance couldn’t be loaded.'}
      <button type="button" onClick={() => { loadIncomes(uid, isGuest); loadExpenses(uid, isGuest); }}>Retry finances</button>
    </p> : null}
  </header>;
}
