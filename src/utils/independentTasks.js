// Independent Tasks are not Activity records. Never place them in Moment activities,
// Story/PDF chapters or an Activity's continuation entries.
import { normalizeActivityTime } from './activityTime.js';
import { parseMomentDate } from './momentDates.js';
import { recordId } from './recordIdentity.js';
import { activityOwnsLinkedId } from './activityEntries.js';
import { nextScheduledDate, normalizeRepeatSchedule, repeatScheduleForDraft, scheduleTimestamp } from './repeatSchedule.js';

export const TASK_STATUSES = Object.freeze(['in-progress', 'completed', 'cancelled']);
export const TASK_PRIORITIES = Object.freeze(['low', 'medium', 'high']);
export const TASK_GROUPS = Object.freeze(['dueDate', 'moment', 'activity', 'status']);
const validObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const taskDate = (value) => {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !parseMomentDate(value)) {
    throw new Error('Choose a valid Task due date.');
  }
  return value;
};
const timestamp = (value, label) => {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Task ${label} is invalid.`);
  }
  return value;
};
const safeStatus = (value, completed) => TASK_STATUSES.includes(value)
  ? value : completed === true ? 'completed' : 'in-progress';

// Every Task has a stable independent ID. Never silently generate a new ID
// while reading old records or reconstruct links from an Activity ID.
export const normalizeIndependentTask = (raw, { createId } = {}) => {
  if (!validObject(raw)) throw new Error('A Task must be a record.');
  const id = recordId(raw.id) || recordId(raw.firestoreId) || recordId(createId?.());
  if (!id || id.includes('/')) throw new Error('A Task needs a stable ID.');
  const title = String(raw.title ?? '').trim();
  if (!title || title.length > 500) throw new Error('Enter a Task title (up to 500 characters).');
  const momentId = recordId(raw.momentId);
  const activityId = recordId(raw.activityId);
  if (activityId && !momentId) throw new Error('Choose the Task Moment before linking an Activity.');
  const dueDate = taskDate(raw.dueDate);
  const dueTime = normalizeActivityTime(raw.dueTime);
  if (raw.dueTime && !dueTime) throw new Error('Choose a valid Task due time.');
  if (dueTime && !dueDate) throw new Error('Choose a Task due date before entering a time.');
  const priority = TASK_PRIORITIES.includes(raw.priority) ? raw.priority : 'medium';
  const status = safeStatus(raw.status, raw.completed);
  const createdAt = timestamp(raw.createdAt, 'creation date');
  const updatedAt = timestamp(raw.updatedAt, 'update date');
  const completedAt = status === 'completed' ? timestamp(raw.completedAt, 'completion date') : null;
  const repeat = raw.repeat == null ? null : normalizeRepeatSchedule(raw.repeat);
  const seriesId = repeat && recordId(raw.repeat.seriesId);
  if (repeat && (!/^[\w-]{1,100}$/.test(seriesId) || !dueDate || dueDate < repeat.anchorDate || status === 'completed')) {
    throw new Error('This repeating Task needs a valid due date and schedule.');
  }
  return {
    id, title, notes: String(raw.notes ?? ''), priority, status,
    dueDate, dueTime, momentId, activityId, createdAt, updatedAt, completedAt,
    ...(repeat ? { repeat: { ...repeat, seriesId } } : {}),
  };
};

export const taskStatusPatch = (task, target, now = new Date()) => {
  if (!TASK_STATUSES.includes(target)) throw new Error('Choose a valid Task status.');
  if (task.status === target) return null;
  const at = now instanceof Date ? now.toISOString() : timestamp(now, 'update date');
  return { status: target, completedAt: target === 'completed' ? at : null, updatedAt: at };
};

// An edit to the due date or frequency starts a new schedule from that date.
export function taskRepeatForDraft(previous, frequency, dueDate, createId) {
  if (!frequency) return null;
  if (previous?.repeat?.frequency === frequency && previous.dueDate === dueDate) return previous.repeat;
  return { ...repeatScheduleForDraft(previous, frequency, dueDate), seriesId: createId() };
}

export function resolveRepeatingTask(task, action, now = new Date()) {
  if (!task?.repeat || task.status !== 'in-progress' || !['complete', 'skip'].includes(action)) {
    throw new Error('This repeating Task changed. Reopen Tasks and try again.');
  }
  const current = normalizeIndependentTask({ ...task, repeat: null,
    ...taskStatusPatch(task, action === 'complete' ? 'completed' : 'cancelled', now),
    updatedAt: scheduleTimestamp(task.updatedAt, now) });
  const dueDate = nextScheduledDate(task.repeat, task.dueDate);
  const next = normalizeIndependentTask({ ...task, dueDate,
    id: `repeat-${task.repeat.seriesId}-${dueDate}`,
    momentId: '', activityId: '', createdAt: now.toISOString(), updatedAt: now.toISOString(),
  });
  return { current, next };
}

export function advanceRepeatingTask(tasks, id, action, expectedUpdatedAt) {
  const task = tasks.find((item) => item.id === id);
  if (!task || task.updatedAt !== expectedUpdatedAt) throw new Error('This Task changed. Reopen Tasks and try again.');
  const { current, next } = resolveRepeatingTask(task, action);
  const entries = tasks.map((item) => item.id === id ? current : item);
  if (!entries.some((item) => item.id === next.id)) entries.push(next);
  return { current, entries };
}

// Parent changes never delete independent Tasks or change their completion.
export const detachIndependentTaskLinks = (tasks = [], { momentId, activityId, activityIds } = {}) => {
  const parentId = recordId(momentId);
  const childIds = new Set([activityId, ...(Array.isArray(activityIds) ? activityIds : [])]
    .map(recordId).filter(Boolean));
  if (!parentId || (activityIds !== undefined && !childIds.size)) return [...tasks];
  return tasks.map((task) => {
    if (recordId(task.momentId) !== parentId) return task;
    if (!childIds.size) return task.momentId || task.activityId
      ? { ...task, momentId: '', activityId: '' } : task;
    if (!childIds.has(recordId(task.activityId))) return task;
    return { ...task, activityId: '' };
  });
};

// An Activity ID is not globally unique. Resolve it only within its linked Moment.
// Missing parents are presented as unavailable; a Task does not become an Activity.
export const resolveIndependentTaskParent = (task, moments = []) => {
  const momentId = recordId(task.momentId);
  const activityId = recordId(task.activityId);
  if (!momentId) return { kind: 'standalone', moment: null, activity: null };
  const moment = moments.find((item) => recordId(item.id) === momentId || recordId(item.firestoreId) === momentId);
  if (!moment) return { kind: 'missing-moment', moment: null, activity: null };
  if (!activityId) return { kind: 'moment', moment, activity: null };
  const activity = (moment.activities || []).find((item) => activityOwnsLinkedId(item, activityId));
  return activity ? { kind: 'activity', moment, activity } : { kind: 'missing-activity', moment, activity: null };
};

const compareDue = (a, b, direction = 'asc') => {
  const first = a.dueDate || '', second = b.dueDate || '';
  if (!first || !second) return first ? -1 : second ? 1 : 0;
  const sign = direction === 'desc' ? -1 : 1;
  return sign * (first.localeCompare(second) || (a.dueTime && b.dueTime ? a.dueTime.localeCompare(b.dueTime) : a.dueTime ? -1 : b.dueTime ? 1 : 0));
};
const taskSortRank = (task, field) => field === 'priority'
  ? ({ high: 0, medium: 1, low: 2 })[task.priority] ?? 3
  : ({ 'in-progress': 0, completed: 1, cancelled: 2 })[task.status] ?? 3;
const compareTaskField = (a, b, field, direction) => {
  const sign = direction === 'desc' ? -1 : 1;
  if (field === 'dueDate') return compareDue(a, b, direction);
  if (field === 'priority' || field === 'status') return sign * (taskSortRank(a, field) - taskSortRank(b, field));
  if (field === 'createdAt' || field === 'updatedAt') {
    const left = a[field] || '', right = b[field] || '';
    // Missing historical timestamps always follow dated records.
    return !left || !right ? left ? -1 : right ? 1 : 0 : sign * left.localeCompare(right);
  }
  return sign * String(a.title).localeCompare(String(b.title), undefined, { sensitivity: 'base' });
};
export const sortIndependentTasks = (tasks = [], direction = 'asc', sortBy = 'dueDate') => [...tasks].sort((a, b) => {
  const primary = compareTaskField(a, b, sortBy, direction);
  return primary || compareDue(a, b, direction)
    || String(a.title).localeCompare(String(b.title), undefined, { sensitivity: 'base' })
    || String(a.id).localeCompare(String(b.id));
});

// Presentation-only grouping. Filter before calling; each independent Task
// appears exactly once regardless of how many nested Activity entries exist.
export const groupIndependentTasks = (tasks = [], { by = 'dueDate', moments = [], direction = 'asc', sortBy = 'dueDate' } = {}) => {
  if (!TASK_GROUPS.includes(by)) throw new Error('Unknown Task grouping.');
  const sorted = sortIndependentTasks(tasks, direction, sortBy);
  const groups = new Map();
  for (const task of sorted) {
    const parent = resolveIndependentTaskParent(task, moments);
    let key, label;
    if (by === 'dueDate') { key = task.dueDate || 'undated'; label = task.dueDate || 'No due date'; }
    else if (by === 'status') { key = task.status; label = task.status === 'in-progress' ? 'In progress' : task.status === 'completed' ? 'Completed' : 'Cancelled'; }
    else if (by === 'moment') {
      key = task.momentId || 'standalone';
      label = parent.moment?.name || (key === 'standalone' ? 'Standalone' : 'Unavailable Moment');
    } else {
      key = parent.kind === 'activity' ? JSON.stringify([task.momentId, task.activityId])
        : parent.kind === 'moment' ? JSON.stringify([task.momentId, 'moment-only'])
          : parent.kind;
      label = parent.kind === 'activity' ? parent.activity?.title || 'Untitled activity'
        : parent.kind === 'moment' ? 'Moment only' : parent.kind === 'standalone' ? 'Standalone'
          : parent.kind === 'missing-activity' ? 'Unavailable Activity' : 'Unavailable Moment';
    }
    if (!groups.has(key)) groups.set(key, { key, label, tasks: [] });
    groups.get(key).tasks.push(task);
  }
  return [...groups.values()].map((group) => ({ ...group, count: group.tasks.length }));
};
