import { UserCircle, ListChecks, Settings2, Database, Download, Upload, Trash2, Bell, Clock3, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ModalDialog from '../components/common/ModalDialog';
import DropdownSelect from '../components/common/DropdownSelect';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { activateSampleScenario, clearActiveSampleScenario, getActiveSampleData, getActiveSampleScenario, getSampleScenarioDefinitions, getSampleScenarioLabel } from '../dev/sampleData';
import useAppStore from '../store/useAppStore';
import { downloadBlob } from '../utils/download';

const normalizeList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const ValueListEditor = ({ label, value, onChange }) => {
  const [draft, setDraft] = useState('');
  const items = normalizeList(value);

  const addItem = () => {
    const nextValue = draft.trim();
    if (!nextValue) return;

    const nextItems = [...new Set([...items, nextValue])];
    onChange(nextItems.join(', '));
    setDraft('');
  };

  const removeItem = (itemToRemove) => {
    onChange(items.filter((item) => item !== itemToRemove).join(', '));
  };

  return (
    <div className="settings-tag-editor">
      <div className="settings-tag-list">
        {items.length ? items.map((item) => (
          <span key={item} className="settings-tag">
            <span>{item}</span>
            <button type="button" onClick={() => removeItem(item)} aria-label={`Remove ${item}`} title={`Remove ${item}`}>
              ×
            </button>
          </span>
        )) : <span className="settings-tag-empty">No values yet</span>}
      </div>

      <div className="settings-tag-input-row">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addItem();
            }
          }}
          placeholder={`Add ${label}`}
          aria-label={`Add ${label}`}
        />
        <button type="button" className="settings-tag-add" onClick={addItem}>Add</button>
      </div>
    </div>
  );
};

const normalizeReminderTime = (value = '') => {
  if (!value || typeof value !== 'string') return '09:00';

  const trimmed = value.trim();
  if (!trimmed) return '09:00';

  const match = trimmed.match(/^\s*(\d{1,2})\s*[:.]\s*(\d{1,2})\s*(am|pm)?\s*$/i);
  if (!match) {
    const fallback = trimmed.replace(/[^\d]/g, '').slice(0, 4);
    if (fallback.length === 3) {
      return `${fallback.slice(0, 1)}:${fallback.slice(1)}`; 
    }
    if (fallback.length === 4) {
      const hours = fallback.slice(0, 2);
      const minutes = fallback.slice(2, 4);
      return `${hours}:${minutes}`;
    }
    return '09:00';
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toLowerCase();

  if (minutes > 59) return `${String(hours).padStart(2, '0')}:00`;

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  const normalizedHours = String(hours % 24).padStart(2, '0');
  const normalizedMinutes = String(minutes).padStart(2, '0');
  return `${normalizedHours}:${normalizedMinutes}`;
};

export default function Settings() {
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const preferences = useAppStore((state) => state.preferences);
  const showToast = useAppStore((state) => state.showToast);
  const setAdminValues = useAppStore((state) => state.setAdminValues);
  const resetAdminValues = useAppStore((state) => state.resetAdminValues);
  const setPreferences = useAppStore((state) => state.setPreferences);
  const resetPreferences = useAppStore((state) => state.resetPreferences);
  const setGuestMode = useAppStore((state) => state.setGuestMode);
  const profileName = user?.displayName || user?.email || 'Guest';

  const [eventTypes, setEventTypes] = useState(adminValues.eventTypes.join(', '));
  const [incomeTypes, setIncomeTypes] = useState(adminValues.incomeTypes.join(', '));
  const [expenseCategories, setExpenseCategories] = useState(adminValues.expenseCategories.join(', '));
  const defaultGreetingEnabledTypes = ['Birthday', 'Anniversary'];
  const [greetingEnabledTypes, setGreetingEnabledTypes] = useState(() => {
    const enabled = Array.isArray(preferences.greetingEnabledTypes) && preferences.greetingEnabledTypes.length
      ? preferences.greetingEnabledTypes
      : defaultGreetingEnabledTypes;
    return enabled.filter((type) => (adminValues.eventTypes || []).includes(type)).length ? enabled.filter((type) => (adminValues.eventTypes || []).includes(type)) : [...defaultGreetingEnabledTypes];
  });
  const [activeGreetingType, setActiveGreetingType] = useState(() => greetingEnabledTypes[0] || '');
  const [selectedGreetingType, setSelectedGreetingType] = useState(() => {
    const options = (adminValues.eventTypes || []).filter((type) => !defaultGreetingEnabledTypes.includes(type) || !greetingEnabledTypes.includes(type));
    return options[0] || '';
  });
  const [greetingTemplates, setGreetingTemplates] = useState(() => {
    const next = {};
    const enabledList = (Array.isArray(preferences.greetingEnabledTypes) && preferences.greetingEnabledTypes.length
      ? preferences.greetingEnabledTypes
      : defaultGreetingEnabledTypes
    ).filter((type) => (adminValues.eventTypes || []).includes(type));
    enabledList.forEach((eventType) => {
      next[eventType] = preferences.greetingTemplates?.[eventType] || `Happy {ordinal} ${eventType} {name}`;
    });
    return Object.keys(next).length ? next : {
      Birthday: preferences.greetingTemplates?.Birthday || 'Happy {ordinal} Birthday {name} 🎂',
      Anniversary: preferences.greetingTemplates?.Anniversary || 'Happy {ordinal} Anniversary {name} ❤️',
    };
  });
  const [prefForm, setPrefForm] = useState({
    currency: preferences.currency,
    dashboardView: preferences.dashboardView,
    defaultEventType: preferences.defaultEventType,
    defaultIncomeType: preferences.defaultIncomeType,
    defaultExpenseCategory: preferences.defaultExpenseCategory,
    notifications: {
      eventReminders: preferences.notifications?.eventReminders ?? true,
      monthlySummary: preferences.notifications?.monthlySummary ?? true,
      budgetAlerts: preferences.notifications?.budgetAlerts ?? true,
      reminderTime: preferences.notifications?.reminderTime ?? '09:00',
    },
  });
  const [backupMessage, setBackupMessage] = useState('');
  const [openSection, setOpenSection] = useState(null);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [theme, setTheme] = useState(preferences.theme || 'light');
  const [sampleScenario, setSampleScenario] = useState('regular');
  const [activeSampleScenario, setActiveSampleScenario] = useState(() => getActiveSampleScenario());

  useEffect(() => {
    const sectionByHash = {
      '#profile': 'profile',
      '#preferences': 'defaults',
      '#theme': 'defaults',
      '#notifications': 'notifications',
      '#backup': 'backup',
    };
    if (sectionByHash[location.hash]) setOpenSection(sectionByHash[location.hash]);
  }, [location.hash]);
  const [showPlaceholderReference, setShowPlaceholderReference] = useState(false);
  const [copiedPlaceholder, setCopiedPlaceholder] = useState('');

  const placeholderDefinitions = [
    { token: '{name}', detail: 'Recipient or person name', source: 'Greeting template', sample: 'Emma' },
    { token: '{ordinal}', detail: 'Age or anniversary count in ordinal form', source: 'Greeting template', sample: '21st' },
    { token: '{years}', detail: 'Years value for anniversaries or milestones', source: 'Greeting template', sample: '5' },
    { token: '{eventName}', detail: 'Configured event type name', source: 'Greeting template', sample: 'Birthday' },
    { token: '{eventDate}', detail: 'Event date in a readable format', source: 'Greeting template', sample: '25 Sept 2026' },
  ];

  useEffect(() => {
    setEventTypes(adminValues.eventTypes.join(', '));
    setIncomeTypes(adminValues.incomeTypes.join(', '));
    setExpenseCategories(adminValues.expenseCategories.join(', '));
  }, [adminValues]);

  useEffect(() => {
    setGreetingEnabledTypes((current) => {
      const valid = current.filter((type) => (adminValues.eventTypes || []).includes(type));
      const fallback = [...defaultGreetingEnabledTypes].filter((type) => (adminValues.eventTypes || []).includes(type));
      return valid.length ? valid : fallback;
    });
  }, [adminValues.eventTypes]);

  useEffect(() => {
    if (greetingEnabledTypes.includes(activeGreetingType)) return;
    setActiveGreetingType(greetingEnabledTypes[0] || '');
  }, [activeGreetingType, greetingEnabledTypes]);

  useEffect(() => {
    const enabled = greetingEnabledTypes.length ? greetingEnabledTypes : defaultGreetingEnabledTypes;
    setGreetingTemplates((current) => {
      const next = {};
      enabled.forEach((eventType) => {
        next[eventType] = preferences.greetingTemplates?.[eventType] || current[eventType] || `Happy {ordinal} ${eventType} {name}`;
      });
      return next;
    });
  }, [greetingEnabledTypes, preferences.greetingTemplates]);

  useEffect(() => {
    setPrefForm({
      currency: preferences.currency,
      dashboardView: preferences.dashboardView,
      defaultEventType: preferences.defaultEventType,
      defaultIncomeType: preferences.defaultIncomeType,
      defaultExpenseCategory: preferences.defaultExpenseCategory,
      notifications: {
        eventReminders: preferences.notifications?.eventReminders ?? true,
        monthlySummary: preferences.notifications?.monthlySummary ?? true,
        budgetAlerts: preferences.notifications?.budgetAlerts ?? true,
        reminderTime: preferences.notifications?.reminderTime ?? '09:00',
      },
    });
  }, [preferences]);

  const summary = useMemo(() => ({
    eventTypes: normalizeList(eventTypes),
    incomeTypes: normalizeList(incomeTypes),
    expenseCategories: normalizeList(expenseCategories),
  }), [eventTypes, incomeTypes, expenseCategories]);

  const saveAdminValues = () => {
    setAdminValues({
      eventTypes: summary.eventTypes,
      incomeTypes: summary.incomeTypes,
      expenseCategories: summary.expenseCategories,
    });
    showToast('Admin values saved', 'success');
  };

  const handleCopyPlaceholder = async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedPlaceholder(token);
      window.setTimeout(() => setCopiedPlaceholder(''), 1200);
    } catch (error) {
      console.error('Unable to copy placeholder token:', error);
    }
  };

  const savePreferences = () => {
    const normalized = {
      ...prefForm,
      notifications: {
        ...prefForm.notifications,
        reminderTime: normalizeReminderTime(prefForm.notifications.reminderTime),
      },
    };
    setPrefForm(normalized);
    setPreferences(normalized);
    showToast('Preferences saved', 'success');
  };

  const saveGreetingSettings = () => {
    const enabled = greetingEnabledTypes.filter((type) => (adminValues.eventTypes || []).includes(type));
    const normalized = {};
    enabled.forEach((eventType) => {
      normalized[eventType] = (greetingTemplates[eventType] || `Happy {ordinal} ${eventType} {name}`).trim();
    });
    setPreferences({
      greetingEnabledTypes: enabled,
      greetingTemplates: normalized,
    });
    showToast('Greeting cards saved', 'success');
  };

  const addGreetingType = () => {
    if (!selectedGreetingType) return;
    setActiveGreetingType(selectedGreetingType);
    setGreetingEnabledTypes((current) => {
      const next = [...new Set([...current, selectedGreetingType])];
      setGreetingTemplates((templates) => ({
        ...templates,
        [selectedGreetingType]: templates[selectedGreetingType] || `Happy {ordinal} ${selectedGreetingType} {name}`,
      }));
      return next;
    });
    setSelectedGreetingType('');
  };

  const handleGreetingTypeChange = (currentType, nextType) => {
    if (activeGreetingType === currentType) setActiveGreetingType(nextType);
    setGreetingEnabledTypes((current) => current.map((type) => (type === currentType ? nextType : type)));
    setGreetingTemplates((current) => {
      const next = { ...current };
      const template = next[currentType] || `Happy {ordinal} ${currentType} {name}`;
      delete next[currentType];
      next[nextType] = template;
      return next;
    });
  };

  const removeGreetingType = (eventType) => {
    const remainingTypes = greetingEnabledTypes.filter((type) => type !== eventType);
    setGreetingEnabledTypes(remainingTypes);
    if (activeGreetingType === eventType) setActiveGreetingType(remainingTypes[0] || '');
    setGreetingTemplates((current) => {
      const next = { ...current };
      delete next[eventType];
      return next;
    });
  };

  const getPreviewText = (eventType, template) => {
    const typeName = String(eventType || '').trim() || 'Birthday';
    const sampleName = 'Emma';
    const sampleDate = '25 Sept 2026';
    const sampleOrdinal = typeName.toLowerCase().includes('anniversary') ? '5th' : typeName.toLowerCase().includes('birthday') ? '21st' : '1st';
    const sampleYears = typeName.toLowerCase().includes('anniversary') ? '5' : '21';
    const source = template && template.trim() ? template : `Happy {ordinal} ${typeName} {name} 🎂`;

    return source
      .replace(/\{name\}/gi, sampleName)
      .replace(/\{ordinal\}/gi, sampleOrdinal)
      .replace(/\{years\}/gi, sampleYears)
      .replace(/\{eventName\}/gi, typeName)
      .replace(/\{eventDate\}/gi, sampleDate);
  };

  const resetPreferencesForm = () => {
    resetPreferences();
    setTheme('dark');
    document.documentElement.dataset.theme = 'dark';
    setPrefForm({
      currency: 'INR',
      dashboardView: 'overview',
      defaultEventType: 'Personal',
      defaultIncomeType: 'Salary',
      defaultExpenseCategory: 'Food',
      notifications: {
        eventReminders: true,
        monthlySummary: true,
        budgetAlerts: true,
        reminderTime: '09:00',
      },
    });
  };

  const exportBackup = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      app: 'DN',
      data: {

        lifehub_guest_incomes: JSON.parse(localStorage.getItem('lifehub_guest_incomes') || '[]'),
      },
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `dn-backup-${new Date().toISOString().slice(0, 10)}.json`);
    setBackupMessage('Backup downloaded successfully.');
    showToast('Backup exported', 'success');
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const target = parsed.data || parsed;

      Object.entries(target).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          localStorage.removeItem(key);
          return;
        }
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      });

      setBackupMessage('Backup restored successfully. Reloading app...');
      showToast('Backup restored', 'success');
      event.target.value = '';
      window.location.reload();
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setBackupMessage('That file is not a valid DN backup.');
      showToast('Backup restore failed', 'danger');
      event.target.value = '';
    }
  };

  const clearLocalData = () => {
    ['lifehub_admin_values', 'lifehub_preferences', 'lifehub_guest_eventGroups', 'lifehub_guest_expenses', 'lifehub_guest_incomes', 'lifehub_guest_mode', 'lifehub_session_backup', 'lifehub_dev_fixture_scenario', 'lifehub_dev_fixture_data'].forEach((key) => localStorage.removeItem(key));
    setBackupMessage('Local app data cleared. Reloading...');
    showToast('Local data cleared', 'danger');
    window.location.reload();
  };

  const loadSampleData = () => {
    if (user) {
      showToast('Sign out before loading isolated sample data', 'danger');
      return;
    }
    const data = activateSampleScenario(sampleScenario);
    localStorage.setItem('lifehub_guest_mode', 'true');
    setGuestMode(true);
    useEventStore.getState().setEvents(data.events);
    useExpenseStore.getState().setExpenses(data.expenses);
    useIncomeStore.getState().setIncomes(data.incomes);
    setActiveSampleScenario(sampleScenario);
    showToast(`${getSampleScenarioLabel(sampleScenario)} sample data ready`, 'success');
  };

  const clearSampleData = async () => {
    clearActiveSampleScenario();
    setActiveSampleScenario(null);
    await Promise.all([
      useEventStore.getState().loadEvents(null, isGuest),
      useExpenseStore.getState().loadExpenses(null, isGuest),
      useIncomeStore.getState().loadIncomes(null, isGuest),
    ]);
    showToast('Sample data removed; your own data is unchanged', 'success');
  };

  const toggleSection = (section) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const renderProfileSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-profile-row"><strong>{profileName}</strong><span>{isGuest ? 'Guest mode' : 'Authenticated mode'}</span></div>
    </div>
  );

  const renderAdminValuesSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-admin-grid">
        <label className="settings-input-block">
          <span>Event types</span>
          <ValueListEditor label="event type" value={eventTypes} onChange={setEventTypes} />
        </label>

        <label className="settings-input-block">
          <span>Income types</span>
          <ValueListEditor label="income type" value={incomeTypes} onChange={setIncomeTypes} />
        </label>

        <label className="settings-input-block">
          <span>Expense categories</span>
          <ValueListEditor label="expense category" value={expenseCategories} onChange={setExpenseCategories} />
        </label>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-primary-button" onClick={saveAdminValues}>Save values</button>
        <button type="button" className="settings-secondary-button" onClick={resetAdminValues}>Reset defaults</button>
      </div>
    </div>
  );

  const renderGreetingCardsSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-greeting-panel">
        <div className="settings-placeholder-card">
          <button type="button" className="settings-placeholder-toggle" onClick={() => setShowPlaceholderReference((current) => !current)}>
            <span>{showPlaceholderReference ? '▼' : '▶'} Supported Placeholders</span>
            <span>{showPlaceholderReference ? 'Hide' : 'Show'}</span>
          </button>

          {showPlaceholderReference ? (
            <div className="settings-placeholder-body">
              <div className="settings-placeholder-grid">
                {placeholderDefinitions.map((placeholder) => (
                  <div key={placeholder.token} className="settings-placeholder-item">
                    <div className="settings-placeholder-header">
                      <strong>{placeholder.token}</strong>
                      <button type="button" className="settings-copy-placeholder" onClick={() => handleCopyPlaceholder(placeholder.token)}>
                        {copiedPlaceholder === placeholder.token ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <span>{placeholder.detail}</span>
                    <small>Source: {placeholder.source}</small>
                    <small>Example: {placeholder.sample}</small>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="settings-greeting-toolbar">
          <label className="settings-input-block">
            <span>Add event type</span>
            <DropdownSelect value={selectedGreetingType} onChange={(event) => setSelectedGreetingType(event.target.value)}>
              <option value="">Select an event type</option>
              {(adminValues.eventTypes || []).filter((type) => !greetingEnabledTypes.includes(type)).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </DropdownSelect>
          </label>
          <button type="button" className="settings-primary-button" onClick={addGreetingType} disabled={!selectedGreetingType}>Add greeting type</button>
        </div>

        {activeGreetingType ? (
          <section className="settings-greeting-editor-card" aria-label={`${activeGreetingType} greeting template`}>
            <div className="settings-greeting-type-rail" role="tablist" aria-label="Greeting event types">
              {greetingEnabledTypes.map((eventType) => (
                <button
                  key={eventType}
                  type="button"
                  role="tab"
                  aria-selected={activeGreetingType === eventType}
                  className={activeGreetingType === eventType ? 'is-active' : ''}
                  onClick={() => setActiveGreetingType(eventType)}
                >
                  {eventType}
                </button>
              ))}
            </div>

            <div className="settings-greeting-editor-heading">
              <div>
                <strong>{activeGreetingType} greeting</strong>
                <span>Edit your template and preview the result.</span>
              </div>
              <label className="settings-input-block settings-greeting-select-wrap">
                <span>Event type</span>
                <DropdownSelect value={activeGreetingType} onChange={(event) => handleGreetingTypeChange(activeGreetingType, event.target.value)}>
                  {(adminValues.eventTypes || []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </DropdownSelect>
              </label>
              <button type="button" className="settings-greeting-remove" onClick={() => removeGreetingType(activeGreetingType)} aria-label={`Remove ${activeGreetingType} greeting type`}>
                Remove
              </button>
            </div>

            <div className="settings-greeting-editor-grid">
              <label className="settings-input-block">
                <span>Message template</span>
                <textarea
                  rows={3}
                  value={greetingTemplates[activeGreetingType] || ''}
                  onChange={(event) => setGreetingTemplates((current) => ({ ...current, [activeGreetingType]: event.target.value }))}
                  placeholder={`Happy {ordinal} ${activeGreetingType} {name} 🎂`}
                />
              </label>
              <div className="settings-preview-box">
                <div className="settings-preview-label">Preview · Emma</div>
                <div className="settings-preview-text">{getPreviewText(activeGreetingType, greetingTemplates[activeGreetingType])}</div>
              </div>
            </div>
          </section>
        ) : (
          <div className="settings-greeting-empty">No greeting types enabled. Choose an event type above to get started.</div>
        )}
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-primary-button" onClick={saveGreetingSettings}>Save greeting cards</button>
      </div>
    </div>
  );

  const renderDefaultsSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-admin-grid">
        <label className="settings-input-block">
          <span>Appearance</span>
          <DropdownSelect value={theme} onChange={(event) => {
            const nextTheme = event.target.value;
            setTheme(nextTheme);
            document.documentElement.dataset.theme = nextTheme;
            setPreferences({ ...preferences, theme: nextTheme });
          }}>
            <option value="light">Soft light</option>
            <option value="dark">Dark</option>
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default currency</span>
          <DropdownSelect value={prefForm.currency} onChange={(event) => setPrefForm((current) => ({ ...current, currency: event.target.value }))}>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default dashboard view</span>
          <DropdownSelect value={prefForm.dashboardView} onChange={(event) => setPrefForm((current) => ({ ...current, dashboardView: event.target.value }))}>
            <option value="overview">Overview</option>
            <option value="events">Events</option>
            <option value="financials">Financials</option>
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default event type</span>
          <DropdownSelect value={prefForm.defaultEventType} onChange={(event) => setPrefForm((current) => ({ ...current, defaultEventType: event.target.value }))}>
            {adminValues.eventTypes.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default income type</span>
          <DropdownSelect value={prefForm.defaultIncomeType} onChange={(event) => setPrefForm((current) => ({ ...current, defaultIncomeType: event.target.value }))}>
            {adminValues.incomeTypes.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default expense category</span>
          <DropdownSelect value={prefForm.defaultExpenseCategory} onChange={(event) => setPrefForm((current) => ({ ...current, defaultExpenseCategory: event.target.value }))}>
            {adminValues.expenseCategories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </DropdownSelect>
        </label>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-primary-button" onClick={savePreferences}>Save preferences</button>
        <button type="button" className="settings-secondary-button" onClick={resetPreferencesForm}>Reset</button>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-admin-grid">
        <button
          type="button"
          className="settings-choice"
          onClick={() => setPrefForm((current) => ({
            ...current,
            notifications: {
              ...current.notifications,
              eventReminders: !current.notifications.eventReminders,
            },
          }))}
          aria-pressed={prefForm.notifications.eventReminders}
        >
          <span className="settings-choice-icon"><Bell size={17} /></span>
          <span><strong>Event reminders</strong><small>Get nudges before key dates and activities.</small></span>
          <span className={`settings-switch ${prefForm.notifications.eventReminders ? 'settings-switch-on' : ''}`} aria-hidden="true"><span /></span>
        </button>

        <button
          type="button"
          className="settings-choice"
          onClick={() => setPrefForm((current) => ({
            ...current,
            notifications: {
              ...current.notifications,
              monthlySummary: !current.notifications.monthlySummary,
            },
          }))}
          aria-pressed={prefForm.notifications.monthlySummary}
        >
          <span className="settings-choice-icon"><Clock3 size={17} /></span>
          <span><strong>Monthly summary</strong><small>Receive a quick recap of spending and key events.</small></span>
          <span className={`settings-switch ${prefForm.notifications.monthlySummary ? 'settings-switch-on' : ''}`} aria-hidden="true"><span /></span>
        </button>

        <button
          type="button"
          className="settings-choice"
          onClick={() => setPrefForm((current) => ({
            ...current,
            notifications: {
              ...current.notifications,
              budgetAlerts: !current.notifications.budgetAlerts,
            },
          }))}
          aria-pressed={prefForm.notifications.budgetAlerts}
        >
          <span className="settings-choice-icon"><Database size={17} /></span>
          <span><strong>Budget alerts</strong><small>Warn when your monthly spend is trending high.</small></span>
          <span className={`settings-switch ${prefForm.notifications.budgetAlerts ? 'settings-switch-on' : ''}`} aria-hidden="true"><span /></span>
        </button>
      </div>

      <div className="settings-admin-grid">
        <label className="settings-input-block">
          <span>Daily reminder time</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="9:00 AM"
            value={prefForm.notifications.reminderTime}
            onChange={(event) => {
              const nextValue = event.target.value;
              setPrefForm((current) => ({
                ...current,
                notifications: {
                  ...current.notifications,
                  reminderTime: normalizeReminderTime(nextValue),
                },
              }));
            }}
            title="Enter a time like 9:00 AM or 21:00"
          />
        </label>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-primary-button" onClick={() => setPreferences(prefForm)}>Save notifications</button>
        <button type="button" className="settings-secondary-button" onClick={resetPreferencesForm}>Reset</button>
      </div>
    </div>
  );

  const renderDataSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-admin-grid">
        <div className="settings-input-block">
          <span>Local backup</span>
          <p className="settings-helper">Export your current local DN data as a JSON file or restore it later on the same device.</p>
        </div>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-primary-button" onClick={exportBackup}><Download size={15} /> Export backup</button>
        <label className="settings-secondary-button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
          <Upload size={15} /> Restore backup
          <input type="file" accept="application/json" onChange={importBackup} style={{ display: 'none' }} />
        </label>
        <button type="button" className="settings-secondary-button" onClick={() => setConfirmClearData(true)}><Trash2 size={15} /> Clear local data</button>
      </div>

      {backupMessage ? <p className="settings-message">{backupMessage}</p> : null}
    </div>
  );

  const sections = [
    { key: 'profile', heading: 'Profile', description: 'Manage account and user information.', icon: UserCircle, body: renderProfileSection() },
    { key: 'defaults', heading: 'Appearance & preferences', description: 'Choose your theme, currency, and default behavior.', icon: Settings2, body: renderDefaultsSection() },
    { key: 'notifications', heading: 'Notifications', description: 'Manage reminder and notification preferences.', icon: Bell, body: renderNotificationsSection() },
    { key: 'backup', heading: 'Data & Backup', description: 'Backup, restore or clear local data.', icon: Database, body: renderDataSection() },
    { key: 'admin-values', heading: 'Categories & types', description: 'Configure event types, income types and expense categories.', icon: ListChecks, body: renderAdminValuesSection() },
    { key: 'greeting-cards', heading: 'Greeting cards', description: 'Manage greeting templates and event greetings.', icon: Bell, body: renderGreetingCardsSection() },
    { key: 'about', heading: 'About', description: 'A personal space for the moments that matter.', icon: Info, body: <div className="settings-accordion-body settings-about"><strong>DN</strong><span>Your personal space for life moments, plans, memories, and the details you want to keep close.</span><small>Version 1.0.0</small></div> },
  ];

  return (
    <div className="settings-page feature-page">
      <div className="settings-heading">
        <h2>Settings</h2>
        <p>Keep DN comfortable for the way you plan and remember.</p>
      </div>

      {import.meta.env.DEV && !user ? (
        <section className="dev-sample-panel" aria-label="Development sample data">
          <div><span className="settings-section-heading"><Database size={17} /> Safe sample-data lab</span><p>Development only. Fixtures are isolated from guest backups and Firebase, and are disabled while signed in.</p></div>
          <div className="dev-sample-actions">
            <DropdownSelect value={sampleScenario} onChange={(event) => setSampleScenario(event.target.value)} aria-label="Sample data scenario">
              {Object.entries(getSampleScenarioDefinitions()).map(([key, scenario]) => <option key={key} value={key}>{scenario.label} · {scenario.events} events</option>)}
            </DropdownSelect>
            <button type="button" className="settings-primary-button" onClick={loadSampleData} disabled={Boolean(user)}>Load sample</button>
            {activeSampleScenario ? <button type="button" className="settings-secondary-button" onClick={clearSampleData}>Clear sample</button> : null}
          </div>
          {activeSampleScenario ? <small className="dev-sample-active">Active: {getSampleScenarioLabel(activeSampleScenario)} · {getActiveSampleData()?.events.length || 0} events · {getActiveSampleData()?.activities.length || 0} activities · {getActiveSampleData()?.memories.length || 0} memories</small> : null}
        </section>
      ) : null}

      {sections.map(({ key, heading, description, icon: Icon, body }) => {
        const isOpen = openSection === key;
        return (
          <section key={key} className="settings-section">
            <button type="button" className="settings-accordion-toggle" onClick={() => toggleSection(key)} aria-expanded={isOpen}>
              <span className="settings-accordion-header-main">
                <span className="settings-accordion-icon"><Icon size={18} /></span>
                <span className="settings-accordion-text">
                  <strong>{heading}</strong>
                  <small>{description}</small>
                </span>
              </span>
              <span className="settings-accordion-indicator">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen ? body : null}
          </section>
        );
      })}

      {confirmClearData ? (
        <ModalDialog title="Clear local DN data?" onClose={() => setConfirmClearData(false)}>
          <p className="settings-helper">This removes guest data, preferences, and local backups from this browser. This action cannot be undone.</p>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={() => setConfirmClearData(false)}>Keep my data</button>
            <button type="button" className="settings-primary-button" onClick={clearLocalData}>Clear local data</button>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  );
}
