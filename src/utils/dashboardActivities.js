import { getDashboardVisibleEvents } from './dashboardVisibility.js';
import { getStartOfDay, parseMomentDate } from './momentDates.js';

const getVisibleActivities = (events, momentTypes) => getDashboardVisibleEvents(events, momentTypes)
  .flatMap((event) => (Array.isArray(event.activities) ? event.activities : [])
    .filter((activity) => activity && !activity.cancelled && !['cancelled', 'canceled'].includes(String(activity.status || '').trim().toLowerCase()))
    .map((activity) => ({ event, activity, date: parseMomentDate(activity.date) }))
    .filter(({ date }) => date)
    .map((item) => ({ ...item, date: getStartOfDay(item.date) })));

export const getUpcomingDashboardActivities = (events = [], referenceDate = new Date(), momentTypes = []) => {
  const today = getStartOfDay(referenceDate);
  const lastDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  return getVisibleActivities(events, momentTypes)
    .filter(({ activity, date }) => !activity.completed && String(activity.status || '').trim().toLowerCase() !== 'completed'
      && date >= today && date <= lastDay)
    .sort((first, second) => first.date - second.date);
};

// Memories use actual recorded activity dates, never a projected repeat.
export const getOnThisDayDashboardActivities = (events = [], referenceDate = new Date(), momentTypes = []) => (
  getVisibleActivities(events, momentTypes)
    .filter(({ date }) => date.getFullYear() < referenceDate.getFullYear()
      && date.getMonth() === referenceDate.getMonth() && date.getDate() === referenceDate.getDate())
    .sort((first, second) => second.date - first.date)
);
