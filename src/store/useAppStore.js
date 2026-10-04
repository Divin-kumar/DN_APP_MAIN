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
import { CODE_LIST_SCHEMA_VERSION, DEFAULT_CODE_LISTS, migrateStoredCodeLists, resetCodeListsPreservingReferences, serializeCodeListEntries } from '../utils/codeLists';

const ADMIN_VALUES_STORAGE_KEY = 'lifehub_admin_values';
const ADMIN_VALUES_VERSION_KEY = 'lifehub_admin_values_schema_version';

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

// Load and migrate admin values without replacing user-maintained entries on application updates.
const loadAdminValues = () => {
  try {
    const storedJson = localStorage.getItem(ADMIN_VALUES_STORAGE_KEY);
    const storedValues = storedJson === null ? null : JSON.parse(storedJson);
    const storedVersion = localStorage.getItem(ADMIN_VALUES_VERSION_KEY) || 0;
    const { adminValues, version } = migrateStoredCodeLists(storedValues, storedVersion);
    localStorage.setItem(ADMIN_VALUES_STORAGE_KEY, JSON.stringify(adminValues));
    localStorage.setItem(ADMIN_VALUES_VERSION_KEY, String(version));
    return adminValues;
  } catch {
    return createDefaultAdminValues();
  }
};

// Load the saved user preferences from localStorage.
const loadPreferences = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('lifehub_preferences') || '{}');
    return {
      ...defaultPreferences,
      ...stored,
      theme: localStorage.getItem('lifehub_theme_choice') ? (stored.theme || defaultPreferences.theme) : 'dark',
      notifications: {
        ...defaultPreferences.notifications,
        ...(stored.notifications || {}),
      },
      listSort: { ...(stored.listSort || {}) },
      defaultEventType: stored.defaultEventType || defaultPreferences.defaultEventType,
      defaultIncomeType: stored.defaultIncomeType || defaultPreferences.defaultIncomeType,
      defaultExpenseCategory: stored.defaultExpenseCategory || defaultPreferences.defaultExpenseCategory,
    };
  } catch {
    return createDefaultPreferences();
  }
};

const useAppStore = create((set) => ({
  // User information and session status.
  user: null,
  authReady: false,
  isGuest: false,
  appLoading: true,
  sessionType: 'unauthenticated',

  // Saved app configuration and temporary popup messages.
  adminValues: loadAdminValues(),
  preferences: loadPreferences(),
  toast: null,

  // Update custom values such as event labels and expense categories.
  setAdminValues: (nextValues) => set((state) => {
    const merged = {
      ...state.adminValues,
      ...nextValues,
    };
    localStorage.setItem(ADMIN_VALUES_STORAGE_KEY, JSON.stringify(merged));
    return { adminValues: merged };
  }),

  // Reset admin-defined values back to the default list.
  resetAdminValues: () => set(() => {
    const adminValues = createDefaultAdminValues();
    localStorage.setItem(ADMIN_VALUES_STORAGE_KEY, JSON.stringify(adminValues));
    localStorage.setItem(ADMIN_VALUES_VERSION_KEY, String(CODE_LIST_SCHEMA_VERSION));
    return { adminValues };
  }),

  resetAllSettings: (referencedValues) => set((state) => {
    const adminValues = resetCodeListsPreservingReferences(state.adminValues, referencedValues);
    const preferences = createDefaultPreferences();
    localStorage.setItem(ADMIN_VALUES_STORAGE_KEY, JSON.stringify(adminValues));
    localStorage.setItem(ADMIN_VALUES_VERSION_KEY, String(CODE_LIST_SCHEMA_VERSION));
    localStorage.setItem('lifehub_preferences', JSON.stringify(preferences));
    localStorage.setItem('lifehub_theme_choice', '1');
    return { adminValues, preferences };
  }),

  // Save preferences and persist them so they survive page refreshes.
  setPreferences: (nextPreferences) => set((state) => {
    const merged = {
      ...state.preferences,
      ...nextPreferences,
      ...(nextPreferences.listSort ? {
        listSort: { ...state.preferences.listSort, ...nextPreferences.listSort },
      } : {}),
    };
    if (Object.prototype.hasOwnProperty.call(nextPreferences, 'theme')) {
      localStorage.setItem('lifehub_theme_choice', '1');
    }
    localStorage.setItem('lifehub_preferences', JSON.stringify(merged));
    return { preferences: merged };
  }),

  // Restore the original app defaults for theme and user preferences.
  resetPreferences: () => set(() => {
    const preferences = createDefaultPreferences();
    localStorage.setItem('lifehub_preferences', JSON.stringify(preferences));
    localStorage.setItem('lifehub_theme_choice', '1');
    return { preferences };
  }),

  // Mark the current user as logged in and clear guest mode.
  setUser: (user) =>
    set({
      user,
      isGuest: false,
      sessionType: user ? 'authenticated' : 'unauthenticated',
      authReady: true,
      appLoading: false,
    }),

  // Switch app to guest mode when no real account is active.
  setGuestMode: (value) =>
    set({
      isGuest: value,
      user: null,
      sessionType: value ? 'guest' : 'unauthenticated',
      authReady: true,
      appLoading: false,
    }),

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
      sessionType: 'unauthenticated',
      authReady: true,
      appLoading: false,
    }),
}));

export default useAppStore;
