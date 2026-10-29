import ActivityTimeField from '../components/common/ActivityTimeField';
/*
  Moment-first app shell for dashboard and workspace navigation.

  In simple language:
  this file is the "parent frame" of the whole app after login.
  It contains the top bar, side menu, mobile navigation, theme switch, profile actions,
  and quick-create buttons for moments, activities, and transactions.
*/
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate, useNavigationType } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, BookHeart, CalendarDays, ChevronDown, LayoutDashboard, ListChecks, LogOut, Moon, Plus, Receipt, Settings, Sun, Upload, UserCircle, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';
import ModalDialog from '../components/common/ModalDialog';
import EventForm from '../components/events/EventForm';
import DateField from '../components/common/DateField';
import DropdownSelect from '../components/common/DropdownSelect';
import TransactionForm from '../components/financials/TransactionForm';
import RichTextEditor from '../components/common/RichTextEditor';
import usePersistentListState from '../hooks/usePersistentListState';
import useEventStore from '../store/useEventStore';
import useTransactionManager from '../hooks/useTransactionManager';
import { getActiveCodeListMeta } from '../utils/codeLists';
import ConnectivityBanner from '../components/common/ConnectivityBanner';
import { activityMomentTypes, filterActivityMoments } from '../utils/activityMomentPicker';
import { getMomentWorkspaceKey, getRouteTransitionKey, isSameMomentWorkspace, primaryNavigationPath } from '../utils/momentWorkspaceRoutes';
import { recordId } from '../utils/recordIdentity';
import { financialDate } from '../utils/financialRecords';
import { scopedRecordActions as records } from '../services/scopedRecordActions';
import { isRecordScopeLoaded } from '../utils/scopedRecordActions';
import { getActiveSampleScenario } from '../dev/sampleData';

// These are the main screens in the application.
// The app keeps the navigation consistent across desktop and mobile layouts.
const navItems = [
  { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Activities', path: '/activities', icon: ListChecks },
  { label: 'Moments', path: '/events', icon: CalendarDays },
];
const ACTIVITY_PICKER_DEFAULTS = Object.freeze({ type: '' });
const momentId = (moment) => recordId(moment?.id) || recordId(moment?.firestoreId);

export default function DashboardLayout() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const theme = useAppStore((state) => state.preferences.theme || 'light');
  const setPreferences = useAppStore((state) => state.setPreferences);
  const showToast = useAppStore((state) => state.showToast);
  const eventState = useEventStore();
  const { events, loadedFor, activeLoadKey, loading: eventsLoading, error: eventsError, loadEvents, addEvent, updateEventItem } = eventState;
  const { saveTransaction } = useTransactionManager();
  const { exitGuestMode } = useGuest();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const activeNavigationPath = primaryNavigationPath(location.pathname);
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
  const quickCreateDesktopRef = useRef(null);
  const quickCreateMobileRef = useRef(null);
  const [quickCreateType, setQuickCreateType] = useState(null);
  const [quickCreateError, setQuickCreateError] = useState('');
  const [quickTransaction, setQuickTransaction] = useState(null);
  const [transactionBusy, setTransactionBusy] = useState(false);
  const transactionSaving = useRef(false);
  const transactionMounted = useRef(true);
  useEffect(() => { transactionMounted.current = true; return () => { transactionMounted.current = false; }; }, []);
  const [quickActivityEventId, setQuickActivityEventId] = useState('');
  const [activityPickerFilter, changeActivityPickerFilter] = usePersistentListState('activity-picker', ACTIVITY_PICKER_DEFAULTS);
  const quickActivityType = activityPickerFilter.type;
  const setQuickActivityType = (type) => changeActivityPickerFilter({ type });
  const [quickActivityTitle, setQuickActivityTitle] = useState('');
  const [quickActivityDate, setQuickActivityDate] = useState(financialDate(new Date()));
  const [quickActivityTime, setQuickActivityTime] = useState('');
  const [quickActivityPriority, setQuickActivityPriority] = useState('medium');
  const [quickActivityDescription, setQuickActivityDescription] = useState('');
  const eventScope = `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
  const activityMoments = isRecordScopeLoaded(eventState, eventScope, getActiveSampleScenario(user?.uid)) ? events : [];
  const activityDetailMatch = useMatch('/events/:eventId/activities/:activityId');
  const workspaceKey = getMomentWorkspaceKey(location.pathname);
  const workspaceMoment = workspaceKey ? activityMoments.find((moment) => workspaceKey === `/events/${encodeURIComponent(momentId(moment))}`) : null;
  const quickActivityTypes = activityMomentTypes(activityMoments, adminValues.eventTypes);
  const filteredActivityMoments = filterActivityMoments(activityMoments, quickActivityType);

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
      primaryRoute: primaryNavigationPath(location.pathname) || segment,
    };
    const previousLocation = previousLocationRef.current;

    if (previousLocation) {
      scrollPositionsRef.current.set(previousLocation.key, contentNode.scrollTop);
      if (scrollPositionsRef.current.size > 80) {
        const oldestKey = scrollPositionsRef.current.keys().next().value;
        scrollPositionsRef.current.delete(oldestKey);
      }
    }

    if (previousLocation && isSameMomentWorkspace(previousLocation.pathname, currentLocation.pathname)) {
      // Section navigation belongs to one workspace; keep its position and drafts.
    } else if (previousLocation && navigationType === 'POP') {
      const savedPosition = scrollPositionsRef.current.get(currentLocation.key) || 0;
      contentNode.scrollTo({ top: savedPosition, left: 0, behavior: 'auto' });
    } else if (!previousLocation || previousLocation.pathname !== currentLocation.pathname) {
      contentNode.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
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
    if (!quickCreateType || (!user && !isGuest)) return;
    if (quickCreateType) loadEvents(user?.uid, isGuest);
  }, [quickCreateType, user?.uid, isGuest, loadEvents]);

  // Build a readable profile label shown in the top bar.
  // If the user has a name, show it; otherwise show email or simply "Guest".
  const profileName = user?.displayName || user?.email || 'Guest';
  const initials = profileName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'G';

  // Logout should behave differently for guest accounts and real accounts.
  // Real users sign out through Firebase; guest users just clear the guest session.
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
  // Shared quick-create for moments, activities, or any transaction.
  const beginQuickCreate = (type) => {
    if (transactionSaving.current) return;
    if (type === 'transaction') {
      const parent = activityDetailMatch ? activityMoments.find((moment) => momentId(moment) === activityDetailMatch.params.eventId) : workspaceMoment;
      const activity = parent?.activities?.find((item) => recordId(item.id) === activityDetailMatch?.params.activityId);
      setQuickTransaction({ context: records.capture(), preset: { eventId: momentId(parent), activityId: recordId(activity?.id), date: financialDate(activity?.date) } });
      setTransactionBusy(false);
    }
    setQuickCreateOpen(false);
    // Restore dialogs to the persistent + control, rather than a disappearing menu item.
    [quickCreateMobileRef.current, quickCreateDesktopRef.current]
      .map((node) => node?.querySelector('.mobile-dock-create-trigger, .dn-quick-create-trigger'))
      .find((node) => node?.getClientRects().length)?.focus({ preventScroll: true });
    setQuickCreateError('');
    setQuickCreateType(type);
    if (type === 'activity') {
      const currentMomentId = momentId(workspaceMoment);
      if (workspaceMoment && !filteredActivityMoments.some((moment) => momentId(moment) === currentMomentId)) setQuickActivityType('');
      setQuickActivityEventId(currentMomentId);
      setQuickActivityTitle('');
      setQuickActivityTime('');
      setQuickActivityDate(financialDate(new Date()));
      setQuickActivityPriority('medium');
      setQuickActivityDescription('');
    }
  };

  const beginMomentCreate = (kind) => {
    if (!workspaceMoment || kind !== 'attachment') return;
    setQuickCreateOpen(false);
    // Keep file selection inside this click; navigating or deferring it can
    // discard the user gesture required by mobile browsers.
    window.dispatchEvent(new CustomEvent('dn:moment-create', {
      detail: { eventId: momentId(workspaceMoment), scope: eventScope, kind },
    }));
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

  // Use the same transaction pathway as the Financials screen.
  const closeQuickTransaction = () => {
    if (!transactionSaving.current) { setQuickCreateType(null); setQuickTransaction(null); setQuickCreateError(''); }
  };
  const saveQuickTransaction = async (formData) => {
    if (transactionSaving.current) return;
    const context = quickTransaction?.context;
    if (!records.isCurrent(context)) throw new Error('Your session changed. Reopen + to add a transaction.');
    transactionSaving.current = true; setTransactionBusy(true); setQuickCreateError('');
    try {
      await saveTransaction(formData);
      if (transactionMounted.current && records.isCurrent(context)) {
        setQuickCreateType(null); setQuickTransaction(null);
        showToast('Transaction added', 'success', { label: 'View', to: '/financials/transactions' });
      }
    } catch (error) {
      if (transactionMounted.current && records.isCurrent(context)) setQuickCreateError(error?.message || 'Could not save this transaction.');
      throw error;
    } finally {
      transactionSaving.current = false;
      if (transactionMounted.current) setTransactionBusy(false);
    }
  };

  // Add a task-like activity under an existing life moment.
  // This is the same idea as creating a to-do attached to a life event.
  const saveQuickActivity = async (submitEvent) => {
    submitEvent.preventDefault();
    const event = filteredActivityMoments.find((item) => momentId(item) === quickActivityEventId);
    if (!event || !quickActivityTitle.trim()) {
      setQuickCreateError('Choose a life moment and enter an activity title.');
      return;
    }
    try {
      const activity = {
        id: crypto.randomUUID(),
        eventId: momentId(event),
        title: quickActivityTitle.trim(),
        description: quickActivityDescription,
        date: quickActivityDate, time: quickActivityTime,
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

  // The layout wraps every protected page in a consistent shell:
  // top header, left navigation, content area, and floating quick-create panel.
  // This creates a single app frame so the experience feels consistent throughout the product.
  return (
    <div className="dn-shell" style={styles.appShell}>
      <header className="dn-header" style={styles.header}>
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
                <NavLink to="/financials/transactions" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><Receipt size={16} /> Transactions</NavLink>
                <NavLink to="/insights" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><Activity size={16} /> Insights</NavLink>
                <NavLink to="/settings" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><Settings size={16} /> Settings</NavLink>
                <button type="button" className="profile-menu-item profile-menu-danger" role="menuitem" onClick={handleLogout}><LogOut size={16} /> Logout</button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="dn-main" style={styles.mainContent}>
        <aside
          className={`dn-sidebar ${sidebarCollapsed ? 'dn-sidebar-collapsed' : ''}`}
          style={{
            ...styles.sidebar,
            width: `${sidebarWidth}px`,
            minWidth: `${sidebarWidth}px`,
            ...(sidebarCollapsed ? styles.sidebarCollapsed : {}),
          }}
        >
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className="dn-nav-link"
              aria-current={activeNavigationPath === item.path ? 'page' : undefined}
              style={{ ...styles.navCard, ...(activeNavigationPath === item.path ? styles.navCardActive : {}) }}>
              <span className="dn-nav-icon" aria-hidden="true"><item.icon size={18} strokeWidth={2} /></span>
              <span className="dn-nav-label">{item.label}</span>
            </Link>
          ))}
        </aside>

        {!sidebarCollapsed ? <button className="mobile-nav-overlay" type="button" aria-label="Close navigation" onClick={() => setSidebarCollapsed(true)} /> : null}

        <section ref={contentRef} className="dn-content" style={styles.contentPane}>
          <ConnectivityBanner />
          <div className="dn-banner" style={styles.banner}>
            {isGuest
              ? 'Guest mode active. Your data is stored locally on this device.'
              : 'Authenticated mode active. Your data is synced with Firebase.'}
          </div>

          <motion.div
            key={getRouteTransitionKey(location.pathname)}
            className="dn-route-transition"
            initial={reducedMotion ? false : { opacity: 0.94, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.14, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </section>
      </main>

      <nav className="mobile-tabbar" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path}
            className={`mobile-tab${activeNavigationPath === item.path ? ' mobile-tab-active' : ''}`}
            aria-current={activeNavigationPath === item.path ? 'page' : undefined} aria-label={item.label}>
            <item.icon size={19} strokeWidth={2} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        ))}
        <div ref={quickCreateMobileRef} className={`mobile-dock-create${quickCreateOpen ? ' is-open' : ''}`}>
          {quickCreateOpen ? (
            <div className="mobile-dock-create-menu" aria-label="Quick create actions">
              <button type="button" onClick={() => beginQuickCreate('event')}><CalendarDays size={17} /><span>Life moment</span></button>
              <button type="button" onClick={() => beginQuickCreate('activity')}><ListChecks size={17} /><span>Activity</span></button>
              <button type="button" onClick={() => beginQuickCreate('transaction')}><Receipt size={17} /><span>Transaction</span></button>
              {workspaceMoment ? <button type="button" onClick={() => beginMomentCreate('attachment')}><Upload size={17} /><span>Attachment</span></button> : null}
            </div>
          ) : null}
          <button type="button" className="mobile-dock-create-trigger" onClick={() => setQuickCreateOpen((open) => !open)} aria-label={quickCreateOpen ? 'Close quick create menu' : 'Open quick create menu'} aria-expanded={quickCreateOpen}>
            {quickCreateOpen ? <X size={20} /> : <Plus size={21} />}
          </button>
        </div>
      </nav>

      <div ref={quickCreateDesktopRef} className={`dn-quick-create${quickCreateOpen ? ' is-open' : ''}`}>
        {quickCreateOpen ? (
          <div className="dn-quick-create-menu" aria-label="Quick create actions">
            <button type="button" onClick={() => beginQuickCreate('event')}><CalendarDays size={17} /><span>Life moment</span></button>
            <button type="button" onClick={() => beginQuickCreate('activity')}><ListChecks size={17} /><span>Activity</span></button>
            <button type="button" onClick={() => beginQuickCreate('transaction')}><Receipt size={17} /><span>Transaction</span></button>
            {workspaceMoment ? <button type="button" onClick={() => beginMomentCreate('attachment')}><Upload size={17} /><span>Attachment</span></button> : null}
          </div>
        ) : null}
        <button type="button" className="dn-quick-create-trigger" onClick={() => setQuickCreateOpen((open) => !open)} aria-label={quickCreateOpen ? 'Close quick create menu' : 'Open quick create menu'} aria-expanded={quickCreateOpen}>
          {quickCreateOpen ? <X size={21} /> : <Plus size={22} />}
        </button>
      </div>

      {quickCreateType === 'event' ? (
        <ModalDialog title="Create a life moment" onClose={() => setQuickCreateType(null)}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <EventForm onSubmit={saveQuickEvent} onCancel={() => setQuickCreateType(null)} submitLabel="Save moment" />
        </ModalDialog>
      ) : null}
      {quickCreateType === 'transaction' && records.isCurrent(quickTransaction?.context) ? (
        <ModalDialog title="Add Transaction" className="dn-transaction-dialog" onClose={closeQuickTransaction}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <TransactionForm events={activityMoments} onSubmit={saveQuickTransaction}
            presetLink={quickTransaction.preset} busy={transactionBusy} onCancel={closeQuickTransaction} />
        </ModalDialog>
      ) : null}
      {quickCreateType === 'activity' ? (
        <ModalDialog title="Add an activity" onClose={() => setQuickCreateType(null)}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <form className="form-surface quick-create-activity-form" onSubmit={saveQuickActivity}>
            <label htmlFor="quick-activity-type">Moment type</label>
            <DropdownSelect id="quick-activity-type" value={quickActivityType} onChange={(changeEvent) => {
              const nextType = changeEvent.target.value;
              setQuickActivityType(nextType);
              if (!filterActivityMoments(activityMoments, nextType).some((event) => momentId(event) === quickActivityEventId)) setQuickActivityEventId('');
            }} aria-label="Moment type" disabled={eventsLoading}>
              <option value="">All moment types</option>
              {quickActivityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              {quickActivityType && !quickActivityTypes.some((type) => type.value === quickActivityType) ? <option value={quickActivityType}>Saved moment type (unavailable)</option> : null}
            </DropdownSelect>
            <label htmlFor="quick-activity-moment">Life moment</label>
            <DropdownSelect id="quick-activity-moment" value={quickActivityEventId} onChange={(event) => setQuickActivityEventId(event.target.value)} aria-label="Life moment" placeholder="Choose a life moment" disabled={eventsLoading}>
              <option value="">Choose a life moment</option>
              {filteredActivityMoments.map((event) => <option key={momentId(event)} value={momentId(event)}>{event.name || 'Untitled moment'}{event.archived ? ' (Archived)' : ''}</option>)}
            </DropdownSelect>
            {eventsLoading ? <p role="status">Loading moments…</p> : eventsError ? <p role="alert">{eventsError} <button type="button" className="secondaryButton" onClick={() => loadEvents(user?.uid, isGuest)}>Retry</button></p> : !filteredActivityMoments.length ? <p role="status">No moments in this type. Choose another type or create a moment first.</p> : null}
            <input value={quickActivityTitle} onChange={(event) => setQuickActivityTitle(event.target.value)} placeholder="Activity title" aria-label="Activity title" autoFocus />
            <DateField label="Date" name="quick-activity-date" value={quickActivityDate} onChange={(event) => setQuickActivityDate(event.target.value)} aria-label="Activity date" />
            <ActivityTimeField value={quickActivityTime} onChange={setQuickActivityTime} />
            <DropdownSelect value={quickActivityPriority} onChange={(event) => setQuickActivityPriority(event.target.value)} aria-label="Activity priority">
              {getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
            <RichTextEditor label="Activity notes" value={quickActivityDescription} onChange={setQuickActivityDescription} placeholder="Description (optional)" rows={4} />
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
