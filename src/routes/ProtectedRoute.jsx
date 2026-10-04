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
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const authReady = useAppStore((state) => state.authReady);
  const persistentReady = useAppStore((state) => state.persistentReady);
  const persistenceError = useAppStore((state) => state.persistenceError);
  const setUser = useAppStore((state) => state.setUser);
  const setGuestMode = useAppStore((state) => state.setGuestMode);
  const location = useLocation();

  // Wait until auth state has loaded before deciding if the user can enter a protected page.
  if (!authReady) {
    return <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}><LoadingSkeleton rows={4} label="Preparing DN" /></main>;
  }

  // If there is no real user and no guest session, redirect to login.
  if (!user && !isGuest) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!persistentReady) {
    if (persistenceError) {
      return (
        <main role="alert" style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
          <h1>Local data is unavailable</h1>
          <p>LifeHub could not open its local database. Your saved records were not changed.</p>
          <button type="button" className="primaryButton" onClick={() => {
            if (user) void setUser(user);
            else void setGuestMode(true);
          }}>Retry</button>
        </main>
      );
    }
    return <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}><LoadingSkeleton rows={4} label="Loading local data" /></main>;
  }

  return children;
}
