import { ArrowLeft, BellRing, Check, Hash, PencilLine, ShieldOff, Trash2 } from 'lucide-react';
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
    case 'greetingTemplateTypes':
      return Array.isArray(preferences?.greetingEnabledTypes) && preferences.greetingEnabledTypes.includes(value) ? 1 : 0;
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
  const events = useEventStore((state) => state.events);
  const expenses = useExpenseStore((state) => state.expenses);
  const incomes = useIncomeStore((state) => state.incomes);
  const [draft, setDraft] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [swipedValue, setSwipedValue] = useState(null);
  const [editingValue, setEditingValue] = useState(null);
  const [warningValue, setWarningValue] = useState(null);
  const swipeStartRef = useRef(null);
  const swipeMovedRef = useRef(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    if (!swipedValue) return undefined;

    const handleOutsidePointerDown = (event) => {
      const target = event.target;
      const clickedRow = target instanceof Element ? target.closest('.code-list-item') : null;
      if (!sectionRef.current?.contains(target) || !clickedRow || !sectionRef.current.contains(clickedRow)) {
        setSwipedValue(null);
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [swipedValue]);

  const entries = useMemo(() => {
    const source = Array.isArray(adminValues[listKey]) && adminValues[listKey].length
      ? adminValues[listKey]
      : DEFAULT_CODE_LISTS[listKey] || [];
    return sanitizeEntries(source).sort((a, b) => a.label.localeCompare(b.label));
  }, [adminValues, listKey]);
  const activeEntries = entries.filter((entry) => entry.active !== false && entry.isActive !== false);
  const inactiveEntries = entries.filter((entry) => entry.active === false || entry.isActive === false);

  const usageMap = useMemo(() => Object.fromEntries(
    entries.map((entry) => [entry.value, getRecordUsageCount(listKey, entry.value, { events, expenses, incomes, preferences })]),
  ), [entries, events, expenses, incomes, preferences, listKey]);

  const updateEntries = (nextEntries) => setAdminValues({ [listKey]: nextEntries });

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

  const handleDelete = (entry) => {
    const usageCount = usageMap[entry.value] || 0;
    if (usageCount === 0) {
      updateEntries(entries.filter((item) => item.value !== entry.value));
      setSwipedValue(null);
      return;
    }

    setWarningValue({ entry, usageCount, label: entry.label });
    setSwipedValue(null);
  };

  const handleDisable = (entry) => {
    updateEntries(entries.map((item) => (item.value === entry.value ? { ...item, active: false, isActive: false } : item)));
    setSwipedValue(null);
  };

  const handleActivate = (entry) => {
    const nextEntries = entries.map((item) => (item.value === entry.value ? { ...item, active: true, isActive: true } : item));
    updateEntries(nextEntries);
    setSwipedValue(null);
  };

  const handleRename = (entry, nextValue) => {
    const trimmed = nextValue.trim();
    if (!trimmed) return;

    updateEntries(entries.map((item) => (
      item.value === entry.value ? { ...item, value: trimmed, label: trimmed } : item
    )));
    setEditingValue(null);
    setSwipedValue(null);
  };

  const handlePointerDown = (event, value) => {
    swipeStartRef.current = { value, x: event.clientX };
    swipeMovedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const gesture = swipeStartRef.current;
    if (!gesture) return;
    const delta = gesture.x - event.clientX;
    if (Math.abs(delta) > 10) swipeMovedRef.current = true;
    if (delta > 40) setSwipedValue(gesture.value);
    if (delta < -32) setSwipedValue(null);
  };

  const handlePointerUp = () => {
    swipeStartRef.current = null;
  };

  const renderEntry = (entry) => {
    const usageCount = usageMap[entry.value] || 0;
    const isSwiped = swipedValue === entry.value;
    const isInactive = entry.active === false || entry.isActive === false;

    return (
      <div key={`${listKey}-${entry.value}`} className={`code-list-item ${isSwiped ? 'is-open' : ''} ${isInactive ? 'is-inactive' : ''}`}>
        <div className="code-list-actions" aria-hidden={!isSwiped}>
          <button type="button" className="code-list-action code-list-edit" tabIndex={isSwiped ? 0 : -1} onClick={() => setEditingValue(entry)}>
            <PencilLine size={14} /> Edit
          </button>
          {isInactive ? (
            <button type="button" className="code-list-action code-list-activate" tabIndex={isSwiped ? 0 : -1} onClick={() => handleActivate(entry)}>
              <Check size={14} /> Activate
            </button>
          ) : usageCount > 0 ? (
            <button type="button" className="code-list-action code-list-disable" tabIndex={isSwiped ? 0 : -1} onClick={() => handleDisable(entry)}>
              <ShieldOff size={14} /> Disable
            </button>
          ) : (
            <button type="button" className="code-list-action code-list-delete" tabIndex={isSwiped ? 0 : -1} onClick={() => handleDelete(entry)}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>

        <button
          type="button"
          className="code-list-row"
          aria-label={`${entry.label}${isInactive ? ', inactive' : ''}. Swipe left or tap for actions.`}
          aria-expanded={isSwiped}
          onClick={(event) => {
            if (swipeMovedRef.current) {
              event.preventDefault();
              swipeMovedRef.current = false;
              return;
            }
            setSwipedValue((current) => (current === entry.value ? null : entry.value));
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
    <section ref={sectionRef} className="settings-section code-list-section">
      <div className="settings-section-heading">
        <span className="settings-accordion-icon"><Hash size={18} /></span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className={`code-list-add-row ${allowLabels ? 'has-labels' : ''}`}>
        {allowLabels ? (
          <>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
            <input value={draftLabel} onChange={(event) => setDraftLabel(event.target.value)} placeholder="Label" aria-label="Label" />
          </>
        ) : (
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
        )}
        <button type="button" className="settings-tag-add" onClick={() => upsertEntry(draft, allowLabels ? draftLabel : undefined)}>
          Add
        </button>
      </div>

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

      <CodeListSection title="Moment Types" description="Used for birthdays, anniversaries, celebrations, and other life moments." listKey="eventTypes" placeholder="Add moment type" />
      <CodeListSection title="Expense Categories" description="Used by expense tracking and reporting filters." listKey="expenseCategories" placeholder="Add expense category" />
      <CodeListSection title="Income Types" description="Used for income sources and financial filters." listKey="incomeTypes" placeholder="Add income type" />
      <CodeListSection title="Activity Priorities" description="Used for task and activity urgency indicators." listKey="activityPriorities" placeholder="Add priority" allowLabels />
      <CodeListSection title="Greeting Template Types" description="Defines which event types can generate greeting cards." listKey="greetingTemplateTypes" placeholder="Add greeting type" />
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
