/*
  This is the app's global memory.
  It stores session info, theme settings, feature defaults, and small UI notifications
  so that different screens can share the same state without complicated prop drilling.
*/
import { create } from 'zustand';

// These are the default selectable values used across the app.
// For example, the user can set event types or expense categories in settings.
const defaultAdminValues = {
  eventTypes: ['Birthday', 'Anniversary', 'Festival', 'Function', 'Personal'],
  incomeTypes: ['Salary', 'Freelance', 'Bonus'],
  expenseCategories: ['Food', 'Hospital', 'Shopping', 'Travel', 'Entertainment'],
};

const defaultGreetingEnabledTypes = ['Birthday', 'Anniversary'];

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

// Load admin values from browser storage if they exist.
// This allows the app to remember user custom settings after refreshing.
const loadAdminValues = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('lifehub_admin_values') || '{}');
    return {
      ...defaultAdminValues,
      ...stored,
      eventTypes: Array.isArray(stored.eventTypes) && stored.eventTypes.length ? stored.eventTypes : defaultAdminValues.eventTypes,
      incomeTypes: Array.isArray(stored.incomeTypes) && stored.incomeTypes.length ? stored.incomeTypes : defaultAdminValues.incomeTypes,
      expenseCategories: Array.isArray(stored.expenseCategories) && stored.expenseCategories.length ? stored.expenseCategories : defaultAdminValues.expenseCategories,
    };
  } catch {
    return { ...defaultAdminValues };
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
    return { ...defaultPreferences };
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
    localStorage.setItem('lifehub_admin_values', JSON.stringify(defaultAdminValues));
    return { adminValues: { ...defaultAdminValues } };
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
    localStorage.setItem('lifehub_preferences', JSON.stringify(defaultPreferences));
    localStorage.setItem('lifehub_theme_choice', '1');
    return { preferences: { ...defaultPreferences } };
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
