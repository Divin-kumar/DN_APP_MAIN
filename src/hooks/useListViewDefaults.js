import usePersistentListState from './usePersistentListState';
import { LIST_DOMAINS, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES, configuredConditionGroup } from '../utils/listViewDefaults';

// Read Settings defaults without subscribing to any live page filter state.
export default function useListViewDefaults(domain) {
  const config = LIST_DOMAINS[domain];
  if (!config) throw new Error('Unknown list defaults domain.');
  const [filters, setFilters, resetFilters] = usePersistentListState(`defaults:${domain}`, config.defaults, config.rules);
  const [saved] = usePersistentListState(`conditions:defaults:${domain}`, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES);
  return { filters, setFilters, resetFilters, group: configuredConditionGroup(domain, saved) };
}
