/*
  This is the app's global memory.
  It stores session info, theme settings, feature defaults, and small UI notifications
  so that different screens can share the same state without complicated prop drilling.

  In simple language:
  imagine this as a central brain for the app.
  Instead of passing the same data from page to page, the app stores it here so every component
  can access it when needed.
*/
import { create } from 'zustand';
import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { DEFAULT_CODE_LISTS, resetCodeListsPreservingReferences, serializeCodeListEntries } from '../utils/codeLists.js';
import { codeListRepository, devicePrincipalRepository, settingsRepository } from '../repositories/index.js';
import { validateSettingsKey } from '../repositories/settingsRepository.validation.js';
import { resolveRepositoryPrincipal } from './repositoryRuntime.js';

// Default app preferences such as theme, currency, and notification settings.
const defaultPreferences = {
  theme: 'dark',
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
  listSort: {},
};

export const DEFAULT_LOCAL_PROFILE = Object.freeze({ displayName: '', nickname: '', description: '', photoDataUrl: '' });

const createDefaultPreferences = () => ({
  ...defaultPreferences,
  notifications: { ...defaultPreferences.notifications },
});

const createDefaultAdminValues = () => Object.fromEntries(
  Object.entries(DEFAULT_CODE_LISTS).map(([key, values]) => [key, serializeCodeListEntries(values)]),
);

const mapCodeListRows = (rows) => Object.entries(DEFAULT_CODE_LISTS).reduce((result, [listKey, defaults]) => {
  const stored = rows
    .filter((row) => row.listKey === listKey)
    .map((row) => ({
      id: row.id,
      value: row.value ?? row.entryValue,
      label: row.label,
      active: row.active,
      isActive: row.isActive,
      canGenerateGreetingCards: row.canGenerateGreetingCards,
      greetingTemplate: row.greetingTemplate,
      showInDashboardUpcoming: row.showInDashboardUpcoming,
    }));
  result[listKey] = stored.length ? stored : serializeCodeListEntries(defaults);
  return result;
}, {});

const normalizePreferences = (stored = {}) => ({
  ...createDefaultPreferences(),
  ...stored,
  notifications: { ...defaultPreferences.notifications, ...(stored.notifications || {}) },
  listSort: { ...(stored.listSort || {}) },
});

const persistCodeLists = async (principalId, current, patch) => {
  await db.transaction('rw', db.table(DATABASE_TABLES.CODE_LISTS), async () => {
    for (const [listKey, items] of Object.entries(patch)) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_CODE_LISTS, listKey)) continue;
      const normalized = serializeCodeListEntries(items);
      if (normalized.length) await codeListRepository.setList(principalId, listKey, normalized);
      else await codeListRepository.deleteList(principalId, listKey);
    }
  });
  return { ...current, ...patch };
};

const ensurePersistentDefaults = async (principalId) => {
  if (!principalId) return { preferences: {}, adminValues: {} };
  const defaults = createDefaultPreferences();
  const [settingsResult, codeListResult] = await Promise.all([
    settingsRepository.ensureDefaults(principalId, defaults),
    codeListRepository.ensureDefaults(principalId),
  ]);
  return {
    preferences: normalizePreferences(settingsResult),
    adminValues: Object.fromEntries(Object.entries(DEFAULT_CODE_LISTS).map(([listKey, values]) => [listKey, serializeCodeListEntries(codeListResult[listKey] || values)])),
  };
};

const persistPreferences = async (principalId, current, partial) => {
  const merged = normalizePreferences({ ...current, ...partial });
  if (partial.notifications) merged.notifications = { ...current.notifications, ...partial.notifications };
  if (partial.listSort) merged.listSort = { ...current.listSort, ...partial.listSort };
  await db.transaction('rw', db.table(DATABASE_TABLES.SETTINGS), async () => {
    for (const [key] of Object.entries(partial)) {
      if (!validateSettingsKey(key)) continue;
      await settingsRepository.updateOne(principalId, key, merged[key]);
    }
  });
  return merged;
};

let bootstrapInFlight = null;

const useAppStore = create((set) => ({
  // User information and session status.
  principal: null,
  principalReady: false,
  migrationCandidates: [],
  appLoading: true,
  principalId: null,
  persistentReady: false,
  persistenceError: null,

  // Saved app configuration and temporary popup messages.
  adminValues: createDefaultAdminValues(),
  preferences: createDefaultPreferences(),
  toast: null,
  profile: DEFAULT_LOCAL_PROFILE,

  hydratePersistentData: async (principalId) => {
    if (!principalId) throw new Error('A repository principal is required to hydrate persistent settings.');
    const { preferences: defaultPreferencesState, adminValues: defaultAdminValues } = await ensurePersistentDefaults(principalId);
    const [storedPreferences, storedCodeLists, storedProfile] = await Promise.all([
      settingsRepository.getPreferences(principalId),
      codeListRepository.getAll(principalId),
      settingsRepository.getByKey(principalId, 'profile'),
    ]);
    if (!storedProfile) await settingsRepository.setOne(principalId, 'profile', DEFAULT_LOCAL_PROFILE);
    const normalizedPreferences = normalizePreferences(storedPreferences && Object.keys(storedPreferences).length ? storedPreferences : defaultPreferencesState);
    const normalizedAdminValues = Object.keys(storedCodeLists || {}).length ? mapCodeListRows(storedCodeLists) : { ...defaultAdminValues, ...mapCodeListRows(storedCodeLists) };
    set({
      principalId,
      preferences: normalizedPreferences,
      profile: storedProfile?.value || DEFAULT_LOCAL_PROFILE,
      adminValues: normalizedAdminValues,
      persistentReady: true,
      persistenceError: null,
    });
    return { preferences: normalizedPreferences, adminValues: normalizedAdminValues };
  },

  // Update custom values such as event labels and expense categories.
  setAdminValues: async (nextValues) => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = state.adminValues;
    const optimistic = { ...previous, ...nextValues };
    set({ adminValues: optimistic, persistenceError: null });
    try {
      await persistCodeLists(principalId, previous, nextValues);
      return optimistic;
    } catch (error) {
      set({ adminValues: previous, persistenceError: error });
      throw error;
    }
  },

  // Reset admin-defined values back to the default list.
  resetAdminValues: async () => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = state.adminValues;
    const defaults = createDefaultAdminValues();
    set({ adminValues: defaults, persistenceError: null });
    try {
      await db.transaction('rw', db.table(DATABASE_TABLES.CODE_LISTS), async () => {
        await codeListRepository.resetToDefaults(principalId);
      });
      return defaults;
    } catch (error) {
      set({ adminValues: previous, persistenceError: error });
      throw error;
    }
  },

  resetAllSettings: async (referencedValues) => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = { adminValues: state.adminValues, preferences: state.preferences };
    const adminValues = resetCodeListsPreservingReferences(state.adminValues, referencedValues);
    const preferences = createDefaultPreferences();
    set({ adminValues, preferences, persistenceError: null });
    try {
      await db.transaction('rw', db.table(DATABASE_TABLES.SETTINGS), db.table(DATABASE_TABLES.CODE_LISTS), async () => {
        await settingsRepository.resetToDefaults(principalId);
        await Promise.all(Object.entries(preferences).map(([key, value]) => settingsRepository.updateOne(principalId, key, value)));
        await settingsRepository.updateOne(principalId, 'profile', state.profile || DEFAULT_LOCAL_PROFILE);
        for (const [listKey, entries] of Object.entries(adminValues)) {
          const normalized = serializeCodeListEntries(entries);
          await codeListRepository.deleteList(principalId, listKey);
          await codeListRepository.setList(principalId, listKey, normalized);
        }
      });
      return { adminValues, preferences };
    } catch (error) {
      set({ ...previous, persistenceError: error });
      throw error;
    }
  },

  // Save preferences and persist them so they survive page refreshes.
  setPreferences: async (nextPreferences) => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = state.preferences;
    const optimistic = normalizePreferences({ ...previous, ...nextPreferences });
    if (nextPreferences.notifications) optimistic.notifications = { ...previous.notifications, ...nextPreferences.notifications };
    if (nextPreferences.listSort) optimistic.listSort = { ...previous.listSort, ...nextPreferences.listSort };
    set({ preferences: optimistic, persistenceError: null });
    try {
      await persistPreferences(principalId, previous, nextPreferences);
      return optimistic;
    } catch (error) {
      set({ preferences: previous, persistenceError: error });
      throw error;
    }
  },

  setProfile: async (nextProfile) => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active local profile is available.');
    const previous = state.profile;
    const profile = { ...previous, ...nextProfile };
    set({ profile, persistenceError: null });
    try {
      await settingsRepository.updateOne(principalId, 'profile', profile);
      return profile;
    } catch (error) {
      set({ profile: previous, persistenceError: error });
      throw error;
    }
  },

  // Restore the original app defaults for theme and user preferences.
  resetPreferences: async () => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal();
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = state.preferences;
    const preferences = createDefaultPreferences();
    set({ preferences, persistenceError: null });
    try {
      await db.transaction('rw', db.table(DATABASE_TABLES.SETTINGS), async () => {
        await settingsRepository.resetToDefaults(principalId);
        await Promise.all(Object.entries(preferences).map(([key, value]) => settingsRepository.updateOne(principalId, key, value)));
        await settingsRepository.updateOne(principalId, 'profile', state.profile || DEFAULT_LOCAL_PROFILE);
      });
      return preferences;
    } catch (error) {
      set({ preferences: previous, persistenceError: error });
      throw error;
    }
  },

  bootstrapDevicePrincipal: async (options = {}) => {
    if (bootstrapInFlight && Object.keys(options).length === 0) {
      return bootstrapInFlight;
    }
    const run = async () => {
      set({ principalReady: false, appLoading: true, persistentReady: false, persistenceError: null });
      try {
        await initializeDatabase();
        const principal = await devicePrincipalRepository.getOrCreate(options);
        await useAppStore.getState().hydratePersistentData(principal.principalId);
        set({ principal, principalId: principal.principalId, migrationCandidates: [], principalReady: true, appLoading: false, persistentReady: true, persistenceError: null });
        return principal;
      } catch (error) {
        set({ principalReady: true, appLoading: false, persistentReady: false, persistenceError: error, migrationCandidates: error?.legacyPrincipals || [] });
        throw error;
      } finally {
        bootstrapInFlight = null;
      }
    };
    bootstrapInFlight = run();
    return bootstrapInFlight;
  },

  updateDeviceName: async (deviceName) => {
    const principal = await devicePrincipalRepository.updateDeviceName(deviceName);
    set({ principal, principalId: principal.principalId });
    return principal;
  },

  // Small success/error popups shown throughout the app.
  showToast: (message, type = 'success', action = null) => set({ toast: { message, type, action, duration: action?.duration || 2600 } }),
  hideToast: () => set({ toast: null }),

  // Shared loading state used during auth checks and boot-up.
  setPrincipalReady: (value) => set({ principalReady: value }),
  setAppLoading: (value) => set({ appLoading: value }),
}));

export default useAppStore;
