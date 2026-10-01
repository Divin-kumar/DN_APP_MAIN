/* Shared session, theme, and application loading state. */
import { create } from 'zustand';

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
  user: null,
  authReady: false,
  isGuest: false,
  appLoading: true,
  sessionType: 'unauthenticated',
  adminValues: loadAdminValues(),
  preferences: loadPreferences(),
  toast: null,

  setAdminValues: (nextValues) => set((state) => {
    const merged = {
      ...state.adminValues,
      ...nextValues,
    };
    localStorage.setItem('lifehub_admin_values', JSON.stringify(merged));
    return { adminValues: merged };
  }),

  resetAdminValues: () => set(() => {
    localStorage.setItem('lifehub_admin_values', JSON.stringify(defaultAdminValues));
    return { adminValues: { ...defaultAdminValues } };
  }),

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

  resetPreferences: () => set(() => {
    localStorage.setItem('lifehub_preferences', JSON.stringify(defaultPreferences));
    localStorage.setItem('lifehub_theme_choice', '1');
    return { preferences: { ...defaultPreferences } };
  }),

  setUser: (user) =>
    set({
      user,
      isGuest: false,
      sessionType: user ? 'authenticated' : 'unauthenticated',
      authReady: true,
      appLoading: false,
    }),

  setGuestMode: (value) =>
    set({
      isGuest: value,
      user: null,
      sessionType: value ? 'guest' : 'unauthenticated',
      authReady: true,
      appLoading: false,
    }),

  showToast: (message, type = 'success') => set({ toast: { message, type } }),
  hideToast: () => set({ toast: null }),

  setAuthReady: (value) => set({ authReady: value }),
  setAppLoading: (value) => set({ appLoading: value }),

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
