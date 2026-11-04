// Dashboard projection only. Never writes a Task or changes its linked Activity.
// Overdue Tasks remain visible; undated and completed Tasks stay on /tasks.
import { formatMomentDate } from './momentDates.js';
import { sortIndependentTasks } from './independentTasks.js';

export const selectUpcomingIndependentTasks = (tasks = [], now = new Date(), horizonDays = 30) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const end = new Date(start);
  end.setDate(end.getDate() + horizonDays);
  const cutoff = formatMomentDate(end);
  return sortIndependentTasks(tasks.filter((task) => task.status === 'in-progress'
    && task.dueDate && task.dueDate <= cutoff), 'asc', 'dueDate');
};

/** Calendar-day distance is local-date based, independent of daylight saving or Task time. */
export const dashboardTaskDueLabel = (dueDate, now = new Date()) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate || ''))) return 'No due date';
  const [year, month, day] = dueDate.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day) / 86400000;
  const current = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
  const distance = target - current;
  if (distance === 0) return 'Due today';
  const days = Math.abs(distance);
  return distance < 0 ? `${days} ${days === 1 ? 'day' : 'days'} overdue`
    : `${days} ${days === 1 ? 'day' : 'days'} away`;
};
