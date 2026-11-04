// Independent Task filtering reuses the same ConditionBuilder engine as other lists.
// Derived values exist only for presentation; original Task/Activity data never changes.
import { recordId } from './recordIdentity.js';
import { emptyGroup, isActiveCondition, normalizeConditionGroup } from './conditionEngine.js';

const option = (value, label) => ({ value, label });
const dayNumber = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = value.split('-').map(Number);
  const instant = Date.UTC(year, month - 1, day);
  return new Date(instant).toISOString().slice(0, 10) === value ? instant / 86400000 : null;
};

export const taskDueWindow = (task, today) => {
  if (!task.dueDate) return 'undated';
  if (task.status !== 'in-progress') return 'closed';
  const due = dayNumber(task.dueDate), current = dayNumber(today);
  if (due == null || current == null) return 'undated';
  const days = due - current;
  if (days < 0) return 'overdue';
  if (days === 0) return ['today', 'next7', 'next30'];
  if (days <= 7) return ['next7', 'next30'];
  if (days <= 30) return 'next30';
  return 'later';
};

export const taskFilterFields = (tasks = [], moments = [], today = '') => {
  const names = new Map(moments.map((moment) => [recordId(moment.id || moment.firestoreId), moment.name || 'Untitled Moment']));
  const momentIds = new Set([...names.keys(), ...tasks.map((task) => recordId(task.momentId))].filter(Boolean));
  const momentOptions = [...momentIds].map((value) => option(value, names.get(value) || 'Unavailable Moment'))
    .sort((a, b) => a.label.localeCompare(b.label));
  const times = [...new Set(tasks.map((task) => task.dueTime).filter(Boolean))].sort().map((value) => option(value, value));
  return [
    { path: 'status', label: 'Status', type: 'dropdown', allowCustom: false,
      options: [option('in-progress', 'In progress'), option('completed', 'Completed'), option('cancelled', 'Cancelled')] },
    { path: 'priority', label: 'Priority', type: 'dropdown', allowCustom: false,
      options: [option('high', 'High'), option('medium', 'Medium'), option('low', 'Low')] },
    { path: 'dueWindow', label: 'Due timing', type: 'dropdown', allowCustom: false,
      options: [option('overdue', 'Overdue'), option('today', 'Today'),
        option('next7', 'Next 7 days'), option('next30', 'Next 30 days'),
        option('later', 'Later'), option('undated', 'No due date')],
      readValue: (task) => taskDueWindow(task, today) },
    { path: 'dueDate', label: 'Due date', type: 'date', allowEmpty: true },
    { path: 'dueTime', label: 'Due time', type: 'dropdown', allowCustom: true, allowEmpty: true,
      options: times },
    { path: 'linkType', label: 'Linked to', type: 'dropdown', allowCustom: false,
      options: [option('standalone', 'Standalone'), option('moment', 'Moment'), option('activity', 'Activity')],
      readValue: (task) => task.activityId ? 'activity' : task.momentId ? 'moment' : 'standalone' },
    { path: 'momentId', label: 'Moment', type: 'dropdown', allowCustom: false, allowEmpty: true,
      hideRawValues: true, options: momentOptions,
      labelValue: (value) => names.get(String(value)) || 'Unavailable Moment' },
    { path: 'title', label: 'Task title', type: 'text' },
    { path: 'notes', label: 'Notes', type: 'text', allowEmpty: true },
    { path: 'createdAt', label: 'Created on', type: 'date', allowEmpty: true },
    { path: 'updatedAt', label: 'Updated on', type: 'date', allowEmpty: true },
    { path: 'completedAt', label: 'Completed on', type: 'date', allowEmpty: true },
  ];
};

// Existing saved Status/Priority/Due choices remain active on upgrade. When
// the next Refine edit is applied, they become ordinary removable filter chips.
export const taskViewConditionGroup = (view = {}) => {
  const original = normalizeConditionGroup(view.group || emptyGroup());
  const legacy = [
    view.status && view.status !== 'all' ? { field: 'status', value: view.status } : null,
    view.priority && view.priority !== 'all' ? { field: 'priority', value: view.priority } : null,
    view.due && view.due !== 'all' ? { field: 'dueWindow', value: view.due } : null,
  ].filter(Boolean).map(({ field, value }) => ({ kind: 'rule', id: 'legacy-' + field,
    field, operator: 'eq', value }));
  if (!legacy.length) return original;
  return original.join === 'OR' && original.children.length
    ? { ...emptyGroup(), children: [{ ...original, id: 'legacy-previous' }, ...legacy] }
    : { ...original, join: 'AND', children: [...original.children, ...legacy] };
};

// A saved Refine state can retain unfinished Filter by rows from older UI.
// Those rows never match anything and should not appear on the next opening.
// Only the initial editing draft is compacted; saved state stays untouched
// until the user explicitly chooses Show results.
export const compactTaskRefineGroup = (value) => {
  const prune = (node) => {
    if (node.kind !== 'group') return isActiveCondition(node) ? node : null;
    const children = node.children.map(prune).filter(Boolean);
    return children.length ? { ...node, children } : null;
  };
  return prune(normalizeConditionGroup(value)) || emptyGroup();
};
