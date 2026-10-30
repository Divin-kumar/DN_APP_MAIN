import { currentEntryTime } from '../utils/activityTime.js';
import { activityTime as savedRecordTime } from '../utils/activityTime';
import { activityTime } from '../utils/activityTime.js';
import ActivityTimeField from '../components/common/ActivityTimeField';
import DebouncedFilterInput from '../components/common/DebouncedFilterInput';
/*
  Moments listing, saved filters and scoped create/edit actions.

  In simple terms, this page is the main event dashboard.
  It shows life moments, lets the user search and filter them, open an event in detail,
  and create or edit Moments.
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, BookHeart, CalendarDays, ClipboardList, Clock3, FileText, Images, Pencil, Plus, Receipt, Search } from 'lucide-react';
import EventForm from '../components/events/EventForm';
import DateField from '../components/common/DateField';
import DropdownSelect from '../components/common/DropdownSelect';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import useExpenseStore from '../store/useExpenseStore';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import { getActiveCodeListMeta } from '../utils/codeLists';
import SwipeActionCard from '../components/common/SwipeActionCard';
import usePersistentListState from '../hooks/usePersistentListState';
import { formatMomentDate, parseMomentDate } from '../utils/momentDates';
import ConditionBuilder, { ConditionChips } from '../components/common/ConditionBuilder';
import { momentConditions, momentConditionRecord } from '../utils/listConditionMigration';
import useConditionFilters from '../hooks/useConditionFilters';
import ListControls from '../components/common/ListControls';
import QuietEmptyState from '../components/common/QuietEmptyState';
import SortControl from '../components/common/SortControl';
import { MOMENT_SORT_OPTIONS, momentSortSummary, sortMoments } from '../utils/userListSort';
import RichTextEditor from '../components/common/RichTextEditor';
import RichText from '../components/common/RichText';
import AttachmentGallery from '../components/common/AttachmentGallery';
import { isAttachmentImage, coverImageKey, legacyAttachmentImage } from '../utils/activityDetail';
import { plainRichText } from '../utils/richText';
import useScopedMoments from '../hooks/useScopedMoments';
import { getActiveSampleScenario } from '../dev/sampleData';
import useAttachmentOriginal from '../hooks/useAttachmentOriginal';
import { activityDateLabel } from '../utils/activityDetail';
import { selectMomentListPreview } from '../utils/momentListPreview';
import '../components/events/MomentList.css';

const dateLabel = (value) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));
const defaultMomentFilters = Object.freeze({ search: '', category: 'All moments', field: 'date', direction: 'asc' });
const momentFilterRules = Object.freeze({ field: MOMENT_SORT_OPTIONS.map(({ value }) => value), direction: ['asc', 'desc'] });

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


function MomentCardCover({ attachment, uid, isGuest, date }) {
  const tileRef = useRef(null);
  const [nearby, setNearby] = useState(typeof IntersectionObserver !== 'function');
  const [failedSource, setFailedSource] = useState('');
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') { setNearby(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNearby(true);
    }, { rootMargin: '180px' });
    if (tileRef.current) observer.observe(tileRef.current);
    return () => observer.disconnect();
  }, []);
  const original = useAttachmentOriginal(attachment, { uid, isGuest, enabled: nearby && Boolean(attachment) });
  const source = original.source && original.source !== failedSource && !original.error ? original.source : '';
  return (
    <span ref={tileRef} className={'event-story-art dn-v2-moment-cover' + (source ? ' has-photo' : '')} aria-hidden="true">
      {source ? <img src={source} alt="" loading="lazy" onError={() => setFailedSource(source)} /> : <Images size={32} strokeWidth={1.5} className="dn-v2-cover-symbol" />}
      <span className="dn-v2-moment-cover-glow" />
      <span className="dn-v2-moment-cover-date">
        <strong>{date ? date.toLocaleDateString('en-GB', { day: '2-digit' }) : '—'}</strong>
        <small>{date ? date.toLocaleDateString('en-GB', { month: 'short' }) : 'Date'}</small>
      </span>
    </span>
  );
}

function EventStoryCard({ event, expenseTotal, uid, isGuest, onOpen, onPdf, onEdit, onArchive, onDelete }) {
  const date = parseMomentDate(event.date);
  const preview = useMemo(() => selectMomentListPreview(event), [event]);
  const status = preview.status;
  const statusLabel = { archived: 'Archived', 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled' }[status] || 'In progress';
  const activities = Array.isArray(event.activities) ? event.activities : [];
  const memories = Array.isArray(event.memories) ? event.memories : [];
  const attachments = Array.isArray(event.attachments) ? event.attachments : [];
  const activity = preview.latest;
  const coverOptions = attachments.filter((item) => isAttachmentImage(item?.type)
    && (/^[a-f0-9]{64}$/.test(item.assetId || '') || legacyAttachmentImage(item)));
  const [coverChoice, saveCoverChoice] = usePersistentListState(
    'moment-card-cover:' + (event.id || event.firestoreId), { imageKey: '' });
  const [choosingCover, setChoosingCover] = useState(false);
  const cover = coverOptions.find((item) => coverImageKey(item) === coverChoice.imageKey) || preview.cover;
  return (
    <>
    <SwipeActionCard className="event-story-card dn-v2-moment-card"
      mainClassName="event-story-main-viewport" label={event.name || 'Moment'}
      menuButton menuLabel={'Actions for ' + (event.name || 'Moment')}
      otherActions={[
        { label: 'Edit', icon: Pencil, onClick: onEdit },
        ...(onPdf ? [{ label: 'PDF Studio', icon: ClipboardList, onClick: onPdf }] : []),
        ...(coverOptions.length ? [{ label: 'Cover photo', icon: Images, onClick: () => setChoosingCover(true) }] : []),
        { label: event.archived ? 'Restore' : 'Archive', icon: event.archived ? ArchiveRestore : Archive, onClick: onArchive },
      ]} onDelete={onDelete}>
      <button type="button" className="event-story-main dn-v2-moment-open" onClick={onOpen}
        aria-label={'Open ' + (event.name || 'event')}>
        <MomentCardCover attachment={cover} uid={uid} isGuest={isGuest} date={date} />
        <span className="event-story-copy dn-v2-moment-copy">
          <span className="dn-v2-moment-heading">
            <span className="event-story-meta">{event.type === 'Other' ? event.customType || 'Other' : event.type || 'Personal'}</span>
            <span className={'event-story-status status-' + status} aria-label={'Status: ' + statusLabel}>{statusLabel}</span>
          </span>
          <strong>{event.name || 'A life moment'}</strong>
          <span className="event-story-date"><CalendarDays size={13} aria-hidden="true" />{date ? dateLabel(date) : 'Date to be decided'}{savedRecordTime(event) ? ` · ${savedRecordTime(event)}` : ''}</span>
          {activity ? <span className="dn-v2-moment-activity">
            <span className="dn-v2-activity-kicker">{activity === preview.upcoming ? 'Coming up' : 'Latest activity'}</span>
            <span className="dn-v2-activity-title">{activity.title || 'Untitled activity'}</span>
            <span className="dn-v2-activity-date">{activity.date ? activityDateLabel(activity.date) : 'Date to be decided'}{activityTime(activity) ? ` · ${activityTime(activity)}` : ''}</span>
          </span> : event.notes ? <RichText inline className="event-story-note free-text-preview is-truncated" value={event.notes} /> : <span className="dn-v2-activity-empty">No activities yet</span>}
          <span className="event-story-details">
            <span><Clock3 size={13} /> {activities.length} {activities.length === 1 ? 'activity' : 'activities'}</span>
            {memories.length ? <span><BookHeart size={13} /> {memories.length} reflections</span> : null}
            {attachments.length ? <span><FileText size={13} /> {attachments.length} files</span> : null}
            {expenseTotal > 0 ? <span><Receipt size={13} /> {currency(expenseTotal)}</span> : null}
          </span>
        </span>
      </button>
    </SwipeActionCard>
    {choosingCover ? <ModalDialog title="Choose Moment cover" className="activity-cover-picker" onClose={() => setChoosingCover(false)}>
      <AttachmentGallery attachments={coverOptions} uid={uid} isGuest={isGuest}
        selectedKey={coverImageKey(cover)} onSelect={(photo) => {
          saveCoverChoice({ imageKey: coverImageKey(photo) });
          setChoosingCover(false);
        }} />
    </ModalDialog> : null}
    </>
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
  const scopedMoments = useScopedMoments();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const adminValues = useAppStore((state) => state.adminValues);
  const showToast = useAppStore((state) => state.showToast);
  const events = scopedMoments.events;
  const loading = useEventStore((state) => state.loading);
  const error = useEventStore((state) => state.error);
  const loadEvents = useEventStore((state) => state.loadEvents);
  const addEvent = useEventStore((state) => state.addEvent);
  const updateEventItem = useEventStore((state) => state.updateEventItem);
  const deleteEventItem = useEventStore((state) => state.deleteEventItem);
  const expenses = useExpenseStore((state) => state.expenses);
  const loadExpenses = useExpenseStore((state) => state.loadExpenses);
  const [drawer, setDrawer] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityDate, setActivityDate] = useState(formatMomentDate(new Date()));
  const [activityTime, setActivityTime] = useState(currentEntryTime);
  const [activityPriority, setActivityPriority] = useState('medium');
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState(null);
  const [momentFilters, changeMomentFilters, resetMomentFilters] = usePersistentListState('moments', defaultMomentFilters, momentFilterRules);
  const { search, field: sortField, direction: sortDirection } = momentFilters;
  const sortSummary = momentSortSummary(sortField, sortDirection);
  const setSearch = (value) => changeMomentFilters({ search: value });
  const resetMomentDiscovery = () => { resetMomentFilters(); conditions.clear(); };
  const conditionRecords = useMemo(() => events.map(momentConditionRecord), [events]);
  const conditions = useConditionFilters('moments', conditionRecords, usePersistentListState, { initialGroup: momentConditions(momentFilters), contextKey: getActiveSampleScenario(user?.uid) });
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

  const eventExpenseTotals = useMemo(() => {
    const totals = new Map();
    expenses.forEach((expense) => {
      if (!expense.eventId) return;
      totals.set(expense.eventId, (totals.get(expense.eventId) || 0) + Number(expense.amount || 0));
    });
    return totals;
  }, [expenses]);
  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortMoments(events.filter((event) => {
        const matchesSearch = !query || [event.name, event.type, event.customType, plainRichText(event.notes)]
          .some((value) => String(value || '').toLowerCase().includes(query));
        return matchesSearch && conditions.matches(momentConditionRecord(event));
      }), sortField, sortDirection);
  }, [events, search, sortField, sortDirection, conditions.matches]);
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
    setActivityTime(currentEntryTime());
    setActivityDescription('');
    setActivityDate(formatMomentDate(new Date()));
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
      date: activityDate, time: activityTime,
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
    setActivityTitle('');
    setActivityTime(currentEntryTime());
    setActivityDescription('');
    setActivityDate(formatMomentDate(new Date()));
    setActivityPriority('medium');
  };
  const openNewEvent = () => { setEditingEvent(null); setDrawer('event'); };

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

  const archiveMoment = async (event) => {
    try {
      await updateEventItem(user?.uid, isGuest, { ...event, archived: !event.archived });
      showToast(event.archived ? 'Moment restored' : 'Moment archived', 'success');
    } catch { showToast('Could not update archive state', 'danger'); }
  };

  const removeEvent = async (event) => {
    try {
      await deleteEventItem(user?.uid, isGuest, event.id || event.firestoreId);
      showToast('Event deleted', 'danger');
      setPendingDeleteEvent(null);
    } catch (deleteError) {
      console.error('Event deletion failed:', deleteError);
      showToast('Delete failed', 'danger');
    }
  };

  const renderEventCard = (event) => (
    <EventStoryCard
      key={event.id || event.firestoreId}
      event={event}
      uid={user?.uid}
      isGuest={isGuest}
      expenseTotal={eventExpenseTotals.get(event.id || event.firestoreId) || 0}
      onOpen={() => navigate(`/events/${encodeURIComponent(event.id || event.firestoreId)}/story`)}
      onPdf={() => navigate(`/events/${encodeURIComponent(event.id || event.firestoreId)}/pdf`)}
      onEdit={() => { setEditingEvent(event); setDrawer('event'); }}
      onArchive={() => archiveMoment(event)}
      onDelete={() => setPendingDeleteEvent(event)}
    />
  );

  return (
    <div className="events-page life-timeline-page">
      <header className="life-timeline-heading"><h2>Life moments</h2></header>

      {isGuest && getActiveSampleScenario(user?.uid) === 'tour' ? (
        <section className="dn-guest-tour-notice" aria-label="Explore DN sample data">
          <div><strong>You're exploring DN with example data</strong>
            <p>Try the photo Journal, monthly Diary, Tasks, transactions and PDF Studio. Nothing here is copied into your own Guest records.</p></div>
          <button type="button" className="secondaryButton" onClick={() => navigate('/settings')}>Manage demo</button>
        </section>
      ) : null}
      <div className="event-discovery-bar">
        <ListControls title="Moment filters" builder
          activeCount={conditions.activeCount} resultCount={visibleEvents.length} resultLabel="moments"
          chips={<ConditionChips filter={conditions} />}
          summary={sortSummary}
          sort={<SortControl field={sortField} direction={sortDirection} options={MOMENT_SORT_OPTIONS} label="Sort moments"
            onFieldChange={(field) => changeMomentFilters({ field, direction: 'asc' })}
            onToggleDirection={() => changeMomentFilters({ direction: sortDirection === 'asc' ? 'desc' : 'asc' })} />}
          canReset={Boolean(conditions.activeCount || search || sortField !== 'date' || sortDirection !== 'asc')} onReset={resetMomentDiscovery}
          search={<DebouncedFilterInput scopeKey={conditions.editorKey} id="moment-filter-search" type="search" value={search} onChange={(changeEvent) => setSearch(changeEvent.target.value)} placeholder="Find a moment" aria-label="Search events" />}>
          <ConditionBuilder filter={conditions} title="Moment conditions" />
        </ListControls>
      </div>

      {error ? <p style={styles.errorText}>{error}</p> : null}
      {loading ? <LoadingSkeleton rows={4} label="Loading moments" /> : error === 'Unable to load events.' ? <div className="financial-load-error" role="alert"><span>Moments couldn’t be loaded.</span><button type="button" className="settings-secondary-button" onClick={() => loadEvents(user?.uid, isGuest)}>Try again</button></div> : visibleEvents.length ? (
        <div className="life-journey">
          <section className="life-journey-section" aria-label={`Moments ordered by ${sortSummary}`}>
            <div className="life-journey-items">{visibleEvents.map(renderEventCard)}</div>
          </section>
        </div>
      ) : (
        <QuietEmptyState kind="moments" filtered={events.length > 0}
          onClear={events.length && (search.trim() || conditions.activeCount) ? resetMomentDiscovery : undefined} />
      )}

      {pendingDeleteEvent ? <ConfirmDialog title="Delete event?" message={`Delete “${pendingDeleteEvent.name || 'Untitled event'}” and its activities? This cannot be undone.`} onCancel={() => setPendingDeleteEvent(null)} onConfirm={() => removeEvent(pendingDeleteEvent)} /> : null}
      {drawer === 'event' ? <Drawer editingEvent={editingEvent} onClose={closeDrawer} onSaveEvent={saveEvent} /> : null}
      {activityChooserOpen ? (
        <ModalDialog title="Choose a life moment" className="dn-modal-activity-picker" onClose={() => { setActivityChooserOpen(false); setActivityEventSearch(''); }}>
          {events.length ? (
            <div className="activity-event-picker">
              <p>Activities belong to an event. Choose the moment this next step will help with.</p>
              <label className="activity-event-search"><Search size={16} /><input value={activityEventSearch} onChange={(changeEvent) => setActivityEventSearch(changeEvent.target.value)} placeholder="Search your moments" aria-label="Search moments for activity" /></label>
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
            <input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Activity title" aria-label="Activity title" autoFocus={typeof window !== "undefined" && window.innerWidth > 760} required />
            <div className="activity-date-time-row">
              <DateField label="Date" name="activity-date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} aria-label="Activity date" />
              <ActivityTimeField value={activityTime} onChange={setActivityTime} />
            </div>
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

function Drawer({ editingEvent, onClose, onSaveEvent }) {
  return <ModalDialog title={editingEvent?.name || 'New event'} onClose={onClose} variant="drawer">
    <div className="event-drawer-content">
      <EventForm initialValues={editingEvent} onSubmit={onSaveEvent} onCancel={onClose}
        submitLabel={editingEvent ? 'Update Event' : 'Save Event'} />
    </div>
  </ModalDialog>;
}

const styles = {
  errorText: { margin: '0 0 12px', padding: '10px 12px', borderRadius: '10px', background: '#fff1f1', color: '#9d3c3c', border: '1px solid #efcaca' }
};
