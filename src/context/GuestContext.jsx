/* Controls guest-mode persistence and session transitions. */
import { createContext, useContext } from 'react';
import useAppStore from '../store/useAppStore';

const GuestContext = createContext(null);
const GUEST_MODE_KEY = 'lifehub_guest_mode';

export function GuestProvider({ children }) {
  const isGuest = useAppStore((state) => state.isGuest);
  const setGuestMode = useAppStore((state) => state.setGuestMode);
  const clearSession = useAppStore((state) => state.clearSession);

  const continueAsGuest = () => {
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    setGuestMode(true);
  };

  const exitGuestMode = () => {
    localStorage.removeItem(GUEST_MODE_KEY);
    clearSession();
  };

  const restoreGuestSession = () => {
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
