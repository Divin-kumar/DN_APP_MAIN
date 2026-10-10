// This page contains app settings and personalization controls.
// It lets the user customize event categories, income types, expense labels, reminder time, and greeting templates.
import { UserCircle, Settings2, Database, Trash2, Bell, Info, ChevronRight, RotateCcw, Plus, Cloud, RefreshCw, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ModalDialog from '../components/common/ModalDialog';
import DropdownSelect from '../components/common/DropdownSelect';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import useIncomeStore from '../store/useIncomeStore';
import { activateSampleScenario, clearActiveSampleScenario, getActiveSampleData, getActiveSampleScenario, getSampleScenarioDefinitions, getSampleScenarioLabel } from '../dev/sampleData';
import useAppStore from '../store/useAppStore';
import { collectReferencedCodeListValues, DEFAULT_CODE_LISTS, getCodeListItems, getCodeListLabel } from '../utils/codeLists';
import {
  getCloudSyncConfig,
  saveCloudSyncConfig,
  connectGoogleDrive,
  disconnectGoogleDrive,
  syncWithGoogleDrive,
  connectICloud,
  disconnectICloud,
  syncWithICloud,
} from '../services/cloudSyncService';

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
  const principal = useAppStore((state) => state.principal);
  const principalId = useAppStore((state) => state.principalId);
  const adminValues = useAppStore((state) => state.adminValues);
  const preferences = useAppStore((state) => state.preferences);
  const showToast = useAppStore((state) => state.showToast);
  const setAdminValues = useAppStore((state) => state.setAdminValues);
  const resetAdminValues = useAppStore((state) => state.resetAdminValues);
  const setPreferences = useAppStore((state) => state.setPreferences);
  const resetPreferences = useAppStore((state) => state.resetPreferences);
  const resetAllSettings = useAppStore((state) => state.resetAllSettings);
  const profileName = principal?.deviceName || 'This device';
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
  const [openSection, setOpenSection] = useState(null);
  const [confirmResetSettings, setConfirmResetSettings] = useState(false);
  const [resettingSettings, setResettingSettings] = useState(false);
  const [theme, setTheme] = useState(preferences.theme || 'light');
  const [sampleScenario, setSampleScenario] = useState('regular');
  const [activeSampleScenario, setActiveSampleScenario] = useState(() => getActiveSampleScenario());
  const [syncConfig, setSyncConfig] = useState(getCloudSyncConfig());
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [iCloudSyncing, setICloudSyncing] = useState(false);

  useEffect(() => {
    const handleSyncConfigUpdate = (e) => {
      if (e.detail) setSyncConfig(e.detail);
    };
    window.addEventListener('lifehub:sync-config-updated', handleSyncConfigUpdate);
    return () => window.removeEventListener('lifehub:sync-config-updated', handleSyncConfigUpdate);
  }, []);

  useEffect(() => {
    const sectionByHash = {
      '#profile': 'profile',
      '#sync': 'sync',
      '#cloud-sync': 'sync',
      '#preferences': 'defaults',
      '#theme': 'defaults',
      '#notifications': 'notifications',
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

  const saveAdminValues = async () => {
    try {
      await setAdminValues({
        eventTypes: summary.eventTypes,
        incomeTypes: summary.incomeTypes,
        expenseCategories: summary.expenseCategories,
      });
      showToast('Admin values saved', 'success');
    } catch {
      showToast('Admin values could not be saved', 'danger');
    }
  };

  const savePreferences = async () => {
    const normalized = {
      ...prefForm,
      notifications: {
        ...prefForm.notifications,
        reminderTime: normalizeReminderTime(prefForm.notifications.reminderTime),
      },
    };
    setPrefForm(normalized);
    try {
      await setPreferences(normalized);
      showToast('Preferences saved', 'success');
    } catch {
      showToast('Preferences could not be saved', 'danger');
    }
  };

  const resetPreferencesForm = async () => {
    try {
      await resetPreferences();
    } catch {
      showToast('Preferences could not be reset', 'danger');
      return;
    }
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

  const resetAllSettingsSafely = async () => {
    if (resettingSettings) return;
    setResettingSettings(true);

    try {
      if (!principal?.principalId) throw new Error('The Device Principal is unavailable. No settings were changed.');

      await Promise.all([
        useEventStore.getState().loadEvents(principalId),
        useExpenseStore.getState().loadExpenses(principalId),
        useIncomeStore.getState().loadIncomes(principalId),
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
    const data = activateSampleScenario(sampleScenario);
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
      useEventStore.getState().loadEvents(principal?.principalId),
      useExpenseStore.getState().loadExpenses(principal?.principalId),
      useIncomeStore.getState().loadIncomes(principal?.principalId),
    ]);
    showToast('Sample data removed; your own data is unchanged', 'success');
  };

  const toggleSection = (section) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  const renderDefaultsSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-admin-grid">
        <label className="settings-input-block">
          <span>Appearance</span>
          <DropdownSelect value={theme} onChange={(event) => {
            const nextTheme = event.target.value;
            setTheme(nextTheme);
            document.documentElement.dataset.theme = nextTheme;
            void setPreferences({ ...preferences, theme: nextTheme }).catch(() => {
              setTheme(preferences.theme || 'dark');
              document.documentElement.dataset.theme = preferences.theme || 'dark';
              showToast('Theme preference could not be saved', 'danger');
            });
          }}>
            <option value="light">Soft light</option>
            <option value="dark">Dark</option>
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default event type</span>
          <DropdownSelect value={prefForm.defaultEventType} onChange={(event) => setPrefForm((current) => ({ ...current, defaultEventType: event.target.value }))}>
            {eventTypeOptions.map((option) => (
              <option key={option} value={option}>{getCodeListLabel('eventTypes', option, adminValues.eventTypes)}</option>
            ))}
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default income type</span>
          <DropdownSelect value={prefForm.defaultIncomeType} onChange={(event) => setPrefForm((current) => ({ ...current, defaultIncomeType: event.target.value }))}>
            {incomeTypeOptions.map((option) => (
              <option key={option} value={option}>{getCodeListLabel('incomeTypes', option, adminValues.incomeTypes)}</option>
            ))}
          </DropdownSelect>
        </label>

        <label className="settings-input-block">
          <span>Default expense category</span>
          <DropdownSelect value={prefForm.defaultExpenseCategory} onChange={(event) => setPrefForm((current) => ({ ...current, defaultExpenseCategory: event.target.value }))}>
            {expenseCategoryOptions.map((option) => (
              <option key={option} value={option}>{getCodeListLabel('expenseCategories', option, adminValues.expenseCategories)}</option>
            ))}
          </DropdownSelect>
        </label>
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-primary-button" onClick={savePreferences}>Save preferences</button>
        <button type="button" className="settings-secondary-button" onClick={resetPreferencesForm}>Reset all preferences</button>
      </div>
    </div>
  );

  const formatSyncTime = (iso) => {
    if (!iso) return 'Never synced';
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const onConnectGoogleInSettings = async () => {
    try {
      await connectGoogleDrive();
      setSyncConfig(getCloudSyncConfig());
      showToast('Connected to Google Drive', 'success');
      onSyncGoogleInSettings();
    } catch (err) {
      showToast(err.message || 'Google Drive connection failed', 'danger');
    }
  };

  const onDisconnectGoogleInSettings = async () => {
    try {
      await disconnectGoogleDrive();
      setSyncConfig(getCloudSyncConfig());
      showToast('Google Drive disconnected', 'success');
    } catch {
      showToast('Failed to disconnect Google Drive', 'danger');
    }
  };

  const onSyncGoogleInSettings = async () => {
    if (googleSyncing) return;
    setGoogleSyncing(true);
    try {
      const res = await syncWithGoogleDrive();
      setSyncConfig(getCloudSyncConfig());
      showToast(`Google Drive synced (${res.syncedCounts.moments} moments, ${res.syncedCounts.activities} activities)`, 'success');
    } catch (err) {
      showToast(err.message || 'Google Drive sync failed', 'danger');
    } finally {
      setGoogleSyncing(false);
    }
  };

  const onConnectICloudInSettings = async () => {
    try {
      await connectICloud();
      setSyncConfig(getCloudSyncConfig());
      showToast('Connected to iCloud container', 'success');
      onSyncICloudInSettings();
    } catch (err) {
      showToast(err.message || 'iCloud connection failed', 'danger');
    }
  };

  const onDisconnectICloudInSettings = async () => {
    try {
      await disconnectICloud();
      setSyncConfig(getCloudSyncConfig());
      showToast('iCloud disconnected', 'success');
    } catch {
      showToast('Failed to disconnect iCloud', 'danger');
    }
  };

  const onSyncICloudInSettings = async () => {
    if (iCloudSyncing) return;
    setICloudSyncing(true);
    try {
      const res = await syncWithICloud();
      setSyncConfig(getCloudSyncConfig());
      showToast(`iCloud synced (${res.syncedCounts.moments} moments, ${res.syncedCounts.activities} activities)`, 'success');
    } catch (err) {
      showToast(err.message || 'iCloud sync failed', 'danger');
    } finally {
      setICloudSyncing(false);
    }
  };

  const renderSyncSection = () => (
    <div className="settings-accordion-body space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Drive Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cloud size={16} className="text-blue-500" /> Google Drive
              </span>
              {syncConfig.googleDrive.connected ? (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Not connected</span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {syncConfig.googleDrive.connected
                ? `Account: ${syncConfig.googleDrive.userEmail || 'Google User'} · Last synced: ${formatSyncTime(syncConfig.googleDrive.lastSyncTime)}`
                : 'Sync moments, activities, and settings to your personal Google Drive.'}
            </p>
            {syncConfig.googleDrive.syncError && (
              <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg flex items-start gap-1.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{syncConfig.googleDrive.syncError}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {syncConfig.googleDrive.connected ? (
              <>
                <button
                  type="button"
                  onClick={onSyncGoogleInSettings}
                  disabled={googleSyncing}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={13} className={googleSyncing ? 'animate-spin' : ''} />
                  <span>{googleSyncing ? 'Syncing…' : 'Sync Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectGoogleInSettings}
                  className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectGoogleInSettings}
                className="w-full py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Cloud size={14} /> Connect Google Drive
              </button>
            )}
          </div>
        </div>

        {/* iCloud Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Cloud size={16} className="text-purple-500" /> Sync with iCloud
              </span>
              {syncConfig.iCloud.connected ? (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                </span>
              ) : (
                <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Not connected</span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {syncConfig.iCloud.connected
                ? `Container: ${syncConfig.iCloud.containerId} · Last synced: ${formatSyncTime(syncConfig.iCloud.lastSyncTime)}`
                : 'Apple CloudKit container synchronization for iOS device sandbox and web.'}
            </p>
            {syncConfig.iCloud.syncError && (
              <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg flex items-start gap-1.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{syncConfig.iCloud.syncError}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {syncConfig.iCloud.connected ? (
              <>
                <button
                  type="button"
                  onClick={onSyncICloudInSettings}
                  disabled={iCloudSyncing}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={13} className={iCloudSyncing ? 'animate-spin' : ''} />
                  <span>{iCloudSyncing ? 'Syncing…' : 'Sync Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnectICloudInSettings}
                  className="py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConnectICloudInSettings}
                className="w-full py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Cloud size={14} /> Connect iCloud
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2 flex justify-end">
        <Link
          to="/settings/sync"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          <span>Open detailed Cloud Sync settings &amp; status</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="settings-accordion-body">
      <div className="settings-unavailable-note" role="note">
        <Bell size={17} aria-hidden="true" />
        <p>Notifications and scheduled reminders are not currently available. DN will not send event reminders, monthly summaries, or budget alerts.</p>
      </div>
    </div>
  );

  const sections = [
    { key: 'profile', heading: 'Profile', description: 'Your local profile and life summary.', icon: UserCircle, body: <div className="settings-accordion-body"><div className="settings-profile-row"><strong>{profileName}</strong><span>Local Device User · profile details</span></div><Link className="settings-primary-button" to="/profile">Open Profile</Link></div> },
    { key: 'sync', heading: 'Sync & Backup', description: 'Independent cloud sync with iCloud & Google Drive, conflict handling, and automatic sync.', icon: Cloud, body: renderSyncSection() },
    { key: 'defaults', heading: 'Appearance & preferences', description: 'Choose your theme and default entry behavior.', icon: Settings2, body: renderDefaultsSection() },
    { key: 'notifications', heading: 'Notifications', description: 'Notifications and scheduled reminders are not currently available.', icon: Bell, body: renderNotificationsSection() },
  ];

  return (
    <div className="settings-page feature-page">
      <div className="settings-heading">
        <h2>Settings</h2>
        <p>Keep DN comfortable for the way you plan and remember.</p>
      </div>

      {import.meta.env.DEV ? (
        <section className="dev-sample-panel" aria-label="Development sample data">
          <div><span className="settings-section-heading"><Database size={17} /> Safe sample-data lab</span><p>Development only. Fixtures are isolated from the Device Principal’s saved records.</p></div>
          <div className={`dev-sample-actions${activeSampleScenario ? ' has-active-sample' : ''}`}>
            <DropdownSelect value={sampleScenario} onChange={(event) => setSampleScenario(event.target.value)} aria-label="Sample data scenario">
              {Object.entries(getSampleScenarioDefinitions()).map(([key, scenario]) => <option key={key} value={key}>{scenario.label} · {scenario.events} events</option>)}
            </DropdownSelect>
            <button type="button" className="settings-primary-button dev-sample-icon-action" onClick={loadSampleData} aria-label="Load sample data" title="Load sample data">
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
        <Link to="/settings/sync" className="settings-hub-card" aria-label="Open Sync & Cloud Backup page">
          <span className="settings-hub-icon"><Cloud size={18} /></span>
          <span className="settings-hub-copy">
            <strong>Sync &amp; Cloud Backup</strong>
            <small>Sync with Google Drive &amp; iCloud, conflict handling, and automatic sync</small>
          </span>
          <span className="settings-hub-arrow" aria-hidden="true"><ChevronRight size={18} /></span>
        </Link>
        <Link to="/settings/data-backup" className="settings-hub-card" aria-label="Open Data and Backup page">
          <span className="settings-hub-icon"><Database size={18} /></span>
          <span className="settings-hub-copy"><strong>Data &amp; Backup</strong><small>Database health, storage, backup, restore, and device information</small></span>
          <span className="settings-hub-arrow" aria-hidden="true"><ChevronRight size={18} /></span>
        </Link>
        <Link to="/settings/code-lists" className="settings-hub-card" aria-label="Open Code Lists page">
          <span className="settings-hub-icon"><Settings2 size={18} /></span>
          <span className="settings-hub-copy">
            <strong>Code Lists</strong>
            <small>Manage Moment types, income types, and expense categories</small>
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
          <p>Reset appearance, entry defaults, saved notification preferences, greeting settings, and Code Lists without deleting your records.</p>
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
              <li>Theme and appearance</li>
              <li>Currency, dashboard view, and default moment, income, and expense selections</li>
              <li>Saved notification preferences (notifications are currently unavailable)</li>
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
