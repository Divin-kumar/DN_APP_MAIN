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
  const location = useLocation();

  // Wait until auth state has loaded before deciding if the user can enter a protected page.
  if (!authReady) {
    return <main style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}><LoadingSkeleton rows={4} label="Preparing DN" /></main>;
  }

  // If there is no real user and no guest session, redirect to login.
  if (!user && !isGuest) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
