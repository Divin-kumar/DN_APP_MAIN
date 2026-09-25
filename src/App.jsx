/* Event-first application routes and provider composition. */
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import Events from './pages/Events';
import PlaceholderPage from './pages/PlaceholderPage';
import EventWorkspaceShell from './features/events/components/EventWorkspaceShell';
import Financials from './pages/Financials';
import Income from './pages/Income';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <GuestProvider>
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
