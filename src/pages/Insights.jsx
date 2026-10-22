// This page turns the stored event, income, and expense data into charts and summaries.
// It helps the user understand trends, upcoming events, and money movement without digging through raw records.
import { useEffect, useMemo } from 'react';
import { Activity, Archive, ArrowDownRight, ArrowUpRight, BookHeart, CalendarDays, CircleCheck, Database, Download, HeartPulse, Sparkles, WalletCards } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { downloadBlob } from '../utils/download';
import ListControls from '../components/common/ListControls';
import usePersistentListState from '../hooks/usePersistentListState';

const defaultInsightFilters = Object.freeze({ search: '' });

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const eventDate = (event) => {
  const date = new Date(event.date || event.startDate || event.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
};
const nextEventDate = (event) => {
  const date = eventDate(event);
  if (!date) return null;
  const recurrence = String(event.recurrence || '').toLowerCase();
  if (!(event.isRecurring === true || (recurrence && recurrence !== 'none'))) return date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = recurrence === 'monthly'
    ? new Date(today.getFullYear(), today.getMonth(), date.getDate())
    : new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (next >= today) return next;
  return recurrence === 'monthly'
    ? new Date(today.getFullYear(), today.getMonth() + 1, date.getDate())
    : new Date(today.getFullYear() + 1, date.getMonth(), date.getDate());
};

export default function Insights() {
  const [insightFilters, changeInsightFilters, resetInsightFilters] = usePersistentListState('insights', defaultInsightFilters);
  const search = insightFilters.search;
  const setSearch = (value) => changeInsightFilters({ search: value });
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { events, loadEvents } = useEventStore();
  const { expenses, loadExpenses } = useExpenseStore();
  const { incomes, loadIncomes } = useIncomeStore();

  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
    loadIncomes(user?.uid, isGuest);
  }, [user, isGuest, loadEvents, loadExpenses, loadIncomes]);

  const activities = useMemo(() => events.flatMap((event) => (event.activities || []).map((activity) => ({ ...activity, eventName: event.name, eventId: event.id || event.firestoreId }))), [events]);
  const completedActivities = activities.filter((activity) => activity.completed).length;
  const totalIncome = incomes.reduce((total, item) => total + Number(item.amount || 0), 0);
  const totalExpenses = expenses.reduce((total, item) => total + Number(item.amount || 0), 0);
  const categoryRows = useMemo(() => {
    const groups = events.reduce((result, event) => {
      const category = event.type || 'Personal';
      result[category] = (result[category] || 0) + 1;
      return result;
    }, {});
    return Object.entries(groups).sort((first, second) => second[1] - first[1]);
  }, [events]);
  const expenseCategoryRows = useMemo(() => {
    const groups = expenses.reduce((result, expense) => {
      const category = expense.category || 'Other';
      result[category] = (result[category] || 0) + Number(expense.amount || 0);
      return result;
    }, {});
    return Object.entries(groups).sort((first, second) => second[1] - first[1]);
  }, [expenses]);
  const monthlyActivity = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const count = activities.filter((activity) => String(activity.createdAt || activity.date || '').slice(0, 7) === monthKey).length;
      return { label: monthDate.toLocaleDateString('en', { month: 'short' }), count };
    });
  }, [activities]);
  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const amount = expenses.filter((item) => String(item.date || '').slice(0, 7) === monthKey).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { label: monthDate.toLocaleDateString('en', { month: 'short' }), amount };
    });
  }, [expenses]);
  const monthlyMemories = useMemo(() => {
    const memories = events.flatMap((event) => (event.memories || []).map((memory) => memory.createdAt || event.createdAt));
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      return { label: monthDate.toLocaleDateString('en', { month: 'short' }), count: memories.filter((date) => String(date || '').slice(0, 7) === monthKey).length };
    });
  }, [events]);
  const nextEvents = [...events].filter((event) => nextEventDate(event) && nextEventDate(event) >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => nextEventDate(a) - nextEventDate(b));
  const pastEvents = [...events].filter((event) => {
    const originalDate = eventDate(event);
    return originalDate && !(event.isRecurring === true || (event.recurrence && String(event.recurrence).toLowerCase() !== 'none'))
      && originalDate < new Date(new Date().setHours(0, 0, 0, 0));
  }).sort((a, b) => eventDate(b) - eventDate(a));
  const memoryCount = events.reduce((sum, event) => sum + (event.memories?.length || 0), 0);
  const attachmentCount = events.reduce((sum, event) => sum + (event.attachments?.length || 0), 0);
  const activityMax = Math.max(1, ...monthlyActivity.map((month) => month.count));
  const expenseMax = Math.max(1, ...monthlyExpenses.map((month) => month.amount));
  const empty = !events.length && !incomes.length && !expenses.length;
  const searchedUpcoming = nextEvents.filter((event) => `${event.name || ''} ${event.type || ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 4);
  const searchedPast = pastEvents.filter((event) => `${event.name || ''} ${event.type || ''}`.toLowerCase().includes(search.toLowerCase())).slice(0, 4);
  const years = [...new Set(events.map((event) => eventDate(event)?.getFullYear()).filter(Boolean))].sort((first, second) => second - first);
  const memoryMax = Math.max(1, ...monthlyMemories.map((month) => month.count));

  const exportInsights = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      overview: { events: events.length, upcoming: nextEvents.length, archived: pastEvents.length, activities: activities.length, completedActivities, memories: memoryCount, attachments: attachmentCount, income: totalIncome, expenses: totalExpenses },
      events,
      incomes,
      expenses,
    };
    downloadBlob(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      `dn-insights-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };

  return (
    <div className="insights-page">
      <header className="insights-heading">
        <div><span className="insights-eyebrow"><Sparkles size={14} /> Your life, in perspective</span>
          <h2>Insights</h2>
          <p>A thoughtful view of the moments, progress, and resources shaping your journey.</p></div>
        <div className="insights-tools">
          <ListControls hasPanel={false} activeCount={Number(Boolean(search))}
            resultCount={searchedUpcoming.length + searchedPast.length} resultLabel="milestones shown"
            summary={search ? `Search: ${search} · Milestone lists only` : 'Milestone lists only'} onReset={resetInsightFilters}
            search={<input id="insights-filter-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search milestones" aria-label="Search Insights" />} />
          <button type="button" onClick={exportInsights}><Download size={15} /> Export</button>
        </div>
      </header>

      {empty ? <div className="insights-empty-note"><HeartPulse size={18} /><span>Your insights will grow as you add moments and memories. Nothing to measure until there is something meaningful to look back on.</span></div> : null}

      <section className="insights-metric-grid" aria-label="Life overview">
        <InsightMetric icon={CalendarDays} label="Life moments" value={events.length} detail={`${nextEvents.length} ahead`} />
        <InsightMetric icon={Activity} label="Activities" value={activities.length} detail={`${completedActivities} complete`} />
        <InsightMetric icon={BookHeart} label="Memories" value={memoryCount} detail={`${attachmentCount} keepsakes`} />
        <InsightMetric icon={WalletCards} label="Net flow" value={money(totalIncome - totalExpenses)} detail={`${money(totalIncome)} in · ${money(totalExpenses)} out`} />
      </section>

      <div className="insights-content-grid">
        <section className="insights-panel">
          <PanelHeading icon={CalendarDays} title="Events overview" detail="Your chapters across time" />
          <div className="insights-timeline-stats"><span><strong>{nextEvents.length}</strong> upcoming</span><span><strong>{pastEvents.length}</strong> archived</span><span><strong>{events.reduce((sum, event) => sum + (event.activities || []).length, 0)}</strong> planned steps</span></div>
          <div className="insights-milestones-grid">
            <MilestoneList title="Next milestones" events={searchedUpcoming} emptyText="No matching upcoming moments." useNextDate />
            <MilestoneList title="Recently remembered" events={searchedPast} emptyText="No matching archived moments." />
          </div>
        </section>

        <section className="insights-panel">
          <PanelHeading icon={Archive} title="Life archive" detail="Where your stories live" />
          <div className="archive-health-row"><span><BookHeart size={15} /> Saved memories</span><strong>{memoryCount}</strong></div>
          <div className="archive-health-row"><span><Activity size={15} /> Activities captured</span><strong>{activities.length}</strong></div>
          <div className="archive-health-row"><span><Database size={15} /> Documents & keepsakes</span><strong>{attachmentCount}</strong></div>
          <div className="data-health-note"><CircleCheck size={15} /> {events.length ? 'Your life timeline is ready to explore.' : 'Add your first event to begin your archive.'}</div>
        </section>

        <section className="insights-panel">
          <PanelHeading icon={HeartPulse} title="Event categories" detail="The moments you make room for" />
          {categoryRows.length ? <div className="category-insight-list">{categoryRows.map(([name, count]) => <div key={name} className="category-insight-row"><span>{name}</span><i><b style={{ width: `${Math.max(8, (count / Math.max(1, events.length)) * 100)}%` }} /></i><strong>{count}</strong></div>)}</div> : <p className="insights-muted">Event categories appear here as your timeline grows.</p>}
        </section>

        <section className="insights-panel">
          <PanelHeading icon={Activity} title="Monthly activity" detail="New activity by month · last six months" />
          <div className="insights-bar-chart">{monthlyActivity.map((month) => <div className="insights-bar-column" key={month.label}><span>{month.count}</span><i><b style={{ height: `${Math.max(5, (month.count / activityMax) * 100)}%` }} /></i><small>{month.label}</small></div>)}</div>
          <div className="insights-summary-line"><span>Completion rate</span><strong>{activities.length ? `${Math.round((completedActivities / activities.length) * 100)}%` : '—'}</strong><span className="insights-summary-icon"><ArrowUpRight size={15} /></span></div>
        </section>

        <section className="insights-panel">
          <PanelHeading icon={BookHeart} title="Memory growth" detail="Memories saved · last six months" />
          <div className="insights-bar-chart">{monthlyMemories.map((month) => <div className="insights-bar-column" key={month.label}><span>{month.count}</span><i><b style={{ height: `${Math.max(5, (month.count / memoryMax) * 100)}%` }} /></i><small>{month.label}</small></div>)}</div>
          <div className="insights-summary-line"><span>Saved memories</span><strong>{memoryCount}</strong><span className="insights-summary-icon"><BookHeart size={14} /></span></div>
        </section>

        <section className="insights-panel">
          <PanelHeading icon={WalletCards} title="Financial overview" detail="Income and expenses in context" />
          <div className="financial-insight-totals"><div><span><ArrowUpRight size={14} /> Income</span><strong>{money(totalIncome)}</strong></div><div><span><ArrowDownRight size={14} /> Expenses</span><strong>{money(totalExpenses)}</strong></div><div><span>Balance</span><strong>{money(totalIncome - totalExpenses)}</strong></div></div>
          <div className="insights-bar-chart insights-expense-chart">{monthlyExpenses.map((month) => <div className="insights-bar-column" key={month.label}><span>{month.amount ? money(month.amount) : '—'}</span><i><b style={{ height: `${Math.max(5, (month.amount / expenseMax) * 100)}%` }} /></i><small>{month.label}</small></div>)}</div>
        </section>

        <section className="insights-panel">
          <PanelHeading icon={ArrowDownRight} title="Spending by category" detail="Where expenses are recorded" />
          {expenseCategoryRows.length ? <div className="category-insight-list">{expenseCategoryRows.map(([category, amount]) => <div key={category} className="category-insight-row"><span>{category}</span><i><b style={{ width: `${Math.max(8, (amount / Math.max(1, totalExpenses)) * 100)}%` }} /></i><strong>{money(amount)}</strong></div>)}</div> : <p className="insights-muted">Add expenses to see your spending breakdown.</p>}
        </section>

        <section className="insights-panel">
          <PanelHeading icon={Archive} title="Yearly life timeline" detail="Your moments, gathered by year" />
          {years.length ? <div className="yearly-life-timeline">{years.map((year) => <div key={year}><strong>{year}</strong><span>{events.filter((event) => eventDate(event)?.getFullYear() === year).length} moments</span><i>{events.filter((event) => eventDate(event)?.getFullYear() === year).map((event) => event.name || 'Life moment').join(' · ')}</i></div>)}</div> : <p className="insights-muted">A year-by-year view will appear as you add moments.</p>}
        </section>

        <section className="insights-panel insights-ai-panel">
          <PanelHeading icon={Sparkles} title="A note from your journey" detail="A simple reflection from your activity" />
          <p>{activities.length ? `${completedActivities} of your ${activities.length} recorded activities are complete. Every small step attached to a life moment helps turn a plan into a memory.` : events.length ? `You have gathered ${events.length} life ${events.length === 1 ? 'moment' : 'moments'}. Add activities or memories to see your journey take shape in more detail.` : 'Start with one moment worth remembering. Your personal insights will grow alongside it.'}</p>
        </section>
      </div>
    </div>
  );
}

function InsightMetric({ icon: Icon, label, value, detail }) {
  return <article className="insight-metric"><span className="insight-metric-icon"><Icon size={17} /></span><span className="insight-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function PanelHeading({ icon: Icon, title, detail }) {
  return <div className="insights-panel-heading"><span><Icon size={17} /></span><div><h3>{title}</h3><small>{detail}</small></div></div>;
}

function MilestoneList({ title, events, emptyText, useNextDate = false }) {
  return <div className="milestone-list"><h4>{title}</h4>{events.length ? events.map((event) => {
    const date = useNextDate ? nextEventDate(event) : eventDate(event);
    return <div className="milestone-row" key={event.id || event.firestoreId}><span>{date?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) || '—'}</span><strong>{event.name || 'Life moment'}</strong><small>{event.type || 'Personal'}</small></div>;
  }) : <p>{emptyText}</p>}</div>;
}
