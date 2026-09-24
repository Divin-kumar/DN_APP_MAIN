import { create } from 'zustand';

const useAppStore = create((set) => ({
  user: null,
  authReady: false,
  isGuest: false,
  appLoading: true,
  sessionType: 'unauthenticated',
  darkMode: localStorage.getItem('lifehub_dark_mode') === 'true',

  toggleDarkMode: () => set((state) => {
    const darkMode = !state.darkMode;
    localStorage.setItem('lifehub_dark_mode', String(darkMode));
    return { darkMode };
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
