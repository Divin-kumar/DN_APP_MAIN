/*
  This file is the central router for the app.
  It decides which page should show for each URL and ensures that only valid users
  can enter protected screens such as the dashboard and financial areas.

  In simple language:
  this is the app's navigation map.
  It tells the app: "if the user opens /login, show login page; if they open /events,
  show the events section; if they open any unknown page, send them home."
*/
import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { Check, CircleAlert } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import ProtectedRoute from './routes/ProtectedRoute';
import useOfflineStatus from './hooks/useOfflineStatus';
import LoadingSkeleton from './components/common/LoadingSkeleton';
import useAppStore from './store/useAppStore';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const loadDashboardHome = () => import('./pages/DashboardHome');
const DashboardHome = lazy(loadDashboardHome);
const DashboardLayout = lazy(() => {
  if (['/', '/dashboard'].includes(window.location.pathname)) void loadDashboardHome().catch(() => {});
  return import('./layouts/DashboardLayout');
});
const Events = lazy(() => import('./pages/Events'));
const Activities = lazy(() => import('./pages/Activities'));
const IndependentTasks = lazy(() => import('./pages/IndependentTasks'));
const ActivityDetail = lazy(() => import('./features/activities/ActivityDetail'));
const Insights = lazy(() => import('./pages/Insights'));
const EventWorkspaceShell = lazy(() => import('./features/events/components/EventWorkspaceShell'));
const Financials = lazy(() => import('./pages/Financials'));
const Settings = lazy(() => import('./pages/Settings'));
const DataBackup = lazy(() => import('./pages/DataBackup'));
const CodeLists = lazy(() => import('./pages/CodeLists'));
const ListDefaults = lazy(() => import('./pages/ListDefaults'));
const About = lazy(() => import('./pages/About'));
const APP_VERSION = String(import.meta.env.VITE_APP_VERSION || 'dev');
const CHUNK_RELOAD_KEY = `dn-chunk-reload:${APP_VERSION}`;

function isRouteDownloadError(error) {
  return /chunk|dynamically imported module|module script|fetch.*module|loading css|preload.*css|failed to fetch|networkerror|load failed/i.test(String(error?.message || error));
}

function RouteFailure({ error }) {
  const shell = useOutletContext();
  const Container = shell ? 'section' : 'main';
  const Heading = shell?.hasPageHeading ? 'h2' : 'h1';
  const offline = useOfflineStatus();
  const [failedOffline] = useState(() => !navigator.onLine && isRouteDownloadError(error));
  const needsConnection = offline && isRouteDownloadError(error);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return (
    <Container className="route-error-screen" aria-labelledby="dn-route-failure">
      <div className="route-error-card">
        <Heading id="dn-route-failure" ref={heading} tabIndex={-1}>{needsConnection ? 'This screen isn’t available offline' : 'This page couldn’t load'}</Heading>
        <p role="status">{needsConnection ? 'Go to Home to keep using DN. Reconnect to open this screen.'
          : failedOffline ? 'You’re back online. Retry to open this screen.' : 'Try opening this screen again, or go to Home.'}</p>
        {!(needsConnection || failedOffline) && <details className="route-error-details">
          <summary>Technical details</summary>
          <code>{error?.name || 'Error'}: {error?.message || 'Unknown rendering error'}</code>
        </details>}
        <div className="route-error-actions">
          <a className={needsConnection ? 'primaryButton' : 'secondaryButton'} href="/dashboard">Go to Home</a>
          <button type="button" className={needsConnection ? 'secondaryButton' : 'primaryButton'} disabled={needsConnection}
            onClick={() => window.location.reload()}>Retry this screen</button>
        </div>
      </div>
    </Container>
  );
}

class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('A route failed to render:', error);
    if (!navigator.onLine || !isRouteDownloadError(error)) return;
    try {
      // Nested boundaries mount independently. Bound automatic reloads across the entire tab.
      const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
      if (Date.now() - lastReload < 60000) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
    } catch {
      // Manual recovery remains available when session storage is blocked.
    }
  }

  render() {
    return this.state.error ? <RouteFailure error={this.state.error} /> : this.props.children;
  }
}

const loadScreen = (screen, label) => (
  <Suspense fallback={<LoadingSkeleton rows={4} label={`Loading ${label}`} />}>
    <RouteErrorBoundary>{screen}</RouteErrorBoundary>
  </Suspense>
);

// GlobalToast is a small popup used for simple success/error notifications
// such as “Expense saved” or “Login failed.”
// It reads from the shared app store and disappears automatically after a short time.
function GlobalToast() {
  const toast = useAppStore((state) => state.toast);
  const hideToast = useAppStore((state) => state.hideToast);
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const [toastHovered, setToastHovered] = useState(false);
  const [toastFocused, setToastFocused] = useState(false);

  // Action feedback must not disappear while someone is reading it with a
  // pointer or navigating to its button with a keyboard.
  useEffect(() => {
    const element = toastRef.current;
    setToastHovered(Boolean(toast?.action?.label && element?.matches(':hover')));
    setToastFocused(Boolean(toast?.action?.label && element?.contains(document.activeElement)));
  }, [toast]);
  useEffect(() => {
    if (!toast || (toast.action?.label && (toastHovered || toastFocused))) return undefined;
    const id = window.setTimeout(() => hideToast(), toast.duration || 2600);
    return () => window.clearTimeout(id);
  }, [toast, hideToast, toastHovered, toastFocused]);

  if (!toast) return null;

  const handleAction = () => {
    const destination = toast.action?.to;
    const onClick = toast.action?.onClick;
    hideToast();
    onClick?.();
    if (destination) navigate(destination);
  };

  return (
    <div ref={toastRef} className="app-toast" data-tone={toast.type || 'success'} role={toast.type === 'danger' || toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'danger' || toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true"
      onMouseEnter={() => { if (toast.action?.label) setToastHovered(true); }}
      onMouseLeave={() => setToastHovered(false)}
      onFocusCapture={() => { if (toast.action?.label) setToastFocused(true); }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setToastFocused(false); }}>
      <span className="app-toast-icon" aria-hidden="true">{toast.type === 'danger' || toast.type === 'error' ? <CircleAlert size={17} /> : <Check size={17} />}</span>
      <span className="app-toast-message">{toast.message}</span>
      {toast.action?.label ? <button className="app-toast-action" type="button" onClick={handleAction}>{toast.action.label}</button> : null}
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
                {loadScreen(<DashboardLayout />, 'workspace')}
              </ProtectedRoute>
            }
          >
            <Route index element={loadScreen(<DashboardHome />, 'dashboard')} />
            <Route path="dashboard" element={loadScreen(<DashboardHome />, 'dashboard')} />
            <Route path="events" element={loadScreen(<Events />, 'moments')} />
            <Route path="activities" element={loadScreen(<Activities />, 'activities')} />
            <Route path="tasks" element={loadScreen(<IndependentTasks />, 'tasks')} />
            <Route path="insights" element={loadScreen(<Insights />, 'insights')} />

            {/* Each event has its own workspace and sub-pages for overview, activities, transactions, etc. */}
            <Route path="events/:eventId" element={loadScreen(<EventWorkspaceShell />, 'moment')} />
            <Route path="events/:eventId/story" element={loadScreen(<EventWorkspaceShell />, 'moment')} />
            <Route path="events/:eventId/gallery" element={loadScreen(<EventWorkspaceShell />, 'moment')} />
            <Route path="events/:eventId/overview" element={loadScreen(<EventWorkspaceShell />, 'moment')} />
            <Route path="events/:eventId/activities" element={loadScreen(<EventWorkspaceShell />, 'activities')} />
            <Route path="events/:eventId/activities/:activityId" element={loadScreen(<ActivityDetail />, 'activity')} />
            <Route path="events/:eventId/transactions" element={loadScreen(<EventWorkspaceShell />, 'transactions')} />
            <Route path="events/:eventId/timeline" element={loadScreen(<EventWorkspaceShell />, 'moment')} />
            <Route path="events/:eventId/memories" element={loadScreen(<EventWorkspaceShell />, 'memories')} />
            <Route path="events/:eventId/attachments" element={loadScreen(<EventWorkspaceShell />, 'attachments')} />
            <Route path="events/:eventId/pdf" element={loadScreen(<EventWorkspaceShell />, 'document')} />

            <Route path="financials" element={loadScreen(<Financials />, 'financials')} />
            <Route path="financials/transactions" element={loadScreen(<Financials />, 'transactions')} />
            {/* Preserve existing bookmarks without exposing duplicate modules. */}
            <Route path="financials/income" element={<Navigate to="/financials/transactions" replace />} />
            <Route path="financials/expenses" element={<Navigate to="/financials/transactions" replace />} />
            <Route path="settings" element={loadScreen(<Settings />, 'settings')} />
            <Route path="settings/appearance" element={loadScreen(<Settings appearanceOnly />, 'appearance and preferences')} />
            <Route path="settings/data-backup" element={loadScreen(<DataBackup />, 'data and backup')} />
            <Route path="settings/code-lists" element={loadScreen(<CodeLists />, 'code lists')} />
            <Route path="settings/list-defaults" element={loadScreen(<ListDefaults />, 'list defaults')} />
            <Route path="settings/about" element={loadScreen(<About />, 'about')} />
          </Route>

          {/* If a user types an unknown URL, send them to home. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GuestProvider>
    </AuthProvider>
  );
}
