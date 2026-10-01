/*
  Protects routes so only logged-in users or guest users can access the app.
  This works like a lock on the front door: if no valid session exists, redirect to login.
*/
import { Navigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';

export default function ProtectedRoute({ children }) {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const authReady = useAppStore((state) => state.authReady);
  const location = useLocation();

  // Wait until auth state has loaded before deciding if the user can enter a protected page.
  if (!authReady) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  // If there is no real user and no guest session, redirect to login.
  if (!user && !isGuest) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
