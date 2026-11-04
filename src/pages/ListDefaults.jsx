// Saved list defaults have their own Settings page, independent from Code Lists.
import { Hash, ListFilter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import './CodeListsPremium.css';
import useAppStore from '../store/useAppStore';
import useIncomeStore from '../store/useIncomeStore';
import useExpenseStore from '../store/useExpenseStore';
import useScopedMoments from '../hooks/useScopedMoments';
import useConditionFilters from '../hooks/useConditionFilters';
import usePersistentListState from '../hooks/usePersistentListState';
import SortChips from '../components/common/SortChips';
import ConditionBuilder from '../components/common/ConditionBuilder';
import { momentConditionRecord, activityEntryConditionRecord } from '../utils/listConditionMigration';
import { projectActivities } from '../utils/activityRecords';
import { toTransactions } from '../utils/transactionFilters';
import { MOMENT_LIST_DEFAULTS, MOMENT_LIST_RULES, TRANSACTION_LIST_DEFAULTS, TRANSACTION_LIST_RULES, systemConditionGroup } from '../utils/listViewDefaults';
import { ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES, ACTIVITY_SORTS } from '../utils/activityListState';
import { MOMENT_SORT_OPTIONS, TRANSACTION_SORT_OPTIONS } from '../utils/userListSort';

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
  const settings = domain === 'moments' ? MOMENT_LIST_DEFAULTS
    : domain === 'activities' ? ACTIVITY_LIST_DEFAULTS : TRANSACTION_LIST_DEFAULTS;
  const rules = domain === 'moments' ? MOMENT_LIST_RULES
    : domain === 'activities' ? ACTIVITY_LIST_RULES : TRANSACTION_LIST_RULES;
  const [, , resetSavedSort] = usePersistentListState(`defaults:${domain}`, settings, rules);
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
            <div className="dn-defaults-filter-heading">
              <div><strong>Saved filter baseline</strong><small>Changes save automatically on this device.</small></div>
              <span className="dn-defaults-saved">Default</span>
            </div>
            <ConditionBuilder filter={conditions} title={`${domain} default filters`} showChips />
            <div className="dn-defaults-filter-footer">
              <p>Reset restores the saved filters and sort order. Browsing changes stay separate.</p>
              <button type="button" className="dn-defaults-factory" onClick={() => {
                resetSavedSort();
                conditions.restore(systemConditionGroup(domain));
              }}>Restore built-in defaults</button>
            </div>
          </>}
  </div>;
}

function ListOrderingPreferences() {
  const [moments, setMoments] = usePersistentListState('defaults:moments', MOMENT_LIST_DEFAULTS, MOMENT_LIST_RULES);
  const [activities, setActivities] = usePersistentListState('defaults:activities', ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES);
  const [finance, setFinance] = usePersistentListState('defaults:transactions', TRANSACTION_LIST_DEFAULTS, TRANSACTION_LIST_RULES);
  const [financeField, financeDirection] = finance.sort.split('-');
  const [editingFilters, setEditingFilters] = useState(null);
  return <section className="settings-section code-list-section" id="list-order" aria-label="List sorting and filters preferences">
    <div className="settings-section-heading">
      <span className="settings-accordion-icon"><Hash size={18} aria-hidden="true" /></span>
      <div><h3>List sorting and filters</h3></div>
    </div>
    <div className="dn-defaults-intro">
      <span className="dn-defaults-kicker">YOUR LIST DEFAULTS</span>
      <p>Choose saved sorting and filters. <strong>Reset</strong> on each list restores these choices.</p>
      <span className="dn-defaults-saved">Saved automatically · This device</span>
    </div>
    <div className="settings-admin-grid dn-list-sort-settings">
      <div className="settings-input-block dn-defaults-sort-card">
        <div className="dn-defaults-sort-label"><strong>Moments</strong><small>Default order</small></div>
        <SortChips label="Sort Moments in settings" field={moments.field} direction={moments.direction}
          options={MOMENT_SORT_OPTIONS} onChange={(field, direction) => setMoments({ field, direction })} />
      </div>
      <div className="settings-input-block dn-defaults-sort-card">
        <div className="dn-defaults-sort-label"><strong>Activities</strong><small>Default order</small></div>
        <SortChips label="Sort Activities in settings" field={activities.field} direction={activities.direction}
          options={ACTIVITY_SORTS} onChange={(field, direction) => setActivities({ field, direction })} />
      </div>
      <div className="settings-input-block dn-defaults-sort-card">
        <div className="dn-defaults-sort-label"><strong>Transactions</strong><small>Default order</small></div>
        <SortChips label="Sort Transactions in settings" field={financeField} direction={financeDirection}
          options={TRANSACTION_SORT_OPTIONS}
          onChange={(field, direction) => setFinance({ sort: `${field}-${direction}` })} />
      </div>
    </div>
    <div className="dn-list-filter-preferences">
      <div className="dn-list-filter-intro">
        <h4>Default filters</h4>
        <p className="code-list-description">Choose what each list restores when you tap Reset.</p>
      </div>
      <div className="dn-list-filter-switches" role="group" aria-label="Choose list filters to edit">
        {[
          { domain: 'moments', label: 'Moments' },
          { domain: 'activities', label: 'Activities' },
          { domain: 'transactions', label: 'Transactions' },
        ].map(({ domain, label }) => <button key={domain} type="button"
          className={`dn-list-filter-switch${editingFilters === domain ? ' is-active' : ''}`}
          aria-expanded={editingFilters === domain} aria-controls={`dn-filter-editor-${domain}`}
          onClick={() => setEditingFilters((current) => current === domain ? null : domain)}>
          <ListFilter size={15} aria-hidden="true" /><span>{label} filters</span>
          <small>{editingFilters === domain ? 'Close' : 'Set defaults'}</small>
        </button>)}
      </div>
      {editingFilters ? <div className="dn-list-filter-expanded" id={`dn-filter-editor-${editingFilters}`}>
        <ListFilterPreferences key={editingFilters} domain={editingFilters} />
      </div> : null}
    </div>
  </section>;
}

export default function ListDefaults() {
  return <div className="feature-page settings-page about-page dn-premium-code-lists dn-list-defaults-page">
    <ListOrderingPreferences />
  </div>;
}
