import usePersistentListState from './usePersistentListState';
import { conditionCount, discoverConditionFields, emptyGroup, matchesConditionGroup } from '../utils/conditionEngine';

const DEFAULT = Object.freeze({ group: emptyGroup(), saved: [], recent: [] });
const RULES = Object.freeze({
  group: (value) => value?.kind === 'group' && Array.isArray(value.children),
  saved: Array.isArray,
  recent: Array.isArray,
});
const newId = () => globalThis.crypto?.randomUUID?.() || `filter-${Date.now()}-${Math.random()}`;

// Accept the caller's persistent-list hook so isolated page harnesses use the
// same account-scoped hook they already inject, rather than a second React tree.
export default function useConditionFilters(scope, records = [], useListState = usePersistentListState) {
  const [state, change] = useListState(`conditions:${scope}`, DEFAULT, RULES);
  const schema = discoverConditionFields(records);
  const matches = (record) => matchesConditionGroup(record, state.group, schema);
  const setGroup = (transform) => change((current) => ({
    group: typeof transform === 'function' ? transform(current.group) : transform,
  }));
  const clear = () => change({ group: emptyGroup() });
  const save = (title) => {
    const label = String(title || '').trim();
    if (!label || conditionCount(state.group) === 0) return;
    change((current) => ({
      saved: [{ id: newId(), label, group: structuredClone(current.group), favorite: false }, ...current.saved].slice(0, 30),
    }));
  };
  const apply = (id) => change((current) => {
    const choice = current.saved.find((item) => item.id === id);
    if (!choice) return {};
    return {
      group: structuredClone(choice.group),
      recent: [id, ...current.recent.filter((item) => item !== id)].slice(0, 8),
    };
  });
  const favorite = (id) => change((current) => ({
    saved: current.saved.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item),
  }));
  const forget = (id) => change((current) => ({
    saved: current.saved.filter((item) => item.id !== id),
    recent: current.recent.filter((item) => item !== id),
  }));
  return { state, schema, matches, setGroup, clear, save, apply, favorite, forget, activeCount: conditionCount(state.group) };
}
