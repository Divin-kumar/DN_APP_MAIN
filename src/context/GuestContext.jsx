import { DN_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX } from '../utils/storageMigration';
/*
  Controls guest-mode persistence and session transitions.

  This is how the app allows a user to try the product without signing up.
  The app remembers the guest choice in localStorage, so the user stays in guest mode
  even after refreshing the page.
*/
import { createContext, useContext, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import { activateSampleScenario, canOfferGuestTour, clearActiveSampleScenario, getActiveSampleScenario, hydrateGuestTourPhotos, GUEST_TOUR_SCENARIO } from '../dev/sampleData';

const GuestContext = createContext(null);
const GUEST_MODE_KEY = 'dn_guest_mode';

export function GuestProvider({ children }) {
  const isGuest = useAppStore((state) => state.isGuest);
  const setGuestMode = useAppStore((state) => state.setGuestMode);
  const clearSession = useAppStore((state) => state.clearSession);

  // Re-entering Guest mode after a reload must resume any interrupted demo
  // image preparation. Do not silently edit personal Guest records.
  useEffect(() => {
    if (!isGuest || getActiveSampleScenario() !== GUEST_TOUR_SCENARIO) return;
    let live = true;
    hydrateGuestTourPhotos().then((data) => {
      if (live && data && getActiveSampleScenario() === GUEST_TOUR_SCENARIO) {
        useEventStore.getState().setEvents(data.events);
      }
    }).catch((error) => {
      if (live) console.warn('Optional Guest tour illustrations could not be prepared:', error);
    });
    return () => { live = false; };
  }, [isGuest]);

  const continueAsGuest = () => {
    // A first-time empty Guest receives a separate, versioned product tour.
    // Real Guest records are never seeded, overwritten, or transferred.
    const startTour = !getActiveSampleScenario() && canOfferGuestTour();
    if (startTour) activateSampleScenario(GUEST_TOUR_SCENARIO);
    localStorage.setItem(GUEST_MODE_KEY, 'true');
    setGuestMode(true);
  };

  const exitGuestMode = () => {
    // Exit the tour alongside Guest mode; never migrate demo records to login.
    if (getActiveSampleScenario() === GUEST_TOUR_SCENARIO) clearActiveSampleScenario();
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
