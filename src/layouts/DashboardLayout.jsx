/*
  Event-first app shell for dashboard and workspace navigation.

  In simple language:
  this file is the "parent frame" of the whole app after login.
  It contains the top bar, side menu, mobile navigation, theme switch, profile actions,
  and quick-create buttons that let the user create events, activities, and expenses without leaving the page.
*/
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronDown, FileImage, LayoutDashboard, ListChecks, Moon, Plus, Receipt, Settings, Sun, UserCircle, WalletCards, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import ModalDialog from '../components/common/ModalDialog';
import EventForm from '../components/events/EventForm';
import DateField from '../components/common/DateField';
import DropdownSelect from '../components/common/DropdownSelect';
import ExpenseForm from '../components/expenses/ExpenseForm';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import { ACTIVITY_PRIORITY_OPTIONS } from '../utils/codeLists';
import ConnectivityBanner from '../components/common/ConnectivityBanner';

// These are the main screens in the application.
// The app keeps the navigation consistent across desktop and mobile layouts.
const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Events', path: '/events', icon: CalendarDays },
  { label: 'Attachments', path: '/attachments', icon: FileImage },
  { label: 'Financials', path: '/financials', icon: WalletCards },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function DashboardLayout() {
  const principal = useAppStore((state) => state.principal);
  const user = principal ? { uid: principal.principalId, displayName: principal.deviceName } : null;
  const isGuest = false;
  const adminValues = useAppStore((state) => state.adminValues);
  const profile = useAppStore((state) => state.profile);
  const theme = useAppStore((state) => state.preferences.theme || 'light');
  const setPreferences = useAppStore((state) => state.setPreferences);
  const showToast = useAppStore((state) => state.showToast);
  const { events, loadEvents, addEvent, updateEventItem } = useEventStore();
  const { loadExpenses, addExpense } = useExpenseStore();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const contentRef = useRef(null);
  const previousLocationRef = useRef(null);
  const scrollPositionsRef = useRef(new Map());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [avatarError, setAvatarError] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [mobileKeyboardOpen, setMobileKeyboardOpen] = useState(false);
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
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    const themeColor = theme === 'light' ? '#f3f6fb' : '#0b1020';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [theme]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 760px)');
    const handleViewportChange = (event) => {
      setSidebarCollapsed(event.matches);
    };

    handleViewportChange(mobileQuery);

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleViewportChange);
      return () => mobileQuery.removeEventListener('change', handleViewportChange);
    }

    mobileQuery.addListener(handleViewportChange);
    return () => mobileQuery.removeListener(handleViewportChange);
  }, []);

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

  useLayoutEffect(() => {
    const contentNode = contentRef.current;
    if (!contentNode) return;

    const segment = location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
    const currentLocation = {
      key: location.key || location.pathname,
      pathname: location.pathname,
      primaryRoute: ['dashboard', 'events', 'financials', 'insights', 'settings'].includes(segment) ? segment : 'dashboard',
    };
    const previousLocation = previousLocationRef.current;

    if (previousLocation) {
      scrollPositionsRef.current.set(previousLocation.key, contentNode.scrollTop);
      if (scrollPositionsRef.current.size > 80) {
        const oldestKey = scrollPositionsRef.current.keys().next().value;
        scrollPositionsRef.current.delete(oldestKey);
      }
    }

    if (!previousLocation || previousLocation.primaryRoute !== currentLocation.primaryRoute) {
      contentNode.scrollTop = 0;
      contentNode.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    } else if (navigationType === 'POP') {
      const savedPosition = scrollPositionsRef.current.get(currentLocation.key) || 0;
      contentNode.scrollTop = savedPosition;
      contentNode.scrollTo({ top: savedPosition, left: 0, behavior: 'auto' });
    } else if (previousLocation.pathname !== currentLocation.pathname) {
      contentNode.scrollTop = 0;
      contentNode.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    previousLocationRef.current = currentLocation;
  }, [location.key, location.pathname, navigationType]);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previousScrollRestoration; };
  }, []);

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
    const mobileQuery = window.matchMedia('(max-width: 760px)');
    const updateKeyboardState = () => {
      const activeElement = document.activeElement;
      const isEditable = activeElement instanceof HTMLElement && (
        activeElement.matches('input:not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, [contenteditable="true"]')
      );
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const keyboardVisible = mobileQuery.matches && isEditable && window.innerHeight - viewportHeight > 160;
      setMobileKeyboardOpen(keyboardVisible);
      if (keyboardVisible) setQuickCreateOpen(false);
    };
    const scheduleUpdate = () => window.requestAnimationFrame(updateKeyboardState);

    document.addEventListener('focusin', updateKeyboardState);
    document.addEventListener('focusout', scheduleUpdate);
    window.addEventListener('resize', updateKeyboardState);
    window.visualViewport?.addEventListener('resize', updateKeyboardState);
    window.visualViewport?.addEventListener('scroll', updateKeyboardState);
    mobileQuery.addEventListener?.('change', updateKeyboardState);
    updateKeyboardState();

    return () => {
      document.removeEventListener('focusin', updateKeyboardState);
      document.removeEventListener('focusout', scheduleUpdate);
      window.removeEventListener('resize', updateKeyboardState);
      window.visualViewport?.removeEventListener('resize', updateKeyboardState);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardState);
      mobileQuery.removeEventListener?.('change', updateKeyboardState);
    };
  }, []);

  useEffect(() => {
    if (!quickCreateType || (!user && !isGuest)) return;
    if ((quickCreateType === 'activity' || quickCreateType === 'expense') && !events.length) loadEvents(user?.uid, isGuest);
    if (quickCreateType === 'expense') loadExpenses(user?.uid, isGuest);
  }, [quickCreateType, user, isGuest, events.length, loadEvents, loadExpenses]);

  // Build a readable profile label shown in the top bar.
  // If the user has a name, show it; otherwise show email or simply "Guest".
  const profileName = profile?.nickname || profile?.displayName || user?.displayName || 'Local Device User';
  const initials = profileName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'G';

  // Quick create opens a lightweight modal for common tasks without leaving the page.
  // This is a shortcut so users can add a life moment, activity, or expense in a few clicks.
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

  // Save a life moment and let the user choose whether to open it.
  const saveQuickEvent = async (formData) => {
    try {
      const event = await addEvent(user?.uid, isGuest, { ...formData, activities: [] });
      setQuickCreateType(null);
      showToast('Moment added successfully', 'success', { label: 'View', to: `/events/${event.id || event.firestoreId}` });
    } catch {
      setQuickCreateError('Could not save this life moment. Please try again.');
    }
  };

  // Save the expense without leaving the current screen.
  const saveQuickExpense = async (formData) => {
    try {
      await addExpense(user?.uid, isGuest, formData);
      setQuickCreateType(null);
      showToast('Expense added successfully', 'success', { label: 'View', to: '/financials/expenses' });
    } catch {
      setQuickCreateError('Could not save this expense. Please try again.');
    }
  };

  // Add a task-like activity under an existing life moment.
  // This is the same idea as creating a to-do attached to a life event.
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
      showToast('Activity added successfully', 'success', { label: 'View', to: `/events/${activity.eventId}/activities` });
    } catch {
      setQuickCreateError('Could not save this activity. Please try again.');
    }
  };

  const toggleTheme = async () => {
    try {
      await setPreferences({ theme: theme === 'dark' ? 'light' : 'dark' });
    } catch {
      showToast('Theme preference could not be saved', 'danger');
    }
  };

  // The layout wraps every protected page in a consistent shell:
  // top header, left navigation, content area, and floating quick-create panel.
  // This creates a single app frame so the experience feels consistent throughout the product.
  return (
    <div className="lifehub-shell" style={styles.appShell}>
      <header className="lifehub-header" style={styles.header}>
        <div style={styles.topBarLeft}>
          <button
            type="button"
            className="menu-button"
            aria-label={sidebarCollapsed ? 'Open navigation' : 'Close navigation'}
            onClick={() => setSidebarCollapsed((open) => !open)}
          >
            ☰
          </button>
          <div className="brand-lockup" aria-label="DN · Personal Experience">
            <span className="brand-mark" aria-hidden="true">DN</span>
            <span className="brand-lockup-title">Personal Experience</span>
          </div>
        </div>

        <div className="header-user-controls" style={styles.userSection}>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div ref={profileMenuRef} className="profile-menu-wrap">
            <button className="profile-trigger" type="button" onClick={() => setProfileMenuOpen((open) => !open)} aria-label="Open profile and account menu" aria-expanded={profileMenuOpen} aria-haspopup="menu">
              {profile?.photoDataUrl && !avatarError ? (
                <img className="avatar" src={profile.photoDataUrl} alt="" style={styles.avatar} onError={() => setAvatarError(true)} />
              ) : <span className="avatar avatar-fallback" aria-hidden="true">{initials}</span>}
              <span className="user-name" style={styles.userName}>{profileName}</span>
              <ChevronDown size={15} />
            </button>
            {profileMenuOpen ? (
              <div className="profile-menu" role="menu">
                <div className="profile-menu-account"><strong>{profileName}</strong><span>Device Principal</span></div>
                <NavLink to="/profile" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><UserCircle size={16} /> Profile</NavLink>
                <NavLink to="/settings" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><Settings size={16} /> Settings</NavLink>
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

        <section ref={contentRef} className="lifehub-content" style={styles.contentPane}>
          <ConnectivityBanner />
          <div className="lifehub-banner" style={styles.banner}>
            Your data is stored locally on this device.
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
      </nav>

      <div ref={quickCreateMobileRef} className={`mobile-dock-create${quickCreateOpen ? ' is-open' : ''}${mobileKeyboardOpen ? ' is-keyboard-open' : ''}`}>
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
            <DateField label="Date" name="quick-activity-date" value={quickActivityDate} onChange={(event) => setQuickActivityDate(event.target.value)} aria-label="Activity date" />
            <DropdownSelect value={quickActivityPriority} onChange={(event) => setQuickActivityPriority(event.target.value)} aria-label="Activity priority">
              {ACTIVITY_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
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
    minHeight: '100dvh',
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
    minHeight: 'calc(100dvh - 82px)',
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
