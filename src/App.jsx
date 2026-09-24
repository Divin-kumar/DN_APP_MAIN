import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GuestProvider } from './context/GuestContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import Expenses from './pages/Expenses';
import Income from './pages/Income';
import Events from './pages/Events';
import PlaceholderPage from './pages/PlaceholderPage';

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
            <Route path="expenses" element={<Expenses />} />
            <Route path="income" element={<Income />} />
            <Route path="events" element={<Events />} />
            <Route path="settings" element={<PlaceholderPage title="Settings" />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GuestProvider>
    </AuthProvider>
  );
}
