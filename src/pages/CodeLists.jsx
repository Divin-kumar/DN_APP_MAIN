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
import { BellRing, Check, Hash, PencilLine, Plus, ShieldOff, Trash2 } from 'lucide-react';
import './CodeListsPremium.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
import { ENTRY_MODE_LABELS } from '../utils/activityEntries';

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
  const accountError = useAppStore((state) => state.adminValuesError);
  const accountLoading = useAppStore((state) => state.adminValuesLoading);
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const [editingValue, setEditingValue] = useState(null);
  const [warningValue, setWarningValue] = useState(null);
  const [momentTypeEditor, setMomentTypeEditor] = useState(null);
  const retryAccount = async () => {
    const state = useAppStore.getState();
    if (!state.user?.uid) return;
    try { await state.hydrateAdminValuesForUser(state.user.uid); setSaveError(''); }
    catch { /* Keep the draft and the existing account error visible. */ }
  };
  const saveFeedback = <>
    {saveError ? <p className="code-list-save-error" role="alert">{saveError}</p> : null}
    {accountError || accountLoading ? <button type="button" className="settings-secondary-button"
      disabled={accountLoading} onClick={retryAccount}>{accountLoading ? 'Reloading Code Lists…' : 'Reload Code Lists to retry'}</button> : null}
  </>;
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
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await setAdminValues({ [listKey]: nextEntries });
      showToast(isGuest ? 'Code List saved on this device' : 'Code List saved to your account', 'success');
      return true;
    } catch (error) {
      console.error('Unable to save Code List:', error);
      setSaveError(error.message || 'Code List could not be saved. Try again.');
      showToast(error.message || 'Code List could not be saved', 'danger');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const upsertEntry = async (nextValue, nextLabel) => {
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

    if (await updateEntries(nextEntries)) {
      setDraft('');
      setDraftLabel('');
    }
  };

  const openMomentTypeEditor = (entry = null) => {
    if (savingRef.current) return;
    setSaveError('');
    const baseEntry = entry || { value: '', label: '', canGenerateGreetingCards: true, greetingTemplate: '', showInDashboardUpcoming: true, showActivitiesOnDashboard: true };
    setMomentTypeEditor({
      existingValue: baseEntry.value || null,
      title: baseEntry.label || baseEntry.value || '',
      canGenerateGreetingCards: baseEntry.canGenerateGreetingCards ?? true,
      greetingTemplate: typeof baseEntry.greetingTemplate === 'string' ? baseEntry.greetingTemplate : '',
      showInDashboardUpcoming: baseEntry.showInDashboardUpcoming ?? true,
      showActivitiesOnDashboard: baseEntry.showActivitiesOnDashboard ?? true,
      storyPresentation: entry ? resolveMomentStoryPresentation({ type: entry.value || entry.label }, [entry]) : '',
    });
  };

  const saveMomentTypeEditor = async () => {
    const title = momentTypeEditor?.title?.trim();
    if (!title) return;
    if (!Object.values(STORY_PRESENTATIONS).includes(momentTypeEditor.storyPresentation)) {
      showToast('Choose Daily, Journal, or Tasks before saving this Moment type.', 'danger');
      return;
    }

    const nextEntry = {
      value: title,
      label: title,
      active: true,
      isActive: true,
      canGenerateGreetingCards: Boolean(momentTypeEditor.canGenerateGreetingCards),
      greetingTemplate: momentTypeEditor.canGenerateGreetingCards ? momentTypeEditor.greetingTemplate : '',
      showInDashboardUpcoming: momentTypeEditor.showInDashboardUpcoming !== false,
      showActivitiesOnDashboard: momentTypeEditor.showActivitiesOnDashboard !== false,
      storyPresentation: momentTypeEditor.storyPresentation,
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
    return updateEntries(entries.map((item) => (item.value === entry.value ? { ...item, active: false, isActive: false } : item)));
  };

  const handleActivate = (entry) => {
    const nextEntries = entries.map((item) => (item.value === entry.value ? { ...item, active: true, isActive: true } : item));
    updateEntries(nextEntries);
  };

  const handleRename = async (entry, nextValue) => {
    const trimmed = nextValue.trim();
    if (!trimmed) return;

    const saved = await updateEntries(entries.map((item) => {
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
    if (saved) setEditingValue(null);
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
            if (savingRef.current) return;
            setSaveError('');
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
          aria-label={`${entry.label}${isInactive ? ', inactive' : ''}. Tap to open actions; swipe is optional.`}>
          <span className="code-list-main">
            <span className="code-list-text">{entry.label}</span>
            {isInactive ? <span className="code-list-status">Inactive</span> : null}
          </span>
        </button>
      </SwipeActionCard>
    );
  };

  return (
    <section id={`code-list-${listKey}`} className={`settings-section code-list-section dn-code-list-editor-section ${listKey === 'eventTypes' ? 'has-modal-add' : ''}`}>
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
        <form className={`code-list-add-row ${allowLabels ? 'has-labels' : ''}`}
          onSubmit={(event) => { event.preventDefault(); upsertEntry(draft, allowLabels ? draftLabel : undefined); }}>
          {allowLabels ? (
            <>
              <input disabled={saving} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
              <input disabled={saving} value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} placeholder="Label" aria-label="Label" />
            </>
          ) : (
            <input disabled={saving} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
          )}
          <button type="submit" className="settings-tag-add" disabled={saving || accountLoading || Boolean(accountError) || !draft.trim()}><Plus size={15} aria-hidden="true" /> {saving ? 'Saving…' : 'Add'}</button>
        </form>
      ) : null}
      {saveError && !editingValue && !momentTypeEditor && !warningValue ? <p className="code-list-save-error" role="alert">{saveError}</p> : null}

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
        <ModalDialog title="Edit value" className="code-list-rename-dialog" onClose={() => { if (!savingRef.current) setEditingValue(null); }}>
          <div className="code-list-editor-modal">
            <label className="settings-input-block">
              <span>Value</span>
              <input
                className="code-list-rename-input"
                autoFocus
                disabled={saving}
                value={editingValue.label}
                onChange={(event) => setEditingValue({ ...editingValue, label: event.target.value })}
                placeholder="Enter a value"
              />
            </label>
            {saveFeedback}
            <div className="settings-actions">
              <button type="button" className="settings-secondary-button" disabled={saving} onClick={() => setEditingValue(null)}>Cancel</button>
              <button type="button" className="settings-primary-button" disabled={saving || accountLoading || Boolean(accountError) || !editingValue.label.trim()} onClick={() => handleRename(editingValue, editingValue.label)}>{saving ? 'Saving…' : 'Save changes'}</button>
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
              <label htmlFor="moment-type-story-presentation">Activity mode (required)</label>
              <DropdownSelect id="moment-type-story-presentation" value={momentTypeEditor.storyPresentation}
                onChange={(changeEvent) => setMomentTypeEditor((current) => ({ ...current, storyPresentation: changeEvent.target.value }))}>
                <option value="" disabled>Choose one of three modes</option>
                {ENTRY_MODE_LABELS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </DropdownSelect>
              <small className="settings-helper" aria-live="polite">
                {momentTypeEditor.storyPresentation
                  ? `Diary, Journal and Tasks all create independent Activities. Each Activity supports dated content entries. This choice controls the Story presentation, not Activity creation.`
                  : 'Select one mode to enable this Moment type. No unconfigured creation mode is allowed.'}
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
              <button type="button" className="settings-primary-button" disabled={saving || accountLoading || Boolean(accountError) || !momentTypeEditor.title.trim() || !momentTypeEditor.storyPresentation} onClick={saveMomentTypeEditor}>{saving ? 'Saving…' : 'Save moment type'}</button>
            </div>
            {saveFeedback}
          </div>
        </ModalDialog>
      ) : null}

      {warningValue ? (
        <ModalDialog title="Value is currently in use" onClose={() => { if (!savingRef.current) setWarningValue(null); }}>
          <div className="settings-helper" style={{ marginBottom: '16px' }}>
            {warningValue.label} is currently used by {warningValue.usageCount} {listKey === 'eventTypes' ? 'moment record' : listKey === 'expenseCategories' ? 'expense record' : listKey === 'incomeTypes' ? 'income record' : listKey === 'paymentMethods' ? 'transaction' : listKey === 'activityPriorities' ? 'activity record' : 'related record'}{warningValue.usageCount === 1 ? '' : 's'}.
            Deleting this value may affect existing records and reporting.
          </div>
          {saveFeedback}
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" disabled={saving} onClick={() => setWarningValue(null)}>Cancel</button>
            <button type="button" className="settings-primary-button" disabled={saving || accountLoading || Boolean(accountError)} onClick={async () => { if (await handleDisable(warningValue.entry)) setWarningValue(null); }}>{saving ? 'Saving…' : 'Disable Value'}</button>
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
  if (incomes.error || expenses.error) return <section id="code-list-paymentMethods" className="settings-section" role="alert">
    <h3>Payment Methods</h3>
    <p>Transactions could not be loaded to check which methods are in use.</p>
    <button type="button" className="settings-secondary-button" onClick={() => {
      incomes.loadIncomes(uid, isGuest); expenses.loadExpenses(uid, isGuest);
    }}>Retry loading payment methods</button>
  </section>;
  if (incomes.loadedFor !== scope || expenses.loadedFor !== scope) return <section id="code-list-paymentMethods" className="settings-section" role="status">Loading payment methods…</section>;
  return <CodeListSection title="Payment Methods" description="Add payment choices for new transactions and filters. Disabling or renaming a choice keeps earlier transactions unchanged." listKey="paymentMethods" placeholder="Add payment method" />;
}


export default function CodeLists() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  return <CodeListsContent key={user?.uid || (isGuest ? 'guest' : 'signed-out')} />;
}

function CodeListsContent() {
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const adminValuesLoading = useAppStore((state) => state.adminValuesLoading);
  const adminValuesError = useAppStore((state) => state.adminValuesError);
  const hydrateAdminValuesForUser = useAppStore((state) => state.hydrateAdminValuesForUser);
  // A failed account save/reload must not unmount editors and discard drafts.
  // The outer scope key still clears them when the session changes.
  const [hasLoaded, setHasLoaded] = useState(false);
  useEffect(() => {
    if (!adminValuesLoading && !adminValuesError) setHasLoaded(true);
  }, [adminValuesLoading, adminValuesError]);
  const retryCodeLists = async () => {
    if (!user?.uid) return;
    try {
      await hydrateAdminValuesForUser(user.uid);
    } catch {
      // The error panel remains visible and allows another explicit retry.
    }
  };

  // Legacy bookmarked list defaults now have their own route.
  if (location.hash === '#list-order') return <Navigate to="/settings/list-defaults" replace />;

  return (
    <div className="feature-page settings-page about-page code-lists-page dn-premium-code-lists">
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
      {hasLoaded || (!adminValuesLoading && !adminValuesError) ? <>
        <nav className="dn-code-list-index" aria-label="Code List sections">
          <span className="dn-code-list-index-label">Browse</span>
          <div className="dn-code-list-nav-window">
            <div className="dn-code-list-index-scroll" tabIndex={0}
              aria-label="Scroll Code List sections horizontally">
            {[
              { id: "code-list-eventTypes", title: "Moment Types" },
              { id: "code-list-expenseCategories", title: "Expense Categories" },
              { id: "code-list-incomeTypes", title: "Income Types" },
              { id: "code-list-paymentMethods", title: "Payment Methods" },
              { id: "code-list-activityPriorities", title: "Activity Priorities" },
              { id: "code-list-reminderPresets", title: "Reminder Presets" },
            ].map(({ id, title }) => <a key={id} href={`#${id}`}>{title}</a>)}
            </div>
          </div>
        </nav>
        <CodeListSection title="Moment Types" description="Manage Moment types and choose their Daily, Journal, or Tasks mode, greetings, and Dashboard options." listKey="eventTypes" placeholder="Add moment type" />
        <CodeListSection title="Expense Categories" description="Used by expense tracking and reporting filters." listKey="expenseCategories" placeholder="Add expense category" />
        <CodeListSection title="Income Types" description="Used for income sources and financial filters." listKey="incomeTypes" placeholder="Add income type" />
        <PaymentMethodsSection />
        <CodeListSection title="Activity Priorities" description="Used for task and activity urgency indicators." listKey="activityPriorities" placeholder="Add priority" allowLabels />
        <CodeListSection title="Reminder Presets" description="Saved presets for the future Notifications feature." listKey="reminderPresets" placeholder="Add reminder time" allowLabels />
      </> : null}

      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><BellRing size={18} /></span>
          <div>
            <h3>Notes</h3>
            <p>Active choices appear in forms and filters. Existing records keep their saved values. New fields require an app update.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
