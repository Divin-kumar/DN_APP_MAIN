// Shared by the Activities page and direct Activity Detail navigation.
export const ACTIVITY_LIST_DEFAULTS = Object.freeze({ search: '', filter: 'all', momentId: '', momentType: '', parentScope: 'active', field: 'date', direction: 'asc' });
export const ACTIVITY_FILTERS = Object.freeze([['all', 'All'], ['in-progress', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']]);
export const ACTIVITY_SORTS = Object.freeze([{ value: 'date', label: 'Due date' }, { value: 'title', label: 'Title' }, { value: 'priority', label: 'Priority' }, { value: 'status', label: 'Status' }]);
export const ACTIVITY_LIST_RULES = Object.freeze({ filter: ACTIVITY_FILTERS.map(([value]) => value), parentScope: ['active', 'archived', 'all'], field: ACTIVITY_SORTS.map(({ value }) => value), direction: ['asc', 'desc'] });
