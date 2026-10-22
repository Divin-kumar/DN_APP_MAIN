import { clearDnLocalData } from '../utils/storageMigration';
// This page contains app settings and personalization controls.
// It lets the user customize event categories, income types, expense labels, reminder time, and greeting templates.
import { UserCircle, Settings2, Database, Download, Upload, Trash2, Bell, Clock3, Info, ChevronRight, RotateCcw, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ModalDialog from '../components/common/ModalDialog';
import DropdownSelect from '../components/common/DropdownSelect';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { createEvent, getEventsForUser, getGuestEvents, setGuestEvents, updateEvent } from '../services/eventService';
import { createExpense, getExpensesForUser, getGuestExpenseMasters, getGuestExpenses, setGuestExpenses } from '../services/expenseService';
import { createIncome, getIncomesForUser, getGuestIncomes, setGuestIncomes } from '../services/incomeService';
import { activateSampleScenario, clearActiveSampleScenario, getActiveSampleData, getActiveSampleScenario, getSampleScenarioDefinitions, getSampleScenarioLabel } from '../dev/sampleData';
import useAppStore from '../store/useAppStore';
import { CODE_LIST_SCHEMA_VERSION, collectReferencedCodeListValues, DEFAULT_CODE_LISTS, getCodeListItems } from '../utils/codeLists';
import { downloadBlob } from '../utils/download';
import { buildEventGroupsFromBackup, collectBackupReferenceWarnings, createBackupDocument, mergeEventGroupsForRestore, mergeRecordsById, parseBackupDocument } from '../services/backupService';

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
        <button type="button" className="settings-tag-add" onClick={addItem}><Plus size={15} aria-hidden="true" /> Add</button>
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
  const restorePreferences = useAppStore((state) => state.restorePreferences);
  const resetAdminValues = useAppStore((state) => state.resetAdminValues);
  const setPreferences = useAppStore((state) => state.setPreferences);
  const resetPreferences = useAppStore((state) => state.resetPreferences);
  const resetAllSettings = useAppStore((state) => state.resetAllSettings);
  const setGuestMode = useAppStore((state) => state.setGuestMode);
  const profileName = user?.displayName || user?.email || 'Guest';
  const eventTypeOptions = getCodeListItems('eventTypes', adminValues.eventTypes);
  const incomeTypeOptions = getCodeListItems('incomeTypes', adminValues.incomeTypes);
  const expenseCategoryOptions = getCodeListItems('expenseCategories', adminValues.expenseCategories);

  const [eventTypes, setEventTypes] = useState(eventTypeOptions.join(', '));
  const [incomeTypes, setIncomeTypes] = useState(incomeTypeOptions.join(', '));
  const [expenseCategories, setExpenseCategories] = useState(expenseCategoryOptions.join(', '));
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
  const [pendingBackup, setPendingBackup] = useState(null);
  const [importingBackup, setImportingBackup] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const [resettingSettings, setResettingSettings] = useState(false);
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
  useEffect(() => {
    setEventTypes(eventTypeOptions.join(', '));
    setIncomeTypes(incomeTypeOptions.join(', '));
    setExpenseCategories(expenseCategoryOptions.join(', '));
  }, [adminValues]);

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

  const exportBackup = async () => {
    try {
      setBackupMessage('Preparing an application data backup…');

      let events;
      let expenses;
      let incomes;
      let dataSource;

      const sampleData = getActiveSampleData(user?.uid || null);
      if (sampleData) {
        ({ events, expenses, incomes } = sampleData);
        dataSource = 'development-sample';
      } else if (isGuest) {
        events = getGuestEvents();
        expenses = getGuestExpenses();
        incomes = getGuestIncomes();
        dataSource = 'guest-local';
      } else if (user?.uid) {
        [events, expenses, incomes] = await Promise.all([
          getEventsForUser(user.uid),
          getExpensesForUser(user.uid),
          getIncomesForUser(user.uid),
        ]);
        dataSource = 'firebase-account';
      } else {
        events = getGuestEvents();
        expenses = getGuestExpenses();
        incomes = getGuestIncomes();
        dataSource = 'local-browser';
      }

      const pickerStorageId = user?.uid || (isGuest ? 'guest' : 'local');
      const readIdList = (key) => {
        try {
          const value = JSON.parse(localStorage.getItem(key) || '[]');
          return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
        } catch {
          return [];
        }
      };
      const snapshot = createBackupDocument({
        moments: events,
        expenses,
        incomes,
        codeLists: adminValues,
        codeListSchemaVersion: CODE_LIST_SCHEMA_VERSION,
        preferences,
        settings: { themeChoiceEnabled: Boolean(localStorage.getItem('dn_theme_choice')) },
        dashboardConfiguration: {
          favorites: readIdList(`dn_favorite_event_ids_${pickerStorageId}`),
          recent: readIdList(`dn_recent_event_ids_${pickerStorageId}`),
        },
        metadata: {
          source: dataSource,
          sourceAccount: user?.uid ? {
            uid: user.uid,
            displayName: user.displayName || null,
            email: user.email || null,
          } : null,
          appVersion: String(import.meta.env.VITE_APP_VERSION || 'dev'),
        },
      });

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `dn-backup-${snapshot.createdDate.slice(0, 10)}.json`);
      setBackupMessage('Backup downloaded. Attachment records contain metadata only; original file bytes are not stored by this app.');
      showToast('Backup exported', 'success');
    } catch (error) {
      console.error('Failed to export application backup:', error);
      setBackupMessage('Backup could not be created. Check your connection and try again.');
      showToast('Backup export failed', 'danger');
    }
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('Backup files must be 50 MB or smaller.');
      }
      const parsed = JSON.parse(await file.text());
      const backup = parseBackupDocument(parsed);
      const referenceWarnings = collectBackupReferenceWarnings(backup);

      setPendingBackup({
        backup,
        fileName: file.name,
        referenceWarnings,
        legacySettingsOnly: Boolean(backup.metadata.legacySettingsOnly),
      });
      setBackupMessage('Backup schema and required relationships validated. Review the import and conflict policy before restoring.');
    } catch (error) {
      console.error('Unable to read backup file:', error);
      setBackupMessage(error.message || 'That file is not a valid DN backup.');
      showToast('Backup file could not be read', 'danger');
    } finally {
      event.target.value = '';
    }
  };

  const restorePendingBackup = async () => {
    if (!pendingBackup || importingBackup) return;
    setImportingBackup(true);
    const { backup } = pendingBackup;

    try {
      const sampleData = getActiveSampleData(user?.uid || null);
      if (sampleData) {
        throw new Error('Clear the isolated development sample scenario before restoring a backup.');
      }

      const importedGroups = buildEventGroupsFromBackup(backup);
      const imported = { moments: 0, activities: 0, memories: 0, attachments: 0, expenses: 0, incomes: 0, conflicts: 0 };
      let restoredGroups;
      let resultingExpenses;
      let resultingIncomes;

      if (isGuest || !user?.uid) {
        const existingExpenseMasters = getGuestExpenseMasters();
        const existingGroups = getGuestEvents();
        const existingExpenses = getGuestExpenses();
        const existingIncomes = getGuestIncomes();
        const merged = mergeEventGroupsForRestore(existingGroups, importedGroups, existingExpenses);
        restoredGroups = merged.eventGroups;
        Object.assign(imported, merged.counts);
        setGuestEvents(restoredGroups);

        const nestedExpenseIds = new Set(restoredGroups.flatMap((moment) => (
          (moment.activities || []).flatMap((activity) => (activity.expenses || []).map((expense) => expense.id).filter(Boolean))
        )));
        const existingExpenseIds = new Set(existingExpenses.map((expense) => expense.id).filter(Boolean));
        const standaloneBackupExpenses = backup.expenses.filter((expense) => (
          !nestedExpenseIds.has(expense.id) && !existingExpenseIds.has(expense.id)
        ));
        imported.conflicts += backup.expenses.length - standaloneBackupExpenses.length
          - backup.expenses.filter((expense) => nestedExpenseIds.has(expense.id)).length;
        // Keep existing independent ledger entries even when the backup adds a
        // matching activity mirror; never copy the merged projection to storage.
        resultingExpenses = mergeRecordsById(existingExpenseMasters, standaloneBackupExpenses).items;
        setGuestExpenses(resultingExpenses);
        imported.expenses = standaloneBackupExpenses.length;

        const mergedIncomes = mergeRecordsById(existingIncomes, backup.incomes);
        resultingIncomes = mergedIncomes.items;
        setGuestIncomes(resultingIncomes);
        imported.incomes = mergedIncomes.added;
        imported.conflicts += backup.incomes.length - mergedIncomes.added;
      } else {
        const [existingGroups, existingExpenses, existingIncomes] = await Promise.all([
          getEventsForUser(user.uid),
          getExpensesForUser(user.uid),
          getIncomesForUser(user.uid),
        ]);
        const merged = mergeEventGroupsForRestore(existingGroups, importedGroups, existingExpenses);
        restoredGroups = merged.eventGroups;
        Object.assign(imported, merged.counts);

        const existingById = new Map(existingGroups.map((moment) => [moment.id, moment]));
        for (const moment of restoredGroups) {
          const previous = existingById.get(moment.id);
          if (!previous) {
            const legacyDestination = existingGroups.length > 0 && existingGroups.every((item) => item.firestoreCollection === 'events');
            await createEvent(user.uid, { ...moment, ...(legacyDestination ? { firestoreCollection: 'events' } : {}) });
            continue;
          }
          if (JSON.stringify(previous) !== JSON.stringify(moment)) await updateEvent(user.uid, { ...moment, firestoreCollection: previous.firestoreCollection });
        }

        const nestedExpenseIds = new Set(restoredGroups.flatMap((moment) => (
          (moment.activities || []).flatMap((activity) => (activity.expenses || []).map((expense) => expense.id).filter(Boolean))
        )));
        const existingExpenseIds = new Set(existingExpenses.map((expense) => expense.id).filter(Boolean));
        const standaloneBackupExpenses = backup.expenses.filter((expense) => (
          !nestedExpenseIds.has(expense.id) && !existingExpenseIds.has(expense.id)
        ));
        imported.conflicts += backup.expenses.length - standaloneBackupExpenses.length
          - backup.expenses.filter((expense) => nestedExpenseIds.has(expense.id)).length;
        for (const expense of standaloneBackupExpenses) await createExpense(user.uid, expense);
        imported.expenses = standaloneBackupExpenses.length;

        const mergedIncomes = mergeRecordsById(existingIncomes, backup.incomes);
        for (const income of backup.incomes) {
          if (existingIncomes.some((current) => current.id === income.id)) continue;
          await createIncome(user.uid, income);
        }
        imported.incomes = mergedIncomes.added;
        imported.conflicts += backup.incomes.length - mergedIncomes.added;
      }

      // Configuration is restored only after record writes succeed. Existing record values win on ID conflicts.
      if (backup.settings.restoreCodeLists !== false) await setAdminValues(backup.codeLists);
      if (Object.keys(backup.preferences).length) {
        restorePreferences(backup.preferences);
        setTheme(backup.preferences.theme || 'dark');
        document.documentElement.dataset.theme = backup.preferences.theme === 'light' ? 'light' : 'dark';
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
          'content', backup.preferences.theme === 'light' ? '#f3f6fb' : '#0b1020',
        );
      }

      const pickerStorageId = user?.uid || (isGuest ? 'guest' : 'local');
      const validMomentIds = new Set(restoredGroups.map((moment) => moment.id));
      const favorites = [...new Set((backup.dashboardConfiguration.favorites || []).filter((id) => validMomentIds.has(id)))];
      const recent = [...new Set((backup.dashboardConfiguration.recent || []).filter((id) => validMomentIds.has(id)))].slice(0, 8);
      localStorage.setItem(`dn_favorite_event_ids_${pickerStorageId}`, JSON.stringify(favorites));
      localStorage.setItem(`dn_recent_event_ids_${pickerStorageId}`, JSON.stringify(recent));

      const importSummary = `Restore complete: ${imported.moments} Moments, ${imported.activities} Activities, ${imported.memories} Memories, ${imported.attachments} attachment records, ${imported.expenses} standalone Expenses, and ${imported.incomes} Income records added; ${imported.conflicts} existing-ID conflicts preserved. Preferences, dashboard configuration, and Code Lists were restored where present.`;

      setPendingBackup(null);
      setBackupMessage(`${importSummary} Reloading app. Original attachment files are not included because the application stores attachment metadata only.`);
      showToast('Backup restore finished', 'success');
      window.location.reload();
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setBackupMessage(`Restore incomplete: ${error.message || 'check your connection and try again'}. Records already imported were kept; re-importing this file skips matching IDs.`);
      showToast('Backup restore incomplete', 'danger');
    } finally {
      setImportingBackup(false);
    }
  };

  const clearLocalData = () => {
    clearDnLocalData();
    setBackupMessage('Local app data cleared. Reloading...');
    showToast('Local data cleared', 'danger');
    window.location.reload();
  };

  const resetAllSettingsSafely = async () => {
    if (resettingSettings) return;
    setResettingSettings(true);

    try {
      if (!isGuest && !user?.uid) throw new Error('Your account records could not be identified. No settings were changed.');

      await Promise.all([
        useEventStore.getState().loadEvents(user?.uid, isGuest),
        useExpenseStore.getState().loadExpenses(user?.uid, isGuest),
        useIncomeStore.getState().loadIncomes(user?.uid, isGuest),
      ]);

      const eventState = useEventStore.getState();
      const expenseState = useExpenseStore.getState();
      const incomeState = useIncomeStore.getState();
      if (eventState.error || expenseState.error || incomeState.error) {
        throw new Error('DN could not verify all existing records. No settings were changed. Please try again when you are online.');
      }

      const referencedValues = collectReferencedCodeListValues({
        events: eventState.events,
        expenses: expenseState.expenses,
        incomes: incomeState.incomes,
      });
      await resetAllSettings(referencedValues);
      setTheme('dark');
      document.documentElement.dataset.theme = 'dark';
      setPrefForm({
        currency: 'INR',
        dashboardView: 'overview',
        defaultEventType: 'Personal',
        defaultIncomeType: 'Salary',
        defaultExpenseCategory: 'Food',
        notifications: { eventReminders: true, monthlySummary: true, budgetAlerts: true, reminderTime: '09:00' },
      });
      setConfirmResetSettings(false);
      showToast('Settings restored to defaults. Existing records were preserved.', 'success');
    } catch (error) {
      console.error('Unable to reset settings safely:', error);
      showToast(error.message || 'Settings could not be reset. No data was changed.', 'danger');
    } finally {
      setResettingSettings(false);
    }
  };

  const loadSampleData = () => {
    if (user) {
      showToast('Sign out before loading isolated sample data', 'danger');
      return;
    }
    const data = activateSampleScenario(sampleScenario);
    localStorage.setItem('dn_guest_mode', 'true');
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
            {eventTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default income type</span>
          <DropdownSelect value={prefForm.defaultIncomeType} onChange={(event) => setPrefForm((current) => ({ ...current, defaultIncomeType: event.target.value }))}>
            {incomeTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default expense category</span>
          <DropdownSelect value={prefForm.defaultExpenseCategory} onChange={(event) => setPrefForm((current) => ({ ...current, defaultExpenseCategory: event.target.value }))}>
            {expenseCategoryOptions.map((option) => (
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
          <p className="settings-helper">Export app settings and records to JSON. Restore merges missing records into the active guest or signed-in account; matching record IDs are skipped and existing records are never overwritten.</p>
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
          <div className={`dev-sample-actions${activeSampleScenario ? ' has-active-sample' : ''}`}>
            <DropdownSelect value={sampleScenario} onChange={(event) => setSampleScenario(event.target.value)} aria-label="Sample data scenario">
              {Object.entries(getSampleScenarioDefinitions()).map(([key, scenario]) => <option key={key} value={key}>{scenario.label} · {scenario.events} events</option>)}
            </DropdownSelect>
            <button type="button" className="settings-primary-button dev-sample-icon-action" onClick={loadSampleData} disabled={Boolean(user)} aria-label="Load sample data" title="Load sample data">
              <Database size={16} aria-hidden="true" /><span className="dev-sample-action-label">Load sample</span>
            </button>
            {activeSampleScenario ? <button type="button" className="settings-secondary-button dev-sample-icon-action" onClick={clearSampleData} aria-label="Clear sample data" title="Clear sample data">
              <Trash2 size={16} aria-hidden="true" /><span className="dev-sample-action-label">Clear sample</span>
            </button> : null}
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

      <div className="settings-navigation-hub settings-about-footer">
        <Link to="/settings/code-lists" className="settings-hub-card" aria-label="Open Code Lists page">
          <span className="settings-hub-icon"><Settings2 size={18} /></span>
          <span className="settings-hub-copy">
            <strong>Code Lists</strong>
            <small>Manage moment types, categories, priorities, and reminder presets</small>
          </span>
          <span className="settings-hub-arrow" aria-hidden="true"><ChevronRight size={18} /></span>
        </Link>

        <Link to="/settings/about" className="settings-hub-card" aria-label="Open About page">
          <span className="settings-hub-icon"><Info size={18} /></span>
          <span className="settings-hub-copy">
            <strong>About</strong>
            <small>Application overview, version, guide, and release notes</small>
          </span>
          <span className="settings-hub-arrow" aria-hidden="true"><ChevronRight size={18} /></span>
        </Link>
      </div>

      <section className="settings-reset-card">
        <div>
          <strong>Restore default settings</strong>
          <p>Reset appearance, preferences, reminders, greeting settings, and Code Lists without deleting your records.</p>
        </div>
        <button type="button" className="settings-secondary-button settings-reset-button" onClick={() => setConfirmResetSettings(true)}>
          <RotateCcw size={15} /> Reset all settings
        </button>
      </section>

      {pendingBackup ? (
        <ModalDialog title="Review backup restore" onClose={() => { if (!importingBackup) setPendingBackup(null); }}>
          <div className="settings-reset-warning">
            <p><strong>File:</strong> {pendingBackup.fileName}</p>
            <p><strong>Format:</strong> {pendingBackup.legacySettingsOnly ? 'Legacy settings-only backup' : `Version ${pendingBackup.backup.backupVersion}`}</p>
            {!pendingBackup.legacySettingsOnly ? (
              <>
                <p><strong>Created:</strong> {pendingBackup.backup.createdDate}</p>
                <ul>
                  <li>{pendingBackup.backup.moments.length} Moments</li>
                  <li>{pendingBackup.backup.activities.length} Activities</li>
                  <li>{pendingBackup.backup.memories.length} Memories</li>
                  <li>{pendingBackup.backup.attachments.length} attachment metadata records (no file bytes)</li>
                  <li>{pendingBackup.backup.expenses.length} Expenses</li>
                  <li>{pendingBackup.backup.incomes.length} Income records</li>
                  <li>Code Lists, preferences, and dashboard configuration</li>
                </ul>
                <p>Restore uses a merge policy: missing records and child records are added; existing records with matching IDs are preserved, not overwritten. Configuration from the backup replaces the destination configuration. An interrupted restore can be retried; completed records are recognized by ID.</p>
                <p><strong>Attachment limitation:</strong> original files are not in this backup because the app currently stores attachment metadata only.</p>
                {pendingBackup.referenceWarnings.length ? (
                  <div role="alert"><strong>Relationship warnings</strong><ul>{pendingBackup.referenceWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
                ) : null}
              </>
            ) : <p>This legacy file contains settings only; it cannot restore Moments or financial records.</p>}
            {pendingBackup.backup.metadata.sourceAccount?.uid ? <p>Backup source account: {pendingBackup.backup.metadata.sourceAccount.displayName || pendingBackup.backup.metadata.sourceAccount.uid}. Its authentication account is not recreated.</p> : null}
            {user?.uid ? <p>The records will be merged into the currently signed-in account, not necessarily the account that created the backup.</p> : <p>Records will be merged into this browser's guest data.</p>}
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={() => setPendingBackup(null)} disabled={importingBackup}>Cancel</button>
            <button type="button" className="settings-primary-button" onClick={restorePendingBackup} disabled={importingBackup}>
              {importingBackup ? 'Restoring backup…' : 'Confirm restore'}
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {confirmClearData ? (
        <ModalDialog title="Clear local DN data?" onClose={() => setConfirmClearData(false)}>
          <p className="settings-helper">This removes guest data, preferences, and local backups from this browser. This action cannot be undone.</p>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={() => setConfirmClearData(false)}>Keep my data</button>
            <button type="button" className="settings-primary-button" onClick={clearLocalData}>Clear local data</button>
          </div>
        </ModalDialog>
      ) : null}

      {confirmResetSettings ? (
        <ModalDialog title="Reset all settings?" className="settings-reset-dialog" onClose={() => { if (!resettingSettings) setConfirmResetSettings(false); }}>
          <div className="settings-reset-warning">
            <p>This restores DN configuration only:</p>
            <ul>
              <li>Theme and appearance</li>
              <li>Currency, dashboard view, and default moment, income, and expense selections</li>
              <li>Notifications and reminder time</li>
              <li>Greeting types and templates</li>
              <li>All Code Lists and their system default values</li>
            </ul>
            <p>Unused custom Code List values will be removed. Values referenced by existing records will remain available as inactive values.</p>
            <p><strong>Your events, expenses, income, activities, memories, attachments, and account data will not be deleted or edited.</strong></p>
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={() => setConfirmResetSettings(false)} disabled={resettingSettings}>Cancel</button>
            <button type="button" className="settings-primary-button" onClick={resetAllSettingsSafely} disabled={resettingSettings}>
              {resettingSettings ? 'Checking records…' : 'Reset all settings'}
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </div>
  );
}
