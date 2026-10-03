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
  const clearSession = useAppStore((state) => state.clearSession);
  const setGuestMode = useAppStore((state) => state.setGuestMode);

  useEffect(() => {
    // Subscribe to auth changes so the app always knows the current login state.
    const unsubscribe = authService.onAuthChange((user) => {
      if (user) {
        // If a real login exists, merge guest-only data into the account before storing user info.
        mergeGuestDataIntoAccount(user.uid)
          .catch((error) => {
            console.error('Failed to merge guest data:', error);
          })
          .finally(() => {
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            });
          });
      } else if (localStorage.getItem('lifehub_guest_mode') === 'true') {
        // If the app is in guest mode, keep the user in a limited mode instead of forcing logout.
        setGuestMode(true);
      } else {
        // If no account and no guest mode, reset session to a logged-out state.
        clearSession();
      }
    });

    return () => unsubscribe?.();
  }, [clearSession, setGuestMode, setUser]);

  return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
