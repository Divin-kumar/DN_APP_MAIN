// Saved list defaults have their own Settings page, independent from Code Lists.
import { ChevronDown, ListFilter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import './CodeListsPremium.css';
import './ListDefaults.css';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useTaskStore, { taskScopeKey } from '../store/useTaskStore';
import useScopedMoments from '../hooks/useScopedMoments';
import useConditionFilters from '../hooks/useConditionFilters';
import usePersistentListState from '../hooks/usePersistentListState';
import SortChips from '../components/common/SortChips';
import ConditionBuilder from '../components/common/ConditionBuilder';
import { momentConditionRecord, activityEntryConditionRecord } from '../utils/listConditionMigration';
import { projectActivities } from '../utils/activityRecords';
import { toTransactions } from '../utils/transactionFilters';
import { MOMENT_LIST_DEFAULTS, MOMENT_LIST_RULES, TRANSACTION_LIST_DEFAULTS, TRANSACTION_LIST_RULES, systemConditionGroup, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES, configuredConditionGroup } from '../utils/listViewDefaults';
import { ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES, ACTIVITY_SORTS } from '../utils/activityListState';
import { MOMENT_SORT_OPTIONS, TRANSACTION_SORT_OPTIONS, momentSortSummary, transactionSortSummary } from '../utils/userListSort';

import { conditionCount, emptyGroup, normalizeConditionGroup } from '../utils/conditionEngine';
import { taskFilterFields } from '../utils/taskConditionFields.js';
import { TASK_VIEW_DEFAULTS, TASK_VIEW_RULES, TASK_SORT_OPTIONS } from '../utils/taskViewDefaults.js';
import { formatMomentDate } from '../utils/momentDates.js';

// Settings owns independent baseline keys, not the active page's working keys.
// Filter editing still loads real field choices only when its panel opens.
function ListFilterPreferences({ domain }) {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const uid = user?.uid;
  const scope = `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;
  const scoped = useScopedMoments();
  const incomes = useIncomeStore((state) => state.incomes);
  const incomeScope = useIncomeStore((state) => state.loadedFor);
  const incomeError = useIncomeStore((state) => state.error);
  const loadIncomes = useIncomeStore((state) => state.loadIncomes);
  const expenses = useExpenseStore((state) => state.expenses);
  const expenseScope = useExpenseStore((state) => state.loadedFor);
  const expenseError = useExpenseStore((state) => state.error);
  const loadExpenses = useExpenseStore((state) => state.loadExpenses);
  const isFinance = domain === 'transactions';
  useEffect(() => {
    if (!isFinance || (!uid && !isGuest)) return;
    loadIncomes(uid, isGuest);
    loadExpenses(uid, isGuest);
  }, [isFinance, uid, isGuest, loadIncomes, loadExpenses]);
  const isFinanceReady = incomeScope === scope && expenseScope === scope;
  const records = useMemo(() => {
    if (isFinance) return isFinanceReady ? toTransactions(incomes, expenses) : [];
    if (!scoped.ready) return [];
    if (domain === 'moments') return scoped.events.map(momentConditionRecord);
    return projectActivities(scoped.events).map(activityEntryConditionRecord);
  }, [domain, isFinance, isFinanceReady, incomes, expenses, scoped.ready, scoped.events]);
  const initialGroup = systemConditionGroup(domain);
  const config = isFinance ? { initialGroup, moments: scoped.events, storageScope: `defaults:${domain}` }
    : { initialGroup, storageScope: `defaults:${domain}` };
  const conditions = useConditionFilters(domain, records, usePersistentListState, config);
  const notSignedIn = !uid && !isGuest;
  const loading = !notSignedIn && (!scoped.ready || (isFinance && !isFinanceReady));
  const error = Boolean(scoped.loadError || (isFinance && (incomeError || expenseError)));
  const retry = () => {
    scoped.retry();
    if (isFinance) { loadIncomes(uid, isGuest); loadExpenses(uid, isGuest); }
  };
  return <div className="dn-code-list-filter-editor" role="region" aria-label={`${domain} filters`}>
    {notSignedIn ? <p className="settings-helper">Sign in or continue as Guest to change your list filters.</p>
      : error ? <div role="alert" className="settings-helper">
        Your filter choices are saved, but records could not be loaded.
        <button type="button" className="settings-secondary-button" onClick={retry}>Retry loading filters</button>
      </div>
        : loading ? <p className="settings-helper" role="status">Loading your available filter choices…</p>
          : <>
            <ConditionBuilder filter={conditions} title={`${domain} default filters`} showChips />
          </>}
  </div>;
}

// Task defaults use Task-only fields (due timing and links), never Activity fields.
const EMPTY = Object.freeze([]);
function TaskDefaultFilterPreferences() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const scope = taskScopeKey({ user, isGuest });
  const taskStore = useTaskStore();
  const scoped = useScopedMoments();
  const [saved, setSaved, , editorKey] = usePersistentListState(
    'conditions:defaults:tasks', LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES);
  useEffect(() => { if (isGuest || user?.uid) taskStore.loadTasks(); }, [isGuest, user?.uid, scope, taskStore.loadTasks]);
  const ready = taskStore.loadedFor === scope && scoped.ready;
  const tasks = taskStore.loadedFor === scope && !taskStore.error ? taskStore.tasks : EMPTY;
  const moments = scoped.ready ? scoped.events : EMPTY;
  const schema = useMemo(() => taskFilterFields(tasks, moments, formatMomentDate(new Date())), [tasks, moments]);
  const group = configuredConditionGroup('tasks', saved);
  const setGroup = (transform) => setSaved((current) => ({
    group: normalizeConditionGroup(typeof transform === 'function'
      ? transform(configuredConditionGroup('tasks', current)) : transform),
    migrationVersion: Math.max(1, current.migrationVersion),
  }));
  const filter = {
    state: { group }, schema, editorKey,
    activeCount: conditionCount(group), setGroup,
    clear: () => setGroup(emptyGroup()),
  };
  return <div className="dn-code-list-filter-editor" role="region" aria-label="tasks filters">
    {!isGuest && !user?.uid ? <p className="settings-helper">Open a Guest or account workspace to configure Task filters.</p>
      : taskStore.error || scoped.loadError ? <p className="settings-helper" role="alert">
        Task filter choices are saved, but some records could not be loaded.
        <button type="button" onClick={() => { taskStore.loadTasks(); scoped.retry(); }}>Retry loading filters</button>
      </p> : !ready ? <p className="settings-helper" role="status">Loading Task filter choices…</p>
        : <ConditionBuilder filter={filter} title="Tasks default filters" showChips />}
  </div>;
}

const LISTS = [
  { domain: 'moments', label: 'Moments', defaults: MOMENT_LIST_DEFAULTS, rules: MOMENT_LIST_RULES, options: MOMENT_SORT_OPTIONS },
  { domain: 'activities', label: 'Activities', defaults: ACTIVITY_LIST_DEFAULTS, rules: ACTIVITY_LIST_RULES, options: ACTIVITY_SORTS },
  { domain: 'transactions', label: 'Transactions', defaults: TRANSACTION_LIST_DEFAULTS, rules: TRANSACTION_LIST_RULES, options: TRANSACTION_SORT_OPTIONS },
  { domain: 'tasks', label: 'Tasks', defaults: TASK_VIEW_DEFAULTS, rules: TASK_VIEW_RULES, options: TASK_SORT_OPTIONS },
];

function ListPreferences({ config, expanded, onToggle }) {
  const { domain, label, defaults, rules, options } = config;
  const [sort, setSort, resetSort] = usePersistentListState(`defaults:${domain}`, defaults, rules);
  // Read the baseline without loading records or mounting hidden filter editors.
  const [saved, setSaved] = usePersistentListState(`conditions:defaults:${domain}`, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES);
  const [revision, setRevision] = useState(0);
  const isFinance = domain === 'transactions';
  const [field, direction] = isFinance ? sort.sort.split('-') : [sort.field, sort.direction];
  const count = conditionCount(configuredConditionGroup(domain, saved));
  const summary = isFinance ? transactionSortSummary(sort.sort)
    : domain === 'moments' ? momentSortSummary(field, direction)
      : `${options.find((option) => option.value === field)?.label} · ${direction === 'asc' ? 'Ascending' : 'Descending'}`;
  const restore = () => {
    resetSort();
    setSaved({ group: systemConditionGroup(domain), migrationVersion: Math.max(1, saved.migrationVersion) });
    // Cancel any delayed editor input when restoring, as ConditionBuilder.restore does.
    setRevision((value) => value + 1);
  };
  return <section className="dn-defaults-domain" aria-label={`${label} defaults`}>
    <div className="settings-input-block dn-defaults-sort-card" data-sort-count={options.length}>
      <div className="dn-defaults-sort-label"><strong>{label}</strong><small>{summary}</small></div>
      <SortChips label={`Sort ${label} in settings`} field={field} direction={direction}
        options={options} onChange={(nextField, nextDirection) => setSort(isFinance
          ? { sort: `${nextField}-${nextDirection}` } : { field: nextField, direction: nextDirection })} />
    </div>
    <button type="button" className={`dn-list-filter-switch${expanded ? ' is-active' : ''}`}
      aria-label={`${label} filters`} aria-describedby={`dn-saved-filter-count-${domain}`}
      aria-expanded={expanded} aria-controls={`dn-filter-editor-${domain}`}
      onClick={onToggle}>
      <ListFilter size={16} aria-hidden="true" /><span>Filters</span>
      <small id={`dn-saved-filter-count-${domain}`}>{count ? `${count} saved` : 'None'}</small>
      <ChevronDown size={16} aria-hidden="true" className="dn-defaults-chevron" />
    </button>
    <div className="dn-list-filter-expanded" id={`dn-filter-editor-${domain}`} hidden={!expanded}>
      {expanded ? domain === 'tasks' ? <TaskDefaultFilterPreferences key={`${domain}:${revision}`} />
        : <ListFilterPreferences key={`${domain}:${revision}`} domain={domain} /> : null}
    </div>
    <button type="button" className="dn-defaults-factory" aria-label={`Restore built-in defaults for ${label}`}
      onClick={restore}>Restore built-in sorting and filters</button>
  </section>;
}

function ListOrderingPreferences() {
  const [editingFilters, setEditingFilters] = useState(null);
  return <section className="settings-section code-list-section" id="list-order" aria-label="List sorting and filters preferences">
    <div className="settings-section-heading"><h3>List defaults</h3></div>
    <div className="dn-defaults-intro">
      <p>In any list, open <strong>Refine</strong> and tap <strong>Reset</strong> to load these defaults.</p>
      <p className="dn-defaults-saved">Changes save automatically in this browser.</p>
    </div>
    <div className="dn-defaults-domains">
      {LISTS.map((config) => <ListPreferences key={config.domain} config={config}
        expanded={editingFilters === config.domain}
        onToggle={() => setEditingFilters((current) => current === config.domain ? null : config.domain)} />)}
    </div>
  </section>;
}

export default function ListDefaults() {
  return <div className="feature-page settings-page about-page dn-premium-code-lists dn-list-defaults-page">
    <ListOrderingPreferences />
  </div>;
}
