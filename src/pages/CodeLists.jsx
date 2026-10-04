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
import { ArrowLeft, BellRing, Check, Hash, PencilLine, Plus, ShieldOff, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModalDialog from '../components/common/ModalDialog';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { DEFAULT_CODE_LISTS, serializeCodeListEntries } from '../utils/codeLists';

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
  const events = useEventStore((state) => state.events);
  const expenses = useExpenseStore((state) => state.expenses);
  const incomes = useIncomeStore((state) => state.incomes);
  const [draft, setDraft] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [swipedRow, setSwipedRow] = useState(null);
  const [editingValue, setEditingValue] = useState(null);
  const [warningValue, setWarningValue] = useState(null);
  const [momentTypeEditor, setMomentTypeEditor] = useState(null);
  const isMomentTypeEditorOpen = Boolean(momentTypeEditor);
  const swipeStartRef = useRef(null);
  const swipeMovedRef = useRef(false);
  const sectionRef = useRef(null);
  const momentTypeTitleRef = useRef(null);

  useEffect(() => {
    if (!momentTypeEditor) return undefined;
    const frameId = window.requestAnimationFrame(() => momentTypeTitleRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [isMomentTypeEditorOpen]);

  useEffect(() => {
    if (!swipedRow) return undefined;

    const handleOutsidePointerDown = (event) => {
      const target = event.target;
      const clickedRow = target instanceof Element ? target.closest('.code-list-item') : null;
      if (!sectionRef.current?.contains(target) || !clickedRow || !sectionRef.current.contains(clickedRow)) {
        setSwipedRow(null);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [swipedRow]);

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

  const updateEntries = (nextEntries) => {
    void setAdminValues({ [listKey]: nextEntries }).catch(() => showToast('Code list changes could not be saved', 'danger'));
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
    const baseEntry = entry || { value: '', label: '', canGenerateGreetingCards: true, greetingTemplate: '', showInDashboardUpcoming: true };
    setMomentTypeEditor({
      existingValue: baseEntry.value || null,
      title: baseEntry.label || baseEntry.value || '',
      canGenerateGreetingCards: baseEntry.canGenerateGreetingCards ?? true,
      greetingTemplate: typeof baseEntry.greetingTemplate === 'string' ? baseEntry.greetingTemplate : '',
      showInDashboardUpcoming: baseEntry.showInDashboardUpcoming ?? true,
    });
  };

  const saveMomentTypeEditor = () => {
    const title = momentTypeEditor?.title?.trim();
    if (!title) return;

    const nextEntry = {
      value: title,
      label: title,
      active: true,
      isActive: true,
      canGenerateGreetingCards: Boolean(momentTypeEditor.canGenerateGreetingCards),
      greetingTemplate: momentTypeEditor.canGenerateGreetingCards ? momentTypeEditor.greetingTemplate.trim() : '',
      showInDashboardUpcoming: momentTypeEditor.showInDashboardUpcoming !== false,
    };

    const nextEntries = entries.some((entry) => entry.value === (momentTypeEditor.existingValue || title))
      ? entries.map((entry) => (entry.value === (momentTypeEditor.existingValue || title) ? { ...entry, ...nextEntry } : entry))
      : [...entries, nextEntry];

    updateEntries(nextEntries);
    setMomentTypeEditor(null);
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
      setSwipedRow(null);
      return;
    }

    setWarningValue({ entry, usageCount, label: entry.label });
    setSwipedRow(null);
  };

  const handleDisable = (entry) => {
    updateEntries(entries.map((item) => (item.value === entry.value ? { ...item, active: false, isActive: false } : item)));
    setSwipedRow(null);
  };

  const handleActivate = (entry) => {
    const nextEntries = entries.map((item) => (item.value === entry.value ? { ...item, active: true, isActive: true } : item));
    updateEntries(nextEntries);
    setSwipedRow(null);
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
        };
      }
      return { ...item, value: trimmed, label: trimmed };
    }));
    setEditingValue(null);
    setSwipedRow(null);
  };

  const handlePointerDown = (event, value) => {
    swipeStartRef.current = { value, x: event.clientX, y: event.clientY };
    swipeMovedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const gesture = swipeStartRef.current;
    if (!gesture) return;
    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) swipeMovedRef.current = true;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    setSwipedRow({ value: gesture.value, action: deltaX > 0 ? 'delete' : 'other' });
  };

  const handlePointerUp = () => {
    swipeStartRef.current = null;
  };

  const renderEntry = (entry) => {
    const usageCount = usageMap[entry.value] || 0;
    const swipedRowMatches = swipedRow?.value === entry.value;
    const isOtherOpen = swipedRowMatches && swipedRow.action === 'other';
    const isDeleteOpen = swipedRowMatches && swipedRow.action === 'delete';
    const isInactive = entry.active === false || entry.isActive === false;
    const hasStatusAction = isInactive || usageCount > 0;

    return (
      <div key={`${listKey}-${entry.value}`} className={`code-list-item ${isOtherOpen ? 'is-open-other' : ''} ${isDeleteOpen ? 'is-open-delete' : ''} ${isInactive ? 'is-inactive' : ''}`} style={{ '--code-list-actions-width': hasStatusAction ? '144px' : '72px' }}>
        <div className="code-list-actions code-list-actions-other" aria-hidden={!isOtherOpen}>
          <button type="button" className="code-list-action code-list-edit" tabIndex={isOtherOpen ? 0 : -1} onClick={() => {
            if (listKey === 'eventTypes') {
              openMomentTypeEditor(entry);
            } else {
              setEditingValue(entry);
            }
            setSwipedRow(null);
          }}>
            <PencilLine size={14} /> Edit
          </button>
          {isInactive ? (
            <button type="button" className="code-list-action code-list-activate" tabIndex={isOtherOpen ? 0 : -1} onClick={() => handleActivate(entry)}>
              <Check size={14} /> Activate
            </button>
          ) : usageCount > 0 ? (
            <button type="button" className="code-list-action code-list-disable" tabIndex={isOtherOpen ? 0 : -1} onClick={() => handleDisable(entry)}>
              <ShieldOff size={14} /> Disable
            </button>
          ) : null}
        </div>
        <div className="code-list-actions code-list-actions-delete" aria-hidden={!isDeleteOpen}>
          <button type="button" className="code-list-action code-list-delete" tabIndex={isDeleteOpen ? 0 : -1} onClick={() => handleDelete(entry)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>

        <button
          type="button"
          className="code-list-row"
          aria-label={`${entry.label}${isInactive ? ', inactive' : ''}. Swipe left for edit or status actions, right for delete.`}
          aria-expanded={Boolean(swipedRowMatches)}
          onClick={(event) => {
            if (swipeMovedRef.current) {
              event.preventDefault();
              swipeMovedRef.current = false;
              return;
            }
            setSwipedRow((current) => (current?.value === entry.value ? null : { value: entry.value, action: 'other' }));
          }}
          onPointerDown={(event) => handlePointerDown(event, entry.value)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <span className="code-list-main">
            <span className="code-list-text">{entry.label}</span>
            {isInactive ? <span className="code-list-status">Inactive</span> : null}
          </span>
        </button>
      </div>
    );
  };

  return (
    <section ref={sectionRef} className={`settings-section code-list-section ${listKey === 'eventTypes' ? 'has-modal-add' : ''}`}>
      <div className="settings-section-heading">
        <span className="settings-accordion-icon"><Hash size={18} /></span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {listKey === 'eventTypes' ? (
          <button type="button" className="settings-tag-add moment-type-add-button" onClick={() => openMomentTypeEditor()}>
            <Plus size={15} /> Add
          </button>
        ) : null}
      </div>

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

            <div className="moment-type-switch-list">
              <div className="moment-type-switch-row">
                <span>Greeting Cards</span>
                <button type="button" className="moment-type-switch" role="switch" aria-label="Greeting Cards" aria-checked={momentTypeEditor.canGenerateGreetingCards} onClick={() => setMomentTypeEditor((current) => ({ ...current, canGenerateGreetingCards: !current.canGenerateGreetingCards }))}>
                  <span className="moment-type-switch-thumb" />
                </button>
              </div>
              <div className="moment-type-switch-row">
                <span>Show on Dashboard</span>
                <button type="button" className="moment-type-switch" role="switch" aria-label="Show on Dashboard" aria-checked={momentTypeEditor.showInDashboardUpcoming} onClick={() => setMomentTypeEditor((current) => ({ ...current, showInDashboardUpcoming: !current.showInDashboardUpcoming }))}>
                  <span className="moment-type-switch-thumb" />
                </button>
              </div>
            </div>

            {momentTypeEditor.canGenerateGreetingCards ? (
              <div className="moment-type-template-field">
                <label className="settings-input-block">
                  <span>Greeting Template</span>
                  <textarea
                    rows={3}
                    value={momentTypeEditor.greetingTemplate}
                    onChange={(event) => setMomentTypeEditor((current) => ({ ...current, greetingTemplate: event.target.value }))}
                    placeholder="Happy {ordinal} {eventName} {name}"
                  />
                  <small className="settings-placeholder-guide">Supported placeholders: {'{name}'}, {'{eventName}'}, {'{ordinal}'}</small>
                </label>

                <div className="moment-type-preview" aria-live="polite">
                  <span>Preview</span>
                  <div className="free-text-preview is-truncated">{getGreetingTemplatePreview(momentTypeEditor.greetingTemplate)}</div>
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
            {warningValue.label} is currently used by {warningValue.usageCount} {listKey === 'eventTypes' ? 'moment record' : listKey === 'expenseCategories' ? 'expense record' : listKey === 'incomeTypes' ? 'income record' : listKey === 'activityPriorities' ? 'activity record' : 'related record'}{warningValue.usageCount === 1 ? '' : 's'}.
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

export default function CodeLists() {
  const navigate = useNavigate();

  return (
    <div className="feature-page settings-page about-page">
      <header className="settings-subpage-header">
        <button type="button" className="settings-back-button" onClick={() => navigate('/settings')} aria-label="Back to Settings">
          <ArrowLeft size={16} />
        </button>
        <div className="settings-subpage-title-wrap">
          <span className="settings-subpage-eyebrow">Settings</span>
          <h2>Code Lists</h2>
        </div>
      </header>

      <CodeListSection title="Moment Types" description="Used for birthdays, anniversaries, celebrations, and other life moments. Each type can control greeting generation and dashboard visibility." listKey="eventTypes" placeholder="Add moment type" />
      <CodeListSection title="Expense Categories" description="Used by expense tracking and reporting filters." listKey="expenseCategories" placeholder="Add expense category" />
      <CodeListSection title="Income Types" description="Used for income sources and financial filters." listKey="incomeTypes" placeholder="Add income type" />
      <CodeListSection title="Activity Priorities" description="Used for task and activity urgency indicators." listKey="activityPriorities" placeholder="Add priority" allowLabels />
      <CodeListSection title="Reminder Presets" description="Common reminder times shown for notifications and daily nudges." listKey="reminderPresets" placeholder="Add reminder time" allowLabels />

      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><BellRing size={18} /></span>
          <div>
            <h3>Notes</h3>
            <p>Only supported code lists are managed here. Derived statuses and attachment/memory taxonomies stay out of scope for now.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
