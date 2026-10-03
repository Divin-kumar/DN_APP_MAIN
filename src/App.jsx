/*
  This file is the central router for the app.
  It decides which page should show for each URL and ensures that only valid users
  can enter protected screens such as the dashboard and financial areas.

  In simple language:
  this is the app's navigation map.
  It tells the app: "if the user opens /login, show login page; if they open /events,
  show the events section; if they open any unknown page, send them home."
*/
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoadingSkeleton from './components/common/LoadingSkeleton';
import useAppStore from './store/useAppStore';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const Events = lazy(() => import('./pages/Events'));
const Insights = lazy(() => import('./pages/Insights'));
const EventWorkspaceShell = lazy(() => import('./features/events/components/EventWorkspaceShell'));
const Financials = lazy(() => import('./pages/Financials'));
const Income = lazy(() => import('./pages/Income'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Settings = lazy(() => import('./pages/Settings'));
const CodeLists = lazy(() => import('./pages/CodeLists'));
const About = lazy(() => import('./pages/About'));

const loadScreen = (screen, label) => (
  <Suspense fallback={<LoadingSkeleton rows={4} label={`Loading ${label}`} />}>
    {screen}
  </Suspense>
);

// GlobalToast is a small popup used for simple success/error notifications
// such as “Expense saved” or “Login failed.”
// It reads from the shared app store and disappears automatically after a short time.
function GlobalToast() {
  const toast = useAppStore((state) => state.toast);
  const hideToast = useAppStore((state) => state.hideToast);

  // If a toast exists, remove it automatically after 1.2 seconds.
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
    // Authentication and guest session wrappers sit at the top level.
    <AuthProvider>
      <GuestProvider>
        <GlobalToast />
        <Routes>
          {/* Public route: anyone can view the login screen. */}
          <Route path="/login" element={loadScreen(<LoginPage />, 'sign in')} />

          {/* This parent route wraps all logged-in screens and uses the protected guard. */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={loadScreen(<DashboardHome />, 'dashboard')} />
            <Route path="dashboard" element={loadScreen(<DashboardHome />, 'dashboard')} />
            <Route path="events" element={loadScreen(<Events />, 'moments')} />
            <Route path="activities" element={<Navigate to="/events" replace />} />
            <Route path="insights" element={loadScreen(<Insights />, 'insights')} />

            {/* Each event has its own workspace and sub-pages for overview, activities, timeline, etc. */}
            <Route path="events/:eventId" element={loadScreen(<EventWorkspaceShell />, 'moment')} />
            <Route path="events/:eventId/overview" element={loadScreen(<EventWorkspaceShell />, 'moment')} />
            <Route path="events/:eventId/activities" element={loadScreen(<EventWorkspaceShell />, 'activities')} />
            <Route path="events/:eventId/timeline" element={loadScreen(<EventWorkspaceShell />, 'timeline')} />
            <Route path="events/:eventId/memories" element={loadScreen(<EventWorkspaceShell />, 'memories')} />
            <Route path="events/:eventId/attachments" element={loadScreen(<EventWorkspaceShell />, 'attachments')} />
            <Route path="events/:eventId/pdf" element={loadScreen(<EventWorkspaceShell />, 'document')} />

            <Route path="financials" element={loadScreen(<Financials />, 'financials')}>
              <Route path="income" element={loadScreen(<Income />, 'income')} />
              <Route path="expenses" element={loadScreen(<Expenses />, 'expenses')} />
            </Route>
            <Route path="settings" element={loadScreen(<Settings />, 'settings')} />
            <Route path="settings/code-lists" element={loadScreen(<CodeLists />, 'code lists')} />
            <Route path="settings/about" element={loadScreen(<About />, 'about')} />
          </Route>

          {/* If a user types an unknown URL, send them to home. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GuestProvider>
    </AuthProvider>
  );
}
