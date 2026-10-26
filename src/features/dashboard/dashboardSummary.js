import { getDashboardVisibleActivityEvents, getDashboardVisibleEvents } from '../../utils/dashboardVisibility.js';
import { getStartOfDay, parseMomentDate } from '../../utils/momentDates.js';
import { filterTransactions, summarizeTransactions, toTransactions } from '../../utils/transactionFilters.js';

export const dashboardGreeting = (date = new Date()) => date.getHours() < 12
  ? 'Good morning' : date.getHours() < 18 ? 'Good afternoon' : 'Good evening';

export const dashboardProfileName = (user, isGuest) => String(user?.displayName || '').trim().split(/\s+/)[0]
  || String(user?.email || '').split('@')[0] || (isGuest ? 'Guest' : 'there');

const statusOf = (activity) => {
  const status = String(activity?.status || '').trim().toLowerCase();
  return activity?.cancelled || ['cancelled', 'canceled'].includes(status) ? 'cancelled'
    : activity?.completed || status === 'completed' ? 'completed' : 'pending';
};
const safeDate = (value) => {
  try { return parseMomentDate(value); } catch { return null; }
};

// These are calendar-date summaries, not a record-creation or synchronization log.
export function summarizeDashboard(events = [], now = new Date(), momentTypes = []) {
  const today = getStartOfDay(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const firstRecentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const visibleMoments = getDashboardVisibleEvents(events, momentTypes);
  const visibleActivityParents = getDashboardVisibleActivityEvents(events, momentTypes);
  const result = { todayActivities: 0, todayCompleted: 0, recentMoments: 0, pending: 0,
    overdue: 0, recentActivities: 0, recentCompleted: 0, totalActivities: 0 };
  for (const moment of visibleMoments) {
    // An undecided Event Date must not turn into a recent Moment via createdAt.
    const momentDate = safeDate(moment.date) || safeDate(moment.startDate);
    if (momentDate && momentDate >= firstRecentDay && momentDate < tomorrow) result.recentMoments += 1;
  }
  for (const moment of visibleActivityParents) {
    for (const activity of Array.isArray(moment.activities) ? moment.activities : []) {
      if (!activity) continue;
      const status = statusOf(activity);
      if (status === 'cancelled') continue;
      result.totalActivities += 1;
      if (status === 'pending') result.pending += 1;
      const date = safeDate(activity.date);
      if (!date) continue;
      if (status === 'pending' && date < today) result.overdue += 1;
      if (date >= today && date < tomorrow) {
        result.todayActivities += 1;
        if (status === 'completed') result.todayCompleted += 1;
      }
      if (date >= firstRecentDay && date < tomorrow) {
        result.recentActivities += 1;
        if (status === 'completed') result.recentCompleted += 1;
      }
    }
  }
  return result;
}

export const dashboardMonthKey = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// Stores supply the typed → legacy → nested deduplicated ledgers used by Finance.
export const summarizeDashboardMonth = (incomes, expenses, now = new Date()) => summarizeTransactions(
  filterTransactions(toTransactions(incomes, expenses), { month: dashboardMonthKey(now) }),
);

export function dashboardEncouragement(summary, name) {
  if (summary.overdue) return `${summary.overdue} pending ${summary.overdue === 1 ? 'activity is' : 'activities are'} dated before today. Take one small step, ${name}.`;
  if (summary.todayActivities > summary.todayCompleted) return `${summary.todayActivities - summary.todayCompleted} ${summary.todayActivities - summary.todayCompleted === 1 ? 'activity' : 'activities'} to finish today. You have this, ${name}.`;
  if (summary.totalActivities && !summary.pending) return `Your activities are up to date. Make room for a new memory, ${name}.`;
  return `Keep capturing memories and making progress, ${name}.`;
}
