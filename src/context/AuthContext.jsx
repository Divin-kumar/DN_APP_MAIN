/* Bridges Firebase auth state into the application session store. */
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
    const unsubscribe = authService.onAuthChange((user) => {
      if (user) {
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
        setGuestMode(true);
      } else {
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
