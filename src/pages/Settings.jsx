import { listAccountTasks, mergeAccountTasks } from '../services/accountTaskService';
import { clearDnLocalData } from '../utils/storageMigration';
import { listStateScope } from '../utils/listStateMemory';
import { exportSavedListDefaultsForScope, resetSavedListDefaultsForScope, restoreSavedListDefaultsForScope } from '../utils/listViewDefaults';
import { settingsResetContext, assertSettingsResetContext, assertSettingsResetRecords } from '../utils/settingsResetSafety';
import { dashboardConfigurationRestorePatch } from '../utils/backupDashboardConfiguration';
import './GuestTour.css';
import './SettingsDataPremium.css';
import './AppearancePreferences.css';
import StoryDesignSettings from '../components/settings/StoryDesignSettings';
// This page contains app settings and personalization controls.
// It lets the user customize event categories, income types, expense labels, reminder time, and greeting templates.
import { UserCircle, Settings2, Database, Download, Upload, Trash2, Bell, Info, ChevronRight, ChevronDown, RotateCcw, Plus, ArrowRight, RefreshCw, SlidersHorizontal, CloudOff, ShieldCheck, HardDrive, Cloud, FileJson, LockKeyhole, BookOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
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
import { createGuestTaskRepository } from '../services/guestTaskService';
import { restoreAttachmentFiles } from '../services/attachmentService';
import { deleteSignedInCloudRecords } from '../services/accountCloudDeletionService';
import { CLOUD_DELETE_CONFIRMATION } from '../utils/accountCloudDeletionSafety';
import { exportStoryDesignForBackup, restoreStoryDesignFromBackup, resetStoryDesign } from '../utils/storyDesignPreferences';

// Only personal Guest sessions can access independent Task storage. In a demo,
 // backup restoration still targets the real Guest storage, never the sample.
const guardedGuestTasks = (assertCurrent) => createGuestTaskRepository({
  storage: localStorage,
  assertGuest: () => {
    assertCurrent();
    const state = useAppStore.getState();
    return state.isGuest === true && !state.user?.uid;
  },
});

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

const DATA_BACKUP_SECTIONS = [
  { id: 'backup-actions', label: 'Backup', icon: Download },
  { id: 'data-management', label: 'Manage data', icon: HardDrive },
  { id: 'data-guide', label: 'Data guide', icon: BookOpen },
];

export default function Settings({ dataBackupOnly = false, appearanceOnly = false }) {
  const location = useLocation();
  const dataPageRef = useRef(null);
  const dataSectionId = location.hash.slice(1);
  useEffect(() => {
    if (!dataBackupOnly || !DATA_BACKUP_SECTIONS.some(({ id }) => id === dataSectionId)) return undefined;
    const frame = requestAnimationFrame(() => {
      const section = dataPageRef.current?.querySelector(`#${dataSectionId}`);
      section?.scrollIntoView({ block: 'start' });
      section?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [dataBackupOnly, dataSectionId, location.key]);
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const preferences = useAppStore((state) => state.preferences);
  const showToast = useAppStore((state) => state.showToast);
  const setAdminValues = useAppStore((state) => state.setAdminValues);
  const restorePreferences = useAppStore((state) => state.restorePreferences);
  const resetAdminValues = useAppStore((state) => state.resetAdminValues);
  const setPreferences = useAppStore((state) => state.setPreferences);
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
  const [creationDefaultsError, setCreationDefaultsError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [dataManagementMessage, setDataManagementMessage] = useState('');
  const [pendingBackup, setPendingBackup] = useState(null);
  const [importingBackup, setImportingBackup] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [readingBackup, setReadingBackup] = useState(false);
  const backupOperationRef = useRef(null);
  useEffect(() => () => backupOperationRef.current?.abort(), []);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [confirmCloudDeleteUid, setConfirmCloudDeleteUid] = useState(null);
  const [cloudDeletePhrase, setCloudDeletePhrase] = useState('');
  const [cloudDeleteAcknowledged, setCloudDeleteAcknowledged] = useState(false);
  const [deletingCloudRecords, setDeletingCloudRecords] = useState(false);
  const [cloudDeleteProgress, setCloudDeleteProgress] = useState(null);
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const [resettingSettings, setResettingSettings] = useState(false);
  const [theme, setTheme] = useState(preferences.theme || 'dark');
  useEffect(() => {
    setTheme(preferences.theme === 'light' ? 'light' : 'dark');
  }, [preferences.theme]);
  const [sampleScenario, setSampleScenario] = useState('regular');
  const [activeSampleScenario, setActiveSampleScenario] = useState(() => getActiveSampleScenario());

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
  }, [
    preferences.currency, preferences.dashboardView,
    preferences.defaultEventType, preferences.defaultIncomeType,
    preferences.defaultExpenseCategory,
    preferences.notifications?.eventReminders,
    preferences.notifications?.monthlySummary,
    preferences.notifications?.budgetAlerts,
    preferences.notifications?.reminderTime,
  ]);

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

  const creationDefaultsChanged = ['currency', 'defaultEventType', 'defaultIncomeType', 'defaultExpenseCategory']
    .some((key) => prefForm[key] !== preferences[key]);

  const updateCreationDefault = (key, value) => {
    setCreationDefaultsError('');
    setPrefForm((current) => ({ ...current, [key]: value }));
  };

  const savePreferences = () => {
    const normalized = {
      ...prefForm,
      notifications: preferences.notifications,
    };
    try {
      setPreferences(normalized);
      setCreationDefaultsError('');
      showToast('Preferences saved', 'success');
    } catch {
      setCreationDefaultsError('Could not save defaults in this browser. Try Save defaults again.');
    }
  };

  const resetPreferencesForm = () => {
    setCreationDefaultsError('');
    // This button belongs to Creation defaults. Reset its draft only; never
    // surprise-reset the independently saved theme or Story/PDF designs.
    setPrefForm((current) => ({
      ...current,
      currency: 'INR',
      defaultEventType: 'Personal',
      defaultIncomeType: 'Salary',
      defaultExpenseCategory: 'Food',
    }));
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
      let tasks = [];
      let dataSource;

      const sampleData = getActiveSampleData(user?.uid || null);
      if (sampleData) {
        ({ events, expenses, incomes, tasks = [] } = sampleData);
        dataSource = sampleData.scenario === GUEST_TOUR_SCENARIO ? 'guided-guest-demo' : 'development-sample';
      } else if (isGuest) {
        events = getGuestEvents();
        expenses = getGuestExpenses();
        incomes = getGuestIncomes();
        tasks = guardedGuestTasks(assertSourceScope).list();
        dataSource = 'guest-local';
      } else if (user?.uid) {
        [events, expenses, incomes, tasks] = await Promise.all([
          getEventsForUser(user.uid),
          getExpensesForUser(user.uid),
          getIncomesForUser(user.uid),
          listAccountTasks(user.uid, assertSourceScope),
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
        tasks,
        codeLists: adminValues,
        codeListSchemaVersion: CODE_LIST_SCHEMA_VERSION,
        preferences,
        settings: {
          themeChoiceEnabled: Boolean(localStorage.getItem('dn_theme_choice')),
          ...(!sourceScenario && (sourceUid || sourceGuest) ? {
            storyPdfDesign: exportStoryDesignForBackup(localStorage,
              { uid: sourceUid, isGuest: sourceGuest, sample: false }),
          } : {}),
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

      // Fail before restoring any originals, Moments or ledger records if
      // personal Guest Task storage cannot be read safely.
      const guestTasks = destinationGuest && !destinationUid ? guardedGuestTasks(assertDestinationScope) : null;
      guestTasks?.list();
      if (destinationUid) await listAccountTasks(destinationUid, assertDestinationScope);
      assertDestinationScope();
      setBackupMessage('Verifying and restoring original attachment files before records…');
      const importedGroups = await restoreAttachmentFiles(buildEventGroupsFromBackup(backup, { originalFiles: pendingBackup.originalFiles }), backup.attachmentFiles || [], {
        uid: destinationUid, isGuest: isGuest || !destinationUid, assertCurrent: assertDestinationScope, readOriginal: pendingBackup.readOriginal,
      });
      assertDestinationScope();
      const imported = { moments: 0, activities: 0, memories: 0, attachments: 0, expenses: 0, incomes: 0, tasks: 0, conflicts: 0 };
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

      // Imported independent Tasks are merged once, after parent/ledger records.
      // A retry never overwrites a destination Task that shares its stable ID.
      if (guestTasks && backup.tasks.length) {
        assertDestinationScope();
        const taskMerge = guestTasks.merge(backup.tasks);
        imported.tasks = taskMerge.added;
        imported.conflicts += taskMerge.conflicts;
      } else if (destinationUid && backup.tasks.length) {
        const taskMerge = await mergeAccountTasks(destinationUid, backup.tasks, assertDestinationScope);
        imported.tasks = taskMerge.added;
        imported.conflicts += taskMerge.conflicts;
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
      if (backup.settings.storyPdfDesign !== undefined) {
        assertDestinationScope();
        // A confirmed Guest-tour restore writes to the real Guest scope, not the demo.
        restoreStoryDesignFromBackup(localStorage,
          { uid: destinationUid, isGuest: destinationGuest, sample: false }, backup.settings.storyPdfDesign);
      }

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

      const importSummary = `Restore complete: ${imported.moments} Moments, ${imported.activities} Activities, ${imported.memories} Memories, ${imported.attachments} attachment records, ${imported.expenses} standalone Expenses, and ${imported.incomes} Income records, plus ${imported.tasks} independent Tasks added; ${imported.conflicts} existing-ID conflicts preserved. Preferences, Dashboard shortcuts, Code Lists and saved List defaults were restored where present.`;

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

  const closeCloudDelete = () => {
    if (deletingCloudRecords) return;
    setConfirmCloudDeleteUid(null);
    setCloudDeletePhrase('');
    setCloudDeleteAcknowledged(false);
    setCloudDeleteProgress(null);
  };

  const openCloudDelete = () => {
    if (!user?.uid || isGuest || getActiveSampleScenario(user.uid)
      || deletingCloudRecords || exportingBackup || importingBackup || readingBackup) return;
    setCloudDeletePhrase('');
    setCloudDeleteAcknowledged(false);
    setCloudDeleteProgress(null);
    setConfirmCloudDeleteUid(user.uid);
  };

  const clearOnlineRecords = async () => {
    const uid = confirmCloudDeleteUid;
    if (!uid || deletingCloudRecords || cloudDeletePhrase !== CLOUD_DELETE_CONFIRMATION
      || !cloudDeleteAcknowledged || uid !== user?.uid || isGuest || getActiveSampleScenario(uid)
      || exportingBackup || importingBackup || readingBackup) return;
    setDeletingCloudRecords(true);
    setCloudDeleteProgress({ stage: 'checking', deleted: 0, total: 0 });
    let committed = 0;
    try {
      const result = await deleteSignedInCloudRecords(uid, (progress) => {
        committed = progress.deleted;
        setCloudDeleteProgress(progress);
      });
      setConfirmCloudDeleteUid(null);
      setDataManagementMessage(`Online Firestore records cleared: ${result.deleted} documents deleted. Google identity, local originals and legacy Firebase Storage files remain. Signing out…`);
      try {
        // Staying authenticated on this device can immediately create a new
        // default Code List document. End this session before app bootstrap.
        await signOut(auth);
        window.location.reload();
      } catch (signOutError) {
        console.error('Online records were cleared but Firebase sign-out failed:', signOutError);
        setDataManagementMessage(`Online Firestore records were cleared (${result.deleted} documents), but sign-out failed. Sign out manually before refreshing to avoid recreating online defaults.`);
        showToast('Online data cleared. Please sign out manually.', 'danger');
      }
    } catch (error) {
      console.error('Online account data deletion did not complete:', error);
      setDataManagementMessage(`Online deletion incomplete: ${error.message || 'Unable to verify the cloud records.'} ${committed ? `${committed} records were already deleted and cannot be restored without a backup.` : 'Deletion may not have started; check Firebase before retrying.'}`);
      showToast('Online deletion incomplete. Review the details in Data & Backup.', 'danger');
      setConfirmCloudDeleteUid(null);
    } finally {
      setDeletingCloudRecords(false);
      setCloudDeletePhrase('');
      setCloudDeleteAcknowledged(false);
    }
  };

  const clearLocalData = () => {
    clearDnLocalData();
    setDataManagementMessage('Local records and preferences cleared. Stored originals and account data are retained. Reloading...');
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
      resetStoryDesign(localStorage, { uid: context.uid, isGuest: context.isGuest,
        sample: Boolean(getActiveSampleScenario(context.uid)) });
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


  const selectTheme = (nextTheme) => {
    if (nextTheme !== 'light' && nextTheme !== 'dark') return;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setPreferences({ ...preferences, theme: nextTheme });
  };

  const renderDefaultsSection = () => (
    <div className="dn-appearance-body">
      <section className="dn-appearance-section" id="appearance-theme" aria-label="App color theme">
        <div className="dn-appearance-section-heading">
          <div>
            <h3>Choose your theme</h3>
            <p>Choose light or dark. Story and PDF styles stay separate.</p>
          </div>
        </div>
        <div className="dn-appearance-theme-options" role="group" aria-label="Color theme">
          {[{ value: 'light', label: 'Soft light', hint: 'Bright, calm surfaces' },
            { value: 'dark', label: 'Dark', hint: 'Subtle contrast at night' }].map(({ value, label, hint }) =>
            <button type="button" key={value} className={'dn-appearance-theme-pick is-' + value}
              aria-pressed={theme === value} onClick={() => selectTheme(value)}>
              <span className="dn-appearance-theme-preview" aria-hidden="true">
                <span className="dn-appearance-preview-header" />
                <span className="dn-appearance-preview-body"><i /><i /><i /></span>
              </span>
              <span className="dn-appearance-theme-copy"><strong>{label}</strong><small>{hint}</small></span>
              <span className="dn-appearance-theme-indicator" aria-hidden="true">{theme === value ? '✓' : ''}</span>
            </button>)}
        </div>
        <p className="dn-appearance-footnote">Saved instantly.</p>
      </section>

      <section className="dn-appearance-section" id="appearance-creation" aria-label="Defaults for new records">
        <div className="dn-appearance-section-heading">
          <div>
            <h3>Creation defaults</h3>
            <p>Choose the values DN suggests when you create a record.</p>
          </div>
        </div>
        <div className="settings-admin-grid dn-appearance-default-fields">
          <label className="settings-input-block">
            <span>Currency</span>
            <DropdownSelect aria-label="Default currency" value={prefForm.currency}
              onChange={(event) => updateCreationDefault('currency', event.target.value)}>
              <option value="INR">INR · Indian rupee (₹)</option>
              <option value="USD">USD · US dollar ($)</option>
              <option value="EUR">EUR · Euro (€)</option>
              <option value="GBP">GBP · British pound (£)</option>
            </DropdownSelect>
          </label>
          <label className="settings-input-block">
            <span>New Moment type</span>
            <DropdownSelect aria-label="Default Moment type" value={prefForm.defaultEventType}
              onChange={(event) => updateCreationDefault('defaultEventType', event.target.value)}>
              {!eventTypeOptions.includes(prefForm.defaultEventType) ?
                <option value={prefForm.defaultEventType}>{prefForm.defaultEventType} · previously selected</option> : null}
              {eventTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </DropdownSelect>
          </label>
          <label className="settings-input-block">
            <span>New income type</span>
            <DropdownSelect aria-label="Default income type" value={prefForm.defaultIncomeType}
              onChange={(event) => updateCreationDefault('defaultIncomeType', event.target.value)}>
              {!incomeTypeOptions.includes(prefForm.defaultIncomeType) ?
                <option value={prefForm.defaultIncomeType}>{prefForm.defaultIncomeType} · previously selected</option> : null}
              {incomeTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </DropdownSelect>
          </label>
          <label className="settings-input-block">
            <span>New expense category</span>
            <DropdownSelect aria-label="Default expense category" value={prefForm.defaultExpenseCategory}
              onChange={(event) => updateCreationDefault('defaultExpenseCategory', event.target.value)}>
              {!expenseCategoryOptions.includes(prefForm.defaultExpenseCategory) ?
                <option value={prefForm.defaultExpenseCategory}>{prefForm.defaultExpenseCategory} · previously selected</option> : null}
              {expenseCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </DropdownSelect>
          </label>
        </div>
        <div className="dn-appearance-save-row">
          <span role="status" className={creationDefaultsError ? 'has-error' : undefined}>
            {creationDefaultsError || (creationDefaultsChanged ? 'Save defaults to apply your changes.' : 'Defaults saved.')}
          </span>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={resetPreferencesForm}>Reset defaults</button>
            <button type="button" className="settings-primary-button" onClick={savePreferences}>Save defaults</button>
          </div>
        </div>
      </section>

      <section className="dn-appearance-section dn-appearance-story" id="appearance-story">
        <div className="dn-appearance-section-heading">
          <div>
            <h3>Story & PDF design</h3>
            <p>Choose a style for each Story type.</p>
          </div>
        </div>
        <StoryDesignSettings />
      </section>

      <nav className="dn-appearance-more" aria-label="Other personalization settings">
        <Link to="/settings/list-defaults"><SlidersHorizontal size={18} aria-hidden="true" />
          <span><strong>List defaults</strong><small>Saved sorting and filters for Moments, Activities, Transactions and Tasks</small></span>
          <ChevronRight size={17} aria-hidden="true" /></Link>
        <Link to="/settings/code-lists"><Settings2 size={18} aria-hidden="true" />
          <span><strong>Code Lists</strong><small>Manage Moment types, priorities, payment methods and categories</small></span>
          <ChevronRight size={17} aria-hidden="true" /></Link>
      </nav>
    </div>
  );

  const renderDataSection = () => (
    <div className="settings-accordion-body dn-data-backup">
      <section id="backup-actions" tabIndex={-1} className="dn-data-backup-block" aria-label="Backup and restore">
        <div className="dn-data-backup-head">
          <span className="dn-data-backup-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
          <div><strong>Protect your records</strong><p>Save a copy of your Moments, transactions, settings and available original photos before making changes.</p></div>
        </div>
        <div className="dn-data-action-grid">
          <button type="button" className="settings-primary-button dn-data-action-button" onClick={exportBackup}
            disabled={exportingBackup || importingBackup || readingBackup || deletingCloudRecords}>
            <Download size={17} aria-hidden="true" /> {exportingBackup ? 'Preparing backup…' : 'Export backup'}
          </button>
          <label className="settings-secondary-button dn-backup-file-picker dn-data-action-button">
            <Upload size={17} aria-hidden="true" /> Restore backup
            <input type="file" accept=".json,application/json" aria-label="Choose a DN backup JSON file"
              onChange={importBackup} disabled={exportingBackup || importingBackup || readingBackup || deletingCloudRecords} />
          </label>
        </div>
        {readingBackup || exportingBackup ? <button type="button" className="settings-secondary-button dn-data-cancel-prep"
          onClick={() => backupOperationRef.current?.abort()}>Cancel preparation</button> : null}
        <div role="status" className="dn-data-operation-status">{backupMessage}</div>
        <p className="settings-helper">Export produces a JSON backup. Restore merges records into the current workspace and preserves existing IDs. Original files stored in this browser can be included when available.</p>
      </section>

      <section id="data-management" tabIndex={-1} className="dn-data-backup-block dn-data-clear-block" aria-label="Clear DN data">
        <div className="dn-data-backup-head">
          <span className="dn-data-backup-icon"><HardDrive size={18} aria-hidden="true" /></span>
          <div><strong>Manage stored data</strong><p>Choose exactly where to clear. Browser data and online Firebase records are separate.</p></div>
        </div>
        <div className="dn-data-clear-options">
          <div className="dn-data-clear-option">
            <div><span className="dn-data-clear-label"><HardDrive size={15} aria-hidden="true" /> This browser</span>
              <p>Clear local app data, including independent Guest Tasks and preferences. Does not remove online records or stored original files.</p></div>
            <button type="button" className="dn-data-outlined-button" onClick={() => setConfirmClearData(true)}
              disabled={exportingBackup || importingBackup || readingBackup || deletingCloudRecords}>
              <Trash2 size={15} aria-hidden="true" /> Clear local
            </button>
          </div>
          {user?.uid && !isGuest && !getActiveSampleScenario(user.uid) ? (
            <div className="dn-data-clear-option is-cloud">
              <div><span className="dn-data-clear-label"><Cloud size={15} aria-hidden="true" /> Firebase cloud</span>
                <p>Permanently remove this account's online DN Firestore records, including older collections. Keep Google login and browser originals.</p></div>
              <button type="button" className="dn-data-outlined-button is-danger" onClick={openCloudDelete}
                disabled={exportingBackup || importingBackup || readingBackup || deletingCloudRecords}>
                <CloudOff size={15} aria-hidden="true" /> Delete online
              </button>
            </div>
          ) : (
            <p className="dn-data-guest-note">To clear Firebase records, sign in to the account that owns them. Guest records stay on this device.</p>
          )}
        </div>
        <div role="status" className="dn-data-operation-status">{dataManagementMessage}</div>
      </section>
    </div>
  );

  // All operations and their established dialogs share one controller.
  // The normal Settings page no longer mounts these forms or danger actions.
  const dataDialogs = (
    <>
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
                  <li>{pendingBackup.backup.tasks.length} independent Tasks</li>
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
            <button type="button" className="settings-primary-button" onClick={restorePendingBackup}
              disabled={importingBackup || exportingBackup}>
              {importingBackup ? 'Restoring backup…' : 'Confirm restore'}
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {confirmCloudDeleteUid ? (
        <ModalDialog title="Delete online Firebase data?" className="dn-cloud-delete-modal" onClose={closeCloudDelete}>
          <div className="dn-cloud-delete-warning">
            <span className="dn-cloud-delete-warning-icon"><CloudOff size={22} aria-hidden="true" /></span>
            <div><strong>This permanently deletes online records</strong>
              <p>Moments, Activities, linked files' metadata, income, expenses, transactions, Code Lists and legacy Firestore records in this account will be removed.</p></div>
          </div>
          <p className="dn-cloud-delete-account"><strong>Signed-in account</strong><span>{user?.uid === confirmCloudDeleteUid ? (user?.email || user?.displayName || 'Current account') : 'Account changed'}</span></p>
          <p className="settings-helper">Your Google sign-in, records stored only on this browser, original photos in browser storage and any older Firebase Storage files are <strong>not</strong> deleted. Deletions cannot be undone without a backup. DN signs out after successful deletion to prevent immediate cloud re-creation. You can sign in again to start fresh; DN may create default Code Lists then. Close other signed-in DN tabs first.</p>
          <label className="dn-cloud-confirm-check">
            <input type="checkbox" checked={cloudDeleteAcknowledged} onChange={(event) => setCloudDeleteAcknowledged(event.target.checked)} disabled={deletingCloudRecords} />
            <span>I understand this is permanent and have saved a backup if needed.</span>
          </label>
          <label className="dn-cloud-confirm-phrase">Type <strong>{CLOUD_DELETE_CONFIRMATION}</strong> to confirm
            <input type="text" value={cloudDeletePhrase} onChange={(event) => setCloudDeletePhrase(event.target.value)}
              autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false}
              disabled={deletingCloudRecords} placeholder="Confirmation phrase" />
          </label>
          {deletingCloudRecords ? <p role="status" className="dn-cloud-delete-progress" aria-live="polite">
            {cloudDeleteProgress?.stage === 'deleting'
              ? `Deleting online records: ${cloudDeleteProgress.deleted} of ${cloudDeleteProgress.total}…`
              : 'Checking your online records and permissions…'}
          </p> : null}
          <div className="settings-actions dn-cloud-delete-actions">
            <button type="button" className="settings-secondary-button" onClick={closeCloudDelete} disabled={deletingCloudRecords}>Cancel</button>
            <button type="button" className="dn-data-outlined-button is-danger is-confirm"
              disabled={deletingCloudRecords || !cloudDeleteAcknowledged || cloudDeletePhrase !== CLOUD_DELETE_CONFIRMATION
                || confirmCloudDeleteUid !== user?.uid || isGuest || Boolean(getActiveSampleScenario(confirmCloudDeleteUid))}
              onClick={clearOnlineRecords}>
              <CloudOff size={16} aria-hidden="true" /> {deletingCloudRecords ? 'Deleting online data…' : 'Permanently delete online data'}
            </button>
          </div>
        </ModalDialog>
      ) : null}

      {confirmClearData ? (
        <ModalDialog title="Clear local DN data?" className="dn-local-clear-modal" onClose={() => setConfirmClearData(false)}>
          <p className="settings-helper">This removes guest records, independent Guest Tasks, preferences, and local record backups from this browser. Stored original files and account data are retained. This action cannot be undone.</p>
          <div className="settings-actions">
            <button type="button" className="settings-secondary-button" onClick={() => setConfirmClearData(false)}>Keep my data</button>
            <button type="button" className="dn-data-outlined-button is-danger" onClick={clearLocalData}><Trash2 size={15} aria-hidden="true" /> Clear local data</button>
          </div>
        </ModalDialog>
      ) : null}

    </>
  );

  if (dataBackupOnly) {
    const signedIn = Boolean(user?.uid && !isGuest && !getActiveSampleScenario(user.uid));
    return (
      <div ref={dataPageRef} className="settings-page feature-page dn-settings-home dn-data-page">
        <section className="dn-data-page-intro" aria-label="Your data protection">
          <div className="dn-data-page-intro-copy">
            <span className="dn-data-page-overline"><ShieldCheck size={15} aria-hidden="true" /> Your data, your control</span>
            <p>Make a recovery copy, move your records to another device, or manage what DN keeps in your browser and Firebase.</p>
          </div>
          <span className="dn-data-account-chip">
            {signedIn ? <Cloud size={15} aria-hidden="true" /> : <HardDrive size={15} aria-hidden="true" />}
            {signedIn ? 'Signed-in workspace' : 'Guest · this device'}
          </span>
        </section>

        <nav className="dn-data-page-jumps" aria-label="Data and Backup sections">
          {DATA_BACKUP_SECTIONS.map(({ id, label, icon: Icon }) =>
            <Link key={id} to={{ search: location.search, hash: `#${id}` }}
              aria-current={dataSectionId === id ? 'location' : undefined}>
              <Icon size={14} aria-hidden="true" /> {label}
            </Link>)}
        </nav>

        {renderDataSection()}

        <section id="data-guide" tabIndex={-1} className="dn-data-page-guide" aria-label="How DN stores your data">
          <div className="dn-data-guide-heading">
            <BookOpen size={18} aria-hidden="true" />
            <div><h3>Know what lives where</h3><p>Account sync, original files and downloads have different responsibilities.</p></div>
          </div>
          <div className="dn-data-location-grid">
            <div className="dn-data-location-item">
              <Cloud size={18} aria-hidden="true" />
              <strong>Firebase records</strong>
              <p>When signed in, Moments, Activity details, Tasks, transactions and Code Lists live in your account's Firestore data. Guest records are browser-only.</p>
            </div>
            <div className="dn-data-location-item">
              <HardDrive size={18} aria-hidden="true" />
              <strong>Original photos</strong>
              <p>New original attachments remain in this browser, even when signed in. Cloud metadata cannot replace a missing original file.</p>
            </div>
            <div className="dn-data-location-item">
              <FileJson size={18} aria-hidden="true" />
              <strong>Recovery copy</strong>
              <p>Your downloaded JSON can contain Moments, Activities, Tasks, transactions, Code Lists, saved defaults and available originals. It is not encrypted, so store it privately.</p>
            </div>
          </div>
          <details className="dn-data-recovery-guide">
            <summary><span><LockKeyhole size={16} aria-hidden="true" /> Before changing device or clearing data</span><ChevronDown size={16} aria-hidden="true" /></summary>
            <ol>
              <li><strong>Export backup.</strong> Download your JSON while you still have access to this device and account.</li>
              <li><strong>Keep the file safely.</strong> It can contain private notes, photos and financial entries; DN does not encrypt this download.</li>
              <li><strong>Check the restore preview.</strong> Select the file under Restore backup to inspect the counts and warnings without writing data. Cancel if you only wanted to inspect it.</li>
              <li><strong>Confirm the destination.</strong> Restoring merges into the active Guest or signed-in account, and matching record IDs are preserved.</li>
              <li><strong>Then clear deliberately.</strong> Local clearing does not remove Firebase records; online clearing does not delete browser originals, Google sign-in or older Storage files.</li>
            </ol>
          </details>
        </section>
        {dataDialogs}
      </div>
    );
  }

  // Legacy Settings anchors remain valid, but open the new dedicated page.
  if (!appearanceOnly && (location.hash === '#preferences' || location.hash === '#theme')) {
    return <Navigate to="/settings/appearance" replace />;
  }
  if (!appearanceOnly && location.hash === '#backup') return <Navigate to="/settings/data-backup" replace />;

  if (appearanceOnly) {
    return <div className="settings-page feature-page dn-settings-appearance">
      <header className="dn-appearance-intro">
        <span className="dn-appearance-eyebrow">Personalize your space</span>
        <h2>Make DN yours</h2>
        <p>Theme, new-record defaults and Story/PDF styles.</p>
      </header>
      {renderDefaultsSection()}
    </div>;
  }

  return (
    <div className="settings-page feature-page dn-settings-home dn-settings-redesign">
      <section className="dn-settings-account-summary" id="profile" aria-label="Current workspace">
        <UserCircle size={22} aria-hidden="true" />
        <span><strong>{profileName}</strong>
          <small>{isGuest ? 'Guest workspace · stored on this device' : user?.uid ? 'Signed-in account' : 'Signed out'}</small>
        </span>
      </section>
      <p className="dn-settings-overview-note">Personalize DN, manage your lists and keep your memories safe.</p>
      <nav className="settings-navigation-hub settings-about-footer" aria-label="Settings destinations">
        <Link to="/settings/appearance" className="settings-hub-card dn-settings-appearance-link"
          aria-label="Open Appearance & preferences">
          <span className="settings-hub-icon"><Settings2 size={18} aria-hidden="true" /></span>
          <span className="settings-hub-copy">
            <strong>Appearance & preferences</strong>
            <small>Theme, new-record defaults and Story/PDF designs</small>
          </span>
          <span className="settings-hub-arrow" aria-hidden="true"><ChevronRight size={18} /></span>
        </Link>
        <Link to="/settings/data-backup" className="settings-hub-card dn-settings-data-link" aria-label="Open Data & Backup page">
          <span className="settings-hub-icon"><Database size={18} aria-hidden="true" /></span>
          <span className="settings-hub-copy">
            <strong>Data & Backup</strong>
            <small>Export and restore records, understand storage and manage browser or Firebase data</small>
          </span>
          <span className="settings-hub-arrow" aria-hidden="true"><ChevronRight size={18} /></span>
        </Link>

        <Link to="/settings/list-defaults" className="settings-hub-card dn-settings-list-defaults-link"
          aria-label="Open List defaults">
          <span className="settings-hub-icon"><SlidersHorizontal size={18} /></span>
          <span className="settings-hub-copy">
            <strong>List defaults</strong>
            <small>Choose what Reset restores in Moments, Activities, Transactions and Tasks</small>
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
      </nav>

      <section className="dn-settings-future-note" id="notifications" aria-label="Notifications availability">
        <Bell size={18} aria-hidden="true" />
        <span><strong>Notifications</strong>
          <small>Coming later. No alerts or reminders are currently sent by DN.</small></span>
      </section>
      {isGuest && !user ? <h3 className="dn-settings-explore-header">Explore DN</h3> : null}
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

      <section className="settings-reset-card">
        <div>
          <strong>Restore default settings</strong>
          <p>Reset appearance, new-record defaults, Story/PDF designs, Code Lists and saved list defaults without deleting your records.</p>
        </div>
        <button type="button" className="settings-secondary-button settings-reset-button" onClick={() => setConfirmResetSettings(true)}>
          <RotateCcw size={15} /> Reset all settings
        </button>
      </section>

      {confirmResetSettings ? (
        <ModalDialog title="Reset all settings?" className="settings-reset-dialog" onClose={() => { if (!resettingSettings) setConfirmResetSettings(false); }}>
          <div className="settings-reset-warning">
            <p>This restores DN configuration only:</p>
            <ul>
              <li>Theme and appearance, including Story and PDF designs</li>
              <li>Currency and default Moment, income, and expense selections</li>
              <li>Saved preferences; Notifications remain a coming-soon feature</li>
              <li>Greeting types and templates</li>
              <li>All Code Lists and their system default values</li>
              <li>Saved default sorting and filters for Moments, Activities, Transactions and Tasks</li>
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
