// This is the home landing page after login.
// It simply renders the dashboard overview component, which contains the main summary cards and insight widgets.
import DashboardOverview from '../features/dashboard/components/DashboardOverview';

export default function DashboardHome() {
  return (
    <div className="dashboard-page dashboard-page-shell">
      <DashboardOverview />
    </div>
  );
}
