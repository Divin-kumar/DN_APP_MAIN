import { activityTime } from '../../../utils/activityTime.js';
// Dashboard Moment and Activity lists keep their own date view and visibility.
import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Sparkles, Pencil, BookOpen, Check, RotateCcw, XCircle, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModalDialog from '../../../components/common/ModalDialog';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import { getOnThisDayDashboardEvents, getUpcomingDashboardEvents, getMomentTypeGreetingTemplate } from '../../../utils/dashboardVisibility';
import { getOnThisDayDashboardActivities, getUpcomingDashboardActivities } from '../../../utils/dashboardActivities';
import { getCalendarDaysRemaining, getEventDate, getNextOccurrenceDate, isRecurringEvent } from '../../../utils/momentDates';
import { downloadBlob } from '../../../utils/download';
import { plainRichText } from '../../../utils/richText';
import GreetingCard, { buildGreetingCardHtml } from '../../../components/common/GreetingCard';
import SwipeToComplete from '../../../components/common/SwipeToComplete';
import ActivityActionDialogs from '../../../components/events/ActivityActionDialogs';
import SwipeActionCard from '../../../components/common/SwipeActionCard';
import useActivityActions from '../../../hooks/useActivityActions';
import { activityDetailPath, activityStatus } from '../../../utils/activityDetail';
import { isActivityEditable, isRecordScopeLoaded } from '../../../utils/scopedRecordActions';
import { recordId } from '../../../utils/recordIdentity';
import { getActiveSampleScenario } from '../../../dev/sampleData';
import './DashboardSections.css';
import DashboardGreeting from './DashboardGreeting';
import useDashboardClock from '../useDashboardClock';

const EMPTY_GREETING_TEMPLATES = Object.freeze({});
const EMPTY_MOMENT_TYPES = Object.freeze([]);
const EMPTY_EVENTS = Object.freeze([]);
const DASHBOARD_SECTIONS = Object.freeze({ moments: true, activities: true });
const readDashboardSections = (key) => {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(key) || 'null');
    return { moments: typeof saved?.moments === 'boolean' ? saved.moments : true,
      activities: typeof saved?.activities === 'boolean' ? saved.activities : true };
  } catch { return { ...DASHBOARD_SECTIONS }; }
};

const formatDisplayDate = (date) => {
  if (!date) return 'Date not set';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const getOrdinal = (value) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return '1st';

  const remainder10 = number % 10;
  const remainder100 = number % 100;

  if (remainder10 === 1 && remainder100 !== 11) return `${number}st`;
  if (remainder10 === 2 && remainder100 !== 12) return `${number}nd`;
  if (remainder10 === 3 && remainder100 !== 13) return `${number}rd`;
  return `${number}th`;
};

const getGreetingName = (event) => {
  const rawName = event?.personName || event?.contactName || event?.name || 'You';
  const cleaned = String(rawName)
    .replace(/\b(birthday|anniversary)\b/gi, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || 'You';
};

const getNextOccurrenceForStatus = (event, referenceDate = new Date()) => {
  return getNextOccurrenceDate(event, referenceDate);
};

const getDaysRemaining = getCalendarDaysRemaining;

const renderGreetingTemplate = (template, replacements = {}) => {
  if (!template) return '';

  return String(template).replace(/\{([^}]+)\}/g, (match, key) => {
    const normalizedKey = String(key).trim().toLowerCase();
    const value = replacements[normalizedKey] ?? replacements[key] ?? replacements[match] ?? '';
    return value === '' ? match : String(value);
  });
};

const resolveGreetingTemplate = (eventType, greetingTemplates = {}, momentTypes = []) => {
  const rawType = String(eventType || '').trim();
  if (!rawType) return null;

  const configuredTemplate = getMomentTypeGreetingTemplate(rawType, momentTypes, greetingTemplates[rawType]);
  if (configuredTemplate) return configuredTemplate;

  const lowered = rawType.toLowerCase();
  return Object.entries(greetingTemplates).find(([key]) => String(key).toLowerCase() === lowered)?.[1] || null;
};

const getGreetingMessage = (event, greetingTemplates = {}, momentTypes = []) => {
  const type = String(event?.type || '').trim() || String(event?.name || '').trim();
  const configuredTemplate = resolveGreetingTemplate(type, greetingTemplates, momentTypes);
  if (!configuredTemplate) return null;

  const eventName = String(event?.type || event?.name || 'Celebration').trim() || 'Celebration';
  const nextOccurrenceDate = getNextOccurrenceForStatus(event);
  const eventDate = formatDisplayDate(nextOccurrenceDate || getEventDate(event));
  const name = getGreetingName(event);
  const normalizedType = type.toLowerCase();
  const isRecurring = isRecurringEvent(event);

  if (normalizedType.includes('birthday')) {
    const baseDate = getEventDate(event);
    if (!baseDate) return null;

    const nextYear = nextOccurrenceDate ? nextOccurrenceDate.getFullYear() : new Date().getFullYear();
    const birthdayAge = Math.max(nextYear - baseDate.getFullYear(), 1);
    if (birthdayAge < 1) return null;

    const ordinal = getOrdinal(birthdayAge);
    const text = renderGreetingTemplate(configuredTemplate, {
      name,
      ordinal,
      age: String(birthdayAge),
      years: '',
      eventName,
      eventDate,
    });
    const [title, ...rest] = String(text).split(/\r\n|\r|\n/);
    return {
      title: title || `Happy ${ordinal} Birthday ${name} 🎂`,
      body: rest.join('\n') || 'Wishing you a wonderful year filled with happiness, health and success.',
    };
  }

  if (normalizedType.includes('anniversary')) {
    const baseDate = getEventDate(event);
    if (!baseDate) return null;

    const nextYear = nextOccurrenceDate ? nextOccurrenceDate.getFullYear() : new Date().getFullYear();
    const years = Math.max(nextYear - baseDate.getFullYear(), 1);
    if (years < 1) return null;

    const ordinal = getOrdinal(years);
    const text = renderGreetingTemplate(configuredTemplate, {
      name,
      ordinal,
      age: '',
      years: String(years),
      eventName,
      eventDate,
    });
    const [title, ...rest] = String(text).split(/\r\n|\r|\n/);
    return {
      title: title || `Happy ${ordinal} Anniversary ❤️`,
      body: rest.join('\n') || 'Wishing you many more years of happiness, love and beautiful memories together.',
    };
  }

  if (isRecurring) {
    const text = renderGreetingTemplate(configuredTemplate, {
      name,
      ordinal: 'Celebration',
      age: '',
      years: '',
      eventName,
      eventDate,
    });
    const [title, ...rest] = String(text).split(/\r\n|\r|\n/);
    return {
      title: title || `Happy ${eventName} 🎉`,
      body: rest.join('\n') || 'Wishing you a joyful celebration and beautiful memories to treasure.',
    };
  }

  const text = renderGreetingTemplate(configuredTemplate, {
    name,
    ordinal: 'Celebration',
    age: '',
    years: '',
    eventName,
    eventDate,
  });
  const [title, ...rest] = String(text).split(/\r\n|\r|\n/);
  return {
    title: title || `Happy ${eventName}`,
    body: rest.join('\n') || 'Wishing you a wonderful celebration.',
  };
};

function GreetingCardModal({ event, greeting, dateLabel, onClose, onCopy }) {
  const downloadGreeting = () => {
    const html = buildGreetingCardHtml({ ...greeting, momentName: event.name, momentType: event.type, dateLabel });
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${(event.name || 'dn').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-greeting.html`);
  };
  return (
    <ModalDialog title="Greeting card" onClose={onClose} className="dashboard-greeting-modal">
      <GreetingCard title={greeting.title} body={greeting.body} momentName={event.name} momentType={event.type} dateLabel={dateLabel} />
      <div className="dashboard-greeting-modal-actions">
        <button type="button" className="secondaryButton" onClick={downloadGreeting}><Download size={15} /> Download card</button>
        <button type="button" className="primaryButton" onClick={onCopy}><Copy size={15} /> Copy greeting</button>
      </div>
    </ModalDialog>
  );
}

export default function DashboardOverview() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  return <DashboardOverviewContent key={JSON.stringify([user?.uid, isGuest, getActiveSampleScenario(user?.uid)])} />;
}

export function DashboardOverviewContent() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || EMPTY_GREETING_TEMPLATES);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes || EMPTY_MOMENT_TYPES);
  const eventState = useEventStore();
  const { events: storedEvents, loading, error, loadedFor, activeLoadKey, loadEvents } = eventState;
  const activityActions = useActivityActions();
  const loadKey = `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
  const ready = isRecordScopeLoaded(eventState, loadKey, getActiveSampleScenario(user?.uid));
  const events = ready ? storedEvents : EMPTY_EVENTS;
  const [greetingEvent, setGreetingEvent] = useState(null);
  const [momentView, setMomentView] = useState('upcoming');
  const [activityView, setActivityView] = useState('upcoming');
  const sectionKey = `dn_dashboard_sections_${isGuest ? 'guest' : user?.uid || 'signed-out'}_${getActiveSampleScenario(user?.uid) || 'live'}`;
  const [sectionState, setSectionState] = useState(() => ({ key: sectionKey, visible: readDashboardSections(sectionKey) }));
  const sections = sectionState.key === sectionKey ? sectionState.visible : readDashboardSections(sectionKey);
  const changeSections = (patch) => {
    const next = { ...sections, ...patch };
    try { globalThis.localStorage?.setItem(sectionKey, JSON.stringify(next)); } catch { /* Remain usable without storage. */ }
    setSectionState({ key: sectionKey, visible: next });
  };
  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
  }, [isGuest, loadEvents, user?.uid, loadedFor]);

  const today = useDashboardClock();
  const todayKey = today.toDateString();
  const upcomingEvents = useMemo(() => getUpcomingDashboardEvents(events, today, momentTypes), [events, momentTypes, todayKey]);
  const onThisDayEvents = useMemo(() => getOnThisDayDashboardEvents(events, today, momentTypes), [events, momentTypes, todayKey]);
  const dashboardMoments = momentView === 'upcoming' ? upcomingEvents : onThisDayEvents;
  const upcomingActivities = useMemo(() => getUpcomingDashboardActivities(events, today, momentTypes), [events, momentTypes, todayKey]);
  const onThisDayActivities = useMemo(() => getOnThisDayDashboardActivities(events, today, momentTypes), [events, momentTypes, todayKey]);
  const dashboardActivities = activityView === 'upcoming' ? upcomingActivities : onThisDayActivities;


  const getMomentGreeting = (event) => {
    const greetingSource = momentView === 'on-this-day' && !isRecurringEvent(event) ? { ...event, recurrence: 'yearly' } : event;
    return event.greetingCard?.title ? event.greetingCard : getGreetingMessage(greetingSource, greetingTemplates, momentTypes);
  };
  const selectedGreeting = greetingEvent?.greeting;
  const copyTodaysGreeting = async () => {
    if (!selectedGreeting) return;
    try {
      await navigator.clipboard.writeText(`${plainRichText(selectedGreeting.title)}\n\n${plainRichText(selectedGreeting.body)}`);
      showToast('Greeting copied', 'success');
    } catch {
      showToast('Unable to copy greeting on this device', 'danger');
    }
  };

  return (
    <>
      <div className="dashboard-overview dashboard-compact">
        <DashboardGreeting now={today} />
        <section className="dashboard-upcoming-card" aria-label="Moments">
          <header className="dashboard-section-heading">
            <span className="dashboard-section-title">Moments</span>
            <div className="dashboard-section-actions">
            {sections.moments ? <div role="group" aria-label="Moment dates" className="dashboard-date-views">
              <button type="button" aria-pressed={momentView === 'upcoming'} onClick={() => setMomentView('upcoming')}>Upcoming</button>
              <button type="button" aria-pressed={momentView === 'on-this-day'} onClick={() => setMomentView('on-this-day')}>On This Day</button>
            </div> : null}
            <button type="button" className="dashboard-section-toggle" aria-expanded={sections.moments}
              aria-label={sections.moments ? 'Hide Moments on dashboard' : 'Show Moments on dashboard'}
              onClick={() => changeSections({ moments: !sections.moments })}>{sections.moments ? 'Hide' : 'Show'}</button>
            </div>
          </header>
          {sections.moments ? <>
          {error === 'Unable to load events.' ? (
            <div className="financial-load-error" role="alert"><span>Moments couldn’t be loaded.</span><button type="button" className="settings-secondary-button" onClick={() => loadEvents(user?.uid, isGuest)}>Try again</button></div>
          ) : !ready || loading ? (
            <p className="dashboard-upcoming-empty" role="status">Loading moments…</p>
          ) : dashboardMoments.length ? (
            <div style={styles.upcomingListContainer} className="dashboard-upcoming-list-container" key={momentView} tabIndex={0} role="region" aria-label={momentView === 'upcoming' ? 'Moments in the next 30 days' : 'Moments on this day in previous years'}>
              <div className="dashboard-upcoming-list" style={styles.upcomingList}>
                {dashboardMoments.map((event) => {
                  const date = momentView === 'on-this-day' ? getEventDate(event) : getNextOccurrenceForStatus(event, today);
                  const days = getDaysRemaining(date);
                  const yearsAgo = date ? today.getFullYear() - date.getFullYear() : 0;
                  const momentGreeting = getMomentGreeting(event);
                  return (
                    <div className="dashboard-moment-row" key={event.id || event.firestoreId}>
                      <button type="button" className="dashboard-upcoming-row" onClick={() => navigate(`/events/${encodeURIComponent(event.id || event.firestoreId)}/story`)}>
                        <span className="dashboard-upcoming-date"><strong>{date?.toLocaleDateString('en-GB', { day: '2-digit' }) || '—'}</strong><small>{date?.toLocaleDateString('en-GB', { month: 'short' }) || 'Date'}</small></span>
                        <span className="dashboard-upcoming-copy"><strong>{event.name || event.type || 'Life moment'}</strong><small>{event.type || 'Personal'} · {momentView === 'on-this-day' ? `${date.getFullYear()} · ${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`}</small></span>
                        <span className="dashboard-upcoming-arrow" aria-hidden="true">›</span>
                      </button>
                      <button type="button" className="dashboard-moment-greeting-button" onClick={() => navigate(`/events/${encodeURIComponent(event.id || event.firestoreId)}/pdf`)} aria-label={`PDF Studio for ${event.name || 'this moment'}`} title="PDF Studio"><SlidersHorizontal size={17} aria-hidden="true" /></button>
                      {momentGreeting ? <button type="button" className="dashboard-moment-greeting-button" onClick={() => setGreetingEvent({ event, greeting: momentGreeting, dateLabel: formatDisplayDate(momentView === 'on-this-day' ? today : date) })} aria-label={`Greeting for ${event.name || 'this moment'}`} title="View greeting"><Sparkles size={17} aria-hidden="true" /></button> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="dashboard-upcoming-empty">{momentView === 'upcoming' ? 'No moments in the next 30 days.' : 'No moments on this day in previous years.'}</p>
          )}
          </> : null}
        </section>
        <section className="dashboard-upcoming-card" aria-label="Activities">
          <header className="dashboard-section-heading">
            <span className="dashboard-section-title">Activities</span>
            <div className="dashboard-section-actions">
            {sections.activities ? <div role="group" aria-label="Activity dates" className="dashboard-date-views">
              <button type="button" aria-pressed={activityView === 'upcoming'} onClick={() => setActivityView('upcoming')}>Upcoming</button>
              <button type="button" aria-pressed={activityView === 'on-this-day'} onClick={() => setActivityView('on-this-day')}>On This Day</button>
            </div> : null}
            <button type="button" className="dashboard-section-toggle" aria-expanded={sections.activities}
              aria-label={sections.activities ? 'Hide Activities on dashboard' : 'Show Activities on dashboard'}
              onClick={() => changeSections({ activities: !sections.activities })}>{sections.activities ? 'Hide' : 'Show'}</button>
            </div>
          </header>
          {sections.activities ? <>
          {error === 'Unable to load events.' ? (
            <div className="financial-load-error" role="alert"><span>Activities couldn’t be loaded.</span><button type="button" className="settings-secondary-button" onClick={() => loadEvents(user?.uid, isGuest)}>Try again</button></div>
          ) : !ready || loading ? (
            <p className="dashboard-upcoming-empty" role="status">Loading activities…</p>
          ) : dashboardActivities.length ? (
            <div style={styles.upcomingListContainer} className="dashboard-upcoming-list-container" key={activityView} tabIndex={0} role="region" aria-label={activityView === 'upcoming' ? 'Activities in the next 30 days' : 'Activities on this day in previous years'}>
              <div className="dashboard-upcoming-list" style={styles.upcomingList}>
                {dashboardActivities.map(({ event, activity, date }, index) => {
                  const yearsAgo = today.getFullYear() - date.getFullYear();
                  const days = getDaysRemaining(date);
                  const target = { momentId: recordId(event.id) || recordId(event.firestoreId), activityId: recordId(activity.id) };
                  const status = activityStatus(activity);
                  const row = <SwipeActionCard className="dashboard-activity-card" label={activity.title || 'Activity'}
                    menuButton menuLabel="Activity options" swipeEnabled={false} disabled={activityActions.busy}
                    otherActions={[
                      ...(isActivityEditable(activity) ? [{ label: 'Edit', icon: Pencil, onClick: () => activityActions.edit(target) }] : []),
                      { label: status === 'completed' ? 'Reopen' : 'Complete', icon: status === 'completed' ? RotateCcw : Check,
                        onClick: () => activityActions.setCompleted(target, status !== 'completed') },
                      { label: 'Cancel', icon: XCircle, onClick: () => activityActions.setCancelled(target, true) },
                    ]} onDelete={() => activityActions.requestDelete(target)}>
                    <button type="button" className="dashboard-upcoming-row" disabled={activityActions.busy}
                      aria-label={`Open ${activity.title || activity.name || 'activity'}`}
                      onClick={() => navigate(activityDetailPath(target.momentId, target.activityId))}>
                      <span className="dashboard-upcoming-date"><strong>{date.toLocaleDateString('en-GB', { day: '2-digit' })}</strong><small>{date.toLocaleDateString('en-GB', { month: 'short' })}</small></span>
                      <span className="dashboard-upcoming-copy"><strong>{activity.title || activity.name || 'Untitled activity'}</strong><small>{event.name || event.type || 'Moment'} · {activityView === 'on-this-day' ? `${date.getFullYear()} · ${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`}{activityTime(activity) ? ` · ${activityTime(activity)}` : ''}</small></span>
                      <span className="dashboard-upcoming-arrow" aria-hidden="true">{status === 'completed' ? <Check size={14} /> : <BookOpen size={14} />}</span>
                    </button>
                  </SwipeActionCard>;
                  const key = JSON.stringify([target.momentId, target.activityId || index]);
                  return <SwipeToComplete key={key} label={activity.title || activity.name || 'activity'} direction="left"
                    disabled={activityActions.busy} actionLabel={status === 'completed' ? 'Reopen' : 'Complete'} actionIcon={status === 'completed' ? RotateCcw : Check}
                    onComplete={() => activityActions.setCompleted(target, status !== 'completed')}>{row}</SwipeToComplete>;
                })}
              </div>
            </div>
          ) : (
            <p className="dashboard-upcoming-empty">{activityView === 'upcoming' ? 'No pending activities in the next 30 days.' : 'No activities on this day in previous years.'}</p>
          )}
          {activityActions.error && !activityActions.draft ? <p className="dashboard-activity-action-error" role="alert">{activityActions.error}</p> : null}
          </> : null}
          <p className="sr-only" role="status" aria-live="polite">{activityActions.announcement}</p>
        </section>
      </div>

      {greetingEvent && selectedGreeting ? <GreetingCardModal event={greetingEvent.event} greeting={selectedGreeting} dateLabel={greetingEvent.dateLabel} onClose={() => setGreetingEvent(null)} onCopy={copyTodaysGreeting} /> : null}
      <ActivityActionDialogs actions={activityActions} />
    </>
  );
}

const styles = {
  upcomingListContainer: {
    maxHeight: '220px',
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: '4px',
    marginRight: '-4px',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
  },
  upcomingList: {
    display: 'grid',
    gap: '4px',
    minHeight: 0,
  }
};
