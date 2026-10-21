import { DN_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX } from '../utils/storageMigration';
/*
  Controls guest-mode persistence and session transitions.

  This is how the app allows a user to try the product without signing up.
  The app remembers the guest choice in localStorage, so the user stays in guest mode
  even after refreshing the page.
*/
import { createContext, useContext } from 'react';
import useAppStore from '../store/useAppStore';

const GuestContext = createContext(null);
const GUEST_MODE_KEY = 'dn_guest_mode';

export function GuestProvider({ children }) {
  const isGuest = useAppStore((state) => state.isGuest);
  const setGuestMode = useAppStore((state) => state.setGuestMode);
  const clearSession = useAppStore((state) => state.clearSession);

  const continueAsGuest = () => {
    // Save guest preference so the app knows not to force a login next time.
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    setGuestMode(true);
  };

  const exitGuestMode = () => {
    // Remove guest session state and clear the app session.
    localStorage.removeItem(GUEST_MODE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_PREFIX + GUEST_MODE_KEY.slice(DN_STORAGE_PREFIX.length));
    clearSession();
  };

  const restoreGuestSession = () => {
    // On reload, restore guest mode automatically if the user previously chose to stay as guest.
    const guestEnabled = localStorage.getItem(GUEST_MODE_KEY) === 'true';
    if (guestEnabled) {
      setGuestMode(true);
    }
  };

  const value = {
    isGuest,
    continueAsGuest,
    exitGuestMode,
    restoreGuestSession,
  };

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}

export function useGuest() {
  const context = useContext(GuestContext);
  if (!context) {
    throw new Error('useGuest must be used within GuestProvider');
  }
  return context;
}
