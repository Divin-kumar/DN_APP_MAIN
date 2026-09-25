/* Legacy dashboard shell retained for compatibility with the migration route surface. */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { exitGuestMode } = useGuest();

  const handleLogout = async () => {
    try {
      if (isGuest) {
        exitGuestMode();
        navigate('/login', { replace: true });
        return;
      }

      await authService.signOutUser();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  useEffect(() => {
    if (!user && !isGuest) {
      navigate('/login', { replace: true });
    }
  }, [user, isGuest, navigate]);

  return (
    <div style={styles.appShell}>
      <header style={styles.header}>
        <div style={styles.topBarLeft}>
          <button style={styles.menuButton} aria-label="Open navigation">☰</button>
          <div>
            <div style={styles.eyebrow}>Workspace</div>
            <h1 style={styles.title}>LifeHub</h1>
          </div>
        </div>

        <div style={styles.userSection}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="User profile" style={styles.avatar} />
          ) : null}
          <span style={styles.userName}>{user?.displayName || 'Guest'}</span>
          <button style={styles.logoutButton} onClick={handleLogout}>
            Logout
          </button>
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
            {isGuest
              ? 'Guest mode active. Your data is stored locally on this device.'
              : 'Authenticated mode active. Your data is synced with Firebase.'}
          </div>

          <div style={styles.placeholderCard}>
            <h2 style={styles.placeholderTitle}>Dashboard Shell Ready</h2>
            <p style={styles.placeholderText}>
              Phase 1 includes auth, guest mode, protected routes, and the layout shell.
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
