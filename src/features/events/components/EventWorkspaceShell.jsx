// This is the single-event workspace.
// It is the full detail page for one life moment, where the user can edit the event and manage activities, notes, memories, and spending.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, BookHeart, CalendarDays, Check, CircleCheck, Clock3, Download, FileText, Heart, Images, ListChecks, Pencil, Plus, Receipt, Save, Search, Sparkles, Trash2, X } from 'lucide-react';
import ActivityList from '../../../components/events/ActivityList';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import GreetingCard, { buildGreetingCardHtml } from '../../../components/common/GreetingCard';
import { attachmentRepository, MAX_ATTACHMENT_BYTES } from '../../../services/attachmentService';
import { getActiveSampleData, getActiveSampleScenario } from '../../../dev/sampleData';
import SwipeActionCard from '../../../components/common/SwipeActionCard';
import EventForm from '../../../components/events/EventForm';
import DateField from '../../../components/common/DateField';
import TransactionForm from '../../../components/financials/TransactionForm';
import RichTextEditor from '../../../components/common/RichTextEditor';
import RichText from '../../../components/common/RichText';
import DropdownSelect from '../../../components/common/DropdownSelect';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import useExpenseStore from '../../../store/useExpenseStore';
import useTransactionManager from '../../../hooks/useTransactionManager';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import { downloadBlob } from '../../../utils/download';
import { getEventGreeting } from '../../../utils/greeting';
import { getActiveCodeListMeta } from '../../../utils/codeLists';
import usePersistentListState from '../../../hooks/usePersistentListState';
import SortControl from '../../../components/common/SortControl';
import ListControls from '../../../components/common/ListControls';
import { getMomentWorkspaceSection } from '../../../utils/momentWorkspaceRoutes';
import { formatMomentDate, parseMomentDate } from '../../../utils/momentDates';
import { recordId } from '../../../utils/recordIdentity';
import { scopedRecordActions as records } from '../../../services/scopedRecordActions';
import { isRecordScopeLoaded } from '../../../utils/scopedRecordActions';
import { activityCompletionPatch, activityDateLabel, activityDetailPath, activityStatus } from '../../../utils/activityDetail';
import useMomentFinance from '../../../hooks/useMomentFinance';
import LinkedTransactions from '../../finance/components/LinkedTransactions';
import MomentContents from './MomentContents';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';

const EMPTY_GREETING_TEMPLATES = Object.freeze({});
const EMPTY_MOMENT_TYPES = Object.freeze([]);
const ACTIVITY_LIST_DEFAULTS = Object.freeze({ search: '', filter: 'all', field: 'date', direction: 'asc' });
const ACTIVITY_LIST_OPTIONS = Object.freeze({
  filter: ['all', 'in-progress', 'completed', 'cancelled', 'high', 'medium', 'low'],
  field: ['date', 'title', 'priority', 'status'], direction: ['asc', 'desc'],
});

const formatDate = activityDateLabel;

const getBirthdayAge = (value) => {
  if (!value) return null;

  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const birthdayThisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  let age = today.getFullYear() - birthDate.getFullYear();
  if (todayDate < birthdayThisYear) age -= 1;

  return Math.max(age, 0);
};

export default function EventWorkspaceShell() {
  const { eventId } = useParams();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  return <EventWorkspaceContent key={JSON.stringify([user?.uid, isGuest, getActiveSampleScenario(user?.uid), eventId])} />;
}

export function EventWorkspaceContent() {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceNavRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const attachmentContextRef = useRef(null);
  const memoryContextRef = useRef(null);
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || EMPTY_GREETING_TEMPLATES);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes || EMPTY_MOMENT_TYPES);
  const showToast = useAppStore((state) => state.showToast);
  const eventState = useEventStore();
  const { loading, error, loadEvents, updateEventItem, deleteEventItem } = eventState;
  const expenseState = useExpenseStore();
  const { loadExpenses } = expenseState;
  const finance = useMomentFinance(eventId);
  const mutationContext = records.capture();
  const [activityAnnouncement, setActivityAnnouncement] = useState('');
  const activitySavingRef = useRef(false);
  const [activityBusy, setActivityBusy] = useState(false);
  const { saveTransaction } = useTransactionManager();
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityDescription, setActivityDescription] = useState('');
  const [activityPriority, setActivityPriority] = useState('medium');
  const [activityList, changeActivityList, resetActivityList] = usePersistentListState(`activities:${eventId}`, ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_OPTIONS);
  const { search: activitySearch, filter: activityFilter, field: activitySort, direction: activitySortDirection } = activityList;
  const setActivitySearch = (search) => changeActivityList({ search });
  const setActivityFilter = (filter) => changeActivityList({ filter });
  const setActivitySort = (field) => changeActivityList({ field, direction: 'asc' });
  const toggleActivitySortDirection = () => changeActivityList((current) => ({ direction: current.direction === 'asc' ? 'desc' : 'asc' }));
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryBody, setMemoryBody] = useState('');
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [pendingDeleteMemory, setPendingDeleteMemory] = useState(null);
  const [pendingDeleteAttachment, setPendingDeleteAttachment] = useState(null);
  const [attachmentDraft, setAttachmentDraft] = useState(null);
  const [attachmentActivityId, setAttachmentActivityId] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const attachmentSavingRef = useRef(false);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(false);
  const [eventEditOpen, setEventEditOpen] = useState(false);
  const [linkExpenseActivity, setLinkExpenseActivity] = useState(null);
  const [expenseError, setExpenseError] = useState('');
  const [transactionActivity, setTransactionActivity] = useState(null);
  const [transactionBusy, setTransactionBusy] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const transactionSavingRef = useRef(false);
  const transactionContext = `${user?.uid || (isGuest ? 'guest' : 'local')}:${eventId}`;
  const transactionContextRef = useRef(transactionContext);
  transactionContextRef.current = transactionContext;
  const [greetingDialogOpen, setGreetingDialogOpen] = useState(false);
  const [greetingTitleDraft, setGreetingTitleDraft] = useState('');
  const [greetingBodyDraft, setGreetingBodyDraft] = useState('');
  const workspaceScope = `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
  const sample = getActiveSampleScenario(user?.uid);
  const ready = isRecordScopeLoaded(eventState, workspaceScope, sample);
  const events = ready ? eventState.events : [];
  const expenses = isRecordScopeLoaded(expenseState, workspaceScope, sample) ? expenseState.expenses : [];
  const workspaceMountedRef = useRef(false);
  const workspaceIdentityRef = useRef('');
  workspaceIdentityRef.current = `${workspaceScope}:${eventId}`;

  const resolveCreateMoment = (context) => {
    const session = useAppStore.getState();
    const currentScope = `${session.isGuest ? 'guest' : 'user'}:${session.user?.uid || 'anonymous'}`;
    const current = useEventStore.getState();
    if (!workspaceMountedRef.current || workspaceIdentityRef.current !== `${workspaceScope}:${eventId}`
      || !context || context.eventId !== eventId || context.scope !== workspaceScope
      || (!session.user && !session.isGuest) || currentScope !== workspaceScope
      || current.loadedFor !== workspaceScope || current.activeLoadKey !== workspaceScope) return null;
    return current.events.find((moment) => (recordId(moment.id) || recordId(moment.firestoreId)) === eventId) || null;
  };

  useEffect(() => {
    workspaceMountedRef.current = true;
    const receiveCreate = (request) => {
      const context = request.detail;
      if (!['memory', 'attachment'].includes(context?.kind) || !resolveCreateMoment(context)) return;
      if (context.kind === 'memory') {
        memoryContextRef.current = { eventId, scope: workspaceScope };
        setMemoryDialogOpen(true);
      } else {
        attachmentContextRef.current = { eventId, scope: workspaceScope };
        attachmentInputRef.current?.click();
      }
    };
    window.addEventListener('dn:moment-create', receiveCreate);
    return () => {
      workspaceMountedRef.current = false;
      window.removeEventListener('dn:moment-create', receiveCreate);
      attachmentContextRef.current = null;
      memoryContextRef.current = null;
    };
  }, [eventId, workspaceScope]);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [isGuest, loadEvents, loadExpenses, user]);

  useEffect(() => {
    if (!location.search.includes('create=activity')) return;
    setEditingActivityId(null);
    setActivityTitle('');
    setActivityDescription('');
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityPriority('medium');
    setActivityError('');
    setActivityDialogOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => setMemoryExpanded(false), [eventId]);

  const event = events.find((item) => (item.id || item.firestoreId) === eventId);

  useLayoutEffect(() => {
    const nav = workspaceNavRef.current;
    if (!nav) return undefined;
    let frame;
    const revealActiveLink = () => {
      const activeLink = nav.querySelector('[aria-current="page"]');
      if (!activeLink) return;
      const bounds = nav.getBoundingClientRect();
      const activeBounds = activeLink.getBoundingClientRect();
      const visibleLeft = bounds.left + nav.clientLeft;
      const visibleRight = visibleLeft + nav.clientWidth;
      const adjustment = activeBounds.left < visibleLeft ? activeBounds.left - visibleLeft
        : activeBounds.right > visibleRight ? activeBounds.right - visibleRight : 0;
      // Adjust this strip only; never move the page vertically when selecting a tab.
      if (Math.abs(adjustment) > 1) nav.scrollLeft += adjustment;
    };
    const scheduleReveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(revealActiveLink);
    };
    revealActiveLink();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleReveal) : null;
    observer?.observe(nav);
    nav.querySelectorAll('a').forEach((link) => observer?.observe(link));
    window.addEventListener('resize', scheduleReveal);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleReveal);
    };
  }, [location.pathname, event?.id]);

  if (eventState.activeLoadKey === workspaceScope && error === 'Unable to load events.') {
    return <section role="alert"><h1>Moment couldn’t be loaded</h1><p>Please try again.</p><button type="button" className="secondaryButton" onClick={() => loadEvents(user?.uid, isGuest)}>Try again</button></section>;
  }
  if (!ready || loading) return <LoadingSkeleton rows={6} label="Loading Moment workspace" />;

  if (!event) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0 }}>Moment not found</h2>
        <p style={{ margin: 0, color: 'var(--ink-soft)' }}>This Moment may have been removed or is not available in the current session.</p>
        <Link to="/events" style={{ color: 'var(--primary)', fontWeight: 700 }}>Back to Moments</Link>
      </div>
    );
  }

  const sections = [
    { label: 'Overview', path: `/events/${encodeURIComponent(eventId)}/overview`, detail: 'Event details and current status', icon: FileText },
    { label: 'Activities', path: `/events/${encodeURIComponent(eventId)}/activities`, detail: `${event.activities?.length || 0} activities captured`, icon: ListChecks },
    { label: 'Transactions', path: `/events/${encodeURIComponent(eventId)}/transactions`, detail: 'Income and expenses linked to this Moment', icon: Receipt },
    { label: 'Timeline', path: `/events/${encodeURIComponent(eventId)}/timeline`, detail: 'Milestones and progress', icon: Clock3 },
    { label: 'Memories', path: `/events/${encodeURIComponent(eventId)}/memories`, detail: `${event.memories?.length || 0} memories saved`, icon: BookHeart },
    { label: 'Attachments', path: `/events/${encodeURIComponent(eventId)}/attachments`, detail: `${event.attachments?.length || 0} keepsakes attached`, icon: Images },
  ];
  const sectionName = getMomentWorkspaceSection(location.pathname);
  const activeSection = sections.find((section) => section.label.toLowerCase() === sectionName) || sections[0];
  const birthdayAge = String(event.type || '').toLowerCase() === 'birthday' ? getBirthdayAge(event.date) : null;
  const activities = [...(event.activities || [])].sort((first, second) => {
    const dateOrder = new Date(first.date || '9999-12-31').getTime() - new Date(second.date || '9999-12-31').getTime();
    let result = dateOrder;
    if (activitySort === 'title') result = String(first.title || '').localeCompare(String(second.title || ''), undefined, { sensitivity: 'base' });
    if (activitySort === 'priority') {
      const priorityRank = { high: 3, medium: 2, low: 1 };
      result = (priorityRank[String(first.priority || 'medium').toLowerCase()] || 0) - (priorityRank[String(second.priority || 'medium').toLowerCase()] || 0);
    }
    if (activitySort === 'status') {
      const statusRank = (activity) => {
        if (activity.cancelled || activity.status === 'cancelled') return 3;
        if (activity.completed) return 2;
        const activityDate = new Date(`${String(activity.date || '').slice(0, 10)}T00:00:00`);
        return activityDate > new Date(new Date().setHours(0, 0, 0, 0)) ? 1 : 0;
      };
      result = statusRank(first) - statusRank(second);
    }
    if (!result && activitySort !== 'date') result = dateOrder;
    return activitySortDirection === 'desc' ? -result : result;
  });
  const filteredActivities = activities.filter((activity) => {
    const matchesSearch = String(activity.title || '').toLowerCase().includes(activitySearch.trim().toLowerCase());
    const isCancelled = activity.cancelled || activity.status === 'cancelled';
    if (activityFilter === 'cancelled') return isCancelled && matchesSearch;
    if (isCancelled) return false;
    const matchesFilter = activityFilter === 'all'
      || (activityFilter === 'in-progress' && !activity.completed)
      || (activityFilter === 'completed' && activity.completed)
      || (activity.priority || 'medium') === activityFilter;
    return matchesSearch && matchesFilter;
  });
  const eventExpenses = expenses.filter((expense) => expense.eventId === eventId);
  const expensesByActivity = Object.fromEntries(activities.map((activity) => [
    activity.id,
    eventExpenses.filter((expense) => expense.activityId === activity.id),
  ]));
  const linkableExpenses = expenses.filter((expense) => (
    !expense.activityId && (!expense.eventId || expense.eventId === eventId)
  ));
  const totalSpent = finance.summary.expense;
  const activeActivities = activities.filter((activity) => !activity.cancelled && activity.status !== 'cancelled');
  const completedActivities = activeActivities.filter((activity) => activity.completed).length;
  const memoryCount = (event.memories || []).length;
  const attachments = event.attachments || [];
  const latestMemory = [...(event.memories || [])].sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0))[0];
  const latestMemoryBody = String(latestMemory?.body || '');
  const latestMemoryNeedsExpansion = latestMemoryBody.length > 110 || latestMemoryBody.split(/\r\n|\r|\n/).length > 3;
  const eventDateValue = new Date(event.date || event.startDate || event.createdAt);
  const validEventDate = !Number.isNaN(eventDateValue.getTime());
  const daysUntilEvent = validEventDate ? Math.ceil((new Date(eventDateValue.getFullYear(), eventDateValue.getMonth(), eventDateValue.getDate()).getTime() - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()) / 86400000) : null;
  const eventStyle = String(event.type || '').toLowerCase();
  const eventMood = eventStyle.includes('birth') || eventStyle.includes('wedding') || eventStyle.includes('engagement') ? 'celebration' : eventStyle.includes('vacation') || eventStyle.includes('travel') ? 'travel' : eventStyle.includes('investment') || eventStyle.includes('insurance') || eventStyle.includes('finance') ? 'finance' : eventStyle.includes('anniversary') || eventStyle.includes('marriage') ? 'romance' : 'life';
  const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
  const generatedGreeting = getEventGreeting(event, greetingTemplates, momentTypes) || {
    title: `A moment worth celebrating: ${event.name || event.type || 'today'}`,
    body: event.notes || 'Wishing you a beautiful day filled with meaning and memories to treasure.',
  };
  const eventGreeting = event.greetingCard?.title
    ? event.greetingCard
    : generatedGreeting;

  const openGreetingCard = () => {
    setGreetingTitleDraft(eventGreeting.title || '');
    setGreetingBodyDraft(eventGreeting.body || '');
    setGreetingDialogOpen(true);
  };

  const saveGreetingCard = async (submitEvent) => {
    submitEvent.preventDefault();
    const greetingCard = { title: greetingTitleDraft.trim(), body: greetingBodyDraft, updatedAt: new Date().toISOString() };
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, greetingCard });
      setGreetingDialogOpen(false);
      showToast('Greeting card saved', 'success');
    } catch {
      showToast('Could not save this greeting card', 'danger');
    }
  };

  const downloadGreetingCard = () => {
    const html = buildGreetingCardHtml({ title: greetingTitleDraft, body: greetingBodyDraft, momentName: event.name, momentType: event.type, dateLabel: formatDate(event.date) });
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${(event.name || 'dn-greeting').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-greeting.html`);
  };

  const runActivityWrite = async (operation, after) => {
    if (activitySavingRef.current) return;
    activitySavingRef.current = true; setActivityBusy(true); setActivityError('');
    try {
      await operation();
      if (workspaceMountedRef.current && records.isCurrent(mutationContext)) after?.();
    } catch (reason) {
      if (workspaceMountedRef.current && records.isCurrent(mutationContext)) {
        setActivityError(reason?.message || 'Could not save this activity. Please try again.');
        showToast('Could not save this activity. Please try again.', 'danger');
      }
      throw reason;
    } finally { activitySavingRef.current = false; if (workspaceMountedRef.current && records.isCurrent(mutationContext)) setActivityBusy(false); }
  };
  const addActivity = (submitEvent) => {
    submitEvent.preventDefault();
    if (!activityTitle.trim()) { setActivityError('Enter an activity title.'); return; }
    const values = { title: activityTitle.trim(), date: activityDate, description: activityDescription, priority: activityPriority };
    return runActivityWrite(() => editingActivityId
      ? records.mutateActivity(mutationContext, eventId, editingActivityId, () => values)
      : records.mutateMoment(mutationContext, eventId, (latest) => ({ ...latest, activities: [...(latest.activities || []), {
        ...values, id: crypto.randomUUID(), eventId, completed: false, completedAt: null, createdAt: new Date().toISOString(),
      }] })), () => { setActivityTitle(''); setActivityDescription(''); setEditingActivityId(null); setActivityDialogOpen(false); }).catch(() => {});
  };

  const editActivity = (activity) => {
    setPendingDeleteActivity(null);
    setActivityError('');
    setEditingActivityId(activity.id);
    setActivityTitle(activity.title || '');
    setActivityDescription(activity.description || '');
    setActivityDate(formatMomentDate(parseMomentDate(activity.date)));
    setActivityPriority(activity.priority || 'medium');
    setActivityDialogOpen(true);
  };

  const linkExistingExpense = async (expense) => {
    try {
      // Use the same master + activity-mirror coordinator as Transactions.
      // Directly updating the expense alone leaves nested activity copies stale.
      await saveTransaction({
        transactionKind: 'expense',
        title: expense.name || expense.description || 'Expense',
        amount: expense.amount,
        category: expense.category || 'Other',
        date: expense.date,
        notes: expense.notes || expense.description || '',
        eventId,
        activityId: linkExpenseActivity.id,
      }, { ...expense, transactionKind: 'expense' });
      setLinkExpenseActivity(null);
      setExpenseError('');
      showToast('Transaction linked to activity', 'success');
    } catch {
      setExpenseError('Could not link this expense. Please try again.');
    }
  };

  const openActivityTransaction = (activity) => {
    if (transactionSavingRef.current) return;
    setTransactionError('');
    setLinkExpenseActivity(null);
    setTransactionActivity({ eventId, activityId: activity.id, date: activity.date, context: transactionContext });
  };

  const closeActivityTransaction = () => {
    if (transactionSavingRef.current) return;
    setTransactionActivity(null);
    setTransactionError('');
  };

  const saveActivityTransaction = async (form) => {
    if (transactionSavingRef.current) return;
    transactionSavingRef.current = true;
    setTransactionBusy(true);
    setTransactionError('');
    const context = transactionContext;
    try {
      await saveTransaction(form);
      if (transactionContextRef.current === context) {
        setTransactionActivity(null);
        showToast('Transaction added', 'success');
      }
    } catch (saveError) {
      if (transactionContextRef.current === context) setTransactionError(saveError?.message || 'Could not save this transaction.');
      throw saveError;
    } finally {
      transactionSavingRef.current = false;
      setTransactionBusy(false);
    }
  };

  const removeActivity = (activityId) => runActivityWrite(() => records.mutateActivity(mutationContext, eventId, activityId, () => null),
    () => setPendingDeleteActivity(null)).catch(() => {});
  const toggleActivity = (activityId, view) => runActivityWrite(() => records.mutateActivity(mutationContext, eventId, activityId,
    (activity, moment) => activityCompletionPatch(activity, moment, activityStatus(view) !== 'completed')),
  () => setActivityAnnouncement(activityStatus(view) === 'completed' ? 'Activity reopened' : 'Activity completed')).catch(() => {});
  const toggleActivityCancellation = (activityId) => runActivityWrite(() => records.mutateActivity(mutationContext, eventId, activityId, (activity) => {
    const cancelled = activity.cancelled || activity.status === 'cancelled';
    return { cancelled: !cancelled, status: cancelled ? activity.completed ? 'completed' : 'in-progress' : 'cancelled' };
  }), () => setActivityAnnouncement('Activity status updated')).catch(() => {});

  const saveNotes = async (submitEvent) => {
    submitEvent.preventDefault();
    await updateEventItem(user?.uid, isGuest, { ...event, notes: notesDraft });
    setNotesDialogOpen(false);
  };

  const saveMemory = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!memoryTitle.trim()) return;
    const currentMoment = resolveCreateMoment(memoryContextRef.current);
    if (!currentMoment) {
      showToast('This Moment is no longer available in the active session. Please reopen it.', 'danger');
      return;
    }
    await updateEventItem(user?.uid, isGuest, {
      ...currentMoment,
      memories: [...(currentMoment.memories || []), {
        id: crypto.randomUUID(),
        title: memoryTitle.trim(),
        body: memoryBody,
        createdAt: new Date().toISOString(),
      }],
    });
    setMemoryTitle('');
    setMemoryBody('');
    setMemoryDialogOpen(false);
  };

  const removeMemory = async (memoryId) => {
    await updateEventItem(user?.uid, isGuest, { ...event, memories: (event.memories || []).filter((memory) => memory.id !== memoryId) });
    setPendingDeleteMemory(null);
  };

  const addAttachment = (changeEvent) => {
    const input = changeEvent.target;
    const file = input.files?.[0];
    const context = attachmentContextRef.current;
    const currentMoment = resolveCreateMoment(context);
    attachmentContextRef.current = null;
    input.value = '';
    if (!file || !currentMoment) return;
    if (!file.size || file.size > MAX_ATTACHMENT_BYTES) { showToast('Choose a file between 1 byte and 10 MB.', 'danger'); return; }
    setAttachmentError('');
    setAttachmentActivityId('');
    setAttachmentDraft({ file, context });
  };
  const saveAttachment = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!attachmentDraft || attachmentSavingRef.current) return;
    const { file, context } = attachmentDraft;
    attachmentSavingRef.current = true;
    setAttachmentBusy(true); setAttachmentError('');
    try {
      if (!resolveCreateMoment(context)) throw new Error('This Moment is no longer available in the active session. Please reopen it.');
      const reference = await attachmentRepository.save(file, { uid: user?.uid, isGuest, sample: Boolean(getActiveSampleData(user?.uid)), assertCurrent: () => {
        if (!resolveCreateMoment(context)) throw new Error('Your session changed. Reopen this Moment before attaching the file.');
      } });
      const currentMoment = resolveCreateMoment(context);
      if (!currentMoment) throw new Error('Your session changed. Reopen this Moment before attaching the file.');
      if (attachmentActivityId && !currentMoment.activities?.some((activity) => recordId(activity.id) === attachmentActivityId)) throw new Error('The chosen activity is no longer available.');
      await updateEventItem(user?.uid, isGuest, { ...currentMoment, attachments: [...(currentMoment.attachments || []), {
        id: crypto.randomUUID(), name: file.name, type: file.type || 'application/octet-stream', size: file.size,
        createdAt: new Date().toISOString(), ...reference, ...(attachmentActivityId ? { activityId: attachmentActivityId } : {}),
      }] });
      setAttachmentDraft(null);
      showToast('Original file saved', 'success');
    } catch (reason) { setAttachmentError(reason?.message || 'Unable to save the original file. Please try again.'); }
    finally { attachmentSavingRef.current = false; setAttachmentBusy(false); }
  };

  const removeAttachment = async (attachmentId) => {
    await updateEventItem(user?.uid, isGuest, { ...event, attachments: (event.attachments || []).filter((attachment) => attachment.id !== attachmentId) });
    setPendingDeleteAttachment(null);
  };

  const editEventDetails = async (formValues) => {
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, ...formValues });
      setEventEditOpen(false);
      showToast('Moment updated', 'success');
    } catch { showToast('Unable to update moment', 'danger'); }
  };
  const archiveMoment = async () => {
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, archived: !event.archived });
      showToast(event.archived ? 'Moment restored' : 'Moment archived', 'success');
    } catch { showToast('Could not update archive state', 'danger'); }
  };

  const printSummary = () => window.print();

  const removeEvent = async () => {
    try {
      await deleteEventItem(user?.uid, isGuest, eventId);
      navigate('/events');
      setPendingDeleteEvent(false);
    } catch (deleteError) {
      console.error('Event deletion failed:', deleteError);
    }
  };

  const renderSectionContent = () => {
    if (activeSection.label === 'Overview') {
      return (
        <div className="event-moment-overview">
          <MomentContents moment={event} finance={finance} />

          {event.notes ? <section className="event-reflection-note"><div className="event-overview-section-title"><span>Why this moment matters</span><button type="button" onClick={() => { setNotesDraft(event.notes || ''); setNotesDialogOpen(true); }}>Edit</button></div><RichText value={event.notes} className="free-text-content" /></section> : null}
        </div>
      );
    }

    if (activeSection.label === 'Transactions') return <LinkedTransactions eventId={eventId} />;

    if (activeSection.label === 'Activities' || activeSection.label === 'Timeline') {
      if (activeSection.label === 'Timeline') {
        return activities.length ? (
          <div className="timeline-list">
                {activities.map((activity) => (
              <div key={activity.id} className="timeline-item">
                <span>{formatDate(activity.date)}</span>
                <Link to={activityDetailPath(eventId, activity.id)}>{activity.title || 'Untitled activity'}</Link>
                    <small className={activity.cancelled || activity.status === 'cancelled' ? 'is-cancelled' : activity.completed ? 'is-complete' : 'is-pending'}>{activity.cancelled || activity.status === 'cancelled' ? 'Cancelled' : activity.completed ? 'Completed' : 'In progress'}</small>
                {activity.description ? <RichText value={activity.description} className="free-text-content" /> : null}
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, color: 'var(--ink-soft)' }}>Add an activity to start this event timeline.</p>;
      }

      return (
        <div className="workspace-activities">
          <ListControls
            title="Activity filters"
            activeCount={Number(Boolean(activitySearch.trim())) + Number(activityFilter !== 'all') + Number(activitySort !== 'date' || activitySortDirection !== 'asc')}
            resultCount={filteredActivities.length}
            resultLabel="activities"
            summary={[
              ({ all: 'Active activities', 'in-progress': 'In Progress', completed: 'Completed', cancelled: 'Cancelled', high: 'High Priority', medium: 'Medium Priority', low: 'Low Priority' })[activityFilter],
              `${({ date: 'Due date', title: 'Title', priority: 'Priority', status: 'Status' })[activitySort]} ${activitySortDirection === 'asc' ? '↑' : '↓'}`,
              activitySearch.trim() ? `Search: ${activitySearch.trim()}` : '',
            ].filter(Boolean).join(' · ')}
            hasSort
            onReset={resetActivityList}
            sort={<div className="dn-list-controls-field">
              <span>Sort by</span>
              <SortControl className="activity-sort-select" field={activitySort} direction={activitySortDirection} onFieldChange={setActivitySort} onToggleDirection={toggleActivitySortDirection} options={[{ value: 'date', label: 'Due date' }, { value: 'title', label: 'Title' }, { value: 'priority', label: 'Priority' }, { value: 'status', label: 'Status' }]} label="Sort activities" />
            </div>}
            search={<input id="activity-filter-search" type="search" value={activitySearch} onChange={(changeEvent) => setActivitySearch(changeEvent.target.value)} placeholder="Search activities" aria-label="Search activities by title" />}
          >
          <div className="dn-list-controls-field">
            <span>Status or priority</span>
            <DropdownSelect value={activityFilter} onChange={(changeEvent) => setActivityFilter(changeEvent.target.value)} aria-label="Filter activities">
              {[
                ['all', 'All'],
                ['in-progress', 'In Progress'],
                ['completed', 'Completed'],
                ['cancelled', 'Cancelled'],
                ['high', 'High Priority'],
                ['medium', 'Medium Priority'],
                ['low', 'Low Priority'],
              ].map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </DropdownSelect>
          </div>
          </ListControls>
          <ActivityList
            eventName={event.name || 'This life moment'}
            activities={filteredActivities}
            allActivities={activities}
            showCancelled={activityFilter === 'cancelled'}
            hasActiveFilters={Boolean(activitySearch.trim()) || activityFilter !== 'all'}
            expensesByActivity={expensesByActivity}
            renderAttachments={(activity) => <AttachmentGallery compact uid={user?.uid} isGuest={isGuest} attachments={attachments.filter((attachment) => recordId(attachment.activityId) === recordId(activity.id))} />}
            onOpen={(activity) => navigate(activityDetailPath(eventId, activity.id))}
            onToggleComplete={toggleActivity}
            onToggleCancelled={toggleActivityCancellation}
            onAddExpense={openActivityTransaction}
            onLinkExpense={(activity) => { setExpenseError(''); setLinkExpenseActivity(activity); }}
            onEdit={editActivity}
            onDelete={(activityId) => setPendingDeleteActivity(activities.find((activity) => activity.id === activityId))}
          />
        </div>
      );
    }

    if (activeSection.label === 'Attachments') {
      return (
        <div className="workspace-resource-list">
          {event.attachments?.length ? <AttachmentGallery uid={user?.uid} isGuest={isGuest} attachments={attachments} onRemove={setPendingDeleteAttachment} /> : <div className="workspace-empty-surface"><Images size={24} /><strong>Keep the important pieces together</strong><p>Use + to attach original photos and files to this Moment or one of its activities.</p></div>}
        </div>
      );
    }

    if (activeSection.label === 'Memories') {
      return (
        <div className="workspace-resource-list">
          {event.memories?.length ? event.memories.map((memory) => (
            <div className="workspace-resource-row workspace-memory-card" key={memory.id}><span className="workspace-memory-kind"><BookHeart size={15} />{/decision/i.test(memory.title || '') ? 'Key decision' : /milestone|first|achievement/i.test(memory.title || '') ? 'Milestone' : 'Memory note'}</span><div><strong>{memory.title}</strong><RichText className="workspace-memory-body free-text-preview is-truncated" value={memory.body || 'A memory worth keeping.'} /><small>{formatDate(memory.createdAt)}</small></div><button type="button" onClick={() => setPendingDeleteMemory(memory)} style={styles.iconButtonDanger} aria-label={`Remove ${memory.title}`}><Trash2 size={15} /></button></div>
          )) : <div className="workspace-empty-surface"><BookHeart size={24} /><strong>Memory space ready</strong><p>Capture the stories and favorite moments that make {event.name} meaningful.</p></div>}
        </div>
      );
    }

    return <div className="workspace-empty-surface"><Download size={24} /><strong>Export summary</strong><p>A printable summary for {event.name} will be available here.</p><button type="button" className="primaryButton" onClick={printSummary} style={styles.primaryButton}>Print summary</button></div>;
  };

  return (
    <div className="event-workspace-shell">
      <div className="event-workspace-back-row">
        <Link to="/events" className="event-moment-back"><ArrowLeft size={15} /> All moments</Link>
      </div>
      <SwipeActionCard as="section" className="dn-moment-hero-swipe" label={event.name || 'Moment'}
        otherActions={[
          { label: 'Edit', icon: Pencil, onClick: () => setEventEditOpen(true) },
          { label: event.archived ? 'Restore' : 'Archive', icon: event.archived ? ArchiveRestore : Archive, onClick: archiveMoment },
        ]} onDelete={() => setPendingDeleteEvent(true)}>
      <header className={`event-moment-hero mood-${eventMood}`}>
        <div className="event-moment-cover" aria-hidden="true"><span>{eventMood === 'celebration' ? '✳' : eventMood === 'travel' ? '◒' : eventMood === 'romance' ? '♡' : eventMood === 'finance' ? '⌁' : '✦'}</span></div>
        <div className="event-moment-topline">
          <span className="event-moment-kicker" title={event.type === 'Other' ? event.customType || 'Life moment' : event.type || 'Life moment'}>
            <Sparkles size={13} aria-hidden="true" /> {event.type === 'Other' ? event.customType || 'Life moment' : event.type || 'Life moment'}
          </span>
          <div className="event-moment-top-actions">
            <button type="button" className="event-moment-copy-action" onClick={openGreetingCard} aria-label="Preview and edit greeting card"><Sparkles size={17} strokeWidth={1.9} /><span>Greeting</span></button>

          </div>
        </div>
        <div className="event-moment-content">
          <h1>{event.name}</h1>
          <div className="event-moment-date">
            <span className="event-moment-date-value"><CalendarDays size={15} /> {formatDate(event.date)}</span>
            {birthdayAge !== null ? <span className="event-moment-turning">· Turning {birthdayAge + 1}</span> : null}
            <span className="event-moment-countdown">· {daysUntilEvent === null ? 'Date to be decided' : daysUntilEvent > 0 ? `${daysUntilEvent} ${daysUntilEvent === 1 ? 'day' : 'days'} remaining` : daysUntilEvent === 0 ? 'Today is the day' : `${Math.abs(daysUntilEvent)} days since this moment`}</span>
          </div>
          <div className="event-moment-stat-line" aria-label="Moment highlights"><strong>{activities.length}</strong> Steps <i>·</i> <strong>{memoryCount}</strong> Memories <i>·</i> <strong>{currency(totalSpent)}</strong> Spent</div>
        </div>
      </header>
      </SwipeActionCard>

      <nav ref={workspaceNavRef} className="event-workspace-nav" aria-label={`${event.name} sections`}>
        {sections.map((section) => (
          <Link
            key={section.label}
            to={section.path}
            className={`event-workspace-nav-item${activeSection.label === section.label ? ' is-active' : ''}`}
            aria-current={activeSection.label === section.label ? 'page' : undefined}
          >
            <section.icon size={16} />
            <span>{section.label}</span>
            {section.label === 'Activities' && activities.length ? <small>{activities.length}</small> : null}
            {section.label === 'Memories' && memoryCount ? <small>{memoryCount}</small> : null}
          </Link>
        ))}
      </nav>

      <p className="sr-only" role="status" aria-live="polite">{activityAnnouncement}</p>
      {activityBusy ? <p role="status">Saving activity…</p> : null}
      {activityError && !activityDialogOpen && !pendingDeleteActivity ? <p className="quick-create-error" role="alert">{activityError}</p> : null}
      <input ref={attachmentInputRef} type="file" hidden aria-label="Add attachment" onChange={addAttachment} />
      <main className={`event-workspace-section-panel event-section-${activeSection.label.toLowerCase()}`}>
        <div className="event-section-heading">
          <span>{activeSection.label === 'Overview' ? 'The story' : activeSection.label === 'Activities' ? 'The little things that make it happen' : activeSection.label === 'Memories' ? 'Hold on to this' : activeSection.detail}</span>
          <h2>{activeSection.label === 'Overview' ? 'A moment worth keeping' : activeSection.label === 'Activities' ? 'Plans for this moment' : activeSection.label === 'Memories' ? 'Memories' : activeSection.label}</h2>
        </div>
        {error ? <p style={styles.errorText}>{error}</p> : null}
        {renderSectionContent()}
      </main>

      {greetingDialogOpen ? (
        <ModalDialog title="Greeting card" onClose={() => setGreetingDialogOpen(false)} className="event-greeting-editor-modal">
          <GreetingCard title={greetingTitleDraft} body={greetingBodyDraft} momentName={event.name} momentType={event.type} dateLabel={formatDate(event.date)} />
          <form className="form-surface event-greeting-editor" onSubmit={saveGreetingCard}>
            <label>Greeting title<input value={greetingTitleDraft} onChange={(changeEvent) => setGreetingTitleDraft(changeEvent.target.value)} maxLength={120} required /></label>
            <RichTextEditor label="Message" value={greetingBodyDraft} onChange={setGreetingBodyDraft} rows={4} required />
            <div className="event-greeting-editor-actions">
              <button type="button" className="secondaryButton" onClick={downloadGreetingCard}><Download size={15} /> Download card</button>
              <button type="button" className="event-greeting-close-button" onClick={() => setGreetingDialogOpen(false)}><X size={15} /> Close</button>
              <button type="submit" className="primaryButton"><Save size={15} /> Save greeting</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {attachmentDraft ? <ModalDialog title="Save attachment" onClose={() => { if (!attachmentSavingRef.current) setAttachmentDraft(null); }}>
        <form className="form-surface" onSubmit={saveAttachment} style={{ display: 'grid', gap: '12px' }}>
          <p style={{ margin: 0, overflowWrap: 'anywhere' }}>{attachmentDraft.file.name} <small>· {Math.ceil(attachmentDraft.file.size / 1024)} KB</small></p>
          {attachmentError ? <p className="quick-create-error" role="alert">{attachmentError}</p> : null}
          <label htmlFor="attachment-activity">Keep with</label>
          <DropdownSelect id="attachment-activity" value={attachmentActivityId} disabled={attachmentBusy} onChange={(changeEvent) => setAttachmentActivityId(changeEvent.target.value)}>
            <option value="">This Moment</option>
            {activities.map((activity) => <option key={activity.id} value={recordId(activity.id)}>{activity.title || 'Untitled activity'}</option>)}
          </DropdownSelect>
          <div className="form-actions"><button type="button" className="secondaryButton" disabled={attachmentBusy} onClick={() => setAttachmentDraft(null)}>Cancel</button><button type="submit" className="primaryButton" disabled={attachmentBusy}>{attachmentBusy ? 'Saving original…' : 'Save attachment'}</button></div>
        </form>
      </ModalDialog> : null}
      {activityDialogOpen ? (
        <ModalDialog title={editingActivityId ? 'Edit activity' : 'Add activity'} className="event-activity-editor-modal" onClose={() => { if (!activitySavingRef.current) { setActivityDialogOpen(false); setEditingActivityId(null); setActivityError(''); } }}>
          <form aria-busy={activityBusy} onSubmit={addActivity} style={{ display: 'grid', gap: '12px' }}>
            {activityError ? <p className="quick-create-error" role="alert">{activityError}</p> : null}
            <input value={activityTitle} onChange={(submitEvent) => setActivityTitle(submitEvent.target.value)} placeholder="Activity title" style={styles.input} autoFocus />
            <DateField label="Date" name="activity-date" value={activityDate} onChange={(submitEvent) => setActivityDate(submitEvent.target.value)} />
            <DropdownSelect value={activityPriority} onChange={(submitEvent) => setActivityPriority(submitEvent.target.value)} aria-label="Activity priority">
              {getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
            <RichTextEditor label="Activity notes" value={activityDescription} onChange={setActivityDescription} placeholder="Description (optional)" rows={4} />
            <div className="dialog-actions" style={styles.dialogActions}>
              <button type="button" className="secondaryButton" disabled={activityBusy} onClick={() => setActivityDialogOpen(false)}>Cancel</button>
              <button type="submit" disabled={activityBusy} className="primaryButton" style={styles.primaryButton}>{editingActivityId ? 'Save activity' : 'Add activity'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {linkExpenseActivity ? (
        <ModalDialog title={`Link expense · ${linkExpenseActivity.title || 'Activity'}`} onClose={() => setLinkExpenseActivity(null)}>
          {expenseError ? <p className="quick-create-error" role="alert">{expenseError}</p> : null}
          {linkableExpenses.length ? <div className="activity-expense-link-list">{linkableExpenses.map((expense) => <button type="button" className="activity-expense-link-option" key={expense.id || expense.firestoreId} onClick={() => linkExistingExpense(expense)}><span><strong>{expense.name || expense.description || 'Expense'}</strong><small>{expense.category || 'Other'} · {formatDate(expense.date)}</small></span><b>{currency(expense.amount)}</b></button>)}</div> : <p className="activity-expense-link-empty">No unlinked expenses are available. Add a transaction for this activity instead.</p>}
          <div className="activity-expense-link-footer"><button type="button" className="secondaryButton" onClick={() => openActivityTransaction(linkExpenseActivity)}><Plus size={15} aria-hidden="true" /> Add transaction</button><button type="button" className="secondaryButton" onClick={() => setLinkExpenseActivity(null)}>Close</button></div>
        </ModalDialog>
      ) : null}
      {transactionActivity?.context === transactionContext ? (
        <ModalDialog title="Add Transaction" className="dn-transaction-dialog" onClose={closeActivityTransaction}>
          {transactionError ? <p className="dn-transaction-form-error" role="alert">{transactionError}</p> : null}
          <TransactionForm defaultKind="expense" presetLink={transactionActivity} events={events}
            onSubmit={saveActivityTransaction} busy={transactionBusy} onCancel={closeActivityTransaction} />
        </ModalDialog>
      ) : null}
      {notesDialogOpen ? (
        <ModalDialog title="Edit event notes" onClose={() => setNotesDialogOpen(false)}>
          <form onSubmit={saveNotes} style={{ display: 'grid', gap: '12px' }}>
            <RichTextEditor label="Moment notes" value={notesDraft} onChange={setNotesDraft} placeholder="What should you remember about this event?" rows={7} autoFocus />
            <div className="dialog-actions" style={styles.dialogActions}>
              <button type="button" className="secondaryButton" onClick={() => setNotesDialogOpen(false)}>Cancel</button>
              <button type="submit" className="primaryButton" style={styles.primaryButton}>Save notes</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {memoryDialogOpen ? (
        <ModalDialog title="Add memory" onClose={() => setMemoryDialogOpen(false)}>
          <form onSubmit={saveMemory} style={{ display: 'grid', gap: '12px' }}>
            <input value={memoryTitle} onChange={(eventChange) => setMemoryTitle(eventChange.target.value)} placeholder="Memory title" style={styles.input} autoFocus />
            <RichTextEditor label="Memory notes" value={memoryBody} onChange={setMemoryBody} placeholder="What do you want to remember?" rows={6} />
            <div className="dialog-actions" style={styles.dialogActions}><button type="button" className="secondaryButton" onClick={() => setMemoryDialogOpen(false)}>Cancel</button><button type="submit" className="primaryButton" style={styles.primaryButton}>Save memory</button></div>
          </form>
        </ModalDialog>
      ) : null}
      {pendingDeleteMemory ? <ConfirmDialog title="Remove memory?" message={`Remove “${pendingDeleteMemory.title}” from this event?`} onCancel={() => setPendingDeleteMemory(null)} onConfirm={() => removeMemory(pendingDeleteMemory.id)} /> : null}
      {pendingDeleteAttachment ? <ConfirmDialog title="Remove attachment?" message={`Remove “${pendingDeleteAttachment.name}” from this event?`} onCancel={() => setPendingDeleteAttachment(null)} onConfirm={() => removeAttachment(pendingDeleteAttachment.id)} /> : null}
      {pendingDeleteActivity ? (
        <ConfirmDialog
          title="Remove activity?"
          message={`Remove “${pendingDeleteActivity.title || 'Untitled activity'}” from this event?`}
          onCancel={() => { if (!activitySavingRef.current) setPendingDeleteActivity(null); }}
          busy={activityBusy} error={activityError}
          onConfirm={() => removeActivity(pendingDeleteActivity.id)}
        />
      ) : null}
      {eventEditOpen ? (
        <ModalDialog title="Edit Moment" onClose={() => setEventEditOpen(false)}>
          <EventForm initialValues={event} onSubmit={editEventDetails}
            onCancel={() => setEventEditOpen(false)} submitLabel="Save Changes" />
        </ModalDialog>
      ) : null}
      {pendingDeleteEvent ? (
        <ConfirmDialog
          title="Delete event?"
          message={`Delete “${event.name}” and its activities? This cannot be undone.`}
          onCancel={() => setPendingDeleteEvent(false)}
          onConfirm={removeEvent}
        />
      ) : null}
    </div>
  );
}

const styles = {
  input: {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
  },
  primaryButton: {
    justifySelf: 'start',
    border: 'none',
    borderRadius: '10px',
    background: '#2d6a4f',
    color: '#ffffff',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  deleteButton: {
    marginTop: '10px',
    border: '1px solid #efcaca',
    borderRadius: '8px',
    background: '#fff1f1',
    color: '#9d3c3c',
    padding: '7px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  editButton: {
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
    padding: '7px 10px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  iconButton: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '34px',
    height: '34px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'var(--surface)',
    color: 'var(--ink-soft)',
    cursor: 'pointer',
  },
  iconButtonDanger: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '34px',
    height: '34px',
    border: '1px solid #ebcaca',
    borderRadius: '10px',
    background: '#fff5f5',
    color: '#b76060',
    cursor: 'pointer',
  },
  errorText: {
    margin: '0 0 12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: '#fff1f1',
    color: '#9d3c3c',
    border: '1px solid #efcaca',
  },
  deleteEventButton: {
    border: '1px solid #efcaca',
    borderRadius: '9px',
    background: '#fff1f1',
    color: '#9d3c3c',
    padding: '8px 11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(20, 39, 32, 0.32)',
  },
  modal: {
    width: 'min(520px, 100%)',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    padding: '20px',
    borderRadius: '16px',
    background: 'var(--surface)',
    color: 'var(--ink)',
    boxShadow: '0 20px 60px rgba(21, 57, 45, 0.2)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
    cursor: 'pointer',
    fontSize: '1.2rem',
  },
  dialogActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  cancelButton: {
    border: '1px solid var(--border)',
    borderRadius: '9px',
    background: 'var(--surface)',
    color: 'var(--ink)',
    padding: '10px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmButton: {
    border: '1px solid #b84b4b',
    borderRadius: '9px',
    background: '#b84b4b',
    color: '#ffffff',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  textAction: {
    border: 0,
    padding: 0,
    minHeight: 0,
    background: 'transparent',
    color: 'var(--primary)',
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
