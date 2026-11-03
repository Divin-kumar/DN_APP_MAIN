// Task search and Refine share the same condition engine as Moments/Activities.
// Old saved shortcut fields still apply until they are edited into filter chips.
import { compileConditionGroup, conditionCount, normalizeConditionGroup } from './conditionEngine.js';
import { taskFilterFields } from './taskConditionFields.js';

const utcDay = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
export const filterTaskResults = (tasks = [], view = {}, today, moments = []) => {
  const group = normalizeConditionGroup(view.group);
  const date = new Date((today || '2000-01-01') + 'T12:00:00');
  const matchConditions = conditionCount(group) ? compileConditionGroup(group, taskFilterFields(tasks, moments, today), date)
    : () => true;
  return tasks.filter((task) => {
    if (view.search && ![task.title, task.notes].some((text) =>
      String(text || '').toLowerCase().includes(String(view.search).toLowerCase()))) return false;
    if (view.status && view.status !== 'all' && task.status !== view.status) return false;
    if (view.priority && view.priority !== 'all' && task.priority !== view.priority) return false;
    if (view.due && view.due !== 'all') {
      if (view.due === 'undated') {
        if (task.dueDate) return false;
      } else {
        if (!task.dueDate || task.status !== 'in-progress') return false;
        const days = utcDay(task.dueDate) - utcDay(today);
        if (view.due === 'overdue' ? days >= 0 : !(days >= 0 && days <= 7)) return false;
      }
    }
    return matchConditions(task);
  });
};
