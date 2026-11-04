// Pure Task list configuration shared by Refine, Settings, and backup validation.
// Do not import JSX components into Node-tested preference modules.
import { emptyGroup } from './conditionEngine.js';

export const TASK_VIEW_DEFAULTS = Object.freeze({
  search: '', status: 'all', priority: 'all', due: 'all',
  group: emptyGroup(), field: 'dueDate', direction: 'asc',
});
export const TASK_VIEW_RULES = Object.freeze({
  status: ['all', 'in-progress', 'completed', 'cancelled'],
  priority: ['all', 'low', 'medium', 'high'],
  due: ['all', 'overdue', 'next7', 'undated'],
  group: (value) => value?.kind === 'group' && Array.isArray(value.children)
    && JSON.stringify(value).length < 30000,
  field: ['dueDate', 'title', 'priority', 'status', 'createdAt', 'updatedAt'],
  direction: ['asc', 'desc'],
});
export const TASK_SORT_OPTIONS = Object.freeze([
  { value: 'dueDate', label: 'Due date' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
]);
