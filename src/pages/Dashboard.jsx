/* Legacy dashboard shell retained for compatibility with the migration route surface. */
import useAppStore from '../store/useAppStore';

export default function Dashboard() {
  const principal = useAppStore((state) => state.principal);

  return (
    <div style={styles.appShell}>
      <header style={styles.header}>
        <div style={styles.topBarLeft}>
          <button style={styles.menuButton} aria-label="Open navigation">☰</button>
          <div>
            <div style={styles.eyebrow}>Workspace</div>
            <h1 style={styles.title}>DN</h1>
          </div>
        </div>

        <div style={styles.userSection}>
          <span style={styles.userName}>{principal?.deviceName || 'This device'}</span>
        </div>
      </header>

      <main style={styles.mainContent}>
        <aside style={styles.sidebar}>
          <div style={styles.navCard}>Dashboard</div>
          <div style={styles.navCard}>Expenses</div>
          <div style={styles.navCard}>Income</div>
          <div style={styles.navCard}>Events</div>
          <div style={styles.navCard}>Settings</div>
        </aside>

        <section style={styles.contentPane}>
          <div style={styles.banner}>
            Your data is stored locally on this device.
          </div>

          <div style={styles.placeholderCard}>
            <h2 style={styles.placeholderTitle}>Dashboard Shell Ready</h2>
            <p style={styles.placeholderText}>
              DN is ready for this device.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  appShell: {
    minHeight: '100vh',
    background: 'var(--canvas)',
    color: 'var(--ink)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    padding: '16px 24px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  menuButton: {
    background: '#edf6ef',
    border: 'none',
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    fontSize: '1.25rem',
    cursor: 'pointer',
  },
  eyebrow: {
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-soft)',
  },
  title: {
    margin: 0,
    fontSize: '1.7rem',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  userName: {
    fontWeight: 600,
  },
  logoutButton: {
    background: '#2d6a4f',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  mainContent: {
    display: 'flex',
    minHeight: 'calc(100vh - 82px)',
  },
  sidebar: {
    width: '220px',
    background: 'var(--surface-soft)',
    borderRight: '1px solid var(--border)',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  navCard: {
    padding: '14px 12px',
    background: 'var(--surface)',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    fontWeight: 600,
  },
  contentPane: {
    flex: 1,
    padding: '22px',
  },
  banner: {
    background: 'var(--primary-soft)',
    border: '1px solid var(--border)',
    color: 'var(--ink)',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '18px',
    fontWeight: 500,
  },
  placeholderCard: {
    background: 'var(--surface)',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 10px 30px rgba(47, 70, 58, 0.06)',
  },
  placeholderTitle: {
    marginTop: 0,
    marginBottom: '8px',
    fontSize: '1.5rem',
  },
  placeholderText: {
    margin: 0,
    color: 'var(--ink-soft)',
    lineHeight: 1.6,
  },
};
