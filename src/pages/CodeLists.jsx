/**
 * CodeLists.jsx
 *
 * Purpose:
 * A configuration screen for custom categories and defaults that shape the user experience.
 * This file lets people define the labels used throughout the app for moments, income, expense,
 * and reminder behavior without changing the underlying software code.
 *
 * Main Responsibilities:
 * - manage reusable list values used across the app
 * - keep active and inactive values organized
 * - track whether a value is still in use before deleting it
 * - keep the app aligned with each user's terminology and personal setup
 */
import { ArrowLeft, BellRing, Check, Hash, ListFilter, PencilLine, Plus, ShieldOff, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModalDialog from '../components/common/ModalDialog';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { DEFAULT_CODE_LISTS, serializeCodeListEntries } from '../utils/codeLists';
import SwipeActionCard from '../components/common/SwipeActionCard';
import RichTextEditor from '../components/common/RichTextEditor';
import RichText from '../components/common/RichText';
import DropdownSelect from '../components/common/DropdownSelect';
import { resolveMomentStoryPresentation, STORY_PRESENTATIONS } from '../utils/momentStory';
import SortControl from '../components/common/SortControl';
import ConditionBuilder, { ConditionChips } from '../components/common/ConditionBuilder';
import useConditionFilters from '../hooks/useConditionFilters';
import useScopedMoments from '../hooks/useScopedMoments';
import { momentConditions, momentConditionRecord, activityConditions, activityEntryConditionRecord, transactionConditions } from '../utils/listConditionMigration';
import { projectActivities } from '../utils/activityRecords';
import { getActiveSampleScenario } from '../dev/sampleData';
import { toTransactions } from '../utils/transactionFilters';
import usePersistentListState from '../hooks/usePersistentListState';
import { ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES, ACTIVITY_SORTS } from '../utils/activityListState';
import { MOMENT_SORT_OPTIONS, TRANSACTION_SORT_OPTIONS, TRANSACTION_SORT_VALUES, transactionSortForField } from '../utils/userListSort';

const sanitizeEntries = (items) => serializeCodeListEntries(items || DEFAULT_CODE_LISTS.eventTypes);

const getRecordUsageCount = (listKey, value, state) => {
  const { events, expenses, incomes, preferences } = state;

  switch (listKey) {
    case 'eventTypes':
      return events.filter((event) => event.type === value || event.customType === value).length;
    case 'expenseCategories':
      return expenses.filter((expense) => expense.category === value).length;
    case 'incomeTypes':
      return incomes.filter((income) => income.type === value).length;
    case 'paymentMethods':
      return [...incomes, ...expenses].filter((record) => record.paymentMethod === value).length;
    case 'activityPriorities':
      return events.reduce((count, event) => count + (event.activities || []).filter((activity) => activity.priority === value).length, 0);
    case 'reminderPresets':
      return preferences?.notifications?.reminderTime === value ? 1 : 0;
    default:
      return 0;
  }
};

function CodeListSection({ title, description, listKey, placeholder, allowLabels = false }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const preferences = useAppStore((state) => state.preferences);
  const setAdminValues = useAppStore((state) => state.setAdminValues);
  const showToast = useAppStore((state) => state.showToast);
  const isGuest = useAppStore((state) => state.isGuest);
  const events = useEventStore((state) => state.events);
  const expenses = useExpenseStore((state) => state.expenses);
  const incomes = useIncomeStore((state) => state.incomes);
  const [draft, setDraft] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [editingValue, setEditingValue] = useState(null);
  const [warningValue, setWarningValue] = useState(null);
  const [momentTypeEditor, setMomentTypeEditor] = useState(null);
  const isMomentTypeEditorOpen = Boolean(momentTypeEditor);
  const momentTypeTitleRef = useRef(null);

  useEffect(() => {
    if (!momentTypeEditor) return undefined;
    const frameId = window.requestAnimationFrame(() => momentTypeTitleRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [isMomentTypeEditorOpen]);

  const entries = useMemo(() => {
    const source = Array.isArray(adminValues[listKey])
      ? adminValues[listKey]
      : DEFAULT_CODE_LISTS[listKey] || [];
    return sanitizeEntries(source).sort((a, b) => a.label.localeCompare(b.label));
  }, [adminValues, listKey]);
  const activeEntries = entries.filter((entry) => entry.active !== false && entry.isActive !== false);
  const inactiveEntries = entries.filter((entry) => entry.active === false || entry.isActive === false);

  const usageMap = useMemo(() => Object.fromEntries(
    entries.map((entry) => [entry.value, getRecordUsageCount(listKey, entry.value, { events, expenses, incomes, preferences })]),
  ), [entries, events, expenses, incomes, preferences, listKey]);

  const updateEntries = async (nextEntries) => {
    try {
      await setAdminValues({ [listKey]: nextEntries });
      showToast(isGuest ? 'Code List saved on this device' : 'Code List saved to your account', 'success');
      return true;
    } catch (error) {
      console.error('Unable to save Code List:', error);
      showToast(error.message || 'Code List could not be saved', 'danger');
      return false;
    }
  };

  const upsertEntry = (nextValue, nextLabel) => {
    const normalizedValue = nextValue.trim();
    if (!normalizedValue) return;
    const createdEntry = {
      value: normalizedValue,
      label: (nextLabel || normalizedValue).trim() || normalizedValue,
      active: true,
      isActive: true,
    };
    const nextEntries = entries.some((entry) => entry.value === normalizedValue)
      ? entries.map((entry) => (entry.value === normalizedValue ? { ...entry, label: createdEntry.label, active: true, isActive: true } : entry))
      : [...entries, createdEntry];

    updateEntries(nextEntries);
    setDraft('');
    setDraftLabel('');
  };

  const openMomentTypeEditor = (entry = null) => {
    const baseEntry = entry || { value: '', label: '', canGenerateGreetingCards: true, greetingTemplate: '', showInDashboardUpcoming: true, showActivitiesOnDashboard: true };
    setMomentTypeEditor({
      existingValue: baseEntry.value || null,
      title: baseEntry.label || baseEntry.value || '',
      canGenerateGreetingCards: baseEntry.canGenerateGreetingCards ?? true,
      greetingTemplate: typeof baseEntry.greetingTemplate === 'string' ? baseEntry.greetingTemplate : '',
      showInDashboardUpcoming: baseEntry.showInDashboardUpcoming ?? true,
      showActivitiesOnDashboard: baseEntry.showActivitiesOnDashboard ?? true,
      storyPresentation: Object.values(STORY_PRESENTATIONS).includes(baseEntry.storyPresentation) ? baseEntry.storyPresentation : '',
    });
  };

  const saveMomentTypeEditor = async () => {
    const title = momentTypeEditor?.title?.trim();
    if (!title) return;

    const nextEntry = {
      value: title,
      label: title,
      active: true,
      isActive: true,
      canGenerateGreetingCards: Boolean(momentTypeEditor.canGenerateGreetingCards),
      greetingTemplate: momentTypeEditor.canGenerateGreetingCards ? momentTypeEditor.greetingTemplate : '',
      showInDashboardUpcoming: momentTypeEditor.showInDashboardUpcoming !== false,
      showActivitiesOnDashboard: momentTypeEditor.showActivitiesOnDashboard !== false,
      storyPresentation: momentTypeEditor.storyPresentation || null,
    };

    const nextEntries = entries.some((entry) => entry.value === (momentTypeEditor.existingValue || title))
      ? entries.map((entry) => (entry.value === (momentTypeEditor.existingValue || title) ? { ...entry, ...nextEntry } : entry))
      : [...entries, nextEntry];

    if (await updateEntries(nextEntries)) setMomentTypeEditor(null);
  };

  const getGreetingTemplatePreview = (template) => {
    const fallback = 'Happy 1st Birthday Alex';
    const nextTemplate = (template || '').trim();
    if (!nextTemplate) return fallback;

    const replacements = {
      name: 'Alex',
      eventName: 'Birthday',
      ordinal: '1st',
      title: 'Birthday',
      month: 'October',
      date: '15',
    };

    return nextTemplate.replace(/\{(\w+)\}/g, (match, key) => replacements[key] || match);
  };

  const handleDelete = (entry) => {
    const usageCount = usageMap[entry.value] || 0;
    if (usageCount === 0) {
      updateEntries(entries.filter((item) => item.value !== entry.value));
      return;
    }

    setWarningValue({ entry, usageCount, label: entry.label });
  };

  const handleDisable = (entry) => {
    updateEntries(entries.map((item) => (item.value === entry.value ? { ...item, active: false, isActive: false } : item)));
  };

  const handleActivate = (entry) => {
    const nextEntries = entries.map((item) => (item.value === entry.value ? { ...item, active: true, isActive: true } : item));
    updateEntries(nextEntries);
  };

  const handleRename = (entry, nextValue) => {
    const trimmed = nextValue.trim();
    if (!trimmed) return;

    updateEntries(entries.map((item) => {
      if (item.value !== entry.value) return item;
      if (listKey === 'eventTypes') {
        return {
          ...item,
          value: trimmed,
          label: trimmed,
          canGenerateGreetingCards: item.canGenerateGreetingCards ?? true,
          greetingTemplate: typeof item.greetingTemplate === 'string' ? item.greetingTemplate : '',
          showInDashboardUpcoming: item.showInDashboardUpcoming ?? true,
          showActivitiesOnDashboard: item.showActivitiesOnDashboard ?? true,
        };
      }
      return { ...item, value: trimmed, label: trimmed };
    }));
    setEditingValue(null);
  };

  const renderEntry = (entry) => {
    const usageCount = usageMap[entry.value] || 0;
    const isInactive = entry.active === false || entry.isActive === false;
    const hasStatusAction = isInactive || usageCount > 0;

    return (
      <SwipeActionCard key={`${listKey}-${entry.value}`} as="div"
        className={`code-list-item${isInactive ? ' is-inactive' : ''}`}
        mainClassName="code-list-swipe-content" label={entry.label} openOnTap
        otherActions={[
          { label: 'Edit', icon: PencilLine, onClick: () => {
            if (listKey === 'eventTypes') openMomentTypeEditor(entry);
            else setEditingValue(entry);
          } },
          ...(isInactive ? [{
            label: 'Activate', icon: Check, onClick: () => handleActivate(entry),
          }] : hasStatusAction ? [{
            label: 'Disable', icon: ShieldOff, onClick: () => handleDisable(entry),
          }] : []),
        ]}
        onDelete={() => handleDelete(entry)}>
        <button type="button" className="code-list-row"
          aria-label={`${entry.label}${isInactive ? ', inactive' : ''}. Tap or swipe either direction for actions.`}>
          <span className="code-list-main">
            <span className="code-list-text">{entry.label}</span>
            {isInactive ? <span className="code-list-status">Inactive</span> : null}
          </span>
        </button>
      </SwipeActionCard>
    );
  };

  return (
    <section className={`settings-section code-list-section ${listKey === 'eventTypes' ? 'has-modal-add' : ''}`}>
      <div className="settings-section-heading">
        <span className="settings-accordion-icon"><Hash size={18} /></span>
        <div>
          <h3>{title}</h3>
        </div>
        {listKey === 'eventTypes' ? (
          <button type="button" className="settings-tag-add moment-type-add-button" onClick={() => openMomentTypeEditor()}>
            <Plus size={15} /> Add
          </button>
        ) : null}
      </div>
      <p className="code-list-description">{description}</p>

      {listKey !== 'eventTypes' ? (
        <div className={`code-list-add-row ${allowLabels ? 'has-labels' : ''}`}>
          {allowLabels ? (
            <>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
              <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} placeholder="Label" aria-label="Label" />
            </>
          ) : (
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
          )}
          <button type="button" className="settings-tag-add" onClick={() => upsertEntry(draft, allowLabels ? draftLabel : undefined)}><Plus size={15} aria-hidden="true" /> Add</button>
        </div>
      ) : null}

      <div className="code-list-groups">
        <section className="code-list-group" aria-label="Active values">
          <h4 className="code-list-group-heading">Active values <span>{activeEntries.length}</span></h4>
          <div className="code-list-rows">
            {activeEntries.length ? activeEntries.map(renderEntry) : <div className="code-list-empty">No active values</div>}
          </div>
        </section>

        {inactiveEntries.length ? (
          <section className="code-list-group" aria-label="Inactive values">
            <h4 className="code-list-group-heading">Inactive values <span>{inactiveEntries.length}</span></h4>
            <div className="code-list-rows">
              {inactiveEntries.map(renderEntry)}
            </div>
          </section>
        ) : null}
      </div>

      {editingValue ? (
        <ModalDialog title="Edit value" className="code-list-rename-dialog" onClose={() => setEditingValue(null)}>
          <div className="code-list-editor-modal">
            <label className="settings-input-block">
              <span>Value</span>
              <input
                className="code-list-rename-input"
                autoFocus
                value={editingValue.label}
                onChange={(event) => setEditingValue({ ...editingValue, label: event.target.value })}
                placeholder="Enter a value"
              />
            </label>
            <div className="settings-actions">
              <button type="button" className="settings-secondary-button" onClick={() => setEditingValue(null)}>Cancel</button>
              <button type="button" className="settings-primary-button" onClick={() => handleRename(editingValue, editingValue.label)}>Save changes</button>
            </div>
          </div>
        </ModalDialog>
      ) : null}

      {momentTypeEditor ? (
        <ModalDialog title={entries.some((entry) => entry.value === (momentTypeEditor.existingValue || momentTypeEditor.title)) ? 'Edit moment type' : 'New moment type'} className="code-list-rename-dialog moment-type-dialog" onClose={() => setMomentTypeEditor(null)}>
          <div className="moment-type-form">
            <label className="settings-input-block">
              <span>Title</span>
              <input
                ref={momentTypeTitleRef}
                autoFocus
                value={momentTypeEditor.title}
                onChange={(event) => setMomentTypeEditor((current) => ({ ...current, title: event.target.value }))}
                placeholder="Enter a title"
              />
            </label>

            <div className="settings-input-block moment-type-story-setting">
              <label htmlFor="moment-type-story-presentation">Story presentation</label>
              <DropdownSelect id="moment-type-story-presentation" value={momentTypeEditor.storyPresentation}
                onChange={(changeEvent) => setMomentTypeEditor((current) => ({ ...current, storyPresentation: changeEvent.target.value }))}>
                <option value="">Automatic (based on type)</option>
                <option value="journey">Journal · Photo memory book</option>
                <option value="diary">Diary · Monthly writing</option>
                <option value="chronicle">Tasks · Status-first list</option>
              </DropdownSelect>
              <small className="settings-helper" aria-live="polite">
                {momentTypeEditor.storyPresentation
                  ? `This Moment Type displays its Story as ${momentTypeEditor.storyPresentation === 'journey' ? 'a photo-focused memory book' : momentTypeEditor.storyPresentation === 'diary' ? 'a monthly writing journal' : 'a status-first task list'}.`
                  : `Automatic selects ${resolveMomentStoryPresentation({ type: momentTypeEditor.title || 'Personal' }, [])} for this type. Changes affect presentation only, not Activities or dates.`}
              </small>
            </div>

            <div className="moment-type-switch-list">
              <div className="moment-type-switch-row">
                <span>Show Moments on Dashboard</span>
                <button type="button" className="moment-type-switch" role="switch" aria-label="Show Moments on Dashboard" aria-checked={momentTypeEditor.showInDashboardUpcoming} onClick={() => setMomentTypeEditor((current) => ({ ...current, showInDashboardUpcoming: !current.showInDashboardUpcoming }))}>
                  <span className="moment-type-switch-thumb" />
                </button>
              </div>
              <div className="moment-type-switch-row">
                <span>Show Activities on Dashboard</span>
                <button type="button" className="moment-type-switch" role="switch" aria-label="Show Activities on Dashboard" aria-checked={momentTypeEditor.showActivitiesOnDashboard} onClick={() => setMomentTypeEditor((current) => ({ ...current, showActivitiesOnDashboard: !current.showActivitiesOnDashboard }))}>
                  <span className="moment-type-switch-thumb" />
                </button>
              </div>
              <div className="moment-type-switch-row">
                <span>Greeting Cards</span>
                <button type="button" className="moment-type-switch" role="switch" aria-label="Greeting Cards" aria-checked={momentTypeEditor.canGenerateGreetingCards} onClick={() => setMomentTypeEditor((current) => ({ ...current, canGenerateGreetingCards: !current.canGenerateGreetingCards }))}>
                  <span className="moment-type-switch-thumb" />
                </button>
              </div>
            </div>

            {momentTypeEditor.canGenerateGreetingCards ? (
              <div className="moment-type-template-field">
                <div className="settings-input-block">
                  <RichTextEditor label="Greeting Template" value={momentTypeEditor.greetingTemplate}
                    onChange={(greetingTemplate) => setMomentTypeEditor((current) => ({ ...current, greetingTemplate }))}
                    placeholder="Happy {ordinal} {eventName} {name}" />
                  <small className="settings-placeholder-guide">Supported placeholders: {'{name}'}, {'{eventName}'}, {'{ordinal}'}</small>
                </div>

                <div className="moment-type-preview" aria-live="polite">
                  <span>Preview</span>
                  <RichText className="free-text-preview is-truncated" value={getGreetingTemplatePreview(momentTypeEditor.greetingTemplate)} />
                </div>
              </div>
            ) : null}

            <div className="settings-actions">
              <button type="button" className="settings-secondary-button" onClick={() => setMomentTypeEditor(null)}>Cancel</button>
              <button type="button" className="settings-primary-button" onClick={saveMomentTypeEditor}>Save moment type</button>
            </div>
          </div>
        </ModalDialog>
      ) : null}

      {warningValue ? (
        <ModalDialog title="Value is currently in use" onClose={() => setWarningValue(null)}>
          <div className="settings-helper" style={{ marginBottom: '16px' }}>
            {warningValue.label} is currently used by {warningValue.usageCount} {listKey === 'eventTypes' ? 'moment record' : listKey === 'expenseCategories' ? 'expense record' : listKey === 'incomeTypes' ? 'income record' : listKey === 'paymentMethods' ? 'transaction' : listKey === 'activityPriorities' ? 'activity record' : 'related record'}{warningValue.usageCount === 1 ? '' : 's'}.
            Deleting this value may affect existing records and reporting.
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={() => setWarningValue(null)}>Cancel</button>
            <button type="button" className="settings-primary-button" onClick={() => { handleDisable(warningValue.entry); setWarningValue(null); }}>Disable Value</button>
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}

function PaymentMethodsSection() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const uid = user?.uid;
  const scope = `${isGuest ? 'guest' : 'user'}:${uid || 'anonymous'}`;
  const incomes = useIncomeStore();
  const expenses = useExpenseStore();
  useEffect(() => {
    if (!uid && !isGuest) return;
    incomes.loadIncomes(uid, isGuest);
    expenses.loadExpenses(uid, isGuest);
  }, [uid, isGuest, incomes.loadIncomes, expenses.loadExpenses]);
  if (incomes.error || expenses.error) return <section className="settings-section" role="alert">
    <h3>Payment Methods</h3>
    <p>Transactions could not be loaded to check which methods are in use.</p>
    <button type="button" className="settings-secondary-button" onClick={() => {
      incomes.loadIncomes(uid, isGuest); expenses.loadExpenses(uid, isGuest);
    }}>Retry loading payment methods</button>
  </section>;
  if (incomes.loadedFor !== scope || expenses.loadedFor !== scope) return <section className="settings-section" role="status">Loading payment methods…</section>;
  return <CodeListSection title="Payment Methods" description="Add payment choices for new transactions and filters. Disabling or renaming a choice keeps earlier transactions unchanged." listKey="paymentMethods" placeholder="Add payment method" />;
}


// Safe, fixed sort fields are view preferences, not editable Code List IDs.
// Use the same scoped list-state keys and validation rules as each live list.
const MOMENT_SORT_DEFAULTS = Object.freeze({ search: '', category: 'All moments', field: 'date', direction: 'asc' });
const MOMENT_SORT_RULES = Object.freeze({ field: MOMENT_SORT_OPTIONS.map(({ value }) => value), direction: ['asc', 'desc'] });
const FINANCE_SORT_DEFAULTS = Object.freeze({ type: 'all', month: 'all', search: '', sort: 'date-desc' });
const FINANCE_SORT_RULES = Object.freeze({
  type: ['all', 'income', 'expense'], month: (value) => value === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(value),
  sort: TRANSACTION_SORT_VALUES,
});


// Use precisely the same keys, schemas and migration defaults as each main list.
// Mount this editor only when requested, to avoid loading finance on ordinary Settings visits.
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
  const settings = domain === 'moments' ? MOMENT_SORT_DEFAULTS
    : domain === 'activities' ? ACTIVITY_LIST_DEFAULTS : FINANCE_SORT_DEFAULTS;
  const rules = domain === 'moments' ? MOMENT_SORT_RULES
    : domain === 'activities' ? ACTIVITY_LIST_RULES : FINANCE_SORT_RULES;
  const [filters] = usePersistentListState(domain, settings, rules);
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
  const initialGroup = domain === 'moments' ? momentConditions(filters)
    : domain === 'activities' ? activityConditions(filters) : transactionConditions(filters);
  const sample = getActiveSampleScenario(uid);
  const config = isFinance ? { initialGroup, moments: scoped.events }
    : { initialGroup, contextKey: sample };
  const conditions = useConditionFilters(domain, records, usePersistentListState, config);
  const notSignedIn = !uid && !isGuest;
  const loading = !notSignedIn && (!scoped.ready || (isFinance && !isFinanceReady));
  const error = Boolean(scoped.loadError || (isFinance && (incomeError || expenseError)));
  const retry = () => {
    scoped.retry();
    if (isFinance) { loadIncomes(uid, isGuest); loadExpenses(uid, isGuest); }
  };
  return <div className="dn-code-list-filter-editor" aria-label={`${domain} filter preferences`}>
    {notSignedIn ? <p className="settings-helper">Sign in or continue as Guest to change your list filters.</p>
      : error ? <div role="alert" className="settings-helper">
        Your filter choices are saved, but records could not be loaded.
        <button type="button" className="settings-secondary-button" onClick={retry}>Retry loading filters</button>
      </div>
        : loading ? <p className="settings-helper" role="status">Loading your available filter choices…</p>
          : <>
            <ConditionBuilder filter={conditions} title={`${domain} filters`} showChips />
            <p className="code-list-description">These filters apply immediately to your ${domain === 'moments' ? 'Moments' : domain === 'activities' ? 'Activities' : 'Transactions'} page. Changes are remembered in this browser.</p>
          </>}
  </div>;
}

function ListOrderingPreferences() {
  const [moments, setMoments] = usePersistentListState('moments', MOMENT_SORT_DEFAULTS, MOMENT_SORT_RULES);
  const [activities, setActivities] = usePersistentListState('activities', ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_RULES);
  const [finance, setFinance] = usePersistentListState('transactions', FINANCE_SORT_DEFAULTS, FINANCE_SORT_RULES);
  const [financeField, financeDirection] = finance.sort.split('-');
  const [editingFilters, setEditingFilters] = useState(null);
  return <section className="settings-section code-list-section" id="list-order" aria-label="List sorting and filters preferences">
    <div className="settings-section-heading">
      <span className="settings-accordion-icon"><Hash size={18} aria-hidden="true" /></span>
      <div><h3>List sorting and filters</h3></div>
    </div>
    <p className="code-list-description">Choose how your lists are sorted and filtered. These are browser-local preferences for the current Guest or account, not changes to saved records or Code List values. Each Moment's Activities tab keeps its own independent view.</p>
    <div className="settings-admin-grid dn-list-sort-settings">
      <div className="settings-input-block">
        <span>Moments</span>
        <SortControl label="Sort Moments in settings" field={moments.field} direction={moments.direction}
          options={MOMENT_SORT_OPTIONS} onFieldChange={(field) => setMoments({ field, direction: 'asc' })}
          onToggleDirection={() => setMoments({ direction: moments.direction === 'asc' ? 'desc' : 'asc' })} />
      </div>
      <div className="settings-input-block">
        <span>Activities</span>
        <SortControl label="Sort Activities in settings" field={activities.field} direction={activities.direction}
          options={ACTIVITY_SORTS} onFieldChange={(field) => setActivities({ field, direction: 'asc' })}
          onToggleDirection={() => setActivities({ direction: activities.direction === 'asc' ? 'desc' : 'asc' })} />
      </div>
      <div className="settings-input-block">
        <span>Transactions</span>
        <SortControl label="Sort Transactions in settings" field={financeField} direction={financeDirection}
          options={TRANSACTION_SORT_OPTIONS}
          onFieldChange={(field) => setFinance({ sort: transactionSortForField(field) })}
          onToggleDirection={() => setFinance({ sort: `${financeField}-${financeDirection === 'asc' ? 'desc' : 'asc'}` })} />
      </div>
    </div>
    <div className="dn-list-filter-preferences">
      <div className="dn-list-filter-intro">
        <h4>List filters</h4>
        <p className="code-list-description">Choose filter fields, comparisons and values for each main list, using the same filters as on those pages.</p>
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
          <small>{editingFilters === domain ? 'Close' : 'Edit'}</small>
        </button>)}
      </div>
      {editingFilters ? <div className="dn-list-filter-expanded" id={`dn-filter-editor-${editingFilters}`}>
        <ListFilterPreferences key={editingFilters} domain={editingFilters} />
      </div> : null}
    </div>
  </section>;
}

export default function CodeLists() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const adminValuesLoading = useAppStore((state) => state.adminValuesLoading);
  const adminValuesError = useAppStore((state) => state.adminValuesError);
  const hydrateAdminValuesForUser = useAppStore((state) => state.hydrateAdminValuesForUser);

  const retryCodeLists = async () => {
    if (!user?.uid) return;
    try {
      await hydrateAdminValuesForUser(user.uid);
    } catch {
      // The error panel remains visible and allows another explicit retry.
    }
  };

  return (
    <div className="feature-page settings-page about-page code-lists-page">
      <header className="settings-subpage-header">
        <button type="button" className="settings-back-button" onClick={() => navigate('/settings')} aria-label="Back to Settings">
          <ArrowLeft size={16} />
        </button>
        <div className="settings-subpage-title-wrap">
          <span className="settings-subpage-eyebrow">Settings</span>
          <h2>Code Lists</h2>
        </div>
      </header>

      {adminValuesLoading ? <section className="settings-section" role="status">Loading account Code Lists…</section> : null}
      {adminValuesError ? (
        <section className="settings-section" role="alert" aria-live="assertive">
          <h3>Code Lists could not be synchronized</h3>
          <p>Your account values were not replaced with browser defaults. Check your connection and retry before editing.</p>
          <button type="button" className="settings-primary-button" onClick={retryCodeLists} disabled={adminValuesLoading}>
            Retry loading Code Lists
          </button>
        </section>
      ) : null}
      {!adminValuesLoading && !adminValuesError ? <>
        <CodeListSection title="Moment Types" description="Used for birthdays, anniversaries, celebrations, and other life moments. Choose each type’s Story presentation, greeting generation, and separate Dashboard visibility for Moments and Activities." listKey="eventTypes" placeholder="Add moment type" />
        <CodeListSection title="Expense Categories" description="Used by expense tracking and reporting filters." listKey="expenseCategories" placeholder="Add expense category" />
        <CodeListSection title="Income Types" description="Used for income sources and financial filters." listKey="incomeTypes" placeholder="Add income type" />
        <PaymentMethodsSection />
        <CodeListSection title="Activity Priorities" description="Used for task and activity urgency indicators." listKey="activityPriorities" placeholder="Add priority" allowLabels />
        <CodeListSection title="Reminder Presets" description="Saved presets for the future Notifications feature." listKey="reminderPresets" placeholder="Add reminder time" allowLabels />
      </> : null}
      <ListOrderingPreferences />

      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><BellRing size={18} /></span>
          <div>
            <h3>Notes</h3>
            <p>Add your own choices to the lists above. Active choices appear in their forms and filters; saved records keep their original values. Status and visibility follow the app’s actions, while Moment, Activity and time choices come from your records. Adding a new field requires an app update; its choices can be managed here once supported.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
