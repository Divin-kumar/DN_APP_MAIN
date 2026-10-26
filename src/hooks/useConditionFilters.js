import { useEffect, useMemo, useState } from 'react';
import usePersistentListState from './usePersistentListState';
import { compileConditionGroup, conditionCount, discoverConditionFields, emptyGroup, normalizeConditionGroup } from '../utils/conditionEngine';

const DEFAULT = Object.freeze({ group: emptyGroup(), saved: [], recent: [], history: [], migrationVersion: 0 });
const RULES = Object.freeze({
  group: (value) => value?.kind === 'group' && Array.isArray(value.children),
  saved: Array.isArray, recent: Array.isArray, history: Array.isArray,
  migrationVersion: (value) => Number.isSafeInteger(value) && value >= 0,
});
const newId = () => globalThis.crypto?.randomUUID?.() || `filter-${Date.now()}-${Math.random()}`;
const normalizePresets = (items) => {
  const ids = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.label !== 'string') return false;
    ids.add(item.id); return item.group?.kind === 'group';
  }).slice(0, 30).map((item) => ({ id: item.id, label: item.label.slice(0, 80), group: normalizeConditionGroup(item.group), favorite: item.favorite === true }));
};
const combineGroups = (existing, legacy) => {
  if (!legacy.children.length) return existing;
  if (!existing.children.length) return legacy;
  if (JSON.stringify(existing) === JSON.stringify(legacy)) return existing;
  return normalizeConditionGroup({ id: 'root', kind: 'group', join: 'AND', children: [existing, legacy] });
};
const groupKey = (group) => JSON.stringify(group, (key, value) => key === 'id' ? undefined : value);
const NO_OPTIONS = Object.freeze({});
const NO_SCHEMA = Object.freeze([]);
const todayKey = () => { const now = new Date(); return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`; };

// The optional injected hook keeps isolated page harnesses in the same scoped
// React tree. Legacy choices migrate once; saved presets and current rules stay.
export default function useConditionFilters(scope, records = [], useListState = usePersistentListState, options = NO_OPTIONS) {
  const configuration = Array.isArray(options) ? { schema: options } : options;
  const listKey = `conditions:${scope}${configuration.contextKey ? `:${configuration.contextKey}` : ''}`;
  const [stored, change, , storageKey] = useListState(listKey, DEFAULT, RULES);
  const [editorRevision, setEditorRevision] = useState(0);
  const [calendarDay, setCalendarDay] = useState(todayKey);
  const storedGroup = useMemo(() => normalizeConditionGroup(stored.group), [stored.group]);
  const legacyGroup = normalizeConditionGroup(configuration.initialGroup);
  const migrationVersion = configuration.migrationVersion ?? (configuration.initialGroup ? 1 : 0);
  const needsMigration = stored.migrationVersion < migrationVersion;
  const legacyKey = JSON.stringify(legacyGroup);
  const group = useMemo(() => needsMigration ? combineGroups(storedGroup, JSON.parse(legacyKey)) : storedGroup,
    [storedGroup, needsMigration, legacyKey]);
  const state = useMemo(() => ({ ...stored, group, saved: normalizePresets(stored.saved),
    recent: stored.recent.filter((id) => typeof id === 'string').slice(0, 8), history: normalizePresets(stored.history).slice(0, 8),
  }), [stored, group]);
  const schemaHints = configuration.schema || NO_SCHEMA;
  const schema = useMemo(() => discoverConditionFields(records, schemaHints), [records, schemaHints]);
  const matches = useMemo(() => compileConditionGroup(group, schema), [group, schema, calendarDay]);
  const activeCount = useMemo(() => conditionCount(group), [group]);

  useEffect(() => {
    if (needsMigration) change({ group, migrationVersion });
  }, [needsMigration, migrationVersion, group, change]);

  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const refresh = () => setCalendarDay(todayKey());
    const timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 50);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [calendarDay]);

  // Remember complete custom filters after the user pauses; these snapshots
  // remain useful even when they were never explicitly saved as a preset.
  useEffect(() => {
    if (!activeCount || needsMigration) return undefined;
    if (state.history[0] && groupKey(state.history[0].group) === groupKey(group)) return undefined;
    const timer = setTimeout(() => change((current) => {
      const key = groupKey(group);
      const history = normalizePresets(current.history);
      if (history[0] && groupKey(history[0].group) === key) return {};
      return { history: [{ id: newId(), label: `${activeCount} condition${activeCount === 1 ? '' : 's'}`, group, favorite: false },
        ...history.filter((item) => groupKey(item.group) !== key)].slice(0, 8) };
    }), 900);
    return () => clearTimeout(timer);
  }, [activeCount, group, listKey, needsMigration, change, state.history]);

  const setGroup = (transform) => change((current) => ({ group: normalizeConditionGroup(typeof transform === 'function'
    ? transform(normalizeConditionGroup(current.group)) : transform) }));
  const clear = () => {
    change({ group: emptyGroup(), migrationVersion: Math.max(migrationVersion, stored.migrationVersion) });
    setEditorRevision((current) => current + 1);
  };
  const save = (title) => {
    const label = String(title || '').trim().slice(0, 80);
    if (!label || !activeCount) return;
    change((current) => ({ saved: [{ id: newId(), label, group: normalizeConditionGroup(current.group), favorite: false }, ...normalizePresets(current.saved)].slice(0, 30) }));
  };
  const apply = (id) => {
    setEditorRevision((current) => current + 1);
    change((current) => {
      const choice = [...normalizePresets(current.saved), ...normalizePresets(current.history)].find((item) => item.id === id);
      return choice ? { group: normalizeConditionGroup(choice.group), recent: [id, ...current.recent.filter((item) => item !== id)].slice(0, 8) } : {};
    });
  };
  const favorite = (id) => change((current) => {
    const saved = normalizePresets(current.saved), preset = saved.find((item) => item.id === id);
    if (preset) return { saved: saved.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item) };
    const historical = normalizePresets(current.history).find((item) => item.id === id);
    return historical ? { saved: [{ ...historical, favorite: true }, ...saved].slice(0, 30) } : {};
  });
  const forget = (id) => change((current) => ({ saved: normalizePresets(current.saved).filter((item) => item.id !== id),
    history: normalizePresets(current.history).filter((item) => item.id !== id), recent: current.recent.filter((item) => item !== id) }));
  return { state, schema, matches, setGroup, clear, save, apply, favorite, forget, activeCount,
    scopeKey: storageKey || listKey, editorKey: `${storageKey || listKey}:${editorRevision}` };
}
