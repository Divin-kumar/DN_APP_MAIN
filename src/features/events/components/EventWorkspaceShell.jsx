// This is the single-event workspace.
// It is the full detail page for one life moment, where the user can edit the event and manage activities, notes, memories, and spending.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookHeart, CalendarDays, Check, CircleCheck, Clock3, Download, FileText, Heart, Images, ListChecks, Plus, Save, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import ActivityList from '../../../components/events/ActivityList';
import EventActionMenu from '../../../components/events/EventActionMenu';
import EventForm from '../../../components/events/EventForm';
import { duplicateEventData, eventShareDetails } from '../../../utils/eventActions';
import DateField from '../../../components/common/DateField';
import DropdownSelect from '../../../components/common/DropdownSelect';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import useExpenseStore from '../../../store/useExpenseStore';
import useTransactionManager from '../../../hooks/useTransactionManager';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import { downloadBlob } from '../../../utils/download';
import { getEventGreeting } from '../../../utils/greeting';
import { getActiveCodeListMeta } from '../../../utils/codeLists';
import usePersistentSort from '../../../hooks/usePersistentSort';
import SortControl from '../../../components/common/SortControl';

const EMPTY_GREETING_TEMPLATES = Object.freeze({});
const EMPTY_MOMENT_TYPES = Object.freeze([]);

const formatDate = (value) => {
  if (!value) return 'Date to be decided';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date to be decided'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || EMPTY_GREETING_TEMPLATES);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes || EMPTY_MOMENT_TYPES);
  const showToast = useAppStore((state) => state.showToast);
  const { events, loading, error, loadEvents, addEvent, updateEventItem, deleteEventItem } = useEventStore();
  const { expenses, loadExpenses } = useExpenseStore();
  const { saveTransaction } = useTransactionManager();
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityDescription, setActivityDescription] = useState('');
  const [activityPriority, setActivityPriority] = useState('medium');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const { field: activitySort, direction: activitySortDirection, setField: setActivitySort, toggleDirection: toggleActivitySortDirection } = usePersistentSort(`activities-${eventId}`, 'date', 'asc');
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
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(false);
  const [eventEditOpen, setEventEditOpen] = useState(false);
  const [linkExpenseActivity, setLinkExpenseActivity] = useState(null);
  const [expenseError, setExpenseError] = useState('');
  const [greetingDialogOpen, setGreetingDialogOpen] = useState(false);
  const [greetingTitleDraft, setGreetingTitleDraft] = useState('');
  const [greetingBodyDraft, setGreetingBodyDraft] = useState('');

  useEffect(() => {
    if (!user && !isGuest) return;
    if (!events.length) loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [events.length, isGuest, loadEvents, loadExpenses, user]);

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

  if (loading && !event) {
    return <p style={{ color: 'var(--ink-soft)' }}>Loading event workspace...</p>;
  }

  if (!event) {
    return (
      <div style={{ display: 'grid', gap: '14px' }}>
        <h2 style={{ margin: 0 }}>Event not found</h2>
        <p style={{ margin: 0, color: 'var(--ink-soft)' }}>This event may have been removed or is not available in the current session.</p>
        <Link to="/events" style={{ color: 'var(--primary)', fontWeight: 700 }}>Back to Events</Link>
      </div>
    );
  }

  const sections = [
    { label: 'Overview', path: `/events/${eventId}/overview`, detail: 'Event details and current status', icon: FileText },
    { label: 'Activities', path: `/events/${eventId}/activities`, detail: `${event.activities?.length || 0} activities captured`, icon: ListChecks },
    { label: 'Timeline', path: `/events/${eventId}/timeline`, detail: 'Milestones and progress', icon: Clock3 },
    { label: 'Memories', path: `/events/${eventId}/memories`, detail: `${event.memories?.length || 0} memories saved`, icon: BookHeart },
    { label: 'Attachments', path: `/events/${eventId}/attachments`, detail: `${event.attachments?.length || 0} keepsakes attached`, icon: Images },
  ];
  const activeSection = sections.find((section) => location.pathname === section.path) || sections[0];
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
  const totalSpent = eventExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
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
    const greetingCard = { title: greetingTitleDraft.trim(), body: greetingBodyDraft.trim(), updatedAt: new Date().toISOString() };
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, greetingCard });
      setGreetingDialogOpen(false);
      showToast('Greeting card saved', 'success');
    } catch {
      showToast('Could not save this greeting card', 'danger');
    }
  };

  const downloadGreetingCard = () => {
    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,viewport-fit=cover,user-scalable=no"><title>${escapeHtml(greetingTitleDraft)}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0b1020;color:#edf3ff;font-family:Inter,system-ui,sans-serif}.card{width:min(640px,100%);padding:clamp(28px,7vw,56px);border:1px solid #35445f;border-radius:28px;background:radial-gradient(circle at 100% 0,#253966,#162033 55%);box-shadow:0 28px 80px #0006}.eyebrow{color:#80aaff;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.event{margin-top:22px;color:#a7b3c8;font-size:14px}.title{margin:20px 0 12px;font-size:clamp(30px,7vw,48px);line-height:1.1;letter-spacing:-.04em}.body{color:#c1ccdf;font-size:18px;line-height:1.65;white-space:pre-wrap}</style></head><body><article class="card"><span class="eyebrow">A greeting for today</span><div class="event">${escapeHtml(event.name || event.type)} · ${escapeHtml(formatDate(event.date))}</div><h1 class="title">${escapeHtml(greetingTitleDraft)}</h1><p class="body">${escapeHtml(greetingBodyDraft)}</p></article></body></html>`;
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${(event.name || 'dn-greeting').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-greeting.html`);
  };

  const addActivity = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!activityTitle.trim()) return;
    setActivityError('');

    const existingActivity = (event.activities || []).find((item) => item.id === editingActivityId);
    const activity = {
      id: editingActivityId || crypto.randomUUID(),
      eventId,
      title: activityTitle.trim(),
      date: activityDate,
      description: activityDescription.trim(),
      completed: existingActivity?.completed || false,
      completedAt: existingActivity?.completedAt || null,
      priority: activityPriority,
      createdAt: existingActivity?.createdAt || new Date().toISOString(),
    };

    try {
      await updateEventItem(user?.uid, isGuest, {
        ...event,
        activities: editingActivityId
          ? (event.activities || []).map((item) => item.id === editingActivityId ? { ...item, ...activity } : item)
          : [...(event.activities || []), activity],
      });
      setActivityTitle('');
      setActivityDescription('');
      setEditingActivityId(null);
      setActivityDialogOpen(false);
    } catch {
      setActivityError('Could not save this activity. Please try again.');
    }
  };

  const editActivity = (activity) => {
    setPendingDeleteActivity(null);
    setActivityError('');
    setEditingActivityId(activity.id);
    setActivityTitle(activity.title || '');
    setActivityDescription(activity.description || '');
    setActivityDate(activity.date || new Date().toISOString().slice(0, 10));
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

  const removeActivity = async (activityId) => {
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).filter((activity) => activity.id !== activityId),
    });
    setPendingDeleteActivity(null);
  };

  const toggleActivity = async (activityId) => {
    const currentActivity = (event.activities || []).find((activity) => activity.id === activityId);
    if (!currentActivity) return;
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).map((activity) => (
        activity.id === activityId
          ? { ...activity, completed: !activity.completed, completedAt: activity.completed ? null : new Date().toISOString() }
          : activity
      )),
    });
  };

  const toggleActivityCancellation = async (activityId) => {
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      activities: (event.activities || []).map((activity) => (
        activity.id === activityId
          ? { ...activity, cancelled: !(activity.cancelled || activity.status === 'cancelled'), status: activity.cancelled || activity.status === 'cancelled' ? 'in-progress' : 'cancelled' }
          : activity
      )),
    });
  };

  const saveNotes = async (submitEvent) => {
    submitEvent.preventDefault();
    await updateEventItem(user?.uid, isGuest, { ...event, notes: notesDraft.trim() });
    setNotesDialogOpen(false);
  };

  const saveMemory = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!memoryTitle.trim()) return;
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      memories: [...(event.memories || []), {
        id: crypto.randomUUID(),
        title: memoryTitle.trim(),
        body: memoryBody.trim(),
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

  const addAttachment = async (changeEvent) => {
    const file = changeEvent.target.files?.[0];
    if (!file) return;
    await updateEventItem(user?.uid, isGuest, {
      ...event,
      attachments: [...(event.attachments || []), {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || 'File',
        size: file.size,
        createdAt: new Date().toISOString(),
      }],
    });
    changeEvent.target.value = '';
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
  const duplicateMoment = async () => {
    try {
      const saved = await addEvent(user?.uid, isGuest, duplicateEventData(event));
      showToast('Moment duplicated without repeating expenses', 'success');
      navigate('/events/' + (saved.id || saved.firestoreId));
    } catch { showToast('Could not duplicate moment', 'danger'); }
  };
  const archiveMoment = async () => {
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, archived: !event.archived });
      showToast(event.archived ? 'Moment restored' : 'Moment archived', 'success');
    } catch { showToast('Could not update archive state', 'danger'); }
  };
  const shareMoment = async () => {
    const details = eventShareDetails(event, isGuest, window.location.origin);
    try {
      if (navigator.share) await navigator.share(details);
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText([details.text, details.url].filter(Boolean).join('\n'));
        showToast('Moment details copied', 'success');
      } else showToast('Sharing unavailable in this browser', 'danger');
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Could not share moment', 'danger');
    }
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
          <section className="event-featured-memory">
            <div className="event-featured-memory-art"><BookHeart size={21} /><span>Memory keepsake</span></div>
            <div className="event-featured-memory-copy">
              <span className="event-overview-eyebrow"><Heart size={13} /> A piece of this moment</span>
              {latestMemory ? <><h4>{latestMemory.title || 'A memory to keep'}</h4><p className={`event-memory-story-copy free-text-preview${memoryExpanded ? ' is-expanded' : ' is-truncated'}`}>{latestMemory.body || 'A moment worth remembering, kept safe with this event.'}</p><small>{formatDate(latestMemory.createdAt)}</small>{latestMemoryNeedsExpansion ? <button type="button" className="event-memory-expand" onClick={() => setMemoryExpanded((expanded) => !expanded)}>{memoryExpanded ? 'Show less' : 'Read story'}</button> : null}</> : <><h4>Leave room for a memory</h4><p>Save the little details, stories, and feelings you will want to return to.</p><button type="button" className="primaryButton event-empty-state-cta" onClick={() => setMemoryDialogOpen(true)}><Plus size={15} /> Add your first memory</button></>}
            </div>
          </section>

          <section className="event-health-strip" aria-label="Event health">
            <div className="event-overview-section-title"><span>Event health</span><small>A gentle check-in</small></div>
            <div className="event-health-items">
              <span className={activities.length ? 'is-ready' : 'is-pending'}>{activities.length ? <CircleCheck size={15} /> : <CircleCheck size={15} />}{activities.length ? `${activities.length} steps planned` : 'Plan a few steps'}</span>
              <span className={memoryCount ? 'is-ready' : 'is-pending'}>{memoryCount ? <CircleCheck size={15} /> : <Heart size={15} />}{memoryCount ? `${memoryCount} memories saved` : 'Add a memory'}</span>
              <span className={attachments.length ? 'is-ready' : 'is-pending'}>{attachments.length ? <CircleCheck size={15} /> : <Images size={15} />}{attachments.length ? `${attachments.length} keepsakes saved` : 'No keepsakes yet'}</span>
            </div>
          </section>

          <div className="event-overview-lower-grid">
            <section className="event-upcoming-preview">
              <div className="event-overview-section-title"><span>Little next steps</span><button type="button" onClick={() => navigate(`/events/${eventId}/activities`)}>See all</button></div>
              {activities.length ? activities.slice(0, 3).map((activity) => <div className={`event-next-step${activity.completed ? ' is-complete' : ''}`} key={activity.id}><span>{activity.completed ? <Check size={14} /> : null}</span><div><strong>{activity.title || 'Untitled activity'}</strong><small>{activity.completed ? 'Complete' : formatDate(activity.date)}</small></div></div>) : <p className="event-overview-hint">A few gentle reminders can make this moment easier to enjoy.</p>}
            </section>
          </div>

          {event.notes ? <section className="event-reflection-note"><div className="event-overview-section-title"><span>Why this moment matters</span><button type="button" onClick={() => { setNotesDraft(event.notes || ''); setNotesDialogOpen(true); }}>Edit</button></div><p className="free-text-content">{event.notes}</p></section> : null}
        </div>
      );
    }

    if (activeSection.label === 'Activities' || activeSection.label === 'Timeline') {
      if (activeSection.label === 'Timeline') {
        return activities.length ? (
          <div className="timeline-list">
                {activities.map((activity) => (
              <div key={activity.id} className="timeline-item">
                <span>{formatDate(activity.date)}</span>
                <strong>{activity.title || 'Untitled activity'}</strong>
                    <small className={activity.cancelled || activity.status === 'cancelled' ? 'is-cancelled' : activity.completed ? 'is-complete' : 'is-pending'}>{activity.cancelled || activity.status === 'cancelled' ? 'Cancelled' : activity.completed ? 'Completed' : 'In progress'}</small>
                {activity.description ? <p className="free-text-content">{activity.description}</p> : null}
              </div>
            ))}
          </div>
        ) : <p style={{ margin: 0, color: 'var(--ink-soft)' }}>Add an activity to start this event timeline.</p>;
      }

      return (
        <div className="workspace-activities">
          <div className="activity-discovery-bar">
            <label className="activity-search-field"><Search size={15} aria-hidden="true" /><input value={activitySearch} onChange={(changeEvent) => setActivitySearch(changeEvent.target.value)} placeholder="Search activities" aria-label="Search activities by title" /></label>
            <div className="activity-filter-rail" role="group" aria-label="Filter activities">
              {[
                ['all', 'All'],
                ['in-progress', 'In Progress'],
                ['completed', 'Completed'],
                ['cancelled', 'Cancelled'],
                ['high', 'High Priority'],
                ['medium', 'Medium Priority'],
                ['low', 'Low Priority'],
              ].map(([value, label]) => (
                <button key={value} type="button" className={activityFilter === value ? 'is-selected' : ''} aria-pressed={activityFilter === value} onClick={() => setActivityFilter(value)}>{label}</button>
              ))}
            </div>
            <SortControl className="activity-sort-select" field={activitySort} direction={activitySortDirection} onFieldChange={setActivitySort} onToggleDirection={toggleActivitySortDirection} options={[{ value: 'date', label: 'Due date' }, { value: 'title', label: 'Title' }, { value: 'priority', label: 'Priority' }, { value: 'status', label: 'Status' }]} label="Sort activities" />
          </div>
          <ActivityList
            eventName={event.name || 'This life moment'}
            activities={filteredActivities}
            allActivities={activities}
            showCancelled={activityFilter === 'cancelled'}
            hasActiveFilters={Boolean(activitySearch.trim()) || activityFilter !== 'all'}
            expensesByActivity={expensesByActivity}
            onToggleComplete={toggleActivity}
            onToggleCancelled={toggleActivityCancellation}
            onAddExpense={(activity) => navigate('/financials/transactions?create=transaction&event=' + encodeURIComponent(eventId) + '&activity=' + encodeURIComponent(activity.id))}
            onLinkExpense={(activity) => { setExpenseError(''); setLinkExpenseActivity(activity); }}
            onEdit={editActivity}
            onDelete={(activityId) => setPendingDeleteActivity(activities.find((activity) => activity.id === activityId))}
            onAddActivity={() => { setEditingActivityId(null); setActivityTitle(''); setActivityDescription(''); setActivityDate(new Date().toISOString().slice(0, 10)); setActivityPriority('medium'); setActivityError(''); setActivityDialogOpen(true); }}
          />
        </div>
      );
    }

    if (activeSection.label === 'Attachments') {
      return (
        <div className="workspace-resource-list">
          <label className="workspace-upload-control"><Upload size={16} /> Add attachment<input type="file" onChange={addAttachment} /></label>
          {event.attachments?.length ? event.attachments.map((attachment) => (
            <div className="workspace-resource-row workspace-attachment-card" key={attachment.id}><span className="workspace-attachment-icon">{attachment.type?.startsWith('image/') ? <Images size={19} /> : <FileText size={19} />}</span><div><strong title={attachment.name}>{attachment.name}</strong><span className="workspace-attachment-meta"><i>{String(attachment.type || 'FILE').split('/').pop().toUpperCase()}</i>{Math.max(1, Math.ceil(Number(attachment.size || 0) / 1024))} KB · {formatDate(attachment.createdAt)}</span></div><button type="button" onClick={() => setPendingDeleteAttachment(attachment)} style={styles.iconButtonDanger} aria-label={`Remove ${attachment.name}`}><Trash2 size={15} /></button></div>
          )) : <div className="workspace-empty-surface"><Images size={24} /><strong>Keep the important pieces together</strong><p>Documents, photos, and keepsakes will stay attached to this event.</p></div>}
        </div>
      );
    }

    if (activeSection.label === 'Memories') {
      return (
        <div className="workspace-resource-list">
          <button type="button" className="primaryButton" onClick={() => setMemoryDialogOpen(true)} style={styles.primaryButton}><Plus size={16} aria-hidden="true" /> Add memory</button>
          {event.memories?.length ? event.memories.map((memory) => (
            <div className="workspace-resource-row workspace-memory-card" key={memory.id}><span className="workspace-memory-kind"><BookHeart size={15} />{/decision/i.test(memory.title || '') ? 'Key decision' : /milestone|first|achievement/i.test(memory.title || '') ? 'Milestone' : 'Memory note'}</span><div><strong>{memory.title}</strong><span className="workspace-memory-body free-text-preview is-truncated">{memory.body || 'A memory worth keeping.'}</span><small>{formatDate(memory.createdAt)}</small></div><button type="button" onClick={() => setPendingDeleteMemory(memory)} style={styles.iconButtonDanger} aria-label={`Remove ${memory.title}`}><Trash2 size={15} /></button></div>
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
      <header className={`event-moment-hero mood-${eventMood}`}>
        <div className="event-moment-cover" aria-hidden="true"><span>{eventMood === 'celebration' ? '✳' : eventMood === 'travel' ? '◒' : eventMood === 'romance' ? '♡' : eventMood === 'finance' ? '⌁' : '✦'}</span></div>
        <div className="event-moment-topline">
          <div className="event-moment-top-actions">
            <button type="button" className="event-moment-memory-action" onClick={() => setMemoryDialogOpen(true)} aria-label="Add memory"><BookHeart size={15} /><span>Add memory</span></button>
            <button type="button" className="event-moment-copy-action" onClick={openGreetingCard} aria-label="Preview and edit greeting card"><Sparkles size={15} /><span>Greeting card</span></button>
            <EventActionMenu className="is-hero" event={event}
              onEdit={() => setEventEditOpen(true)} onDuplicate={duplicateMoment}
              onShare={shareMoment} onArchive={archiveMoment}
              onDelete={() => setPendingDeleteEvent(true)} />
          </div>
        </div>
        <div className="event-moment-content">
          <span className="event-moment-kicker"><Sparkles size={13} /> {event.type === 'Other' ? event.customType || 'Life moment' : event.type || 'Life moment'}</span>
          <h1>{event.name}</h1>
          <div className="event-moment-date">
            <span className="event-moment-date-value"><CalendarDays size={15} /> {formatDate(event.date)}</span>
            {birthdayAge !== null ? <span className="event-moment-turning">· Turning {birthdayAge + 1}</span> : null}
            <span className="event-moment-countdown">· {daysUntilEvent === null ? 'Date to be decided' : daysUntilEvent > 0 ? `${daysUntilEvent} ${daysUntilEvent === 1 ? 'day' : 'days'} remaining` : daysUntilEvent === 0 ? 'Today is the day' : `${Math.abs(daysUntilEvent)} days since this moment`}</span>
          </div>
          <div className="event-moment-stat-line" aria-label="Moment highlights"><strong>{activities.length}</strong> Steps <i>·</i> <strong>{memoryCount}</strong> Memories <i>·</i> <strong>{currency(totalSpent)}</strong> Spent</div>
        </div>
      </header>

      <nav className="event-workspace-nav" aria-label={`${event.name} sections`}>
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

      <main className={`event-workspace-section-panel event-section-${activeSection.label.toLowerCase()}`}>
        <div className={`event-section-heading${activeSection.label === 'Activities' && activities.length ? ' has-activity-action' : ''}`}>
          <span>{activeSection.label === 'Overview' ? 'The story' : activeSection.label === 'Activities' ? 'The little things that make it happen' : activeSection.label === 'Memories' ? 'Hold on to this' : activeSection.detail}</span>
          <h2>{activeSection.label === 'Overview' ? 'A moment worth keeping' : activeSection.label === 'Activities' ? 'Plans for this moment' : activeSection.label === 'Memories' ? 'Memories' : activeSection.label}</h2>
          {activeSection.label === 'Activities' && activities.length ? <button type="button" className="workspace-add-activity" onClick={() => { setEditingActivityId(null); setActivityTitle(''); setActivityDescription(''); setActivityDate(new Date().toISOString().slice(0, 10)); setActivityPriority('medium'); setActivityDialogOpen(true); }}><Plus size={15} aria-hidden="true" /> Add activity</button> : null}
        </div>
        {error ? <p style={styles.errorText}>{error}</p> : null}
        {renderSectionContent()}
      </main>

      {greetingDialogOpen ? (
        <ModalDialog title="Greeting card" onClose={() => setGreetingDialogOpen(false)} className="event-greeting-editor-modal">
          <div className="event-greeting-card-preview">
            <span><Sparkles size={14} /> A greeting for {event.name || 'this moment'}</span>
            <strong>{greetingTitleDraft || 'Your greeting title'}</strong>
            <p className="free-text-content">{greetingBodyDraft || 'Your greeting message will appear here.'}</p>
          </div>
          <form className="form-surface event-greeting-editor" onSubmit={saveGreetingCard}>
            <label>Greeting title<input value={greetingTitleDraft} onChange={(changeEvent) => setGreetingTitleDraft(changeEvent.target.value)} maxLength={120} required /></label>
            <label>Message<textarea value={greetingBodyDraft} onChange={(changeEvent) => setGreetingBodyDraft(changeEvent.target.value)} rows={4} maxLength={500} required /></label>
            <div className="event-greeting-editor-actions">
              <button type="button" className="secondaryButton" onClick={downloadGreetingCard}><Download size={15} /> Download card</button>
              <button type="button" className="event-greeting-close-button" onClick={() => setGreetingDialogOpen(false)}><X size={15} /> Close</button>
              <button type="submit" className="primaryButton"><Save size={15} /> Save greeting</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}

      {activityDialogOpen ? (
        <ModalDialog title={editingActivityId ? 'Edit activity' : 'Add activity'} className="event-activity-editor-modal" onClose={() => { setActivityDialogOpen(false); setEditingActivityId(null); setActivityError(''); }}>
          <form onSubmit={addActivity} style={{ display: 'grid', gap: '12px' }}>
            {activityError ? <p className="quick-create-error" role="alert">{activityError}</p> : null}
            <input value={activityTitle} onChange={(submitEvent) => setActivityTitle(submitEvent.target.value)} placeholder="Activity title" style={styles.input} autoFocus />
            <DateField label="Date" name="activity-date" value={activityDate} onChange={(submitEvent) => setActivityDate(submitEvent.target.value)} />
            <DropdownSelect value={activityPriority} onChange={(submitEvent) => setActivityPriority(submitEvent.target.value)} aria-label="Activity priority">
              {getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
            <textarea value={activityDescription} onChange={(submitEvent) => setActivityDescription(submitEvent.target.value)} placeholder="Description (optional)" style={styles.input} rows={4} />
            <div className="dialog-actions" style={styles.dialogActions}>
              <button type="button" className="secondaryButton" onClick={() => setActivityDialogOpen(false)}>Cancel</button>
              <button type="submit" className="primaryButton" style={styles.primaryButton}>{editingActivityId ? 'Save activity' : 'Add activity'}</button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {linkExpenseActivity ? (
        <ModalDialog title={`Link expense · ${linkExpenseActivity.title || 'Activity'}`} onClose={() => setLinkExpenseActivity(null)}>
          {expenseError ? <p className="quick-create-error" role="alert">{expenseError}</p> : null}
          {linkableExpenses.length ? <div className="activity-expense-link-list">{linkableExpenses.map((expense) => <button type="button" className="activity-expense-link-option" key={expense.id || expense.firestoreId} onClick={() => linkExistingExpense(expense)}><span><strong>{expense.name || expense.description || 'Expense'}</strong><small>{expense.category || 'Other'} · {formatDate(expense.date)}</small></span><b>{currency(expense.amount)}</b></button>)}</div> : <p className="activity-expense-link-empty">No unlinked expenses are available. Add a transaction for this activity instead.</p>}
          <div className="activity-expense-link-footer"><button type="button" className="secondaryButton" onClick={() => { const activity = linkExpenseActivity; setLinkExpenseActivity(null); navigate('/financials/transactions?create=transaction&event=' + encodeURIComponent(eventId) + '&activity=' + encodeURIComponent(activity.id)); }}><Plus size={15} aria-hidden="true" /> Add transaction</button><button type="button" className="secondaryButton" onClick={() => setLinkExpenseActivity(null)}>Close</button></div>
        </ModalDialog>
      ) : null}
      {notesDialogOpen ? (
        <ModalDialog title="Edit event notes" onClose={() => setNotesDialogOpen(false)}>
          <form onSubmit={saveNotes} style={{ display: 'grid', gap: '12px' }}>
            <textarea value={notesDraft} onChange={(submitEvent) => setNotesDraft(submitEvent.target.value)} placeholder="What should you remember about this event?" style={styles.input} rows={7} autoFocus />
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
            <textarea value={memoryBody} onChange={(eventChange) => setMemoryBody(eventChange.target.value)} placeholder="What do you want to remember?" style={styles.input} rows={6} />
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
          onCancel={() => setPendingDeleteActivity(null)}
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
