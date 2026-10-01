/* Event-first application routes and provider composition. */
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import Events from './pages/Events';
import Insights from './pages/Insights';
import PlaceholderPage from './pages/PlaceholderPage';
import EventWorkspaceShell from './features/events/components/EventWorkspaceShell';
import Financials from './pages/Financials';
import Income from './pages/Income';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import useAppStore from './store/useAppStore';

function GlobalToast() {
  const toast = useAppStore((state) => state.toast);
  const hideToast = useAppStore((state) => state.hideToast);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => hideToast(), 1200);
    return () => window.clearTimeout(id);
  }, [toast, hideToast]);

  if (!toast) return null;

  return (
    <div className="app-toast" data-tone={toast.type || 'success'}>
      {toast.message}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GuestProvider>
        <GlobalToast />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="events" element={<Events />} />
            <Route path="activities" element={<Navigate to="/events" replace />} />
            <Route path="insights" element={<Insights />} />
            <Route path="events/:eventId" element={<EventWorkspaceShell />} />
            <Route path="events/:eventId/overview" element={<EventWorkspaceShell />} />
            <Route path="events/:eventId/activities" element={<EventWorkspaceShell />} />
            <Route path="events/:eventId/timeline" element={<EventWorkspaceShell />} />
            <Route path="events/:eventId/memories" element={<EventWorkspaceShell />} />
            <Route path="events/:eventId/attachments" element={<EventWorkspaceShell />} />
            <Route path="events/:eventId/pdf" element={<EventWorkspaceShell />} />
            <Route path="financials" element={<Financials />}>
              <Route path="income" element={<Income />} />
              <Route path="expenses" element={<Expenses />} />
            </Route>
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GuestProvider>
    </AuthProvider>
  );
}
