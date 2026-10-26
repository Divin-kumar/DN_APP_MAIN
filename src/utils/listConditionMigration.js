import { emptyGroup } from './conditionEngine.js';
import { activityStatus } from './activityDetail.js';
import { getEventStatus } from './eventStatus.js';

// Convert the previous browser choices once, without changing any business data.
const group = (rules) => ({ ...emptyGroup(), children: rules.filter(Boolean).map((rule, index) => ({
  id: `legacy-${index}`, kind: 'rule', ...rule,
})) });
const rule = (field, operator, value) => ({ field, operator, value });
export const momentConditions = ({ category = 'All moments' } = {}) => group([
  rule('archived', 'eq', String(category === 'Archived')),
  !['All moments', 'Archived'].includes(category) && rule('type', 'eq', category),
]);
export const activityConditions = (filters = {}, nested = false) => {
  const prefix = nested ? '' : 'activity.';
  const status = filters.filter || 'all';
  return group([
    !nested && filters.parentScope !== 'all' && rule('archived', 'eq', String(filters.parentScope === 'archived')),
    !nested && filters.momentId && rule('momentId', 'eq', filters.momentId),
    !nested && filters.momentType && rule('momentType', 'eq', filters.momentType),
    ['high', 'medium', 'low'].includes(status) ? rule(`${prefix}priority`, 'eq', status)
      : status !== 'all' ? rule(`${prefix}status`, 'eq', status) : rule(`${prefix}status`, 'ne', 'cancelled'),
    ['high', 'medium', 'low'].includes(status) && rule(`${prefix}status`, 'ne', 'cancelled'),
  ]);
};
export const transactionConditions = ({ type = 'all', month = 'all', activityId = '' } = {}) => group([
  type !== 'all' && rule('transactionKind', 'eq', type),
  activityId && rule('activityId', 'eq', activityId),
  month !== 'all' && /^\d{4}-\d{2}$/.test(month) && rule('date', 'between', [
    `${month}-01`, `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`,
  ]),
]);

export const momentConditionRecord = (moment) => ({ ...moment, type: moment.type || 'Personal', archived: Boolean(moment.archived), status: getEventStatus(moment) });
export const activityConditionRecord = (activity) => ({
  ...activity, priority: activity.priority || 'medium', status: activityStatus(activity),
  completed: activityStatus(activity) === 'completed', cancelled: activityStatus(activity) === 'cancelled',
});
export const activityEntryConditionRecord = (entry) => ({ ...entry, activity: activityConditionRecord(entry.activity) });

// Finance summary totals follow only recorded transaction-date restrictions.
// Type, category, text and amount conditions narrow history without changing totals.
export const transactionDateConditions = (node) => {
  if (node?.kind !== 'group') return node?.field === 'date' ? node : null;
  const projected = node.children.map(transactionDateConditions);
  // An unrestricted OR branch permits every date. Removing it would narrow totals.
  if (node.join === 'OR' && projected.some((child) => !child)) return null;
  const children = projected.filter(Boolean);
  return children.length ? { ...node, children } : null;
};
