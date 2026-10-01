/* Event-first app shell for dashboard and workspace navigation. */
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronDown, LayoutDashboard, ListChecks, LogOut, Moon, Plus, Receipt, Settings, Sun, UserCircle, WalletCards, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';
import ModalDialog from '../components/common/ModalDialog';
import EventForm from '../components/events/EventForm';
import DropdownSelect from '../components/common/DropdownSelect';
import ExpenseForm from '../components/expenses/ExpenseForm';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';

// These are the main screens in the application.
// The app keeps the navigation consistent across desktop and mobile layouts.
const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Events', path: '/events', icon: CalendarDays },
  { label: 'Financials', path: '/financials', icon: WalletCards },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function DashboardLayout() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const theme = useAppStore((state) => state.preferences.theme || 'light');
  const setPreferences = useAppStore((state) => state.setPreferences);
  const showToast = useAppStore((state) => state.showToast);
  const { events, loadEvents, addEvent, updateEventItem } = useEventStore();
  const { loadExpenses, addExpense } = useExpenseStore();
  const { exitGuestMode } = useGuest();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [avatarError, setAvatarError] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateDesktopRef = useRef(null);
  const quickCreateMobileRef = useRef(null);
  const [quickCreateType, setQuickCreateType] = useState(null);
  const [quickCreateError, setQuickCreateError] = useState('');
  const [quickActivityEventId, setQuickActivityEventId] = useState('');
  const [quickActivityTitle, setQuickActivityTitle] = useState('');
  const [quickActivityDate, setQuickActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [quickActivityPriority, setQuickActivityPriority] = useState('medium');
  const [quickActivityDescription, setQuickActivityDescription] = useState('');

  // Apply the saved theme to the page root so colors change across the whole app.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // The sidebar narrows itself on smaller screens to save space.
  const sidebarWidth = sidebarCollapsed ? 88 : 240;

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    const closeProfileMenuOutside = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    const closeProfileMenuOnEscape = (event) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeProfileMenuOutside);
    document.addEventListener('keydown', closeProfileMenuOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeProfileMenuOutside);
      document.removeEventListener('keydown', closeProfileMenuOnEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    setProfileMenuOpen(false);
    setQuickCreateOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!quickCreateOpen) return undefined;

    const closeQuickCreateOutside = (event) => {
      const clickedInsideDesktop = quickCreateDesktopRef.current?.contains(event.target);
      const clickedInsideMobile = quickCreateMobileRef.current?.contains(event.target);
      if (!clickedInsideDesktop && !clickedInsideMobile) setQuickCreateOpen(false);
    };
    const closeQuickCreateOnEscape = (event) => {
      if (event.key === 'Escape') setQuickCreateOpen(false);
    };

    document.addEventListener('pointerdown', closeQuickCreateOutside);
    document.addEventListener('keydown', closeQuickCreateOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeQuickCreateOutside);
      document.removeEventListener('keydown', closeQuickCreateOnEscape);
    };
  }, [quickCreateOpen]);

  useEffect(() => {
    if (!quickCreateType || (!user && !isGuest)) return;
    if ((quickCreateType === 'activity' || quickCreateType === 'expense') && !events.length) loadEvents(user?.uid, isGuest);
    if (quickCreateType === 'expense') loadExpenses(user?.uid, isGuest);
  }, [quickCreateType, user, isGuest, events.length, loadEvents, loadExpenses]);

  // Build a readable profile label shown in the top bar.
  const profileName = user?.displayName || user?.email || 'Guest';
  const initials = profileName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'G';

  // Logout should behave differently for guest accounts and real accounts.
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

  // Quick create opens a lightweight modal for common tasks without leaving the page.
  const beginQuickCreate = (type) => {
    setQuickCreateOpen(false);
    setQuickCreateError('');
    setQuickCreateType(type);
    if (type === 'activity') {
      setQuickActivityEventId('');
      setQuickActivityTitle('');
      setQuickActivityDate(new Date().toISOString().slice(0, 10));
      setQuickActivityPriority('medium');
      setQuickActivityDescription('');
    }
  };

  // Save newly created life moments and open the event page right after.
  const saveQuickEvent = async (formData) => {
    try {
      const event = await addEvent(user?.uid, isGuest, { ...formData, activities: [] });
      setQuickCreateType(null);
      showToast('Life moment saved', 'success');
      navigate(`/events/${event.id || event.firestoreId}`);
    } catch {
      setQuickCreateError('Could not save this life moment. Please try again.');
    }
  };

  // Save the new expense and redirect to the expense list to keep the flow intuitive.
  const saveQuickExpense = async (formData) => {
    try {
      await addExpense(user?.uid, isGuest, formData);
      setQuickCreateType(null);
      showToast('Expense saved', 'success');
      navigate('/financials/expenses');
    } catch {
      setQuickCreateError('Could not save this expense. Please try again.');
    }
  };

  // Add a task-like activity under an existing life moment.
  const saveQuickActivity = async (submitEvent) => {
    submitEvent.preventDefault();
    const event = events.find((item) => (item.id || item.firestoreId) === quickActivityEventId);
    if (!event || !quickActivityTitle.trim()) {
      setQuickCreateError('Choose a life moment and enter an activity title.');
      return;
    }
    try {
      const activity = {
        id: crypto.randomUUID(),
        eventId: event.id || event.firestoreId,
        title: quickActivityTitle.trim(),
        description: quickActivityDescription.trim(),
        date: quickActivityDate,
        priority: quickActivityPriority,
        completed: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
      };
      await updateEventItem(user?.uid, isGuest, { ...event, activities: [...(event.activities || []), activity] });
      setQuickCreateType(null);
      showToast('Activity saved', 'success');
      navigate(`/events/${activity.eventId}/activities`);
    } catch {
      setQuickCreateError('Could not save this activity. Please try again.');
    }
  };

  // The layout wraps every protected page in a consistent shell:
  // top header, left navigation, content area, and floating quick-create panel.
  return (
    <div className="lifehub-shell" style={styles.appShell}>
      <header className="lifehub-header" style={styles.header}>
        <div className="brand-lockup" aria-label="DN · Personal Experience">
          <span className="brand-mark" aria-hidden="true">DN</span>
          <span className="brand-lockup-title">Personal Experience</span>
        </div>

        <div className="header-user-controls" style={styles.userSection}>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setPreferences({ theme: theme === 'dark' ? 'light' : 'dark' })}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div ref={profileMenuRef} className="profile-menu-wrap">
            <button className="profile-trigger" type="button" onClick={() => setProfileMenuOpen((open) => !open)} aria-label="Open profile and account menu" aria-expanded={profileMenuOpen} aria-haspopup="menu">
              {user?.photoURL && !avatarError ? (
                <img className="avatar" src={user.photoURL} alt="" style={styles.avatar} onError={() => setAvatarError(true)} />
              ) : <span className="avatar avatar-fallback" aria-hidden="true">{initials}</span>}
              <span className="user-name" style={styles.userName}>{profileName}</span>
              <ChevronDown size={15} />
            </button>
            {profileMenuOpen ? (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-account"><strong>{profileName}</strong><span>{isGuest ? 'Guest account' : user?.email || 'DN account'}</span></div>
                <NavLink to="/settings#profile" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><UserCircle size={16} /> Profile</NavLink>
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
          style={{
            ...styles.sidebar,
            width: `${sidebarWidth}px`,
            minWidth: `${sidebarWidth}px`,
            ...(sidebarCollapsed ? styles.sidebarCollapsed : {}),
          }}
        >
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
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

          <motion.div
            key={location.pathname}
            className="lifehub-route-transition"
            initial={{ opacity: 0.94, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </section>
      </main>

      <nav className="mobile-tabbar" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) => `mobile-tab${isActive ? ' mobile-tab-active' : ''}`}
            aria-label={item.label}
          >
            <item.icon size={19} strokeWidth={2} aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div ref={quickCreateMobileRef} className={`mobile-dock-create${quickCreateOpen ? ' is-open' : ''}`}>
          {quickCreateOpen ? (
            <div className="mobile-dock-create-menu" aria-label="Quick create actions">
              <button type="button" onClick={() => beginQuickCreate('event')}><CalendarDays size={17} /><span>Life moment</span></button>
              <button type="button" onClick={() => beginQuickCreate('activity')}><ListChecks size={17} /><span>Activity</span></button>
              <button type="button" onClick={() => beginQuickCreate('expense')}><Receipt size={17} /><span>Expense</span></button>
            </div>
          ) : null}
          <button type="button" className="mobile-dock-create-trigger" onClick={() => setQuickCreateOpen((open) => !open)} aria-label={quickCreateOpen ? 'Close quick create menu' : 'Open quick create menu'} aria-expanded={quickCreateOpen}>
            {quickCreateOpen ? <X size={20} /> : <Plus size={21} />}
          </button>
        </div>
      </nav>

      <div ref={quickCreateDesktopRef} className={`lifehub-quick-create${quickCreateOpen ? ' is-open' : ''}`}>
        {quickCreateOpen ? (
          <div className="lifehub-quick-create-menu" aria-label="Quick create actions">
            <button type="button" onClick={() => beginQuickCreate('event')}><CalendarDays size={17} /><span>Life moment</span></button>
            <button type="button" onClick={() => beginQuickCreate('activity')}><ListChecks size={17} /><span>Activity</span></button>
            <button type="button" onClick={() => beginQuickCreate('expense')}><Receipt size={17} /><span>Expense</span></button>
          </div>
        ) : null}
        <button type="button" className="lifehub-quick-create-trigger" onClick={() => setQuickCreateOpen((open) => !open)} aria-label={quickCreateOpen ? 'Close quick create menu' : 'Open quick create menu'} aria-expanded={quickCreateOpen}>
          {quickCreateOpen ? <X size={21} /> : <Plus size={22} />}
        </button>
      </div>

      {quickCreateType === 'event' ? (
        <ModalDialog title="Create a life moment" onClose={() => setQuickCreateType(null)}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <EventForm onSubmit={saveQuickEvent} onCancel={() => setQuickCreateType(null)} submitLabel="Save moment" />
        </ModalDialog>
      ) : null}
      {quickCreateType === 'expense' ? (
        <ModalDialog title="Add an expense" onClose={() => setQuickCreateType(null)}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <ExpenseForm events={events} onSubmit={saveQuickExpense} onCancel={() => setQuickCreateType(null)} submitLabel="Save expense" />
        </ModalDialog>
      ) : null}
      {quickCreateType === 'activity' ? (
        <ModalDialog title="Add an activity" onClose={() => setQuickCreateType(null)}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <form className="form-surface quick-create-activity-form" onSubmit={saveQuickActivity}>
            <DropdownSelect value={quickActivityEventId} onChange={(event) => setQuickActivityEventId(event.target.value)} aria-label="Life moment" placeholder="Choose a life moment">
              <option value="">Choose a life moment</option>
              {events.map((event) => <option key={event.id || event.firestoreId} value={event.id || event.firestoreId}>{event.name || 'Untitled moment'}</option>)}
            </DropdownSelect>
            <input value={quickActivityTitle} onChange={(event) => setQuickActivityTitle(event.target.value)} placeholder="Activity title" aria-label="Activity title" autoFocus />
            <input type="date" value={quickActivityDate} onChange={(event) => setQuickActivityDate(event.target.value)} aria-label="Activity date" />
            <DropdownSelect value={quickActivityPriority} onChange={(event) => setQuickActivityPriority(event.target.value)} aria-label="Activity priority"><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></DropdownSelect>
            <textarea value={quickActivityDescription} onChange={(event) => setQuickActivityDescription(event.target.value)} placeholder="Description (optional)" aria-label="Activity description" rows={3} />
            <div className="form-actions"><button className="primaryButton" type="submit">Save activity</button><button className="secondaryButton" type="button" onClick={() => setQuickCreateType(null)}>Cancel</button></div>
          </form>
        </ModalDialog>
      ) : null}
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
    minWidth: '220px',
    background: '#edf6ef',
    borderRight: '1px solid #dfeae3',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'width 220ms ease, min-width 220ms ease, padding 220ms ease',
  },
  sidebarCollapsed: {
    paddingLeft: '10px',
    paddingRight: '10px',
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
    border: '1px solid #b7d7c0',
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
