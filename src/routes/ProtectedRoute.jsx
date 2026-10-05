/*
  Protects routes so only logged-in users or guest users can access the app.
  This works like a lock on the front door: if no valid session exists, redirect to login.

  In simple language:
  this component says: "Before letting the user see the main app, confirm they are signed in or browsing as guest.
  If not, send them back to the login screen."
*/
import { Navigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import LoadingSkeleton from '../components/common/LoadingSkeleton';

export default function ProtectedRoute({ children }) {
  const principal = useAppStore((state) => state.principal);
  const principalReady = useAppStore((state) => state.principalReady);
  const persistentReady = useAppStore((state) => state.persistentReady);
  const persistenceError = useAppStore((state) => state.persistenceError);
  const bootstrapDevicePrincipal = useAppStore((state) => state.bootstrapDevicePrincipal);
  const location = useLocation();

  if (!principalReady) {
    return <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}><LoadingSkeleton rows={4} label="Preparing this device" /></main>;
  }

  if (!principal) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!persistentReady) {
    if (persistenceError) {
      return (
        <main role="alert" style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
          <h1>Local data is unavailable</h1>
          <p>DN could not open its local database. Your saved records were not changed.</p>
          <button type="button" className="primaryButton" onClick={() => void bootstrapDevicePrincipal().catch(() => {})}>Retry</button>
        </main>
      );
    }
    return <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}><LoadingSkeleton rows={4} label="Loading local data" /></main>;
  }

  return children;
}
