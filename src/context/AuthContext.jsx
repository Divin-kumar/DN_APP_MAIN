/*
  This file listens to Firebase authentication and feeds the app state.
  Its job is to translate the auth system into simple app-level values like
  “logged in,” “guest,” or “logged out.”

  In simple language:
  this component watches whether the user is signed in, signed out, or browsing as guest.
  Based on that, it updates the app's global state so every page can know the current session.
*/
import { createContext, useContext, useEffect } from 'react';
import { hasPersonalGuestRecords } from '../utils/storageMigration';
import { authService } from '../services/firebase';
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

          let transferNotice = '';
          try {
            const { mergeGuestDataIntoAccount } = await import('../services/guestMergeService');
            if (revision !== authChangeRevision) return;
            const merge = await mergeGuestDataIntoAccount(user.uid);
            if (merge.expensePlansRetainedLocally) {
              transferNotice = `Guest expense plans${merge.tasksRetainedLocally ? ' and Tasks' : ''} remain on this device. Open Guest to back them up.`;
            } else if (merge.tasksRetainedLocally) {
              transferNotice = 'Your Guest Task data is still on this device. Open Guest to make a backup.';
            }
          } catch (error) {
            console.error('Failed to merge guest data:', error);
            try {
              if (hasPersonalGuestRecords()) transferNotice = 'Your Guest transfer didn’t finish. Open Guest on this device to back up remaining records.';
            } catch {
              transferNotice = 'DN couldn’t check the Guest records on this device. Open the backup guide for help.';
            }
          }

          if (revision !== authChangeRevision) return;
          setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
          });
          if (transferNotice) showToast(transferNotice, 'danger', {
            label: 'Backup guide', to: '/settings/data-backup#data-guide', duration: 9500,
          });
        };
        void initializeAccount();
      } else {
        authChangeRevision += 1;
        let resumeGuest = false;
        try { resumeGuest = localStorage.getItem('dn_guest_mode') === 'true'; }
        catch { /* The public sign-in screen can still open with browser storage blocked. */ }
        if (resumeGuest) setGuestMode(true);
        else clearSession();
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
