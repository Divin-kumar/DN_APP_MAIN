// Pure Task list filtering shared by the live list and the draft-only Refine
// preview. No Task or Activity mutation and no persistence side effects.
const utcDay = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
};
export const filterTaskResults = (tasks, view, today) => tasks.filter((task) => {
  if (view.search && ![task.title, task.notes].some((text) => String(text || '').toLowerCase().includes(view.search.toLowerCase()))) return false;
  if (view.status !== 'all' && task.status !== view.status) return false;
  if (view.priority !== 'all' && task.priority !== view.priority) return false;
  if (view.due === 'all') return true;
  if (view.due === 'undated') return !task.dueDate;
  if (!task.dueDate || task.status !== 'in-progress') return false;
  const days = utcDay(task.dueDate) - utcDay(today);
  return view.due === 'overdue' ? days < 0 : days >= 0 && days <= 7;
});
