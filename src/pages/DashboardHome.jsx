import DashboardOverview from '../features/dashboard/components/DashboardOverview';

export default function DashboardHome() {
  return (
    <div className="dashboard-page" style={{ display: 'grid', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6a7d71' }}>
            Dashboard
          </div>
          <h2 style={{ margin: '8px 0 6px', fontSize: '1.9rem' }}>Your life journey</h2>
          <p style={{ margin: 0, color: '#536a5d' }}>
            Plan what is next, track what is active, and remember what matters.
          </p>
        </div>
      </div>

      <DashboardOverview />
    </div>
  );
}
