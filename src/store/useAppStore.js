import { migrateLegacyStorage } from '../utils/storageMigration';
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
import { DEFAULT_CODE_LISTS, LEGACY_CODE_LISTS_STORAGE_KEY, LEGACY_CODE_LISTS_VERSION_KEY, resetCodeListsPreservingReferences, serializeCodeListEntries, readGuestCodeListSettings, writeGuestCodeListSettings } from '../utils/codeLists';
import { loadCodeListsForUser, saveCodeListsForUser } from '../services/codeListService';

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

let adminLoadRevision = 0;
let adminWriteRevision = 0;
let adminWriteQueue = Promise.resolve();
let persistedAdminValues = null;
let persistedAdminValuesOwner = null;

// Load the saved user preferences from localStorage.
const loadPreferences = () => {
  try {
    migrateLegacyStorage();
    const stored = JSON.parse(localStorage.getItem('dn_preferences') || '{}');
    return {
      ...defaultPreferences,
      ...stored,
      theme: localStorage.getItem('dn_theme_choice') ? (stored.theme || defaultPreferences.theme) : 'dark',
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

const useAppStore = create((set, get) => ({
  // User information and session status.
  user: null,
  authReady: false,
  isGuest: false,
  appLoading: true,
  sessionType: 'unauthenticated',

  // Saved app configuration and temporary popup messages.
  adminValues: createDefaultAdminValues(),
  adminValuesOwner: null,
  adminValuesLoading: false,
  adminValuesError: null,
  preferences: loadPreferences(),
  toast: null,

  hydrateAdminValuesForUser: async (uid) => {
    const revision = ++adminLoadRevision;
    set({
      adminValues: createDefaultAdminValues(),
      adminValuesOwner: null,
      adminValuesLoading: true,
      adminValuesError: null,
    });

    try {
      const adminValues = await loadCodeListsForUser(uid);
      if (revision === adminLoadRevision) {
        persistedAdminValues = adminValues;
        persistedAdminValuesOwner = uid;
        set({ adminValues, adminValuesOwner: uid, adminValuesLoading: false, adminValuesError: null });
      }
      return adminValues;
    } catch (error) {
      if (revision === adminLoadRevision) {
        set({ adminValuesOwner: null, adminValuesLoading: false, adminValuesError: error });
      }
      throw error;
    }
  },

  hydrateGuestAdminValues: () => {
    adminLoadRevision += 1;
    const { adminValues, schemaVersion } = readGuestCodeListSettings();
    try {
      localStorage.setItem(LEGACY_CODE_LISTS_STORAGE_KEY, JSON.stringify(adminValues));
      localStorage.setItem(LEGACY_CODE_LISTS_VERSION_KEY, String(schemaVersion));
    } catch {
      // The in-memory guest configuration remains usable if browser storage is unavailable.
    }
    persistedAdminValues = adminValues;
    persistedAdminValuesOwner = 'guest';
    set({ adminValues, adminValuesOwner: 'guest', adminValuesLoading: false, adminValuesError: null });
    return adminValues;
  },

  // Authenticated lists are written to the account document; guest lists stay device-local.
  setAdminValues: (nextValues) => {
    const current = get();
    const merged = { ...current.adminValues, ...nextValues };
    const owner = current.user?.uid || (current.isGuest ? 'guest' : null);
    const revision = ++adminWriteRevision;

    if (owner === 'guest') {
      const saved = writeGuestCodeListSettings(merged);
      persistedAdminValues = saved;
      persistedAdminValuesOwner = 'guest';
      set({ adminValues: saved, adminValuesOwner: 'guest', adminValuesError: null });
      return Promise.resolve(saved);
    }

    if (!owner || current.adminValuesOwner !== owner || current.adminValuesError) {
      return Promise.reject(new Error('Code Lists are not ready to save. Reload them before making changes.'));
    }

    set({ adminValues: merged, adminValuesError: null });
    const write = adminWriteQueue.catch(() => undefined).then(() => saveCodeListsForUser(owner, merged));
    adminWriteQueue = write;

    return write.then((saved) => {
      if (get().user?.uid === owner) {
        persistedAdminValues = saved;
        persistedAdminValuesOwner = owner;
      }
      if (revision === adminWriteRevision && get().user?.uid === owner) {
        set({ adminValues: saved, adminValuesError: null });
      }
      return saved;
    }).catch((error) => {
      if (revision === adminWriteRevision && get().user?.uid === owner) {
        const fallback = persistedAdminValuesOwner === owner ? persistedAdminValues : current.adminValues;
        set({ adminValues: fallback, adminValuesOwner: owner, adminValuesError: error });
      }
      throw error;
    });
  },

  // Reset admin-defined values through the same persistence path as normal edits.
  resetAdminValues: () => get().setAdminValues(createDefaultAdminValues()),

  resetAllSettings: async (referencedValues) => {
    const adminValues = resetCodeListsPreservingReferences(get().adminValues, referencedValues);
    await get().setAdminValues(adminValues);
    const preferences = createDefaultPreferences();
    localStorage.setItem('dn_preferences', JSON.stringify(preferences));
    localStorage.setItem('dn_theme_choice', '1');
    set({ preferences });
    return { adminValues, preferences };
  },

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
      localStorage.setItem('dn_theme_choice', '1');
    }
    localStorage.setItem('dn_preferences', JSON.stringify(merged));
    return { preferences: merged };
  }),

  restorePreferences: (restoredPreferences) => {
    const preferences = {
      ...createDefaultPreferences(),
      ...(restoredPreferences || {}),
      notifications: {
        ...defaultPreferences.notifications,
        ...(restoredPreferences?.notifications || {}),
      },
      listSort: { ...(restoredPreferences?.listSort || {}) },
    };
    localStorage.setItem('dn_preferences', JSON.stringify(preferences));
    localStorage.setItem('dn_theme_choice', '1');
    set({ preferences });
    return preferences;
  },

  // Restore the original app defaults for theme and user preferences.
  resetPreferences: () => set(() => {
    const preferences = createDefaultPreferences();
    localStorage.setItem('dn_preferences', JSON.stringify(preferences));
    localStorage.setItem('dn_theme_choice', '1');
    return { preferences };
  }),

  // Mark the current user as logged in and clear guest mode.
  beginAccountLoad: () => {
    adminLoadRevision += 1;
    set({
      user: null,
      isGuest: false,
      sessionType: 'unauthenticated',
      authReady: false,
      appLoading: true,
      adminValues: createDefaultAdminValues(),
      adminValuesOwner: null,
      adminValuesLoading: true,
      adminValuesError: null,
    });
  },

  setUser: (user) =>
    set({
      user,
      isGuest: false,
      sessionType: user ? 'authenticated' : 'unauthenticated',
      authReady: true,
      appLoading: false,
    }),

  // Switch app to guest mode when no real account is active.
  setGuestMode: (value) => {
    if (value) get().hydrateGuestAdminValues();
    set({
      isGuest: value,
      user: null,
      sessionType: value ? 'guest' : 'unauthenticated',
      authReady: true,
      appLoading: false,
    });
  },

  // Small success/error popups shown throughout the app.
  showToast: (message, type = 'success', action = null) => set({ toast: { message, type, action, duration: action?.duration || (action?.label ? 6200 : 2600) } }),
  hideToast: () => set({ toast: null }),

  // Shared loading state used during auth checks and boot-up.
  setAuthReady: (value) => set({ authReady: value }),
  setAppLoading: (value) => set({ appLoading: value }),

  // Clear the session back to a logged-out state.
  clearSession: () => {
    adminLoadRevision += 1;
    persistedAdminValues = null;
    persistedAdminValuesOwner = null;
    set({
      user: null,
      isGuest: false,
      sessionType: 'unauthenticated',
      authReady: true,
      appLoading: false,
      adminValues: createDefaultAdminValues(),
      adminValuesOwner: null,
      adminValuesError: null,
      adminValuesLoading: false,
    });
  },
}));

export default useAppStore;
