/*
  Events workspace: event focus mode, activity management, linked expenses, and memory export.

  In simple terms, this page is the main event dashboard.
  It shows life moments, lets the user search and filter them, open an event in detail,
  add activities, attach expenses, and manage memories or keepsakes.
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, BookHeart, CalendarDays, ClipboardList, Clock3, FileText, Pencil, Plus, Receipt, Search, Sparkles, Trash2, XCircle } from 'lucide-react';
import EventForm from '../components/events/EventForm';
import DateField from '../components/common/DateField';
import DropdownSelect from '../components/common/DropdownSelect';
import ActivityList from '../components/events/ActivityList';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { downloadBlob } from '../utils/download';
import { getActiveCodeListMeta } from '../utils/codeLists';
import { getEventStatus } from '../utils/eventStatus';
import SwipeActionCard from '../components/common/SwipeActionCard';
import usePersistentListState from '../hooks/usePersistentListState';
import SortControl from '../components/common/SortControl';
import EventSummaryDialog from '../components/events/EventSummaryDialog';
import ListControls from '../components/common/ListControls';
import RichTextEditor from '../components/common/RichTextEditor';
import RichText from '../components/common/RichText';
import { plainRichText } from '../utils/richText';

const dateLabel = (value) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const defaultMomentFilters = Object.freeze({ search: '', category: 'All moments', field: 'date', direction: 'asc' });
const momentFilterRules = { field: ['date', 'name', 'status'], direction: ['asc', 'desc'] };

const getTimelineDate = (event, referenceDate = new Date()) => {
  const baseDate = new Date(event.date || event.startDate || event.createdAt);
  if (Number.isNaN(baseDate.getTime())) return null;
  const recurrence = String(event.recurrence || '').toLowerCase();
  const recurring = event.isRecurring === true || (recurrence && recurrence !== 'none');
  if (!recurring) return baseDate;

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const candidate = recurrence === 'monthly'
    ? new Date(today.getFullYear(), today.getMonth(), baseDate.getDate())
    : new Date(today.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  if (candidate >= today) return candidate;
  return recurrence === 'monthly'
    ? new Date(today.getFullYear(), today.getMonth() + 1, baseDate.getDate())
    : new Date(today.getFullYear() + 1, baseDate.getMonth(), baseDate.getDate());
};

function EventStoryCard({ event, expenseTotal, onOpen, onSummary, onEdit, onArchive, onDelete }) {
  const date = getTimelineDate(event);
  const validDate = Boolean(date);
  const status = getEventStatus(event);
  const statusLabel = status === 'archived' ? 'Archived' : status === 'in-progress' ? 'In Progress' : status === 'completed' ? 'Completed' : 'Cancelled';
  const activities = event.activities || [];
  const memories = event.memories || [];
  const attachments = event.attachments || [];
  return (
    <SwipeActionCard className="event-story-card"
      mainClassName="event-story-main-viewport" label={event.name || 'Moment'}
      otherActions={[
        { label: 'Edit', icon: Pencil, onClick: onEdit },
        ...(onSummary ? [{ label: 'Summary', icon: ClipboardList, onClick: onSummary }] : []),
        { label: event.archived ? 'Restore' : 'Archive', icon: event.archived ? ArchiveRestore : Archive, onClick: onArchive },
      ]} onDelete={onDelete}>
        <button type="button" className="event-story-main" onClick={onOpen}
          aria-label={'Open ' + (event.name || 'event')}>
          <span className={'event-story-status status-' + status} aria-label={'Status: ' + statusLabel}>{statusLabel}</span>
          <span className="event-story-art" aria-hidden="true">
            <span>
              {validDate ? date.toLocaleDateString('en-GB', { day: '2-digit' }) : '—'}
            </span>
            <small>{validDate ? date.toLocaleDateString('en-GB', { month: 'short' }) : 'DATE'}</small>
            <i>{String(event.type || 'Life').slice(0, 1).toUpperCase()}</i>
          </span>
          <span className="event-story-copy">
            <span className="event-story-meta">
              <span>{event.type === 'Other' ? event.customType || 'Other' : event.type || 'Personal'}</span>
            </span>
            <strong>{event.name || 'A life moment'}</strong>
            <span className="event-story-date">{validDate ? dateLabel(date) : 'Date to be decided'}</span>
            {event.notes ? <RichText inline className="event-story-note free-text-preview is-truncated" value={event.notes} /> : null}
            <span className="event-story-details">
              <span><Clock3 size={13} /> {activities.length} activities</span>
              <span><BookHeart size={13} /> {memories.length} memories</span>
              <span><FileText size={13} /> {attachments.length} keepsakes</span>
              {expenseTotal > 0 ? <span><Receipt size={13} /> {currency(expenseTotal)}</span> : null}
            </span>
          </span>
        </button>
    </SwipeActionCard>
  );
}

function ActivityEventOption({ event, badge, favorite, onChoose, onToggleFavorite }) {
  const nextDate = getTimelineDate(event);
  return (
    <div className="activity-event-option">
      <button type="button" className="activity-event-option-main" onClick={onChoose}>
        <span className="activity-event-option-date"><strong>{nextDate ? nextDate.toLocaleDateString('en-GB', { day: '2-digit' }) : '—'}</strong><small>{nextDate ? nextDate.toLocaleDateString('en-GB', { month: 'short' }) : 'Date'}</small></span>
        <span className="activity-event-option-copy"><strong>{event.name || 'Life moment'}</strong><small>{event.type === 'Other' ? event.customType || 'Other' : event.type || 'Personal'} · {dateLabel(nextDate || event.date)}</small></span>
        {badge ? <span className="activity-event-option-badge">{badge}</span> : null}
      </button>
      <button type="button" className={`activity-event-favorite${favorite ? ' is-favorite' : ''}`} onClick={onToggleFavorite} aria-label={favorite ? `Remove ${event.name} from favorites` : `Favorite ${event.name}`} aria-pressed={favorite}>★</button>
    </div>
  );
}

export default function Events() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const showToast = useAppStore((state) => state.showToast);
  const events = useEventStore((state) => state.events);
  const loading = useEventStore((state) => state.loading);
  const error = useEventStore((state) => state.error);
  const loadEvents = useEventStore((state) => state.loadEvents);
  const addEvent = useEventStore((state) => state.addEvent);
  const updateEventItem = useEventStore((state) => state.updateEventItem);
  const deleteEventItem = useEventStore((state) => state.deleteEventItem);
  const expenses = useExpenseStore((state) => state.expenses);
  const loadExpenses = useExpenseStore((state) => state.loadExpenses);
  const addExpense = useExpenseStore((state) => state.addExpense);
  const [focusedId, setFocusedId] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10));
  const [activityPriority, setActivityPriority] = useState('medium');
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(null);
  const [summaryEvent, setSummaryEvent] = useState(null);
  const [pendingDeleteActivity, setPendingDeleteActivity] = useState(null);
  const [momentFilters, changeMomentFilters, resetMomentFilters] = usePersistentListState('moments', defaultMomentFilters, momentFilterRules);
  const { search, category, field: eventSort, direction: eventSortDirection } = momentFilters;
  const setSearch = (value) => changeMomentFilters({ search: value });
  const setCategory = (value) => changeMomentFilters({ category: value });
  const setEventSort = (field) => changeMomentFilters({ field, direction: 'asc' });
  const toggleEventSortDirection = () => changeMomentFilters((current) => ({ direction: current.direction === 'asc' ? 'desc' : 'asc' }));
  const [activityChooserOpen, setActivityChooserOpen] = useState(false);
  const [activityChooserEvent, setActivityChooserEvent] = useState(null);
  const [activityEventSearch, setActivityEventSearch] = useState('');
  const pickerStorageId = user?.uid || (isGuest ? 'guest' : 'local');
  const favoritesKey = `dn_favorite_event_ids_${pickerStorageId}`;
  const recentKey = `dn_recent_event_ids_${pickerStorageId}`;
  const [favoriteEventIds, setFavoriteEventIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(favoritesKey) || '[]'); } catch { return []; }
  });

  // ============================
  // Workspace data loading
  // ============================
  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
    loadExpenses(user?.uid, isGuest);
  }, [user, isGuest, loadEvents, loadExpenses]);

  const focusedEvent = useMemo(() => events.find((event) => (event.id || event.firestoreId) === focusedId) || null, [events, focusedId]);
  const eventExpenses = useMemo(() => expenses.filter((expense) => expense.eventId === focusedId), [expenses, focusedId]);
  const eventExpenseTotals = useMemo(() => {
    const totals = new Map();
    expenses.forEach((expense) => {
      if (!expense.eventId) return;
      totals.set(expense.eventId, (totals.get(expense.eventId) || 0) + Number(expense.amount || 0));
    });
    return totals;
  }, [expenses]);
  const expensesByActivity = useMemo(() => {
    if (!focusedEvent) return {};

    const merged = {};
    const addExpense = (activityId, expense) => {
      if (!activityId) return;
      if (!merged[activityId]) merged[activityId] = new Map();
      const expenseId = expense.id || expense.firestoreId || `${activityId}-${expense.date}-${expense.amount}-${expense.description}`;
      if (!merged[activityId].has(expenseId)) merged[activityId].set(expenseId, expense);
    };

    eventExpenses.forEach((expense) => addExpense(expense.activityId, expense));
    focusedEvent.activities?.forEach((activity) => {
      activity.expenses?.forEach((expense) => addExpense(activity.id, expense));
    });

    return Object.fromEntries(Object.entries(merged).map(([activityId, records]) => [activityId, [...records.values()]]));
  }, [eventExpenses, focusedEvent]);

  const actualSpent = Object.values(expensesByActivity)
    .flat()
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
    + eventExpenses.filter((expense) => !expense.activityId).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const categories = useMemo(() => ['All moments', 'Archived', ...new Set(events.filter((event) => !event.archived).map((event) => event.type || 'Personal').filter(Boolean))], [events]);
  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...events]
      .filter((event) => {
        const matchesCategory = category === 'Archived' ? Boolean(event.archived) : !event.archived && (category === 'All moments' || (event.type || 'Personal') === category);
        const matchesSearch = !query || [event.name, event.type, event.customType, plainRichText(event.notes)]
          .some((value) => String(value || '').toLowerCase().includes(query));
        return matchesCategory && matchesSearch;
      })
      .sort((first, second) => new Date(first.date || 0).getTime() - new Date(second.date || 0).getTime());
  }, [events, category, search]);
  const upcomingCount = events.filter((event) => {
    if (event.archived) return false;
    const date = getTimelineDate(event);
    return date && date >= new Date(new Date().setHours(0, 0, 0, 0));
  }).length;
  const memoryCount = events.reduce((count, event) => count + (event.memories?.length || 0) + (event.activities?.length || 0), 0);
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const compareEventDate = (first, second) => {
    const firstDate = getTimelineDate(first)?.getTime() ?? 0;
    const secondDate = getTimelineDate(second)?.getTime() ?? 0;
    return firstDate - secondDate;
  };
  const compareEventStatus = (first, second) => {
    const getRank = (event) => {
      const status = getEventStatus(event);
      if (status === 'cancelled') return 3;
      if (status === 'completed') return 2;
      const date = getTimelineDate(event);
      return date && date >= todayStart ? 1 : 0;
    };
    return getRank(first) - getRank(second);
  };
  const compareEvents = (first, second) => {
    const primary = eventSort === 'name'
      ? String(first.name || '').localeCompare(String(second.name || ''), undefined, { sensitivity: 'base' })
      : eventSort === 'status' ? compareEventStatus(first, second) : compareEventDate(first, second);
    const secondary = primary || compareEventDate(first, second);
    return eventSortDirection === 'desc' ? -secondary : secondary;
  };
  const nextMoments = visibleEvents.filter((event) => {
    if (event.archived || getEventStatus(event) === 'cancelled') return false;
    const date = getTimelineDate(event);
    return date && date >= todayStart;
  }).sort(compareEvents);
  const pastMoments = visibleEvents.filter((event) => {
    if (event.archived) return false;
    if (getEventStatus(event) === 'cancelled') return true;
    const date = getTimelineDate(event);
    return date && date < todayStart;
  }).sort(compareEvents);
  const archivedMoments = visibleEvents.filter((event) => event.archived).sort(compareEvents);
  const statusMomentGroups = [
    { label: 'In Progress', matches: (event) => getEventStatus(event) === 'in-progress' && getTimelineDate(event) < todayStart },
    { label: 'Upcoming / Planned', matches: (event) => getEventStatus(event) === 'in-progress' && getTimelineDate(event) >= todayStart },
    { label: 'Completed', matches: (event) => getEventStatus(event) === 'completed' },
    { label: 'Cancelled', matches: (event) => getEventStatus(event) === 'cancelled' },
    { label: 'Archived', matches: (event) => getEventStatus(event) === 'archived' },
  ].map((group) => ({ ...group, events: visibleEvents.filter(group.matches).sort(compareEvents) })).filter((group) => group.events.length);
  if (eventSortDirection === 'desc') statusMomentGroups.reverse();
  const pickerQuery = activityEventSearch.trim().toLowerCase();
  const pickerEvents = events.filter((event) => !event.archived && (!pickerQuery || [event.name, event.type, event.customType, event.notes].some((value) => String(value || '').toLowerCase().includes(pickerQuery))));
  const pickerById = new Map(pickerEvents.map((event) => [event.id || event.firestoreId, event]));
  const pickerFavorites = favoriteEventIds.map((id) => pickerById.get(id)).filter(Boolean);
  const pickerRecentIds = (() => {
    try { return JSON.parse(localStorage.getItem(recentKey) || '[]'); } catch { return []; }
  })();
  const pickerRecent = pickerRecentIds.map((id) => pickerById.get(id)).filter((event) => event && !favoriteEventIds.includes(event.id || event.firestoreId)).slice(0, 3);
  const pickerSuggested = [...pickerEvents].filter((event) => getTimelineDate(event) >= new Date(new Date().setHours(0, 0, 0, 0))).sort((first, second) => getTimelineDate(first) - getTimelineDate(second))[0];
  const pickerFeaturedIds = new Set([...pickerFavorites, ...pickerRecent].map((event) => event.id || event.firestoreId));
  const pickerAll = pickerEvents.filter((event) => !pickerFeaturedIds.has(event.id || event.firestoreId) && event !== pickerSuggested);

  const chooseEventForActivity = (event) => {
    const id = event.id || event.firestoreId;
    try {
      const recentIds = JSON.parse(localStorage.getItem(recentKey) || '[]').filter((recentId) => recentId !== id);
      localStorage.setItem(recentKey, JSON.stringify([id, ...recentIds].slice(0, 8)));
    } catch { /* Keep selection usable if browser storage is unavailable. */ }
    setActivityChooserOpen(false);
    setActivityChooserEvent(event);
    setActivityTitle('');
    setActivityDescription('');
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityPriority('medium');
  };

  const saveActivityFromChooser = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!activityChooserEvent || !activityTitle.trim()) return;
    const eventId = activityChooserEvent.id || activityChooserEvent.firestoreId;
    const activity = {
      id: crypto.randomUUID(),
      eventId,
      title: activityTitle.trim(),
      description: activityDescription,
      date: activityDate,
      priority: activityPriority,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    try {
      await updateEventItem(user?.uid, isGuest, { ...activityChooserEvent, activities: [...(activityChooserEvent.activities || []), activity] });
      setActivityChooserEvent(null);
      showToast('Activity saved', 'success');
      navigate(`/events/${eventId}/activities`);
    } catch {
      showToast('Could not save this activity. Please try again.', 'error');
    }
  };

  const toggleFavoriteEvent = (event) => {
    const id = event.id || event.firestoreId;
    setFavoriteEventIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
      localStorage.setItem(favoritesKey, JSON.stringify(next));
      return next;
    });
  };

  // ============================
  // Drawer and persistence actions
  // ============================
  const closeDrawer = () => {
    setDrawer(null);
    setEditingEvent(null);
    setEditingActivity(null);
    setActivityTitle('');
    setActivityDescription('');
    setActivityDate(new Date().toISOString().slice(0, 10));
    setActivityPriority('medium');
  };
  const openNewEvent = () => { setEditingEvent(null); setDrawer('event'); };
  const openEditEvent = () => { setEditingEvent(focusedEvent); setDrawer('event'); };

  useEffect(() => {
    if (!location.search.includes('create=event')) return;
    openNewEvent();
    navigate('/events', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (!location.search.includes('create=activity')) return;
    setActivityChooserOpen(true);
    navigate('/events', { replace: true });
  }, [location.search, navigate]);

  const saveEvent = async (formData) => {
    if (editingEvent) {
      await updateEventItem(user?.uid, isGuest, { ...editingEvent, ...formData, id: editingEvent.id || formData.id, activities: editingEvent.activities || [] });
      showToast('Event updated', 'success');
      closeDrawer();
    } else {
      const savedEvent = await addEvent(user?.uid, isGuest, { ...formData, activities: [] });
      showToast('Event saved', 'success');
      closeDrawer();
      navigate(`/events/${savedEvent.id || savedEvent.firestoreId}`);
    }
  };

  const toggleEventCancellation = async (event) => {
    const nextStatus = getEventStatus(event) === 'cancelled' ? 'in-progress' : 'cancelled';
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, status: nextStatus });
      showToast(nextStatus === 'cancelled' ? 'Event cancelled' : 'Event restored', 'success');
    } catch {
      showToast('Could not update event status', 'danger');
    }
  };

  const archiveMoment = async (event) => {
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, archived: !event.archived });
      showToast(event.archived ? 'Moment restored' : 'Moment archived', 'success');
    } catch { showToast('Could not update archive state', 'danger'); }
  };

  const saveActivity = async () => {
    if (!focusedEvent || !activityTitle.trim()) return;
    const activities = focusedEvent.activities || [];
    const next = {
      id: editingActivity?.id || crypto.randomUUID(),
      eventId: focusedId,
      title: activityTitle.trim(),
      description: activityDescription,
      date: activityDate || editingActivity?.date || focusedEvent.date,
      completed: editingActivity?.completed || false,
      completedAt: editingActivity?.completedAt || null,
      priority: activityPriority,
      createdAt: editingActivity?.createdAt || new Date().toISOString(),
    };
    await updateEventItem(user?.uid, isGuest, {
      ...focusedEvent,
      activities: editingActivity ? activities.map((item) => item.id === editingActivity.id ? { ...item, ...next } : item) : [...activities, next],
    });
    showToast(editingActivity ? 'Activity updated' : 'Activity saved', 'success');
    closeDrawer();
  };

  const removeActivity = async (activityId) => {
    if (!focusedEvent) return;
    await updateEventItem(user?.uid, isGuest, { ...focusedEvent, activities: (focusedEvent.activities || []).filter((item) => item.id !== activityId) });
    showToast('Activity deleted', 'danger');
    setPendingDeleteActivity(null);
  };

  const toggleActivity = async (activityId) => {
    if (!focusedEvent) return;
    await updateEventItem(user?.uid, isGuest, {
      ...focusedEvent,
      activities: (focusedEvent.activities || []).map((activity) => (
        activity.id === activityId
          ? { ...activity, completed: !activity.completed, completedAt: activity.completed ? null : new Date().toISOString() }
          : activity
      )),
    });
  };

  const toggleActivityCancellation = async (activityId) => {
    if (!focusedEvent) return;
    await updateEventItem(user?.uid, isGuest, {
      ...focusedEvent,
      activities: (focusedEvent.activities || []).map((activity) => (
        activity.id === activityId
          ? { ...activity, cancelled: !(activity.cancelled || activity.status === 'cancelled'), status: activity.cancelled || activity.status === 'cancelled' ? 'in-progress' : 'cancelled' }
          : activity
      )),
    });
  };

  const removeEvent = async (event) => {
    try {
      await deleteEventItem(user?.uid, isGuest, event.id || event.firestoreId);
      showToast('Event deleted', 'danger');
      setFocusedId(null);
      setPendingDeleteEvent(null);
    } catch (deleteError) {
      console.error('Event deletion failed:', deleteError);
      showToast('Delete failed', 'danger');
    }
  };

  // ============================
  // Memory album export
  // ============================
  const exportAlbum = (format) => {
    if (!focusedEvent) return;
    const activityText = (focusedEvent.activities || []).map((item) => `<article class="memory-card"><h2>${item.title}</h2><p class="date">${dateLabel(item.date)}</p><p>${item.description || 'A memory from this event.'}</p><strong>₹${(expensesByActivity[item.id] || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0).toLocaleString('en-IN')} spent</strong></article>`).join('');
    const html = `<html><head><title>${focusedEvent.name} Memory Album</title><style>@page{size:A4;margin:0}body{margin:0;background:#f6efe5;color:#3b2f2a;font-family:Georgia,serif}.page{min-height:100vh;box-sizing:border-box;padding:80px 70px;page-break-after:always;display:flex;flex-direction:column;justify-content:center}.cover{text-align:center;background:linear-gradient(135deg,#f0d8c8,#f8efe4)}h1{font-size:64px;margin:0 0 18px}.kicker{letter-spacing:4px;text-transform:uppercase;color:#9a6d5b}.date{color:#9a6d5b;font-style:italic}.memory-card{background:#fffaf4;border:1px solid #e3cfc0;border-radius:22px;padding:28px;margin:18px 0;box-shadow:0 10px 24px rgba(104,70,51,.08)}.memory-card strong{color:#a6533d}.closing{text-align:center}</style></head><body><section class="page cover"><p class="kicker">A memory to keep</p><h1>${focusedEvent.name}</h1><p>${dateLabel(focusedEvent.date)}</p><p>${focusedEvent.type} · DN Memories</p></section><section class="page"><p class="kicker">Our memories</p><h1>${focusedEvent.name}</h1><p>${focusedEvent.notes || 'A collection of moments, people, and stories from this special day.'}</p><p>${focusedEvent.activities?.length || 0} memories captured</p></section><section class="page"><p class="kicker">The moments</p>${activityText}</section><section class="page closing"><p class="kicker">Until next time</p><h1>${focusedEvent.name}</h1><p>${focusedEvent.activities?.length || 0} activities</p><h2>₹${actualSpent.toLocaleString('en-IN')} spent</h2><p>${focusedEvent.notes || 'Thank you for being part of this memory.'}</p></section></body></html>`;
    if (format === 'pdf') {
      const popup = window.open('', '_blank');
      if (!popup) return;
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      let printed = false;
      const printPopup = () => {
        if (printed) return;
        printed = true;
        popup.print();
      };
      popup.onload = printPopup;
      window.setTimeout(printPopup, 350);
    } else {
      const blob = new Blob([html], { type: 'application/msword' });
      downloadBlob(blob, `${focusedEvent.name}-memory-album.doc`);
    }
  };

  if (focusedEvent) {
    return (
      <div className="events-page event-workspace-page" style={styles.page}>
        <div style={styles.workspaceHeader}>
          <button type="button" className="secondaryButton" onClick={() => setFocusedId(null)} style={styles.backButton}>← Back to Events</button>
          <div style={styles.workspaceActions}><button type="button" className="secondaryButton" onClick={openEditEvent} style={styles.secondaryButton}>Edit Event</button><button type="button" className="secondaryButton" onClick={() => exportAlbum('pdf')} style={styles.secondaryButton}>PDF</button><button type="button" className="secondaryButton" onClick={() => exportAlbum('doc')} style={styles.secondaryButton}>Word</button></div>
        </div>
        <header style={styles.workspaceTitle}><span style={styles.eyebrow}>Event workspace</span><h2 style={styles.title}>{focusedEvent.name}</h2><div style={styles.metaRow}><span>{dateLabel(focusedEvent.date)}</span><span style={styles.metaDivider}>·</span><span>{focusedEvent.type}</span><span style={styles.metaDivider}>·</span><span>Activities: {focusedEvent.activities?.length || 0}</span><span style={styles.metaDivider}>·</span><span>Total spent: {currency(actualSpent)}</span></div></header>
        <section className="workspace-panel" style={styles.panel}><div style={styles.panelHeader}><h3 style={styles.sectionTitle}>Activities</h3><button type="button" className="primaryButton" onClick={() => { setEditingActivity(null); setActivityTitle(''); setActivityDescription(''); setActivityDate(focusedEvent.date || new Date().toISOString().slice(0, 10)); setActivityPriority('medium'); setDrawer('activity'); }} style={styles.primaryButton}><Plus size={16} aria-hidden="true" /> Add Activity</button></div><ActivityList activities={focusedEvent.activities || []} expensesByActivity={expensesByActivity} onEdit={(activity) => { setEditingActivity(activity); setActivityTitle(activity.title); setActivityDescription(activity.description || ''); setActivityDate(activity.date || focusedEvent.date || new Date().toISOString().slice(0, 10)); setActivityPriority(activity.priority || 'medium'); setDrawer('activity'); }} onAddExpense={(activity) => navigate('/financials/transactions?create=transaction&event=' + encodeURIComponent(focusedEvent.id || focusedEvent.firestoreId) + '&activity=' + encodeURIComponent(activity.id))} onDelete={(activityId) => setPendingDeleteActivity((focusedEvent.activities || []).find((item) => item.id === activityId))} onToggleComplete={toggleActivity} onToggleCancelled={toggleActivityCancellation} /></section>
        {pendingDeleteActivity ? <ConfirmDialog title="Remove activity?" message={`Remove “${pendingDeleteActivity.title || 'Untitled activity'}” from this event?`} onCancel={() => setPendingDeleteActivity(null)} onConfirm={() => removeActivity(pendingDeleteActivity.id)} /> : null}
        {drawer ? <Drawer type={drawer} event={focusedEvent} editingEvent={editingEvent} editingActivity={editingActivity} activityTitle={activityTitle} activityDescription={activityDescription} activityDate={activityDate} activityPriority={activityPriority} setActivityTitle={setActivityTitle} setActivityDescription={setActivityDescription} setActivityDate={setActivityDate} setActivityPriority={setActivityPriority} onClose={closeDrawer} onSaveEvent={saveEvent} onSaveActivity={saveActivity} /> : null}
      </div>
    );
  }

  const renderEventCard = (event) => (
    <EventStoryCard
      key={event.id || event.firestoreId}
      event={event}
      expenseTotal={eventExpenseTotals.get(event.id || event.firestoreId) || 0}
      onOpen={() => navigate(`/events/${event.id || event.firestoreId}`)}
      onSummary={() => setSummaryEvent(event)}
      onEdit={() => { setEditingEvent(event); setDrawer('event'); }}
      onArchive={() => archiveMoment(event)}
      onDelete={() => setPendingDeleteEvent(event)}
    />
  );

  return (
    <div className="events-page life-timeline-page">
      <header className="life-timeline-heading">
        <div>
          <span className="life-timeline-eyebrow"><Sparkles size={13} /> Your story, over time</span>
          <h2>Life moments</h2>
          <p>A place for the days, people, and little details you want to keep close.</p>
        </div>
        <div className="life-timeline-stats" aria-label="Life moments overview">
          <span><strong>{events.length}</strong> moments</span>
          <span><strong>{upcomingCount}</strong> ahead</span>
          <span><strong>{memoryCount}</strong> stories</span>
        </div>
      </header>

      <div className="event-discovery-bar">
        <ListControls title="Moment filters" hasSort
          activeCount={Number(Boolean(search.trim())) + Number(category !== 'All moments') + Number(eventSort !== 'date' || eventSortDirection !== 'asc')}
          resultCount={visibleEvents.length} resultLabel="moments"
          summary={[category, `${eventSort === 'name' ? 'Name' : eventSort === 'status' ? 'Status' : 'Date'} ${eventSortDirection === 'asc' ? '↑' : '↓'}`, search.trim() ? `Search: ${search.trim()}` : ''].filter(Boolean).join(' · ')}
          onReset={resetMomentFilters}
          sort={<div className="dn-list-controls-field">
            <span>Sort by</span>
            <SortControl className="event-sort-select" field={eventSort} direction={eventSortDirection} onFieldChange={setEventSort} onToggleDirection={toggleEventSortDirection} options={[{ value: 'date', label: 'Date' }, { value: 'name', label: 'Name' }, { value: 'status', label: 'Status' }]} label="Sort events" />
          </div>}
          search={<input id="moment-filter-search" type="search" value={search} onChange={(changeEvent) => setSearch(changeEvent.target.value)} placeholder="Find a moment" aria-label="Search events" />}>
          <div className="dn-list-controls-field">
            <label htmlFor="moment-filter-category">Category</label>
            <DropdownSelect id="moment-filter-category" aria-label="Filter by event category" value={category} onChange={(changeEvent) => setCategory(changeEvent.target.value)}>
              {!categories.includes(category) ? <option value={category}>{category}</option> : null}
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </DropdownSelect>
          </div>
        </ListControls>
      </div>

      {error ? <p style={styles.errorText}>{error}</p> : null}
      {loading ? <LoadingSkeleton rows={4} label="Loading moments" /> : error === 'Unable to load events.' ? <div className="financial-load-error" role="alert"><span>Moments couldn’t be loaded.</span><button type="button" className="settings-secondary-button" onClick={() => loadEvents(user?.uid, isGuest)}>Try again</button></div> : visibleEvents.length ? (
        <div className="life-journey">
          {eventSort === 'status' ? statusMomentGroups.map((group) => (
            <section className="life-journey-section" key={group.label}>
              <div className="life-journey-label"><CalendarDays size={16} /><div><span>{group.label}</span><small>Moments grouped by status</small></div><b>{group.events.length}</b></div>
              <div className="life-journey-items">{group.events.map(renderEventCard)}</div>
            </section>
          )) : <>
          {nextMoments.length ? (
            <section className="life-journey-section">
              <div className="life-journey-label"><CalendarDays size={16} /><div><span>On the horizon</span><small>Your next chapters</small></div><b>{nextMoments.length}</b></div>
              <div className="life-journey-items">
                {nextMoments.map(renderEventCard)}
              </div>
            </section>
          ) : null}
          {pastMoments.length ? (
            <section className="life-journey-section past-journey-section">
              <div className="life-journey-label"><BookHeart size={16} /><div><span>Life so far</span><small>Moments you have lived</small></div><b>{pastMoments.length}</b></div>
              <div className="life-journey-items">
                {pastMoments.map(renderEventCard)}
              </div>
            </section>
          ) : null}
          {archivedMoments.length ? (
            <section className="life-journey-section">
              <div className="life-journey-label"><CalendarDays size={16} /><div><span>Archived</span><small>Stored moments, ready to restore</small></div><b>{archivedMoments.length}</b></div>
              <div className="life-journey-items">{archivedMoments.map(renderEventCard)}</div>
            </section>
          ) : null}
          </>}
        </div>
      ) : (
        <div className="life-journey-empty">
          <span className="life-journey-empty-icon"><BookHeart size={25} /></span>
          <span className="life-timeline-eyebrow">A fresh page</span>
          <h3>{events.length ? 'No moments found' : 'Your story starts with one moment'}</h3>
          <p>{events.length ? 'Try another search or category.' : 'Save the dates and people that make life feel like yours. Add the first moment whenever you are ready.'}</p>
        </div>
      )}

      {pendingDeleteEvent ? <ConfirmDialog title="Delete event?" message={`Delete “${pendingDeleteEvent.name || 'Untitled event'}” and its activities? This cannot be undone.`} onCancel={() => setPendingDeleteEvent(null)} onConfirm={() => removeEvent(pendingDeleteEvent)} /> : null}
      {summaryEvent ? <EventSummaryDialog event={summaryEvent} onClose={() => setSummaryEvent(null)} /> : null}
      {drawer === 'event' ? <Drawer type="event" editingEvent={editingEvent} onClose={closeDrawer} onSaveEvent={saveEvent} /> : null}
      {activityChooserOpen ? (
        <ModalDialog title="Choose a life moment" className="dn-modal-activity-picker" onClose={() => { setActivityChooserOpen(false); setActivityEventSearch(''); }}>
          {events.length ? (
            <div className="activity-event-picker">
              <p>Activities belong to an event. Choose the moment this next step will help with.</p>
              <label className="activity-event-search"><Search size={16} /><input autoFocus value={activityEventSearch} onChange={(changeEvent) => setActivityEventSearch(changeEvent.target.value)} placeholder="Search your moments" aria-label="Search moments for activity" /></label>
              <div className="activity-event-picker-results">
                {pickerSuggested && !pickerQuery ? <section className="activity-picker-group"><div className="activity-picker-label">A good place to begin <span>Suggested</span></div><ActivityEventOption event={pickerSuggested} badge="Next up" favorite={favoriteEventIds.includes(pickerSuggested.id || pickerSuggested.firestoreId)} onChoose={() => chooseEventForActivity(pickerSuggested)} onToggleFavorite={() => toggleFavoriteEvent(pickerSuggested)} /></section> : null}
                {pickerFavorites.length ? <section className="activity-picker-group"><div className="activity-picker-label">Favorites</div>{pickerFavorites.map((event) => <ActivityEventOption key={event.id || event.firestoreId} event={event} favorite onChoose={() => chooseEventForActivity(event)} onToggleFavorite={() => toggleFavoriteEvent(event)} />)}</section> : null}
                {pickerRecent.length ? <section className="activity-picker-group"><div className="activity-picker-label">Recently opened</div>{pickerRecent.map((event) => <ActivityEventOption key={event.id || event.firestoreId} event={event} badge="Recent" favorite={favoriteEventIds.includes(event.id || event.firestoreId)} onChoose={() => chooseEventForActivity(event)} onToggleFavorite={() => toggleFavoriteEvent(event)} />)}</section> : null}
                <section className="activity-picker-group activity-picker-all"><div className="activity-picker-label">{pickerQuery ? 'Search results' : 'All moments'} <span>{pickerAll.length + (pickerSuggested ? 1 : 0)}</span></div>
                  {pickerAll.length || (pickerSuggested && pickerQuery) ? [...pickerAll, ...(pickerSuggested && pickerQuery && !pickerAll.includes(pickerSuggested) ? [pickerSuggested] : [])].map((event) => <ActivityEventOption key={event.id || event.firestoreId} event={event} favorite={favoriteEventIds.includes(event.id || event.firestoreId)} onChoose={() => chooseEventForActivity(event)} onToggleFavorite={() => toggleFavoriteEvent(event)} />) : !pickerSuggested && !pickerFavorites.length && !pickerRecent.length ? <p className="activity-picker-no-results">No matching moments. Try another search.</p> : null}
                </section>
              </div>
            </div>
          ) : (
            <div className="activity-event-picker-empty"><p>Start with a life moment. Activities will live inside its story.</p><button type="button" className="primaryButton event-empty-state-cta" onClick={() => { setActivityChooserOpen(false); openNewEvent(); }}><Plus size={16} aria-hidden="true" /> Create a life moment</button></div>
          )}
        </ModalDialog>
      ) : null}
      {activityChooserEvent ? (
        <ModalDialog title="Add an activity" onClose={() => setActivityChooserEvent(null)}>
          <form className="form-surface quick-create-activity-form" onSubmit={saveActivityFromChooser}>
            <p className="activity-target-moment">For <strong>{activityChooserEvent.name || 'This life moment'}</strong></p>
            <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Activity title" aria-label="Activity title" autoFocus required />
            <DateField label="Date" name="activity-date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} aria-label="Activity date" />
            <DropdownSelect value={activityPriority} onChange={(event) => setActivityPriority(event.target.value)} aria-label="Activity priority">
              {getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
            <RichTextEditor label="Activity description" value={activityDescription} onChange={setActivityDescription} placeholder="Description (optional)" />
            <div className="form-actions"><button className="primaryButton" type="submit">Save activity</button><button className="secondaryButton" type="button" onClick={() => setActivityChooserEvent(null)}>Cancel</button></div>
          </form>
        </ModalDialog>
      ) : null}
    </div>
  );
}

function Drawer({ type, editingEvent, editingActivity, activityTitle, activityDescription, activityDate, activityPriority, setActivityTitle, setActivityDescription, setActivityDate, setActivityPriority, onClose, onSaveEvent, onSaveActivity }) {
  const adminValues = useAppStore((state) => state.adminValues);
  const heading = type === 'event' ? (editingEvent?.name || 'New event') : (editingActivity?.title || 'New activity');
  return (
    <ModalDialog title={heading} onClose={onClose} variant="drawer">
      <div className="event-drawer-content">
        {type === 'event' ? (
          <EventForm initialValues={editingEvent} onSubmit={onSaveEvent} onCancel={onClose}
            submitLabel={editingEvent ? 'Update Event' : 'Save Event'} />
        ) : type === 'activity' ? (
          <div style={styles.formStack}>
            <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)}
              placeholder="Activity title" style={styles.input} />
            <RichTextEditor label="Activity description" value={activityDescription} onChange={setActivityDescription} placeholder="Description (optional)" />
            <DateField label="Date" name="activity-date" value={activityDate || ''}
              onChange={(event) => setActivityDate(event.target.value)} />
            <DropdownSelect value={activityPriority} onChange={(event) => setActivityPriority(event.target.value)}
              aria-label="Activity priority">
              {getActiveCodeListMeta('activityPriorities', adminValues.activityPriorities).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </DropdownSelect>
            <button type="button" className="primaryButton" onClick={onSaveActivity}
              style={styles.primaryButton}>Save Activity</button>
          </div>
        ) : null}
      </div>
    </ModalDialog>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: '18px', color: 'var(--ink)' },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '18px' },
  workspaceHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  workspaceActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  workspaceTitle: { padding: '4px 0 2px' },
  eyebrow: { fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' },
  title: { margin: '6px 0 0', fontSize: '1.8rem', color: 'var(--ink)' },
  metaText: { margin: '6px 0 0', color: 'var(--ink-soft)' },
  metaRow: { margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', color: 'var(--ink-soft)', fontSize: '0.95rem' },
  metaDivider: { color: 'var(--ink-soft)', fontWeight: 700 },
  card: { background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--border)', padding: '18px', boxShadow: '0 8px 18px rgba(47, 70, 58, 0.04)' },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  count: { color: 'var(--ink-soft)', fontSize: '0.82rem' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' },
  metric: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', display: 'grid', gap: '6px', color: 'var(--ink)' },
  panel: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', color: 'var(--ink)' },
  panelHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' },
  sectionTitle: { margin: 0, fontSize: '1.2rem', color: 'var(--ink)' },
  primaryButton: { border: 'none', borderRadius: '10px', background: '#2d6a4f', color: '#fff', padding: '11px 14px', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-soft)', color: 'var(--ink)', padding: '9px 12px', fontWeight: 600, cursor: 'pointer' },
  backButton: { border: 'none', background: 'transparent', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', padding: '8px 0' },
  detailHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '18px' },
  detailTitle: { margin: '4px 0 0', fontSize: '1.4rem', color: 'var(--ink)' },
  closeButton: { width: '34px', height: '34px', border: '1px solid var(--border)', borderRadius: '9px', background: 'var(--surface-soft)', color: 'var(--ink)', cursor: 'pointer', fontSize: '1.2rem' },
  input: { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-soft)', color: 'var(--ink)', resize: 'vertical' },
  formStack: { display: 'grid', gap: '12px' },
  linkedContext: { padding: '12px', borderRadius: '10px', background: 'var(--surface-soft)', color: 'var(--ink-soft)', lineHeight: 1.5 },
  errorText: { margin: '0 0 12px', padding: '10px 12px', borderRadius: '10px', background: '#fff1f1', color: '#9d3c3c', border: '1px solid #efcaca' },
};
