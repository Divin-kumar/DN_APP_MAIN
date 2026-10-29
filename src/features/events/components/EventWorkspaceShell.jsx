import { currentEntryTime } from '../../../utils/activityTime.js';
import { activityTime as savedMomentTime, compareActivityDateTime } from '../../../utils/activityTime.js';
import ActivityTimeField from '../../../components/common/ActivityTimeField';
import DebouncedFilterInput from '../../../components/common/DebouncedFilterInput';
// This is the single-event workspace.
// It is the full detail page for one life moment and its existing linked records.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Archive, ArchiveRestore, ArrowLeft, CalendarDays, Download, FileText, Images, ListChecks, Pencil, Receipt, Save, Search, Sparkles, X } from 'lucide-react';
import ActivityList from '../../../components/events/ActivityList';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import GreetingCard, { buildGreetingCardHtml } from '../../../components/common/GreetingCard';
import { attachmentRepository, MAX_ATTACHMENT_BYTES } from '../../../services/attachmentService';
import { getActiveSampleData, getActiveSampleScenario } from '../../../dev/sampleData';
import SwipeActionCard from '../../../components/common/SwipeActionCard';
import EventForm from '../../../components/events/EventForm';
import DateField from '../../../components/common/DateField';
import RichTextEditor from '../../../components/common/RichTextEditor';
import RichText from '../../../components/common/RichText';
import DropdownSelect from '../../../components/common/DropdownSelect';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import useExpenseStore from '../../../store/useExpenseStore';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import { downloadBlob } from '../../../utils/download';
import { getEventGreeting } from '../../../utils/greeting';
import { getActiveCodeListMeta } from '../../../utils/codeLists';
import usePersistentListState from '../../../hooks/usePersistentListState';
import useConditionFilters from '../../../hooks/useConditionFilters';
import ConditionBuilder, { ConditionChips } from '../../../components/common/ConditionBuilder';
import { activityConditions as migrateActivityConditions, activityConditionRecord } from '../../../utils/listConditionMigration';
import SortControl from '../../../components/common/SortControl';
import ListControls from '../../../components/common/ListControls';
import { getMomentWorkspaceSection } from '../../../utils/momentWorkspaceRoutes';
import { recordId } from '../../../utils/recordIdentity';
import { scopedRecordActions as records } from '../../../services/scopedRecordActions';
import { isRecordScopeLoaded } from '../../../utils/scopedRecordActions';
import { activityDateLabel, activityDetailPath, activityStatusTransitionPatch } from '../../../utils/activityDetail';
import useMomentFinance from '../../../hooks/useMomentFinance';
import LinkedTransactions from '../../finance/components/LinkedTransactions';
import MomentContents from './MomentContents';
import MomentStory from './MomentStory';
import MomentPdfStudio from '../../../components/events/MomentPdfStudio';
import { formatMomentDate, getNextBirthdayAge, getNextOccurrenceDate } from '../../../utils/momentDates';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';

const EMPTY_GREETING_TEMPLATES = Object.freeze({});
const EMPTY_MOMENT_TYPES = Object.freeze([]);
const ACTIVITY_LIST_DEFAULTS = Object.freeze({ search: '', filter: 'all', field: 'date', direction: 'asc' });
const ACTIVITY_LIST_OPTIONS = Object.freeze({
  filter: ['all', 'in-progress', 'completed', 'cancelled', 'high', 'medium', 'low'],
  field: ['date', 'title', 'priority', 'status'], direction: ['asc', 'desc'],
});

const formatDate = activityDateLabel;

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
  const activitySavingRef = useRef(false);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState(() => formatMomentDate(new Date()));
  const [activityTime, setActivityTime] = useState(currentEntryTime);
  const [activityDescription, setActivityDescription] = useState('');
  const [activityPriority, setActivityPriority] = useState('medium');
  const [activityList, changeActivityList, resetActivityList] = usePersistentListState(`activities:${eventId}`, ACTIVITY_LIST_DEFAULTS, ACTIVITY_LIST_OPTIONS);
  const { search: activitySearch, filter: activityFilter, field: activitySort, direction: activitySortDirection } = activityList;
  const setActivitySearch = (search) => changeActivityList({ search });
  const setActivityFilter = (filter) => changeActivityList({ filter });
  const setActivitySort = (field) => changeActivityList({ field, direction: 'asc' });
  const toggleActivitySortDirection = () => changeActivityList((current) => ({ direction: current.direction === 'asc' ? 'desc' : 'asc' }));
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [pendingDeleteAttachment, setPendingDeleteAttachment] = useState(null);
  const [pendingTaskCancellation, setPendingTaskCancellation] = useState(null);
  const [attachmentDraft, setAttachmentDraft] = useState(null);
  const [attachmentActivityId, setAttachmentActivityId] = useState('');
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const attachmentSavingRef = useRef(false);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(false);
  const [eventEditOpen, setEventEditOpen] = useState(false);
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
      if (context?.kind !== 'attachment' || !resolveCreateMoment(context)) return;
      attachmentContextRef.current = { eventId, scope: workspaceScope };
      attachmentInputRef.current?.click();
    };
    window.addEventListener('dn:moment-create', receiveCreate);
    return () => {
      workspaceMountedRef.current = false;
      window.removeEventListener('dn:moment-create', receiveCreate);
      attachmentContextRef.current = null;
    };
  }, [eventId, workspaceScope]);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [isGuest, loadEvents, loadExpenses, user]);

  useEffect(() => {
    if (!location.search.includes('create=activity')) return;
    setActivityTitle('');
    setActivityTime(currentEntryTime());
    setActivityDescription('');
    setActivityDate(formatMomentDate(new Date()));
    setActivityPriority('medium');
    setActivityError('');
    setActivityDialogOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);


  const event = events.find((item) => (item.id || item.firestoreId) === eventId);
  const conditionRecords = useMemo(() => (event?.activities || []).map(activityConditionRecord), [event?.activities]);
  const activityConditions = useConditionFilters(`moment-activities:${eventId}`, conditionRecords, usePersistentListState, { initialGroup: migrateActivityConditions(activityList, true), contextKey: getActiveSampleScenario(user?.uid) });

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
    { key: 'story', label: 'Story', path: `/events/${encodeURIComponent(eventId)}/story`, detail: 'Your Moment, in your words', icon: FileText },
    { key: 'activities', label: 'Activities', path: `/events/${encodeURIComponent(eventId)}/activities`, detail: `${event.activities?.length || 0} activities captured`, icon: ListChecks },
    { key: 'transactions', label: 'Transactions', path: `/events/${encodeURIComponent(eventId)}/transactions`, detail: 'Income and expenses linked to this Moment', icon: Receipt },
    { key: 'gallery', label: 'Gallery', path: `/events/${encodeURIComponent(eventId)}/gallery`, detail: `${event.attachments?.length || 0} keepsakes attached`, icon: Images },
    { key: 'pdf', label: 'PDF Studio', path: `/events/${encodeURIComponent(eventId)}/pdf`, detail: 'Customize and preview your pages', icon: Download },
  ];
  const sectionName = getMomentWorkspaceSection(location.pathname);
  const activeSection = sections.find((section) => section.key === sectionName) || sections[0];
  const birthdayAge = String(event.type || '').toLowerCase() === 'birthday' ? getNextBirthdayAge(event.date) : null;
  const activities = [...(event.activities || [])].sort((first, second) => {
    const dateOrder = compareActivityDateTime(first, second, activitySortDirection);
    let result = 0;
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
    return result ? (activitySortDirection === 'desc' ? -result : result) : dateOrder;
  });
  const filteredActivities = activities.filter((activity) => {
    const matchesSearch = [activity.title, activity.description].some((value) => String(value || '').toLowerCase().includes(activitySearch.trim().toLowerCase()));
    return matchesSearch && activityConditions.matches(activityConditionRecord(activity));
  });
  const totalSpent = finance.summary.expense;
  const memoryCount = (event.memories || []).length;
  const attachments = event.attachments || [];
  const eventDateValue = getNextOccurrenceDate(event);
  const today = new Date();
  const daysUntilEvent = eventDateValue ? (Date.UTC(eventDateValue.getFullYear(), eventDateValue.getMonth(), eventDateValue.getDate())
    - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000 : null;
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
  const commitTaskStatus = (activityId, targetStatus) => {
    if (activitySavingRef.current) return Promise.resolve();
    return runActivityWrite(
    () => records.mutateActivity(mutationContext, eventId, activityId,
      (activity, moment) => activityStatusTransitionPatch(activity, moment, targetStatus),
      'status:' + targetStatus),
    () => showToast(targetStatus === 'completed' ? 'Task completed'
      : targetStatus === 'cancelled' ? 'Task cancelled' : 'Task moved to In progress', 'success'),
  ).catch(() => {});
  };

  const requestTaskStatus = (activityId, targetStatus) => {
    if (activitySavingRef.current) return;
    if (targetStatus === 'cancelled') {
      const item = event.activities?.find((activity) => recordId(activity.id) === recordId(activityId));
      if (!item) return;
      setPendingTaskCancellation({ activityId, title: item.title || 'Untitled task' });
      return;
    }
    return commitTaskStatus(activityId, targetStatus);
  };

  const confirmTaskCancellation = async () => {
    if (!pendingTaskCancellation) return;
    const { activityId } = pendingTaskCancellation;
    // Closing first returns focus to the original status control; failure
    // remains visible through the workspace error message and toast.
    setPendingTaskCancellation(null);
    await commitTaskStatus(activityId, 'cancelled');
  };

  const addActivity = (submitEvent) => {
    submitEvent.preventDefault();
    if (!activityTitle.trim()) { setActivityError('Enter an activity title.'); return; }
    const values = { title: activityTitle.trim(), date: activityDate, time: activityTime, description: activityDescription, priority: activityPriority };
    return runActivityWrite(() => records.mutateMoment(mutationContext, eventId, (latest) => ({ ...latest, activities: [...(latest.activities || []), {
        ...values, id: crypto.randomUUID(), eventId, completed: false, completedAt: null, createdAt: new Date().toISOString(),
      }] })), () => { setActivityTitle(''); setActivityDescription(''); setActivityTime(currentEntryTime()); setActivityDialogOpen(false); }).catch(() => {});
  };

  const saveNotes = async (submitEvent) => {
    submitEvent.preventDefault();
    await updateEventItem(user?.uid, isGuest, { ...event, notes: notesDraft });
    setNotesDialogOpen(false);
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
    if (activeSection.key === 'story') {
      return (
        <div className="event-moment-overview dn-v2-story-overview">
          <MomentStory moment={event} momentTypes={momentTypes} uid={user?.uid} isGuest={isGuest}
            onEditIntro={() => { setNotesDraft(event.notes || ''); setNotesDialogOpen(true); }}
            onTaskStatusChange={requestTaskStatus} taskStatusBusy={activityBusy} />
          <MomentContents moment={event} finance={finance} />
        </div>
      );
    }

    if (activeSection.label === 'Transactions') return <LinkedTransactions eventId={eventId} />;

    if (activeSection.label === 'Activities') {
      return (
        <div className="workspace-activities">
          <ListControls title="Activity filters" builder hasSort
            activeCount={activityConditions.activeCount} resultCount={filteredActivities.length} resultLabel="activities"
            chips={<ConditionChips filter={activityConditions} />}
            summary={activitySort + (activitySortDirection === 'asc' ? ' ↑' : ' ↓')}
            canReset={Boolean(activityConditions.activeCount || activitySearch || activitySort !== 'date' || activitySortDirection !== 'asc')} onReset={() => { resetActivityList(); activityConditions.clear(); }}
            sort={<div className="dn-list-controls-field"><span>Sort by</span>
              <SortControl className="activity-sort-select" field={activitySort} direction={activitySortDirection} onFieldChange={setActivitySort} onToggleDirection={toggleActivitySortDirection} options={[{ value: 'date', label: 'Due date' }, { value: 'title', label: 'Title' }, { value: 'priority', label: 'Priority' }, { value: 'status', label: 'Status' }]} label="Sort activities" />
            </div>}
            search={<DebouncedFilterInput scopeKey={activityConditions.editorKey} id="activity-filter-search" type="search" value={activitySearch} onChange={(changeEvent) => setActivitySearch(changeEvent.target.value)} placeholder="Search activities" aria-label="Search activities by title" />}>
            <ConditionBuilder filter={activityConditions} title="Moment Activity conditions" />
          </ListControls>
          <ActivityList readOnly
            eventName={event.name || 'This life moment'}
            activities={filteredActivities}
            allActivities={activities} progressActivities={filteredActivities}
            includeCancelled
            hasActiveFilters={Boolean(activitySearch.trim()) || Boolean(activityConditions.activeCount)}
            onOpen={(activity) => navigate(activityDetailPath(eventId, activity.id), { state: {
              activityOrigin: `/events/${encodeURIComponent(eventId)}/activities`,
              activitySequence: {
                scope: JSON.stringify([mutationContext.scope, mutationContext.sample]),
                ids: filteredActivities.map((item) => [recordId(eventId), recordId(item.id)]),
                momentId: recordId(eventId),
              },
            } })}

          />
        </div>
      );
    }

    if (activeSection.key === 'gallery') {
      return (
        <div className="workspace-resource-list">
          <p className="moment-empty-state">Original files stay in this browser. Use a backup to move them to another device.</p>
          {event.attachments?.length ? <AttachmentGallery uid={user?.uid} isGuest={isGuest} attachments={attachments} onRemove={setPendingDeleteAttachment} /> : <div className="workspace-empty-surface"><Images size={24} /><strong>Keep the important pieces together</strong><p>Use + to attach original photos and files to this Moment or one of its activities.</p></div>}
        </div>
      );
    }

    return <MomentPdfStudio key={eventId} event={event} />;
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
            <span className="event-moment-date-value"><CalendarDays size={15} /> {formatDate(event.date)}{savedMomentTime(event) ? ` · ${savedMomentTime(event)}` : ''}</span>
            {birthdayAge !== null ? <span className="event-moment-turning">· Turning {birthdayAge}</span> : null}
            <span className="event-moment-countdown">· {daysUntilEvent === null ? 'Date to be decided' : daysUntilEvent > 0 ? `${daysUntilEvent} ${daysUntilEvent === 1 ? 'day' : 'days'} remaining` : daysUntilEvent === 0 ? 'Today is the day' : `${Math.abs(daysUntilEvent)} days since this moment`}</span>
          </div>
          <div className="event-moment-stat-line" aria-label="Moment highlights"><strong>{activities.length}</strong> Steps <i>·</i> <strong>{memoryCount}</strong> Reflections <i>·</i> <strong>{currency(totalSpent)}</strong> Spent</div>
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
          </Link>
        ))}
      </nav>

      {activityBusy ? <p role="status">Saving activity…</p> : null}
      {activityError && !activityDialogOpen ? <p className="quick-create-error" role="alert">{activityError}</p> : null}
      <input ref={attachmentInputRef} type="file" hidden aria-label="Add attachment" onChange={addAttachment} />
      <main className={`event-workspace-section-panel event-section-${activeSection.key}`}>
        <div className="event-section-heading">
          <span>{activeSection.key === 'story' ? 'The story' : activeSection.label === 'Activities' ? 'The little things that make it happen' : activeSection.detail}</span>
          <h2>{activeSection.key === 'story' ? 'Your Moment Story' : activeSection.label === 'Activities' ? 'Plans for this moment' : activeSection.label}</h2>
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
          <p className="moment-empty-state">Original files stay in this browser. Use a backup to move them to another device.</p>
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
        <ModalDialog title="Add activity" className="event-activity-editor-modal" onClose={() => { if (!activitySavingRef.current) { setActivityDialogOpen(false); setActivityError(''); } }}>
          <form aria-busy={activityBusy} onSubmit={addActivity} style={{ display: 'grid', gap: '12px' }}>
            {activityError ? <p className="quick-create-error" role="alert">{activityError}</p> : null}
            <input value={activityTitle} onChange={(submitEvent) => setActivityTitle(submitEvent.target.value)} placeholder="Activity title" style={styles.input} autoFocus />
            <div className="activity-date-time-row">
              <DateField label="Date" name="activity-date" value={activityDate} onChange={(submitEvent) => setActivityDate(submitEvent.target.value)} />
              <ActivityTimeField value={activityTime} onChange={setActivityTime} />
            </div>
            <DropdownSelect value={activityPriority} onChange={(submitEvent) => setActivityPriority(submitEvent.target.value)} aria-label="Activity priority">
              {getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
            <RichTextEditor label="Activity notes" value={activityDescription} onChange={setActivityDescription} placeholder="Description (optional)" rows={4} />
            <div className="dialog-actions" style={styles.dialogActions}>
              <button type="button" className="secondaryButton" disabled={activityBusy} onClick={() => setActivityDialogOpen(false)}>Cancel</button>
              <button type="submit" disabled={activityBusy} className="primaryButton" style={styles.primaryButton}>Add activity</button>
            </div>
          </form>
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
      {pendingTaskCancellation ? <ConfirmDialog title="Cancel task?"
        message={`Cancel “${pendingTaskCancellation.title}”? You can restore it later by changing its status.`}
        confirmLabel="Cancel task" busy={activityBusy} onCancel={() => setPendingTaskCancellation(null)}
        onConfirm={confirmTaskCancellation} /> : null}
      {pendingDeleteAttachment ? <ConfirmDialog title="Remove attachment?" message={`Remove “${pendingDeleteAttachment.name}” from this event?`} onCancel={() => setPendingDeleteAttachment(null)} onConfirm={() => removeAttachment(pendingDeleteAttachment.id)} /> : null}
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
