// Settings defaults are separate from each page's working list state.
// These are scoped browser UI preferences only. No record or Firebase writes.
import { emptyGroup, normalizeConditionGroup } from './conditionEngine.js';
import { normalizeUserFilterGroup } from './userFilterSchema.js';
import { momentConditions, activityConditions, transactionConditions } from './listConditionMigration.js';
import { ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES } from './activityListState.js';
import { MOMENT_SORT_OPTIONS, TRANSACTION_SORT_VALUES } from './userListSort.js';
import { listStateKey, listStateMemory } from './listStateMemory.js';

export const MOMENT_LIST_DEFAULTS = Object.freeze({ search: '', category: 'All moments', field: 'date', direction: 'asc' });
export const MOMENT_LIST_RULES = Object.freeze({ field: MOMENT_SORT_OPTIONS.map(({ value }) => value), direction: ['asc', 'desc'] });
export const TRANSACTION_LIST_DEFAULTS = Object.freeze({ type: 'all', month: 'all', search: '', sort: 'date-desc' });
export const TRANSACTION_LIST_RULES = Object.freeze({
  type: ['all', 'income', 'expense'],
  month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value),
  sort: TRANSACTION_SORT_VALUES,
});
export const LIST_CONDITION_DEFAULTS = Object.freeze({ group: emptyGroup(), migrationVersion: 0 });
export const LIST_CONDITION_RULES = Object.freeze({
  group: (value) => value?.kind === 'group' && Array.isArray(value.children),
  migrationVersion: (value) => Number.isSafeInteger(value) && value >= 0,
});
export const LIST_DOMAINS = Object.freeze({
  moments: { defaults: MOMENT_LIST_DEFAULTS, rules: MOMENT_LIST_RULES },
  activities: { defaults: ACTIVITY_LIST_DEFAULTS, rules: ACTIVITY_LIST_RULES },
  transactions: { defaults: TRANSACTION_LIST_DEFAULTS, rules: TRANSACTION_LIST_RULES },
});
export const systemConditionGroup = (domain) => {
  const filters = LIST_DOMAINS[domain]?.defaults;
  if (!filters) throw new Error('Unknown list defaults domain.');
  return domain === 'moments' ? momentConditions(filters)
    : domain === 'activities' ? activityConditions(filters) : transactionConditions(filters);
};
export const configuredConditionGroup = (domain, stored) => normalizeUserFilterGroup(domain,
  normalizeConditionGroup(stored?.migrationVersion >= 1 ? stored.group : systemConditionGroup(domain)));

const withoutIds = (node) => node?.kind === 'group'
  ? { kind: 'group', join: node.join, children: node.children.map(withoutIds) }
  : { kind: 'rule', field: node?.field, operator: node?.operator, value: node?.value };
export const matchesListDefaults = (current, defaults, currentGroup, defaultGroup) =>
  Object.keys(defaults).every((field) => JSON.stringify(current?.[field]) === JSON.stringify(defaults[field]))
  && JSON.stringify(withoutIds(normalizeConditionGroup(currentGroup))) === JSON.stringify(withoutIds(normalizeConditionGroup(defaultGroup)));

// Called only after successful Settings → Reset all settings; preserve all
// business records, user scope, current page choices, and old filter presets.
export const resetSavedListDefaultsForScope = (scope) => {
  if (!scope || scope === 'signed-out') return;
  for (const [domain, config] of Object.entries(LIST_DOMAINS)) {
    listStateMemory.reset(listStateKey(scope, `defaults:${domain}`), config.defaults, config.rules);
    listStateMemory.update(listStateKey(scope, `conditions:defaults:${domain}`),
      LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES,
      { group: systemConditionGroup(domain), migrationVersion: 1 });
  }
};
