/* Event-first app shell for dashboard and workspace navigation. */
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, ChevronDown, LayoutDashboard, LogOut, Menu, Settings, UserCircle, WalletCards } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Events', path: '/events', icon: CalendarDays },
  { label: 'Financials', path: '/financials', icon: WalletCards },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function DashboardLayout() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { exitGuestMode } = useGuest();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [avatarError, setAvatarError] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
  }, []);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  const profileName = user?.displayName || user?.email || 'Guest';
  const initials = profileName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'G';

  const handleLogout = async () => {
    try {
      if (isGuest) {
        exitGuestMode();
        window.location.href = '/login';
        return;
      }

      await authService.signOutUser();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="lifehub-shell" style={styles.appShell}>
      <header className="lifehub-header" style={styles.header}>
        <div style={styles.topBarLeft}>
          <button
            className="menu-button"
            style={styles.menuButton}
            aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <Menu size={19} strokeWidth={2.2} />
          </button>
          <div>
            <div style={styles.eyebrow}>Workspace</div>
            <h1 style={styles.title}>LifeHub</h1>
          </div>
        </div>

        <div style={styles.userSection}>
          {user?.photoURL && !avatarError ? (
            <img
              className="avatar"
              src={user.photoURL}
              alt="User profile"
              style={styles.avatar}
              onError={() => setAvatarError(true)}
            />
          ) : <span className="avatar avatar-fallback" aria-label="User profile">{initials}</span>}
          <div className="profile-menu-wrap">
            <button className="profile-trigger" type="button" onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen} aria-haspopup="menu">
              <span className="user-name" style={styles.userName}>{profileName}</span>
              <ChevronDown size={15} />
            </button>
            {profileMenuOpen ? (
              <div className="profile-menu" role="menu">
                <NavLink to="/settings" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><UserCircle size={16} /> Profile</NavLink>
                <NavLink to="/settings" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><Settings size={16} /> Settings</NavLink>
                <button type="button" className="profile-menu-item profile-menu-danger" role="menuitem" onClick={handleLogout}><LogOut size={16} /> Logout</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="lifehub-main" style={styles.mainContent}>
        <aside
          className={`lifehub-sidebar ${sidebarCollapsed ? 'lifehub-sidebar-collapsed' : ''}`}
          style={{ ...styles.sidebar, ...(sidebarCollapsed ? styles.sidebarCollapsed : {}) }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => { if (window.matchMedia('(max-width: 760px)').matches) setSidebarCollapsed(true); }}
              end={item.path === '/dashboard'}
                className="lifehub-nav-link"
                style={({ isActive }) => ({
                ...styles.navCard,
                ...(isActive ? styles.navCardActive : {}),
              })}
            >
              <span className="lifehub-nav-icon" aria-hidden="true"><item.icon size={18} strokeWidth={2} /></span>
              <span className="lifehub-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </aside>

        {!sidebarCollapsed ? <button className="mobile-nav-overlay" type="button" aria-label="Close navigation" onClick={() => setSidebarCollapsed(true)} /> : null}

        <section className="lifehub-content" style={styles.contentPane}>
          <div className="lifehub-banner" style={styles.banner}>
            {isGuest
              ? 'Guest mode active. Your data is stored locally on this device.'
              : 'Authenticated mode active. Your data is synced with Firebase.'}
          </div>

          <Outlet />
        </section>
      </main>
    </div>
  );
}

const styles = {
  appShell: {
    minHeight: '100vh',
    background: '#f2f7f3',
    color: '#1d3f2c',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#ffffff',
    borderBottom: '1px solid #dfeae3',
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
    color: '#6a7d71',
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
    background: '#edf6ef',
    borderRight: '1px solid #dfeae3',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  navCard: {
    display: 'block',
    padding: '14px 12px',
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #dfeae3',
    fontWeight: 600,
    color: '#1d3f2c',
    textDecoration: 'none',
  },
  navCardActive: {
    background: '#dff2e5',
    borderColor: '#b7d7c0',
  },
  contentPane: {
    flex: 1,
    padding: '22px',
  },
  banner: {
    background: '#dff2e5',
    border: '1px solid #badbc1',
    color: '#1d3f2c',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '18px',
    fontWeight: 500,
  },
};
