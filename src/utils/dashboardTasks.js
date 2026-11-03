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
