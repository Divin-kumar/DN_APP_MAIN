/* Guards application routes for authenticated and guest sessions. */
import { Navigate, useLocation } from 'react-router-dom';
import useAppStore from '../store/useAppStore';

export default function ProtectedRoute({ children }) {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const authReady = useAppStore((state) => state.authReady);
  const location = useLocation();

  if (!authReady) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!user && !isGuest) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
