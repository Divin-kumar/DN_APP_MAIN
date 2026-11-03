/*
  This file listens to Firebase authentication and feeds the app state.
  Its job is to translate the auth system into simple app-level values like
  “logged in,” “guest,” or “logged out.”

  In simple language:
  this component watches whether the user is signed in, signed out, or browsing as guest.
  Based on that, it updates the app's global state so every page can know the current session.
*/
import { createContext, useContext, useEffect } from 'react';
import { authService } from '../services/firebase';
import { mergeGuestDataIntoAccount } from '../services/guestMergeService';
import useAppStore from '../store/useAppStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const setUser = useAppStore((state) => state.setUser);
  const beginAccountLoad = useAppStore((state) => state.beginAccountLoad);
  const clearSession = useAppStore((state) => state.clearSession);
  const setGuestMode = useAppStore((state) => state.setGuestMode);
  const hydrateAdminValuesForUser = useAppStore((state) => state.hydrateAdminValuesForUser);
  const showToast = useAppStore((state) => state.showToast);

  useEffect(() => {
    let authChangeRevision = 0;

    // Subscribe to auth changes so the app always knows the current login state.
    const unsubscribe = authService.onAuthChange((user) => {
      if (user) {
        const revision = ++authChangeRevision;
        beginAccountLoad();
        const initializeAccount = async () => {
          // Read guest settings before the record merge clears the guest-mode marker.
          try {
            await hydrateAdminValuesForUser(user.uid);
          } catch (error) {
            console.error('Failed to load account Code Lists:', error);
          }

          if (revision !== authChangeRevision) return;

          let retainedGuestTasks = 0;
          try {
            const merge = await mergeGuestDataIntoAccount(user.uid);
            retainedGuestTasks = merge.tasksRetainedLocally || 0;
          } catch (error) {
            console.error('Failed to merge guest data:', error);
          }

          if (revision !== authChangeRevision) return;
          setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
          });
          if (retainedGuestTasks) showToast(
            `${retainedGuestTasks} Guest ${retainedGuestTasks === 1 ? 'Task remains' : 'Tasks remain'} on this browser, not in your account. Export a Guest backup before clearing device data.`,
            'danger', { label: 'Learn more', to: '/tasks', duration: 9500 },
          );
        };
        void initializeAccount();
      } else if (localStorage.getItem('dn_guest_mode') === 'true') {
        authChangeRevision += 1;
        // If the app is in guest mode, keep the user in a limited mode instead of forcing logout.
        setGuestMode(true);
      } else {
        authChangeRevision += 1;
        // If no account and no guest mode, reset session to a logged-out state.
        clearSession();
      }
    });

    return () => {
      authChangeRevision += 1;
      unsubscribe?.();
    };
  }, [beginAccountLoad, clearSession, hydrateAdminValuesForUser, setGuestMode, setUser, showToast]);

  return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
