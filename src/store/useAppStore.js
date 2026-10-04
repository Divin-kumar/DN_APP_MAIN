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
import { DATABASE_TABLES } from '../database/tables.js';
import { DEFAULT_CODE_LISTS, resetCodeListsPreservingReferences, serializeCodeListEntries } from '../utils/codeLists.js';
import { codeListRepository, settingsRepository } from '../repositories/index.js';
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
      value: row.entryValue,
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
      await codeListRepository.deleteList(principalId, listKey);
      if (normalized.length) await codeListRepository.setList(principalId, listKey, normalized);
    }
  });
  return { ...current, ...patch };
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

const useAppStore = create((set) => ({
  // User information and session status.
  user: null,
  authReady: false,
  isGuest: false,
  appLoading: true,
  sessionType: 'unauthenticated',
  principalId: null,
  persistentReady: false,
  persistenceError: null,

  // Saved app configuration and temporary popup messages.
  adminValues: createDefaultAdminValues(),
  preferences: createDefaultPreferences(),
  toast: null,

  hydratePersistentData: async (principalId) => {
    if (!principalId) throw new Error('A repository principal is required to hydrate persistent settings.');
    const [storedPreferences, storedCodeLists] = await Promise.all([
      settingsRepository.getPreferences(principalId),
      codeListRepository.getAll(principalId),
    ]);
    set({
      principalId,
      preferences: normalizePreferences(storedPreferences),
      adminValues: mapCodeListRows(storedCodeLists),
      persistentReady: true,
      persistenceError: null,
    });
    return { preferences: normalizePreferences(storedPreferences), adminValues: mapCodeListRows(storedCodeLists) };
  },

  // Update custom values such as event labels and expense categories.
  setAdminValues: async (nextValues) => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal(state.user?.uid, state.isGuest);
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
    const principalId = state.principalId || await resolveRepositoryPrincipal(state.user?.uid, state.isGuest);
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
    const principalId = state.principalId || await resolveRepositoryPrincipal(state.user?.uid, state.isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = { adminValues: state.adminValues, preferences: state.preferences };
    const adminValues = resetCodeListsPreservingReferences(state.adminValues, referencedValues);
    const preferences = createDefaultPreferences();
    set({ adminValues, preferences, persistenceError: null });
    try {
      await db.transaction('rw', db.table(DATABASE_TABLES.SETTINGS), db.table(DATABASE_TABLES.CODE_LISTS), async () => {
        await settingsRepository.resetToDefaults(principalId);
        await Promise.all(Object.entries(preferences).map(([key, value]) => settingsRepository.updateOne(principalId, key, value)));
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
    const principalId = state.principalId || await resolveRepositoryPrincipal(state.user?.uid, state.isGuest);
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

  // Restore the original app defaults for theme and user preferences.
  resetPreferences: async () => {
    const state = useAppStore.getState();
    const principalId = state.principalId || await resolveRepositoryPrincipal(state.user?.uid, state.isGuest);
    if (!principalId) throw new Error('No active repository principal is available.');
    const previous = state.preferences;
    const preferences = createDefaultPreferences();
    set({ preferences, persistenceError: null });
    try {
      await db.transaction('rw', db.table(DATABASE_TABLES.SETTINGS), async () => {
        await settingsRepository.resetToDefaults(principalId);
        await Promise.all(Object.entries(preferences).map(([key, value]) => settingsRepository.updateOne(principalId, key, value)));
      });
      return preferences;
    } catch (error) {
      set({ preferences: previous, persistenceError: error });
      throw error;
    }
  },

  // Mark the current user as logged in and clear guest mode.
  setUser: async (user) => {
    set({ authReady: false, appLoading: true, persistentReady: false, persistenceError: null });
    let principalId = user?.uid || null;
    let persistentReady = false;
    let persistenceError = null;
    try {
      principalId = await resolveRepositoryPrincipal(user?.uid, false);
      await useAppStore.getState().hydratePersistentData(principalId);
      persistentReady = true;
    } catch (error) {
      persistenceError = error;
    }
    set({
      user,
      isGuest: false,
      principalId,
      sessionType: user ? 'authenticated' : 'unauthenticated',
      authReady: true,
      appLoading: false,
      persistentReady,
      persistenceError,
    });
  },

  // Switch app to guest mode when no real account is active.
  setGuestMode: async (value) => {
    set({ authReady: false, appLoading: true, persistentReady: false, persistenceError: null });
    let principalId = null;
    let persistentReady = false;
    let persistenceError = null;
    if (value) {
      try {
        principalId = await resolveRepositoryPrincipal(null, true);
        await useAppStore.getState().hydratePersistentData(principalId);
        persistentReady = true;
      } catch (error) {
        persistenceError = error;
      }
    }
    set({
      isGuest: value,
      user: null,
      principalId,
      sessionType: value ? 'guest' : 'unauthenticated',
      authReady: true,
      appLoading: false,
      persistentReady,
      persistenceError,
    });
  },

  // Small success/error popups shown throughout the app.
  showToast: (message, type = 'success', action = null) => set({ toast: { message, type, action, duration: action?.duration || 2600 } }),
  hideToast: () => set({ toast: null }),

  // Shared loading state used during auth checks and boot-up.
  setAuthReady: (value) => set({ authReady: value }),
  setAppLoading: (value) => set({ appLoading: value }),

  // Clear the session back to a logged-out state.
  clearSession: () =>
    set({
      user: null,
      isGuest: false,
      principalId: null,
      persistentReady: false,
      persistenceError: null,
      preferences: createDefaultPreferences(),
      adminValues: createDefaultAdminValues(),
      sessionType: 'unauthenticated',
      authReady: true,
      appLoading: false,
    }),
}));

export default useAppStore;
