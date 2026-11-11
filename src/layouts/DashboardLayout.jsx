import { currentEntryTime } from '../utils/activityTime.js';
import ActivityFormFields from '../components/events/ActivityFormFields';
import RichTextEditor from '../components/common/RichTextEditor';
import DateField from '../components/common/DateField';
import ActivityTimeField from '../components/common/ActivityTimeField';
import { addUnifiedContentEntry, createStandaloneActivity, getMomentEntryMode, ENTRY_MODES } from '../utils/activityEntries';
import { detailQuickActivityContext } from '../utils/quickActivityDetailContext';
/*
  Moment-first app shell for dashboard and workspace navigation.

  In simple language:
  this file is the "parent frame" of the whole app after login.
  It contains the top bar, side menu, mobile navigation, theme switch, profile actions,
  and quick-create buttons for moments, activities, and transactions.
*/
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate, useNavigationType } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Activity, ArrowLeft, CalendarDays, ChevronDown, Cloud, HardDrive, LayoutDashboard, ListChecks, ListTodo, LogOut, Moon, Plus, Receipt, Settings, Sun, Upload, UserCircle, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { authService } from '../services/firebase';
import { useGuest } from '../context/GuestContext';
import ModalDialog from '../components/common/ModalDialog';
import EventForm from '../components/events/EventForm';
import TaskEditor from '../components/tasks/TaskEditor';
import useTaskStore, { taskScopeKey } from '../store/useTaskStore';
import DropdownSelect from '../components/common/DropdownSelect';
import TransactionForm from '../components/financials/TransactionForm';
import usePersistentListState from '../hooks/usePersistentListState';
import useEventStore from '../store/useEventStore';
import useTransactionManager from '../hooks/useTransactionManager';
import ConnectivityBanner from '../components/common/ConnectivityBanner';
import { activityMomentTypes, filterActivityMoments } from '../utils/activityMomentPicker';
import { getMomentWorkspaceKey, getRouteTransitionKey, getShellPageTitle, isSameMomentWorkspace, primaryNavigationPath, shellSettingsBackPath } from '../utils/momentWorkspaceRoutes';
import { recordId } from '../utils/recordIdentity';
import { financialDate } from '../utils/financialRecords';
import { scopedRecordActions as records } from '../services/scopedRecordActions';
import { isRecordScopeLoaded } from '../utils/scopedRecordActions';
import { getActiveSampleScenario } from '../dev/sampleData';
import './ProfileMenuPremium.css';
import './SessionBannerPremium.css';
import './PremiumMobileDock.css';
import MobileCommandDock from './MobileCommandDock';
import { MobileControlsContext } from '../components/common/MobileControlsSlot';

// These are the main screens in the application.
// The app keeps the navigation consistent across desktop and mobile layouts.
const navItems = [
  { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Activities', path: '/activities', icon: ListChecks },
  { label: 'Tasks', path: '/tasks', icon: ListTodo },
  { label: 'Moments', path: '/events', icon: CalendarDays },
];
// Portrait iPhones and short, touch-enabled landscape iPhones share the dock.
const MOBILE_DOCK_MEDIA = '(max-width: 760px), (orientation: landscape) and (max-height: 500px) and (pointer: coarse)';
const DESKTOP_SHELL_MEDIA = '(min-width: 1024px) and (min-height: 501px)';
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
  const taskStore = useTaskStore();
  const { events, loadedFor, activeLoadKey, loading: eventsLoading, error: eventsError, loadEvents, addEvent } = eventState;
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
  const [mobileShell, setMobileShell] = useState(() => window.matchMedia(MOBILE_DOCK_MEDIA).matches);
  const [mobileControlsTarget, setMobileControlsTarget] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.matchMedia(MOBILE_DOCK_MEDIA).matches);
  const [desktopShell, setDesktopShell] = useState(() => window.matchMedia(DESKTOP_SHELL_MEDIA).matches);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_SHELL_MEDIA);
    const update = () => setDesktopShell(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const shellNavItems = desktopShell ? [navItems[0], navItems[3], navItems[1], navItems[2]] : navItems;
  const [avatarError, setAvatarError] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const profileKeyboardOpenRef = useRef(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const quickCreateDesktopRef = useRef(null);
  const quickCreateMobileRef = useRef(null);
  const quickCreateKeyboardFocusRef = useRef(false);
  const [quickCreateType, setQuickCreateType] = useState(null);
  const [commandHandoff, setCommandHandoff] = useState(false);
  useEffect(() => { if (!mobileShell) setCommandHandoff(false); }, [mobileShell]);
  const commandReturnFocus = useRef(false);
  const previousCreateType = useRef(null);
  useEffect(() => {
    if (previousCreateType.current && !quickCreateType && commandReturnFocus.current) {
      quickCreateMobileRef.current?.querySelector('.dn-command-trigger')?.focus({ preventScroll: true });
      commandReturnFocus.current = false;
    }
    previousCreateType.current = quickCreateType;
  }, [quickCreateType]);
  const [quickTaskPreset, setQuickTaskPreset] = useState(null);
  const quickTaskScopeRef = useRef(null);
  const quickTaskSaving = useRef(false);
  const [quickTaskBusy, setQuickTaskBusy] = useState(false);
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
  const [quickActivityTime, setQuickActivityTime] = useState(currentEntryTime);
  const [quickActivityPriority, setQuickActivityPriority] = useState('medium');
  const [quickActivityDescription, setQuickActivityDescription] = useState('');
  const quickActivitySessionRef = useRef(null);
  const quickActivitySaving = useRef(false);
  const [quickActivityBusy, setQuickActivityBusy] = useState(false);
  const eventScope = `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
  const quickTaskScope = taskScopeKey({ user, isGuest });
  const activityMoments = isRecordScopeLoaded(eventState, eventScope, getActiveSampleScenario(user?.uid)) ? events : [];
  const activityDetailMatch = useMatch('/events/:eventId/activities/:activityId');
  const workspaceKey = getMomentWorkspaceKey(location.pathname);
  const workspaceMoment = workspaceKey ? activityMoments.find((moment) => workspaceKey === `/events/${encodeURIComponent(momentId(moment))}`) : null;
  const openedActivityContext = activityDetailMatch ? detailQuickActivityContext(activityMoments, activityDetailMatch.params, adminValues.eventTypes) : null;
  const shellTitle = getShellPageTitle(location.pathname, { momentTitle: workspaceMoment?.name });
  const shellBackPath = shellSettingsBackPath(location.pathname);
  const quickActivityTypes = activityMomentTypes(activityMoments, adminValues.eventTypes);
  const filteredActivityMoments = filterActivityMoments(activityMoments, quickActivityType);
  const quickSelectedMoment = filteredActivityMoments.find((item) => momentId(item) === quickActivityEventId);
  const quickMode = quickSelectedMoment ? getMomentEntryMode(quickSelectedMoment, adminValues.eventTypes) : null;
  // Historical same-day Diary Activities remain intact. New content is added
  // only when the owner explicitly saves inside the opened Activity.

  // Apply the saved theme to the page root so colors change across the whole app.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    const themeColor = theme === 'light' ? '#f3f6fb' : '#0b1020';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [theme]);

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_DOCK_MEDIA);
    const handleViewportChange = (event) => {
      setSidebarCollapsed(event.matches);
      setMobileShell(event.matches);
      setQuickCreateOpen(false);
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

    const menu = profileMenuRef.current?.querySelector('[role="menu"]');
    const items = () => [...(menu?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    // Only keyboard-opened menus move focus automatically. Pointer users retain
    // their current position, and the original click-outside semantics remain.
    if (profileKeyboardOpenRef.current) {
      const choices = items();
      const index = profileKeyboardOpenRef.current === 'last' ? choices.length - 1 : 0;
      choices[index]?.focus({ preventScroll: true });
      profileKeyboardOpenRef.current = null;
    }

    const closeProfileMenuOutside = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    const handleProfileMenuKeys = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setProfileMenuOpen(false);
        profileTriggerRef.current?.focus({ preventScroll: true });
        return;
      }
      if (event.key === 'Tab') {
        setProfileMenuOpen(false);
        return;
      }
      if (!menu?.contains(event.target)) return;
      const choices = items();
      const current = choices.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = (current + 1) % choices.length;
      else if (event.key === 'ArrowUp') next = (current - 1 + choices.length) % choices.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = choices.length - 1;
      else return;
      if (!choices.length) return;
      event.preventDefault();
      choices[next]?.focus({ preventScroll: true });
    };

    document.addEventListener('pointerdown', closeProfileMenuOutside);
    document.addEventListener('keydown', handleProfileMenuKeys);
    return () => {
      document.removeEventListener('pointerdown', closeProfileMenuOutside);
      document.removeEventListener('keydown', handleProfileMenuKeys);
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

  // Desktop choices precede the + trigger in DOM order. Keyboard opens must
  // focus the first creation action; pointer taps never steal focus.
  useLayoutEffect(() => {
    if (!quickCreateOpen || !quickCreateKeyboardFocusRef.current) return;
    quickCreateKeyboardFocusRef.current = false;
    quickCreateDesktopRef.current?.querySelector('.dn-quick-create-menu button')?.focus({ preventScroll: true });
  }, [quickCreateOpen]);

  useEffect(() => {
    if (!quickCreateOpen) return undefined;

    const closeQuickCreateOutside = (event) => {
      if (event.target.closest?.('.dn-command-dialog')) return;
      const clickedInsideDesktop = quickCreateDesktopRef.current?.contains(event.target);
      const clickedInsideMobile = quickCreateMobileRef.current?.contains(event.target);
      if (!clickedInsideDesktop && !clickedInsideMobile) setQuickCreateOpen(false);
    };
    const closeQuickCreateOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setQuickCreateOpen(false);
      [quickCreateMobileRef.current, quickCreateDesktopRef.current]
        .map((node) => node?.querySelector('.mobile-dock-create-trigger, .dn-quick-create-trigger'))
        .find((node) => node?.getClientRects().length)?.focus({ preventScroll: true });
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
  const beginQuickCreate = (type, activationEvent) => {
    if (transactionSaving.current || quickActivitySaving.current) return;
    if (mobileShell && quickCreateOpen) setCommandHandoff(true);
    commandReturnFocus.current = mobileShell && activationEvent?.detail === 0;
    if (type === 'task') {
      const parent = activityDetailMatch ? openedActivityContext?.moment : workspaceMoment;
      const activity = activityDetailMatch ? openedActivityContext?.activity : null;
      setQuickTaskPreset({ momentId: momentId(parent), activityId: recordId(activity?.id) });
      quickTaskScopeRef.current = taskScopeKey(useAppStore.getState());
      setQuickCreateError('');
      setQuickTaskBusy(false);
      taskStore.loadTasks();
      setQuickCreateOpen(false);
      // Universal Task creation stays on the invoking screen until View is selected.
      setQuickCreateType('task');
      return;
    }
    if (type === 'transaction') {
      const parent = activityDetailMatch ? activityMoments.find((moment) => momentId(moment) === activityDetailMatch.params.eventId) : workspaceMoment;
      const activity = parent?.activities?.find((item) => recordId(item.id) === activityDetailMatch?.params.activityId);
      setQuickTransaction({ context: records.capture(), preset: { eventId: momentId(parent), activityId: recordId(activity?.id), date: financialDate(activity?.date) } });
      setTransactionBusy(false);
    }
    setQuickCreateOpen(false);
    // A touch-selected menu item must not refocus the +: iOS can retain its
    // pressed/hover appearance until another element is tapped. Keep focus
    // recovery for keyboard actions only; dialog focus is handled separately.
    if (activationEvent?.detail === 0) {
      [quickCreateMobileRef.current, quickCreateDesktopRef.current]
        .map((node) => node?.querySelector('.mobile-dock-create-trigger, .dn-quick-create-trigger'))
        .find((node) => node?.getClientRects().length)?.focus({ preventScroll: true });
    }
    setQuickCreateError('');
    setQuickCreateType(type === 'activity' && activityDetailMatch ? 'activity-entry' : type);
    if (type === 'activity') {
      // Detail opens the separate Add entry form; elsewhere + creates a
      // new independent Activity in the selected Moment.
      const parent = activityDetailMatch ? openedActivityContext?.moment : workspaceMoment;
      const currentMomentId = momentId(parent);
      quickActivitySessionRef.current = { context: records.capture(), ready: isRecordScopeLoaded(eventState, eventScope, getActiveSampleScenario(user?.uid)),
        momentId: momentId(openedActivityContext?.moment), activityId: recordId(openedActivityContext?.activity?.id) };
      if (parent && !filteredActivityMoments.some((moment) => momentId(moment) === currentMomentId)) setQuickActivityType('');
      setQuickActivityEventId(currentMomentId);
      setQuickActivityTitle('');
      setQuickActivityTime(currentEntryTime());
      setQuickActivityDate(financialDate(new Date()));
      setQuickActivityPriority('medium');
      setQuickActivityDescription('');
    }
  };

  const beginMomentCreate = (kind) => {
    const targetMoment = activityDetailMatch ? openedActivityContext?.moment : workspaceMoment;
    if (!targetMoment || kind !== 'attachment') return;
    setQuickCreateOpen(false);
    // Preserve the synchronous file-picker gesture; Activity Detail can also
    // attach directly via the universal + while retaining its Activity link.
    window.dispatchEvent(new CustomEvent('dn:moment-create', {
      detail: { eventId: momentId(targetMoment), activityId: recordId(openedActivityContext?.activity?.id),
        scope: eventScope, kind },
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

  // Task persistence remains scoped to the existing Guest/account store.
  const saveQuickTask = async (draft) => {
    if (quickTaskSaving.current) return;
    const openingScope = quickTaskScopeRef.current;
    if (!openingScope || openingScope !== taskScopeKey(useAppStore.getState())
      || useTaskStore.getState().loadedFor !== openingScope) {
      setQuickCreateError('Tasks are not ready in this session. Reopen + to create a Task.');
      return;
    }
    quickTaskSaving.current = true; setQuickTaskBusy(true); setQuickCreateError('');
    try {
      const saved = await useTaskStore.getState().saveTask(draft);
      if (openingScope !== taskScopeKey(useAppStore.getState())) return;
      setQuickCreateType(null);
      showToast('Task added successfully', 'success', { label: 'View', to: '/tasks?task=' + encodeURIComponent(saved.id) });
    } catch (error) {
      if (openingScope === taskScopeKey(useAppStore.getState()))
        setQuickCreateError(error?.message || 'Could not save this Task. Please try again.');
    } finally { quickTaskSaving.current = false; setQuickTaskBusy(false); }
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

  // Every new Activity is independent regardless of Diary, Journal or Tasks.
  // This is the same idea as creating a to-do attached to a life event.
  const saveQuickActivity = async (submitEvent) => {
    submitEvent.preventDefault();
    if (quickActivitySaving.current) return;
    const event = filteredActivityMoments.find((item) => momentId(item) === quickActivityEventId);
    if (!event || !quickActivityTitle.trim()) {
      setQuickCreateError('Choose a life moment and enter an entry title.');
      return;
    }
    const mode = getMomentEntryMode(event, adminValues.eventTypes);
    const opening = quickActivitySessionRef.current;
    // Global + can open before Moments finish loading. Capture the final
    // revision only in that case, while requiring the original account scope.
    const context = opening?.ready ? opening.context : records.capture();
    if (!opening || opening.context.scope !== context.scope
      || opening.context.uid !== context.uid || opening.context.isGuest !== context.isGuest
      || opening.context.sample !== context.sample || !records.isCurrent(context)) {
      setQuickCreateError('Your session changed. Reopen + to add this entry.');
      return;
    }
    quickActivitySaving.current = true;
    setQuickActivityBusy(true);
    try {
      await records.mutateMoment(context, momentId(event), (latest) =>
        createStandaloneActivity(latest, {
          title: quickActivityTitle, description: quickActivityDescription,
          date: quickActivityDate, time: quickActivityTime, priority: quickActivityPriority, mode,
        }));
      if (!records.isCurrent(context)) return;
      setQuickCreateType(null);
      showToast('Activity added successfully', 'success',
      { label: 'View', to: `/events/${momentId(event)}/activities` });
    } catch (error) {
      if (records.isCurrent(context)) setQuickCreateError(error?.message || 'Could not save this entry. Please try again.');
    } finally {
      quickActivitySaving.current = false;
      setQuickActivityBusy(false);
    }
  };

  // Activity Detail uses a dedicated content-only form, never a nested Activity.
  const saveQuickEntry = async (submitEvent) => {
    submitEvent.preventDefault();
    if (quickActivitySaving.current) return;
    const opening = quickActivitySessionRef.current;
    const parent = openedActivityContext?.moment;
    const owner = openedActivityContext?.activity;
    if (!opening?.ready || !records.isCurrent(opening.context) || !parent || !owner
      || opening.momentId !== momentId(parent) || opening.activityId !== recordId(owner.id)) {
      setQuickCreateError('Activity or session changed. Reopen Add entry.');
      return;
    }
    quickActivitySaving.current = true;
    setQuickActivityBusy(true);
    setQuickCreateError('');
    try {
      await records.mutateActivity(opening.context, momentId(parent), recordId(owner.id),
        (latest) => {
          if (latest.completed || latest.cancelled || latest.status === 'completed' || latest.status === 'cancelled') {
            throw new Error('Reopen or restore this Activity before adding an entry.');
          }
          return addUnifiedContentEntry(latest, {
            description: quickActivityDescription, date: quickActivityDate, time: quickActivityTime,
          });
        });
      if (!records.isCurrent(opening.context)) return;
      setQuickCreateType(null);
      showToast('Entry added to Activity', 'success');
    } catch (error) {
      if (records.isCurrent(opening.context)) setQuickCreateError(error?.message || 'Could not add entry.');
    } finally {
      quickActivitySaving.current = false;
      setQuickActivityBusy(false);
    }
  };

  // The layout wraps every protected page in a consistent shell:
  // top header, left navigation, content area, and floating quick-create panel.
  // This creates a single app frame so the experience feels consistent throughout the product.
  return (
    <MobileControlsContext.Provider value={mobileShell ? mobileControlsTarget : null}>
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
          <div className="brand-lockup dn-route-brand">
            {shellBackPath ? <Link className="dn-shell-back" to={shellBackPath} aria-label="Back to Settings" title="Back to Settings">
              <ArrowLeft size={19} strokeWidth={1.9} aria-hidden="true" />
            </Link> : <span className="brand-mark" aria-hidden="true">DN</span>}
            <section className="dn-shell-page-context">
              {activityDetailMatch || workspaceKey
                ? <span className="brand-lockup-title dn-shell-page-title" title={shellTitle}>{shellTitle}</span>
                : <h1 className="brand-lockup-title dn-shell-page-title" title={shellTitle}>{shellTitle}</h1>}
              <small
                className={`dn-shell-scope${isGuest ? ' is-guest' : ' is-account'}`}
                role="note"
                aria-label={isGuest
                  ? 'Guest mode: your data is stored locally on this device and is not automatically transferred to Google.'
                  : 'Signed-in mode: account records use Firebase storage. Cloud availability depends on your connection.'}
              >
                {isGuest ? <HardDrive size={13} strokeWidth={1.9} aria-hidden="true" /> : <Cloud size={13} strokeWidth={1.9} aria-hidden="true" />}
                <span>{isGuest ? 'Guest · On this device' : 'Account · Cloud storage'}</span>
              </small>
            </section>
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
            <button ref={profileTriggerRef} className="profile-trigger" type="button"
              onClick={() => { profileKeyboardOpenRef.current = null; setProfileMenuOpen((open) => !open); }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                event.preventDefault();
                profileKeyboardOpenRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
                setProfileMenuOpen(true);
              }}
              aria-label="Open profile and account menu" aria-expanded={profileMenuOpen} aria-haspopup="menu" aria-controls="dn-profile-menu">
              {user?.photoURL && !avatarError ? (
                <img className="avatar" src={user.photoURL} alt="" style={styles.avatar} onError={() => setAvatarError(true)} />
              ) : <span className="avatar avatar-fallback" aria-hidden="true">{initials}</span>}
              <span className="user-name" style={styles.userName}>{profileName}</span>
              <ChevronDown className="profile-trigger-chevron" size={15} aria-hidden="true" />
            </button>
            {profileMenuOpen ? (
              <div id="dn-profile-menu" className="profile-menu" role="menu" aria-label="Profile and account">
                <div className="profile-menu-account" role="presentation"><strong>{profileName}</strong><span>{isGuest ? 'Guest account' : user?.email || 'DN account'}</span></div>
                <NavLink to="/settings#profile" className="profile-menu-item" role="menuitem" onClick={() => setProfileMenuOpen(false)}><UserCircle size={16} /> Profile</NavLink>
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
          {shellNavItems.map((item) => (
            <Link key={item.path} to={item.path} className="dn-nav-link"
              aria-current={activeNavigationPath === item.path ? 'page' : undefined}
              style={{ ...styles.navCard, ...(activeNavigationPath === item.path ? styles.navCardActive : {}) }}>
              <span className="dn-nav-icon" aria-hidden="true"><item.icon size={18} strokeWidth={2} /></span>
              <span className="dn-nav-label">{item.label}</span>
            </Link>
          ))}
          <div className="dn-desktop-navigation-options">
            <NavLink to="/financials/transactions" aria-label="Transactions" className="dn-nav-link"><span className="dn-nav-icon"><Receipt size={18} /></span><span className="dn-nav-label">Transactions</span></NavLink>
            <NavLink to="/insights" aria-label="Insights" className="dn-nav-link"><span className="dn-nav-icon"><Activity size={18} /></span><span className="dn-nav-label">Insights</span></NavLink>
            <Link to="/settings#profile" className="dn-nav-link dn-desktop-account-start" aria-label="Profile"><span className="dn-nav-icon"><UserCircle size={18} /></span><span className="dn-nav-label">Profile</span></Link>
            <NavLink to="/settings" aria-label="Settings" end className="dn-nav-link"><span className="dn-nav-icon"><Settings size={18} /></span><span className="dn-nav-label">Settings</span></NavLink>
            <button type="button" className="dn-nav-link dn-desktop-logout" aria-label="Logout" onClick={handleLogout}><span className="dn-nav-icon"><LogOut size={18} /></span><span className="dn-nav-label">Logout</span></button>
          </div>
        </aside>

        {!sidebarCollapsed ? <button className="mobile-nav-overlay" type="button" aria-label="Close navigation" onClick={() => setSidebarCollapsed(true)} /> : null}

        <section ref={contentRef} className="dn-content" style={styles.contentPane}>
          <ConnectivityBanner />
          <motion.div
            key={getRouteTransitionKey(location.pathname)}
            className="dn-route-transition"
            initial={reducedMotion ? false : { opacity: mobileShell ? 0.91 : 0.94, y: mobileShell ? 6 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : (mobileShell ? 0.2 : 0.14), ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </section>
      </main>

      {mobileShell ? <MobileCommandDock controlsRef={setMobileControlsTarget} menuRef={quickCreateMobileRef}
        open={quickCreateOpen} setOpen={setQuickCreateOpen} onCreate={beginQuickCreate}
        onExitComplete={() => setCommandHandoff(false)}
        onAttachment={(workspaceMoment || openedActivityContext?.moment) ? () => beginMomentCreate('attachment') : null}
        isEntry={Boolean(activityDetailMatch)} activePath={activeNavigationPath} /> : null}

      <div ref={quickCreateDesktopRef} className={`dn-quick-create${quickCreateOpen ? ' is-open' : ''}`}>
        {quickCreateOpen ? (
          <div id="dn-desktop-quick-create" className="dn-quick-create-menu"
            role="group" aria-label="Quick create actions">
            <button type="button" onClick={(event) => beginQuickCreate('event', event)}><CalendarDays size={17} /><span>Life moment</span></button>
            <button type="button" onClick={(event) => beginQuickCreate('activity', event)}><ListChecks size={17} /><span>{activityDetailMatch ? 'Add entry' : 'Activity'}</span></button>
            <button type="button" onClick={(event) => beginQuickCreate('task', event)}><ListTodo size={17} /><span>Task</span></button>
            <button type="button" onClick={(event) => beginQuickCreate('transaction', event)}><Receipt size={17} /><span>Transaction</span></button>
            {(workspaceMoment || openedActivityContext?.moment) ? <button type="button" onClick={() => beginMomentCreate('attachment')}><Upload size={17} /><span>Attachment</span></button> : null}
          </div>
        ) : null}
        <button type="button" className="dn-quick-create-trigger"
          onClick={(event) => {
            quickCreateKeyboardFocusRef.current = !quickCreateOpen && event.detail === 0;
            setQuickCreateOpen((open) => !open);
          }}
          aria-label={quickCreateOpen ? 'Close quick create menu' : 'Open quick create menu'}
          aria-expanded={quickCreateOpen} aria-controls={quickCreateOpen ? 'dn-desktop-quick-create' : undefined}>
          <Plus size={22} aria-hidden="true" className="dn-create-glyph" />
        </button>
      </div>

      <AnimatePresence initial={false} mode="wait">
      {quickCreateType === 'event' && !commandHandoff ? (
        <ModalDialog key="quick-moment" title="Create a life moment" className="dn-create-sheet" variant={mobileShell ? "drawer" : "dialog"} onClose={() => setQuickCreateType(null)}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <EventForm onSubmit={saveQuickEvent} onCancel={() => setQuickCreateType(null)} submitLabel="Save moment" />
        </ModalDialog>
      ) : null}
      {quickCreateType === 'task' && !commandHandoff ? (
        <ModalDialog key="quick-task" title="New Task" className="dn-task-dialog dn-create-sheet" variant={mobileShell ? "drawer" : "dialog"}
          onClose={() => { if (!quickTaskSaving.current) setQuickCreateType(null); }}>
          <TaskEditor task={quickTaskPreset} moments={activityMoments} onSave={saveQuickTask}
            busy={quickTaskBusy || taskStore.loadedFor !== quickTaskScope}
            error={quickCreateError || taskStore.error || ''}
            onClose={() => { if (!quickTaskSaving.current) setQuickCreateType(null); }} />
        </ModalDialog>
      ) : null}
      {quickCreateType === 'transaction' && !commandHandoff && records.isCurrent(quickTransaction?.context) ? (
        <ModalDialog key="quick-transaction" title="Add Transaction" className="dn-transaction-dialog dn-create-sheet" variant={mobileShell ? "drawer" : "dialog"} onClose={closeQuickTransaction}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <TransactionForm events={activityMoments} onSubmit={saveQuickTransaction}
            presetLink={quickTransaction.preset} busy={transactionBusy} onCancel={closeQuickTransaction} />
        </ModalDialog>
      ) : null}
      {quickCreateType === 'activity-entry' && !commandHandoff ? (
        <ModalDialog key="quick-entry" title="Add entry" className="dn-entry-add-dialog dn-create-sheet" variant={mobileShell ? "drawer" : "dialog"}
          onClose={() => { if (!quickActivitySaving.current) setQuickCreateType(null); }}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <form className="form-surface quick-create-activity-form dn-entry-add-form"
            aria-busy={quickActivityBusy} onSubmit={saveQuickEntry}>
            <p className="dn-form-context">Activity · <strong>{openedActivityContext?.activity?.title || 'Current Activity'}</strong></p>
            <RichTextEditor label="Entry content" value={quickActivityDescription} disabled={quickActivityBusy}
              onChange={setQuickActivityDescription} rows={5} placeholder="What happened next?" required />
            <div className="activity-date-time-row">
              <DateField label="Date" name="dn-new-entry-date" value={quickActivityDate}
                onChange={(event) => setQuickActivityDate(event.target.value)} disabled={quickActivityBusy} required />
              <ActivityTimeField value={quickActivityTime} onChange={setQuickActivityTime} disabled={quickActivityBusy} />
            </div>
            <div className="form-actions dn-activity-create-actions">
              <button type="button" className="secondaryButton" disabled={quickActivityBusy}
                onClick={() => setQuickCreateType(null)}>Cancel</button>
              <button type="submit" className="primaryButton" disabled={quickActivityBusy || !quickActivityDescription.trim()}>
                {quickActivityBusy ? 'Saving…' : 'Save entry'}
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {quickCreateType === 'activity' && !commandHandoff ? (
        <ModalDialog key="quick-activity" title="Add an activity" className="dn-create-sheet" variant={mobileShell ? "drawer" : "dialog"} onClose={() => { if (!quickActivitySaving.current) setQuickCreateType(null); }}>
          {quickCreateError ? <p className="quick-create-error" role="alert">{quickCreateError}</p> : null}
          <form className="form-surface quick-create-activity-form dn-activity-create-form" aria-busy={quickActivityBusy} onSubmit={saveQuickActivity}>
            <div className="dn-activity-create-destination">
              <details className="dn-form-disclosure dn-activity-moment-disclosure"
                key={quickActivityEventId || 'choose'} open={!quickSelectedMoment}>
                <summary><span>{quickSelectedMoment
                  ? `Moment · ${quickSelectedMoment.name || 'This Moment'}` : 'Choose a Moment'}</span>
                  <small>{quickSelectedMoment ? 'Change destination' : 'Select where this Activity belongs'}</small></summary>
                <div className="dn-form-disclosure-content">
                <div className="dn-activity-create-moment-fields">
                <div className="dn-activity-create-field">
                  <label htmlFor="quick-activity-type">Moment type</label>
            <DropdownSelect id="quick-activity-type" value={quickActivityType} onChange={(changeEvent) => {
              const nextType = changeEvent.target.value;
              setQuickActivityType(nextType);
              if (!filterActivityMoments(activityMoments, nextType).some((event) => momentId(event) === quickActivityEventId)) {
                setQuickActivityEventId('');
              }
            }} aria-label="Moment type" disabled={eventsLoading}>
              <option value="">All moment types</option>
              {quickActivityTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              {quickActivityType && !quickActivityTypes.some((type) => type.value === quickActivityType) ? <option value={quickActivityType}>Saved moment type (unavailable)</option> : null}
                </DropdownSelect>
                </div>
                <div className="dn-activity-create-field">
                  <label htmlFor="quick-activity-moment">Life moment</label>
            <DropdownSelect id="quick-activity-moment" value={quickActivityEventId} onChange={(event) => setQuickActivityEventId(event.target.value)} aria-label="Life moment" placeholder="Choose a life moment" disabled={eventsLoading}>
              <option value="">Choose a life moment</option>
              {filteredActivityMoments.map((event) => <option key={momentId(event)} value={momentId(event)}>{event.name || 'Untitled moment'}{event.archived ? ' (Archived)' : ''}</option>)}
                </DropdownSelect>
                </div>
                </div>
                </div>
              </details>
            {eventsLoading ? <p role="status">Loading moments…</p> : eventsError ? <p role="alert">{eventsError} <button type="button" className="secondaryButton" onClick={() => loadEvents(user?.uid, isGuest)}>Retry</button></p> : !filteredActivityMoments.length ? <p role="status">No moments in this type. Choose another type or create a moment first.</p> : null}
            {activityDetailMatch && quickSelectedMoment ? <p className="dn-quick-activity-context">
              {'New Activity under '}
              <strong>{quickSelectedMoment.name || 'this Moment'}</strong>

            </p> : null}
            </div>

            <ActivityFormFields mode={quickMode || ENTRY_MODES.TASKS} namePrefix="dn-quick-activity"
              value={{ title: quickActivityTitle, date: quickActivityDate, time: quickActivityTime,
                description: quickActivityDescription, priority: quickActivityPriority }}
              priorities={adminValues.activityPriorities} disabled={quickActivityBusy}
              onChange={(patch) => {
                if (patch.title !== undefined) setQuickActivityTitle(patch.title);
                if (patch.date !== undefined) setQuickActivityDate(patch.date);
                if (patch.time !== undefined) setQuickActivityTime(patch.time);
                if (patch.description !== undefined) setQuickActivityDescription(patch.description);
                if (patch.priority !== undefined) setQuickActivityPriority(patch.priority);
              }} />
            <div className="form-actions dn-activity-create-actions"><button className="secondaryButton" type="button" disabled={quickActivityBusy} onClick={() => setQuickCreateType(null)}>Cancel</button><button className="primaryButton" type="submit" disabled={quickActivityBusy}>{quickActivityBusy ? 'Saving…' : 'Save activity'}</button></div>
          </form>
        </ModalDialog>
      ) : null}
      </AnimatePresence>
    </div>
    </MobileControlsContext.Provider>
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
};
