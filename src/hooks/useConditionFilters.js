import { useEffect, useMemo, useState } from 'react';
import usePersistentListState from './usePersistentListState';
import { compileConditionGroup, conditionCount, discoverConditionFields, emptyGroup, normalizeConditionGroup } from '../utils/conditionEngine';
import { getUserFilterFields, normalizeUserFilterGroup } from '../utils/userFilterSchema';
import useAppStore from '../store/useAppStore';

const DEFAULT = Object.freeze({ group: emptyGroup(), migrationVersion: 0 });
const RULES = Object.freeze({
  group: (value) => value?.kind === 'group' && Array.isArray(value.children),
  migrationVersion: (value) => Number.isSafeInteger(value) && value >= 0,
});
const normalizeGroup = (scope, group) => normalizeUserFilterGroup(scope, normalizeConditionGroup(group));
const combineGroups = (existing, legacy) => {
  if (!legacy.children.length) return existing;
  if (!existing.children.length) return legacy;
  if (JSON.stringify(existing) === JSON.stringify(legacy)) return existing;
  return normalizeConditionGroup({ id: 'root', kind: 'group', join: 'AND', children: [existing, legacy] });
};
const NO_OPTIONS = Object.freeze({});
const NO_SCHEMA = Object.freeze([]);
const todayKey = () => { const now = new Date(); return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`; };

// The optional injected hook keeps isolated page harnesses in the same scoped
// React tree. Legacy choices migrate once; the last active group persists.
export default function useConditionFilters(scope, records = [], useListState = usePersistentListState, options = NO_OPTIONS) {
  const configuration = Array.isArray(options) ? { schema: options } : options;
  const listKey = `conditions:${configuration.storageScope || scope}${configuration.contextKey ? `:${configuration.contextKey}` : ''}`;
  const [stored, change, , storageKey] = useListState(listKey, DEFAULT, RULES);
  const [editorRevision, setEditorRevision] = useState(0);
  const [calendarDay, setCalendarDay] = useState(todayKey);
  const storedGroup = useMemo(() => normalizeGroup(scope, stored.group), [scope, stored.group]);
  const legacyGroup = normalizeGroup(scope, configuration.initialGroup);
  const migrationVersion = configuration.migrationVersion ?? (configuration.initialGroup ? 1 : 0);
  const needsMigration = stored.migrationVersion < migrationVersion;
  const legacyKey = JSON.stringify(legacyGroup);
  const group = useMemo(() => needsMigration ? combineGroups(storedGroup, JSON.parse(legacyKey)) : storedGroup,
    [storedGroup, needsMigration, legacyKey]);
  const state = useMemo(() => ({ group, migrationVersion: stored.migrationVersion }), [stored.migrationVersion, group]);
  const schemaHints = configuration.schema || NO_SCHEMA;
  const moments = configuration.moments || NO_SCHEMA;
  const adminValues = useAppStore((current) => current.adminValues);
  const adminOwner = useAppStore((current) => current.adminValuesOwner);
  const owner = useAppStore((current) => current.user?.uid || (current.isGuest ? 'guest' : null));
  const scopedValues = owner && adminOwner === owner ? adminValues : NO_OPTIONS;
  const schema = useMemo(() => getUserFilterFields(scope, records, moments, scopedValues) || discoverConditionFields(records, schemaHints), [scope, records, moments, scopedValues, schemaHints]);
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

  const setGroup = (transform) => change((current) => ({ group: normalizeGroup(scope, typeof transform === 'function'
    ? transform(normalizeGroup(scope, current.group)) : transform),
    migrationVersion: Math.max(migrationVersion, current.migrationVersion) }));
  const restore = (target) => {
    change({ group: normalizeGroup(scope, target), migrationVersion: Math.max(migrationVersion, stored.migrationVersion) });
    setEditorRevision((current) => current + 1);
  };
  const clear = () => restore(emptyGroup());
  return { state, schema, matches, setGroup, clear, restore, activeCount,
    scopeKey: storageKey || listKey, editorKey: `${storageKey || listKey}:${editorRevision}` };
}
