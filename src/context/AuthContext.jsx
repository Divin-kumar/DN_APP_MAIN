import { createContext, useContext, useEffect, useMemo } from 'react';
import useAppStore from '../store/useAppStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const principal = useAppStore((state) => state.principal);
  const principalReady = useAppStore((state) => state.principalReady);
  const migrationCandidates = useAppStore((state) => state.migrationCandidates);
  const persistentReady = useAppStore((state) => state.persistentReady);
  const persistenceError = useAppStore((state) => state.persistenceError);
  const bootstrapDevicePrincipal = useAppStore((state) => state.bootstrapDevicePrincipal);

  useEffect(() => {
    void bootstrapDevicePrincipal().catch((error) => console.error('Unable to initialize local device data:', error));
  }, [bootstrapDevicePrincipal]);

  const value = useMemo(() => ({
    principal,
    principalReady,
    migrationCandidates,
    persistentReady,
    persistenceError,
    bootstrapDevicePrincipal,
  }), [principal, principalReady, migrationCandidates, persistentReady, persistenceError, bootstrapDevicePrincipal]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
