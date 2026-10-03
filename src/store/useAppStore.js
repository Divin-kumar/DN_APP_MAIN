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
import { DEFAULT_CODE_LISTS, resetCodeListsPreservingReferences, serializeCodeListEntries } from '../utils/codeLists';

// These are the default selectable values used across the app.
// For example, the user can set event types or expense categories in settings.
const defaultAdminValues = {
  eventTypes: [...DEFAULT_CODE_LISTS.eventTypes],
  incomeTypes: [...DEFAULT_CODE_LISTS.incomeTypes],
  expenseCategories: [...DEFAULT_CODE_LISTS.expenseCategories],
  activityPriorities: [...DEFAULT_CODE_LISTS.activityPriorities],
  greetingTemplateTypes: [...DEFAULT_CODE_LISTS.greetingTemplateTypes],
  reminderPresets: [...DEFAULT_CODE_LISTS.reminderPresets],
};

const defaultGreetingEnabledTypes = [...DEFAULT_CODE_LISTS.greetingTemplateTypes];

const defaultGreetingTemplates = {
  Birthday: 'Happy {ordinal} Birthday {name} 🎂\nWishing you a wonderful year filled with happiness, health and success.',
  Anniversary: 'Happy {ordinal} Anniversary ❤️\nWishing you many more years of happiness, love and beautiful memories together.',
};

// Default app preferences such as theme, currency, and notification settings.
const defaultPreferences = {
  theme: 'dark',
  currency: 'INR',
  dashboardView: 'overview',
  defaultEventType: 'Personal',
  defaultIncomeType: 'Salary',
  defaultExpenseCategory: 'Food',
  greetingEnabledTypes: [...defaultGreetingEnabledTypes],
  greetingTemplates: { ...defaultGreetingTemplates },
  notifications: {
    eventReminders: true,
    monthlySummary: true,
    budgetAlerts: true,
    reminderTime: '09:00',
  },
};

const createDefaultPreferences = () => ({
  ...defaultPreferences,
  greetingEnabledTypes: [...defaultGreetingEnabledTypes],
  greetingTemplates: { ...defaultGreetingTemplates },
  notifications: { ...defaultPreferences.notifications },
});

const createDefaultAdminValues = () => Object.fromEntries(
  Object.entries(DEFAULT_CODE_LISTS).map(([key, values]) => [key, serializeCodeListEntries(values)]),
);

// Load admin values from browser storage if they exist.
// This allows the app to remember user custom settings after refreshing.
const normalizeStoredList = (key, storedValue) => {
  const fallback = defaultAdminValues[key] ?? DEFAULT_CODE_LISTS[key] ?? [];
  const source = Array.isArray(storedValue) && storedValue.length ? storedValue : fallback;
  return serializeCodeListEntries(source);
};

const loadAdminValues = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('lifehub_admin_values') || '{}');
    return {
      ...defaultAdminValues,
      ...stored,
      eventTypes: normalizeStoredList('eventTypes', stored.eventTypes),
      incomeTypes: normalizeStoredList('incomeTypes', stored.incomeTypes),
      expenseCategories: normalizeStoredList('expenseCategories', stored.expenseCategories),
      activityPriorities: normalizeStoredList('activityPriorities', stored.activityPriorities),
      greetingTemplateTypes: normalizeStoredList('greetingTemplateTypes', stored.greetingTemplateTypes),
      reminderPresets: normalizeStoredList('reminderPresets', stored.reminderPresets),
    };
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
      greetingEnabledTypes: Array.isArray(stored.greetingEnabledTypes) && stored.greetingEnabledTypes.length
        ? [...new Set(stored.greetingEnabledTypes.filter(Boolean))]
        : [...defaultGreetingEnabledTypes],
      greetingTemplates: {
        ...defaultGreetingTemplates,
        ...(stored.greetingTemplates || {}),
      },
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
    localStorage.setItem('lifehub_admin_values', JSON.stringify(merged));
    return { adminValues: merged };
  }),

  // Reset admin-defined values back to the default list.
  resetAdminValues: () => set(() => {
    const adminValues = createDefaultAdminValues();
    localStorage.setItem('lifehub_admin_values', JSON.stringify(adminValues));
    return { adminValues };
  }),

  resetAllSettings: (referencedValues) => set((state) => {
    const adminValues = resetCodeListsPreservingReferences(state.adminValues, referencedValues);
    const preferences = createDefaultPreferences();
    localStorage.setItem('lifehub_admin_values', JSON.stringify(adminValues));
    localStorage.setItem('lifehub_preferences', JSON.stringify(preferences));
    localStorage.setItem('lifehub_theme_choice', '1');
    return { adminValues, preferences };
  }),

  // Save preferences and persist them so they survive page refreshes.
  setPreferences: (nextPreferences) => set((state) => {
    const merged = {
      ...state.preferences,
      ...nextPreferences,
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
  showToast: (message, type = 'success') => set({ toast: { message, type } }),
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
