import { clearDnLocalData } from '../utils/storageMigration';
import { listStateScope } from '../utils/listStateMemory';
import { exportSavedListDefaultsForScope, resetSavedListDefaultsForScope, restoreSavedListDefaultsForScope } from '../utils/listViewDefaults';
import { settingsResetContext, assertSettingsResetContext, assertSettingsResetRecords } from '../utils/settingsResetSafety';
import { dashboardConfigurationRestorePatch } from '../utils/backupDashboardConfiguration';
import './GuestTour.css';
// This page contains app settings and personalization controls.
// It lets the user customize event categories, income types, expense labels, reminder time, and greeting templates.
import { UserCircle, Settings2, Database, Download, Upload, Trash2, Bell, Info, ChevronRight, ChevronDown, RotateCcw, Plus, ArrowRight, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ModalDialog from '../components/common/ModalDialog';
import DropdownSelect from '../components/common/DropdownSelect';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { createEvent, getEventsForUser, getGuestEvents, setGuestEvents, updateEvent } from '../services/eventService';
import { createExpense, getExpensesForUser, getGuestExpenseMasters, getGuestExpenses, setGuestExpenses } from '../services/expenseService';
import { createIncome, getIncomesForUser, getGuestIncomes, setGuestIncomes } from '../services/incomeService';
import { activateSampleScenario, clearActiveSampleScenario, clearGuestTourDeclined, getActiveSampleData, getActiveSampleScenario, getSampleScenarioDefinitions, getSampleScenarioLabel, GUEST_TOUR_SCENARIO, GUEST_TOUR_VERSION, guestTourNeedsUpdate, hydrateGuestTourPhotos, markGuestTourDeclined } from '../dev/sampleData';
import useAppStore from '../store/useAppStore';
import { CODE_LIST_SCHEMA_VERSION, collectReferencedCodeListValues, getCodeListItems } from '../utils/codeLists';
import { downloadBlob } from '../utils/download';
import { buildEventGroupsFromBackup, collectBackupReferenceWarnings, mergeEventGroupsForRestore, mergeRecordsById } from '../services/backupService';
import { createBackupFile, readBackupFile } from '../services/backupFileService';
import { restoreAttachmentFiles } from '../services/attachmentService';

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
  const [exportingBackup, setExportingBackup] = useState(false);
  const [readingBackup, setReadingBackup] = useState(false);
  const backupOperationRef = useRef(null);
  useEffect(() => () => backupOperationRef.current?.abort(), []);
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
      notifications: preferences.notifications,
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
    if (backupOperationRef.current || exportingBackup || importingBackup || readingBackup) return;
    setExportingBackup(true);
    const operation = new AbortController();
    backupOperationRef.current = operation;
    const sourceUid = user?.uid || null;
    const sourceGuest = isGuest;
    const sourceScenario = getActiveSampleScenario();
    const assertSourceScope = () => {
      const state = useAppStore.getState();
      if ((state.user?.uid || null) !== sourceUid || state.isGuest !== sourceGuest || getActiveSampleScenario() !== sourceScenario) {
        throw new Error('Your session changed. Open Data & Backup in the current session and try again.');
      }
    };
    try {
      setBackupMessage('Preparing an application data backup…');

      let events;
      let expenses;
      let incomes;
      let dataSource;

      const sampleData = getActiveSampleData(user?.uid || null);
      if (sampleData) {
        ({ events, expenses, incomes } = sampleData);
        dataSource = sampleData.scenario === GUEST_TOUR_SCENARIO ? 'guided-guest-demo' : 'development-sample';
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
      assertSourceScope();
      const pickerStorageId = user?.uid || (isGuest ? 'guest' : 'local');
      const readIdList = (key) => {
        try {
          const value = JSON.parse(localStorage.getItem(key) || '[]');
          return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
        } catch {
          return [];
        }
      };
      const result = await createBackupFile({
        moments: events,
        expenses,
        incomes,
        codeLists: adminValues,
        codeListSchemaVersion: CODE_LIST_SCHEMA_VERSION,
        preferences,
        settings: {
          themeChoiceEnabled: Boolean(localStorage.getItem('dn_theme_choice')),
          ...(sourceUid || sourceGuest ? {
            listViewDefaults: exportSavedListDefaultsForScope(listStateScope(useAppStore.getState())),
          } : {}),
        },
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
      }, { uid: sourceUid, isGuest: isGuest || !sourceUid, sample: Boolean(sampleData),
        signal: operation.signal, assertCurrent: assertSourceScope,
        onProgress: (progress) => setBackupMessage(progress.stage === 'originals'
          ? `Preparing original files: ${progress.completed} of ${progress.total} checked…`
          : `Preparing backup records: ${progress.records} processed…`),
      });
      assertSourceScope();
      if (operation.signal.aborted) throw new DOMException('Backup preparation cancelled.', 'AbortError');
      downloadBlob(result.blob, `dn-backup-${result.createdDate.slice(0, 10)}.json`);
      const { originalFileCount, metadataOnlyCount } = result;
      setBackupMessage(`Backup downloaded with ${originalFileCount} original attachment ${originalFileCount === 1 ? 'file' : 'files'}.${metadataOnlyCount ? ` ${metadataOnlyCount} older attachment ${metadataOnlyCount === 1 ? 'record has' : 'records have'} no stored original; reattach the original files to include them.` : ''}`);
      showToast('Backup exported', 'success');
    } catch (error) {
      if (error.name === 'AbortError') { setBackupMessage('Backup preparation cancelled. No partial backup was downloaded.'); return; }
      console.error('Failed to export application backup:', error);
      setBackupMessage(`Backup could not be created: ${error.message || 'check your connection and try again'}.`);
      showToast('Backup export failed', 'danger');
    } finally {
      setExportingBackup(false);
      if (backupOperationRef.current === operation) backupOperationRef.current = null;
    }
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file || backupOperationRef.current || readingBackup || exportingBackup || importingBackup) return;
    setReadingBackup(true);
    setPendingBackup(null);
    const operation = new AbortController();
    backupOperationRef.current = operation;
    const sourceUid = user?.uid || null;
    const sourceGuest = isGuest;
    const sourceScenario = getActiveSampleScenario();
    let lastProgress = 0;

    try {
      setBackupMessage('Reading and checking your backup…');
      const result = await readBackupFile(file, { signal: operation.signal,
        assertCurrent: () => {
          const current = useAppStore.getState();
          if ((current.user?.uid || null) !== sourceUid || current.isGuest !== sourceGuest
            || getActiveSampleScenario() !== sourceScenario) throw new Error('Your session changed. Select the backup again in the intended workspace.');
        },
        onProgress: (progress) => {
          if (Date.now() - lastProgress < 100 && progress.completed !== progress.total) return;
          lastProgress = Date.now();
          setBackupMessage(progress.stage === 'checking'
            ? `Checking original files: ${progress.completed} verified…`
            : `Reading backup: ${Math.round(progress.completed / progress.total * 100)}%…`);
        },
      });
      const { backup } = result;
      const referenceWarnings = collectBackupReferenceWarnings(backup);

      setPendingBackup({
        ...result,
        fileName: file.name,
        referenceWarnings,
        legacySettingsOnly: Boolean(backup.metadata.legacySettingsOnly),
      });
      setBackupMessage('Backup schema, required relationships and stored original files checked. Review the import and conflict policy before restoring.');
    } catch (error) {
      if (error.name === 'AbortError') { setBackupMessage('Backup reading cancelled. No records or original files were restored.'); return; }
      console.error('Unable to read backup file:', error);
      setBackupMessage(error.message || 'That file is not a valid DN backup.');
      showToast('Backup file could not be read', 'danger');
    } finally {
      event.target.value = '';
      setReadingBackup(false);
      if (backupOperationRef.current === operation) backupOperationRef.current = null;
    }
  };

  const restorePendingBackup = async () => {
    if (!pendingBackup || importingBackup || exportingBackup) return;
    setImportingBackup(true);
    const { backup } = pendingBackup;
    const destinationUid = user?.uid || null;
    const destinationGuest = isGuest;
    // Restoring a validated personal backup exits the isolated Guest tour
    // only after the user confirms, not when browsing or parsing the file.
    // Scoped original-file writes target real Guest storage, never demo data.
    const destinationScenario = getActiveSampleScenario();
    const restoreFromGuestTour = destinationScenario === GUEST_TOUR_SCENARIO && isGuest && !destinationUid;
    const assertDestinationScope = () => {
      const state = useAppStore.getState();
      if ((state.user?.uid || null) !== destinationUid || state.isGuest !== destinationGuest || getActiveSampleScenario() !== destinationScenario) {
        throw new Error('Your session changed. Open Data & Backup in the intended session before retrying.');
      }
    };

    try {
      assertDestinationScope();
      const sampleData = getActiveSampleData(user?.uid || null);
      if (destinationScenario && !restoreFromGuestTour) {
        throw new Error('Exit the development sample session before restoring a personal backup.');
      }
      // Preflight personal Guest ledgers before leaving the demo, so malformed
      // destination data never causes an unnecessary switch or partial import.
      if (restoreFromGuestTour) {
        getGuestEvents();
        getGuestExpenseMasters();
        getGuestExpenses();
        getGuestIncomes();
        assertDestinationScope();
        // Keep the demo accessible until all personal restoration succeeds.
        // This path writes originals and records only into real Guest scope.
      } else if (sampleData) {
        throw new Error('Exit the isolated sample session before restoring a personal backup.');
      }
      assertDestinationScope();
      setBackupMessage('Verifying and restoring original attachment files before records…');
      const importedGroups = await restoreAttachmentFiles(buildEventGroupsFromBackup(backup, { originalFiles: pendingBackup.originalFiles }), backup.attachmentFiles || [], {
        uid: destinationUid, isGuest: isGuest || !destinationUid, assertCurrent: assertDestinationScope, readOriginal: pendingBackup.readOriginal,
      });
      assertDestinationScope();
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
        assertDestinationScope();
        const merged = mergeEventGroupsForRestore(existingGroups, importedGroups, existingExpenses);
        restoredGroups = merged.eventGroups;
        Object.assign(imported, merged.counts);

        const existingById = new Map(existingGroups.map((moment) => [moment.id, moment]));
        for (const moment of restoredGroups) {
          assertDestinationScope();
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
        for (const expense of standaloneBackupExpenses) {
          assertDestinationScope();
          await createExpense(user.uid, expense);
        }
        imported.expenses = standaloneBackupExpenses.length;

        const mergedIncomes = mergeRecordsById(existingIncomes, backup.incomes);
        for (const income of backup.incomes) {
          assertDestinationScope();
          if (existingIncomes.some((current) => current.id === income.id)) continue;
          await createIncome(user.uid, income);
        }
        imported.incomes = mergedIncomes.added;
        imported.conflicts += backup.incomes.length - mergedIncomes.added;
      }

      // Configuration is restored only after record writes succeed. Existing record values win on ID conflicts.
      assertDestinationScope();
      if (backup.settings.restoreCodeLists !== false) await setAdminValues(backup.codeLists);
      assertDestinationScope();
      if (Object.keys(backup.preferences).length) {
        restorePreferences(backup.preferences);
        setTheme(backup.preferences.theme || 'dark');
        document.documentElement.dataset.theme = backup.preferences.theme === 'light' ? 'light' : 'dark';
        document.querySelector('meta[name="theme-color"]')?.setAttribute(
          'content', backup.preferences.theme === 'light' ? '#f3f6fb' : '#0b1020',
        );
      }

      // An older v3 backup has no saved List defaults: keep this device's
      // current baseline rather than silently replace it with built-ins.
      assertDestinationScope();
      restoreSavedListDefaultsForScope(listStateScope(useAppStore.getState()), backup.settings.listViewDefaults);

      // Historical backups may omit Dashboard shortcuts entirely. Never
      // interpret an omitted field as an instruction to erase this device's
      // favorites or recent Moments; an explicit [] remains a valid clear.
      const pickerStorageId = destinationUid || (destinationGuest ? 'guest' : 'local');
      const validMomentIds = new Set(restoredGroups.map((moment) => moment.id));
      const dashboardPatch = dashboardConfigurationRestorePatch(backup.dashboardConfiguration, validMomentIds);
      for (const [key, ids] of Object.entries(dashboardPatch)) {
        assertDestinationScope();
        const storageKey = key === 'favorites' ? 'favorite_event_ids' : 'recent_event_ids';
        localStorage.setItem(`dn_${storageKey}_${pickerStorageId}`, JSON.stringify(ids));
      }

      const importSummary = `Restore complete: ${imported.moments} Moments, ${imported.activities} Activities, ${imported.memories} Memories, ${imported.attachments} attachment records, ${imported.expenses} standalone Expenses, and ${imported.incomes} Income records added; ${imported.conflicts} existing-ID conflicts preserved. Preferences, Dashboard shortcuts, Code Lists and saved List defaults were restored where present.`;

      if (restoreFromGuestTour) {
        // Only conclude the demo after all verified originals, records,
        // preferences and dashboard configuration have been restored.
        assertDestinationScope();
        markGuestTourDeclined();
        clearActiveSampleScenario();
        setActiveSampleScenario(null);
      }
      setPendingBackup(null);
      setBackupMessage(`${importSummary} ${(backup.attachmentFiles || []).length} original attachment files verified and restored. Reloading app.`);
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
    setBackupMessage('Local records and preferences cleared. Stored originals and account data are retained. Reloading...');
    showToast('Local data cleared', 'danger');
    window.location.reload();
  };

  const resetAllSettingsSafely = async () => {
    if (resettingSettings) return;
    setResettingSettings(true);

    try {
      const initial = useAppStore.getState();
      const context = settingsResetContext(initial, getActiveSampleScenario(initial.user?.uid || null));
      const assertCurrent = () => assertSettingsResetContext(
        context, useAppStore.getState(), getActiveSampleScenario(context.uid),
      );
      assertCurrent();

      await Promise.all([
        useEventStore.getState().loadEvents(context.uid, context.isGuest),
        useExpenseStore.getState().loadExpenses(context.uid, context.isGuest),
        useIncomeStore.getState().loadIncomes(context.uid, context.isGuest),
      ]);

      assertCurrent();
      const eventState = useEventStore.getState();
      const expenseState = useExpenseStore.getState();
      const incomeState = useIncomeStore.getState();
      assertSettingsResetRecords(context, eventState, expenseState, incomeState);

      const referencedValues = collectReferencedCodeListValues({
        events: eventState.events,
        expenses: expenseState.expenses,
        incomes: incomeState.incomes,
      });
      await resetAllSettings(referencedValues, assertCurrent);
      assertCurrent();
      resetSavedListDefaultsForScope(context.scope);
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

  const startOrRefreshGuestTour = async () => {
    if (user?.uid || !isGuest) return;
    // Explicit opt-in/reset. Personal Guest data is a separate, untouched scope.
    try {
      clearGuestTourDeclined();
      const data = activateSampleScenario(GUEST_TOUR_SCENARIO);
      setActiveSampleScenario(GUEST_TOUR_SCENARIO);
      useEventStore.getState().setEvents(data.events);
      useExpenseStore.getState().setExpenses(data.expenses);
      useIncomeStore.getState().setIncomes(data.incomes);
      // Restore the isolated scope markers after explicit sample switching.
      await Promise.all([
        useEventStore.getState().loadEvents(null, true),
        useExpenseStore.getState().loadExpenses(null, true),
        useIncomeStore.getState().loadIncomes(null, true),
      ]);
      const ready = await hydrateGuestTourPhotos();
      if (ready && getActiveSampleScenario() === GUEST_TOUR_SCENARIO) {
        useEventStore.setState((state) => state.loadedFor === 'guest:anonymous'
          && state.loadedSample === GUEST_TOUR_SCENARIO && state.activeSample === GUEST_TOUR_SCENARIO
          ? { events: ready.events } : state);
      }
      showToast('Explore DN demo is ready', 'success');
    } catch (error) {
      showToast(error?.message || 'Demo illustrations could not be prepared', 'danger');
    }
  };
  const leaveGuestTour = async () => {
    if (getActiveSampleScenario() !== GUEST_TOUR_SCENARIO) return;
    markGuestTourDeclined();
    clearActiveSampleScenario();
    setActiveSampleScenario(null);
    await Promise.all([
      useEventStore.getState().loadEvents(null, true),
      useExpenseStore.getState().loadExpenses(null, true),
      useIncomeStore.getState().loadIncomes(null, true),
    ]);
    showToast('Your personal Guest workspace is ready; demo records were not copied.', 'success');
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
      <p><strong>Coming Soon</strong></p>
      <p>Notifications and reminders will be available in a future update.</p>
    </div>
  );

  const renderDataSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-admin-grid">
        <div className="settings-input-block">
          <span>Local backup</span>
          <p className="settings-helper">Export records, available original attachments, Code Lists and saved List defaults to one JSON file. DN has no fixed backup size cap; available browser memory and storage still apply. Restore adds missing records to the active Guest or signed-in account, preserves existing record IDs, and restores saved list defaults when the backup includes them. Your current page filters remain separate.</p>
        </div>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-primary-button" onClick={exportBackup} disabled={exportingBackup || importingBackup || readingBackup}><Download size={15} /> {exportingBackup ? 'Preparing backup…' : 'Export backup'}</button>
        <label className="settings-secondary-button dn-backup-file-picker">
          <Upload size={15} aria-hidden="true" /> Restore backup
          <input type="file" accept=".json,application/json" aria-label="Choose a DN backup JSON file"
            onChange={importBackup} disabled={exportingBackup || importingBackup || readingBackup} />
        </label>
        <button type="button" className="settings-secondary-button" onClick={() => setConfirmClearData(true)} disabled={exportingBackup || importingBackup || readingBackup}><Trash2 size={15} /> Clear local data</button>
        {readingBackup || exportingBackup ? <button type="button" className="settings-secondary-button" onClick={() => backupOperationRef.current?.abort()}>Cancel preparation</button> : null}
      </div>

      {backupMessage ? <p className="settings-message" role="status" aria-live="polite">{backupMessage}</p> : null}
    </div>
  );

  const sections = [
    { key: 'profile', heading: 'Profile', description: 'Manage account and user information.', icon: UserCircle, body: renderProfileSection() },
    { key: 'defaults', heading: 'Appearance & preferences', description: 'Choose your theme, currency, and default behavior.', icon: Settings2, body: renderDefaultsSection() },
    { key: 'notifications', heading: 'Notifications', description: 'Coming Soon.', icon: Bell, body: renderNotificationsSection() },
    { key: 'backup', heading: 'Data & Backup', description: 'Backup, restore or clear local data.', icon: Database, body: renderDataSection() },
  ];

  return (
    <div className="settings-page feature-page dn-settings-home">
      <div className="settings-heading">
        <h2>Settings</h2>
        <p>Keep DN comfortable for the way you plan and remember.</p>
      </div>

      {isGuest && !user ? (
        <section className="dev-sample-panel dn-guest-tour-panel" aria-label="Explore DN guest demo">
          <div>
            <span className="settings-section-heading"><Database size={17} /> Explore DN · Guided demo</span>
            <p>{activeSampleScenario === GUEST_TOUR_SCENARIO
              ? 'You are exploring isolated example Moments, Activities, Journal photos, Diary writing, Tasks and Cash/Online transactions. Your own Guest records remain separate.'
              : 'Explore sample Moments, a photo Journal, monthly Diary, Tasks and linked finances without touching your own Guest records.'}</p>
            <small>Demo edition: {GUEST_TOUR_VERSION}{activeSampleScenario === GUEST_TOUR_SCENARIO && guestTourNeedsUpdate()
              ? ' · Updated examples available' : ''}</small>
          </div>
          <div className="dev-sample-actions dn-guest-tour-actions">
            <button type="button" className="dn-tour-refresh-button" onClick={startOrRefreshGuestTour}>
              {activeSampleScenario === GUEST_TOUR_SCENARIO ? <RefreshCw size={15} aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
              {activeSampleScenario === GUEST_TOUR_SCENARIO ? 'Refresh demo' : 'Explore demo'}
            </button>
            {activeSampleScenario === GUEST_TOUR_SCENARIO ? <button type="button" className="dn-tour-personal-switch"
              onClick={leaveGuestTour}>Use my Guest data <ArrowRight size={15} aria-hidden="true" /></button> : null}
          </div>
        </section>
      ) : null}
      {import.meta.env.DEV && !user ? (
        <section className="dev-sample-panel" aria-label="Development sample data">
          <div><span className="settings-section-heading"><Database size={17} /> Safe sample-data lab</span><p>Development only. Fixtures are isolated from guest backups and Firebase, and are disabled while signed in.</p></div>
          <div className={`dev-sample-actions${activeSampleScenario ? ' has-active-sample' : ''}`}>
            <DropdownSelect value={sampleScenario} onChange={(event) => setSampleScenario(event.target.value)} aria-label="Sample data scenario">
              {Object.entries(getSampleScenarioDefinitions()).filter(([key]) => key !== GUEST_TOUR_SCENARIO).map(([key, scenario]) => <option key={key} value={key}>{scenario.label} · {scenario.events} events</option>)}
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
              <span className="settings-accordion-indicator" aria-hidden="true"><ChevronDown size={17} strokeWidth={2.1} /></span>
            </button>
            {isOpen ? body : null}
          </section>
        );
      })}

      <div className="settings-navigation-hub settings-about-footer">
        <Link to="/settings/code-lists#list-order" className="settings-hub-card dn-settings-list-defaults-link"
          aria-label="Open List defaults">
          <span className="settings-hub-icon"><SlidersHorizontal size={18} /></span>
          <span className="settings-hub-copy">
            <strong>List defaults</strong>
            <small>Choose the saved sort and filters restored by Reset on Moments, Activities and Transactions</small>
          </span>
          <span className="settings-hub-arrow" aria-hidden="true"><ChevronRight size={18} /></span>
        </Link>

        <Link to="/settings/code-lists" className="settings-hub-card" aria-label="Open Code Lists page">
          <span className="settings-hub-icon"><Settings2 size={18} /></span>
          <span className="settings-hub-copy">
            <strong>Code Lists</strong>
            <small>Manage Moment types, transaction categories, priorities and reusable choices</small>
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
          <p>Reset appearance, preferences, reminders, greeting settings, Code Lists and saved list defaults without deleting your records.</p>
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
                  <li>{pendingBackup.backup.attachments.length} attachment records · {(pendingBackup.backup.attachmentFiles || []).length} original files</li>
                  <li>{pendingBackup.backup.expenses.length} Expenses</li>
                  <li>{pendingBackup.backup.incomes.length} Income records</li>
                  <li>Code Lists, preferences, dashboard configuration, and saved List defaults (when present)</li>
                </ul>
                <p>Restore uses a merge policy: missing records and child records are added; existing records with matching IDs are preserved, not overwritten. Configuration in the backup replaces its matching destination settings. Older backups without saved List defaults or Dashboard shortcuts leave those existing preferences unchanged. Explicit empty Dashboard shortcut lists still clear them. An interrupted restore can be retried; completed records are recognized by ID.</p>
                <p>Original files in this backup are integrity-checked and stored before record writes. Older attachment records without a stored original remain metadata only.</p>
                {pendingBackup.referenceWarnings.length ? (
                  <div role="alert"><strong>Relationship warnings</strong><ul>{pendingBackup.referenceWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
                ) : null}
              </>
            ) : <p>This legacy file contains settings only; it cannot restore Moments or financial records.</p>}
            {pendingBackup.backup.metadata.sourceAccount?.uid ? <p>Backup source account: {pendingBackup.backup.metadata.sourceAccount.displayName || pendingBackup.backup.metadata.sourceAccount.uid}. Its authentication account is not recreated.</p> : null}
            {getActiveSampleScenario() === GUEST_TOUR_SCENARIO && isGuest && !user?.uid ? (
              <p className="dn-restore-tour-note"><strong>Restore to your own Guest workspace:</strong> Confirming will leave the demo and merge this backup into your private Guest records, preserving existing IDs. Demo records will not be included. Cancel to keep exploring the demo.</p>
            ) : user?.uid ? <p>The records will be merged into the currently signed-in account, not necessarily the account that created the backup.</p> : <p>Records will be merged into this browser's guest data.</p>}
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={() => setPendingBackup(null)} disabled={importingBackup}>Cancel</button>
            <button type="button" className="settings-primary-button" onClick={restorePendingBackup} disabled={importingBackup || exportingBackup}>
              {importingBackup ? 'Restoring backup…' : 'Confirm restore'}
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {confirmClearData ? (
        <ModalDialog title="Clear local DN data?" onClose={() => setConfirmClearData(false)}>
          <p className="settings-helper">This removes guest records, preferences, and local record backups from this browser. Stored original files and account data are retained. This action cannot be undone.</p>
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
              <li>Saved preferences; Notifications is Coming Soon</li>
              <li>Greeting types and templates</li>
              <li>All Code Lists and their system default values</li>
              <li>Saved default sorting and filters for Moments, Activities and Transactions</li>
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
