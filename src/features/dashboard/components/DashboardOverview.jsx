// Dashboard Moment and Activity lists keep their own date view and visibility.
import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Sparkles, Pencil, BookOpen, Check, RotateCcw, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModalDialog from '../../../components/common/ModalDialog';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import { getOnThisDayDashboardEvents, getUpcomingDashboardEvents, getMomentTypeGreetingTemplate } from '../../../utils/dashboardVisibility';
import { getOnThisDayDashboardActivities, getUpcomingDashboardActivities } from '../../../utils/dashboardActivities';
import { getCalendarDaysRemaining, getEventDate, getNextOccurrenceDate, isRecurringEvent } from '../../../utils/momentDates';
import { downloadBlob } from '../../../utils/download';
import RichText from '../../../components/common/RichText';
import { plainRichText } from '../../../utils/richText';
import GreetingCard, { buildGreetingCardHtml } from '../../../components/common/GreetingCard';
import SwipeToComplete from '../../../components/common/SwipeToComplete';
import ActivityActionDialogs from '../../../components/events/ActivityActionDialogs';
import SwipeActionCard from '../../../components/common/SwipeActionCard';
import useActivityActions from '../../../hooks/useActivityActions';
import { activityDateLabel, activityDetailPath, activityStatus } from '../../../utils/activityDetail';
import { isActivityEditable, isRecordScopeLoaded } from '../../../utils/scopedRecordActions';
import { recordId } from '../../../utils/recordIdentity';
import { getActiveSampleScenario } from '../../../dev/sampleData';
import MomentSummaryExtras, { MomentSummaryPhotos, sortedSummaryActivities } from '../../../components/events/MomentSummaryExtras';
import { summaryAttachmentsFor } from '../../../utils/summaryAttachments';
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

function EventSummaryModal({ event, onClose }) {
  const eventDate = getNextOccurrenceForStatus(event);
  const activities = sortedSummaryActivities(event.activities);
  const totalActivities = activities.length;
  const completedActivities = activities.filter((activity) => Boolean(activity.completed)).length;
  const daysRemaining = getDaysRemaining(eventDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isRecurring = isRecurringEvent(event);
  const eventStatus = (() => {
    if (!eventDate) return 'Upcoming';
    if (isRecurring) {
      if (eventDate.getTime() === today.getTime()) return 'Today';
      if (eventDate.getTime() === new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime()) return 'Tomorrow';
      if (daysRemaining !== null && daysRemaining <= 7) return 'This Week';
      return 'Upcoming';
    }
    if (eventDate.getTime() === today.getTime()) return 'Today';
    if (eventDate < today) return completedActivities === totalActivities && totalActivities > 0 ? 'Completed' : 'Missed';
    return 'Upcoming';
  })();

  const statusText = eventStatus === 'Upcoming' && daysRemaining !== null && daysRemaining <= 3 && !isRecurring ? 'Moment is approaching' : eventStatus;
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || EMPTY_GREETING_TEMPLATES);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes || EMPTY_MOMENT_TYPES);
  const greeting = event.greetingCard?.title ? event.greetingCard : getGreetingMessage(event, greetingTemplates, momentTypes);

  const handleDownload = () => {
    const lines = [
      `${event.name || 'Untitled moment'}`,
      `Type: ${event.type || 'Moment'}`,
      `Date: ${formatDisplayDate(eventDate)}`,
      `Status: ${statusText}`,
      '',
    ];

    if (greeting) {
      lines.push(plainRichText(greeting.title), plainRichText(greeting.body), '');
    }
    if (event.notes) lines.push(plainRichText(event.notes), '');
    const momentFiles = summaryAttachmentsFor(event);
    if (momentFiles.length) lines.push('Moment photos and files:', ...momentFiles.map((item) => item.name || 'Attachment'), '');

    if (activities.length) {
      lines.push('Activities:');
      activities.forEach((activity) => {
        const label = activity.title || activity.name || 'Untitled activity';
        const check = activity.completed ? '✓' : '○';
        lines.push(`${check} ${label}`);
        lines.push(`  Date: ${activityDateLabel(activity.date)}`);
        const description = plainRichText(activity.description || '');
        if (description) lines.push(`  Description: ${description}`);
        const files = recordId(activity.id) ? summaryAttachmentsFor(event, activity.id) : [];
        if (files.length) lines.push('  Photos and files:', ...files.map((item) => `  ${item.name || 'Attachment'}`));
      });
    }
    if (event.memories?.length) {
      lines.push('', 'Memories:');
      event.memories.forEach((memory) => lines.push(memory.title || '', plainRichText(memory.body || '')));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${(event.name || 'event').toLowerCase().replace(/\s+/g, '-')}-summary.txt`);
  };

  return (
    <ModalDialog title="Moment summary" onClose={onClose} className="dashboard-event-summary-modal">
      <div style={styles.cardWrap}>
        <div className="moment-summary-story moment-summary-moment">
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Moment</div>
            <h4 style={styles.heroTitle}>{event.name || 'Untitled moment'}</h4>
          </div>
          <div style={styles.heroMeta}>
            <span style={styles.typePill}>{event.type || 'Moment'}</span>
            <strong style={styles.daysText}>
              {daysRemaining === null ? 'Date pending' : daysRemaining === 0 ? 'Today' : `${daysRemaining} days left`}
            </strong>
            <span style={styles.dateText}>{formatDisplayDate(eventDate)}</span>
          </div>
        </div>

        {greeting ? (
          <GreetingCard title={greeting.title} body={greeting.body} momentName={event.name} momentType={event.type} dateLabel={formatDisplayDate(eventDate)} />
        ) : null}
        {event.notes ? <RichText className="event-summary-notes" value={event.notes} /> : null}
        <MomentSummaryPhotos event={event} />
        </div>

        <div style={styles.section}>
          <div style={styles.statusRow}>{statusText}</div>
        </div>

        {activities.length ? (
          <div style={styles.section}>
            <ul style={styles.activityList}>
              {activities.map((activity, index) => {
                const label = activity.title || activity.name || 'Untitled activity';
                const isComplete = Boolean(activity.completed);
                const description = String(activity.description || '');
                const hasDescription = Boolean(description.trim());

                return (
                  <li key={`${label}-${activity.id ?? index}`} className="dashboard-summary-activity-item moment-summary-story moment-summary-activity" style={styles.activityItem}>
                    <span style={isComplete ? styles.activityCheckComplete : styles.activityCheckPending}>
                      {isComplete ? '✓' : '○'}
                    </span>
                    <div className="dashboard-summary-activity-copy">
                      <span style={styles.activityLabel}>{label}</span>
                      <span style={styles.activityDate}>{activityDateLabel(activity.date)}</span>
                      {hasDescription ? (
                        <div className="dashboard-summary-description-wrap">
                          <RichText className="dashboard-summary-description" value={description} />
                        </div>
                      ) : null}
                      {recordId(activity.id) ? <MomentSummaryPhotos event={event} activityId={activity.id} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <MomentSummaryExtras event={event} />
        <button type="button" onClick={handleDownload} style={styles.downloadButton}>
          <Download size={16} />
          Download Summary
        </button>
      </div>
    </ModalDialog>
  );
}

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
  const [selectedEvent, setSelectedEvent] = useState(null);
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
                      <button type="button" className="dashboard-upcoming-row" onClick={() => setSelectedEvent(event)}>
                        <span className="dashboard-upcoming-date"><strong>{date?.toLocaleDateString('en-GB', { day: '2-digit' }) || '—'}</strong><small>{date?.toLocaleDateString('en-GB', { month: 'short' }) || 'Date'}</small></span>
                        <span className="dashboard-upcoming-copy"><strong>{event.name || event.type || 'Life moment'}</strong><small>{event.type || 'Personal'} · {momentView === 'on-this-day' ? `${date.getFullYear()} · ${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`}</small></span>
                        <span className="dashboard-upcoming-arrow" aria-hidden="true">›</span>
                      </button>
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
                      <span className="dashboard-upcoming-copy"><strong>{activity.title || activity.name || 'Untitled activity'}</strong><small>{event.name || event.type || 'Moment'} · {activityView === 'on-this-day' ? `${date.getFullYear()} · ${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`}</small></span>
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

      {selectedEvent && events.find((item) => recordId(item.id || item.firestoreId) === recordId(selectedEvent.id || selectedEvent.firestoreId)) ? <EventSummaryModal
        event={events.find((item) => recordId(item.id || item.firestoreId) === recordId(selectedEvent.id || selectedEvent.firestoreId))} onClose={() => setSelectedEvent(null)} /> : null}
      {greetingEvent && selectedGreeting ? <GreetingCardModal event={greetingEvent.event} greeting={selectedGreeting} dateLabel={greetingEvent.dateLabel} onClose={() => setGreetingEvent(null)} onCopy={copyTodaysGreeting} /> : null}
      <ActivityActionDialogs actions={activityActions} />
    </>
  );
}

const styles = {
  cardWrap: {
    display: 'grid',
    gap: '16px',
    color: 'var(--ink)',
  },
  hero: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '18px 16px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(31,111,93,0.10), rgba(31,111,93,0.02))',
    border: '1px solid rgba(31,111,93,0.12)',
  },
  kicker: {
    marginBottom: '6px',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#5f756a',
  },
  heroTitle: {
    margin: 0,
    fontSize: '1.8rem',
    lineHeight: 1.2,
    color: 'var(--ink)',
  },
  heroMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '6px',
    textAlign: 'right',
  },
  typePill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    background: 'rgba(31,111,93,0.10)',
    border: '1px solid rgba(31,111,93,0.16)',
    borderRadius: '999px',
    color: '#1f6f5d',
    fontSize: '0.76rem',
    fontWeight: 700,
  },
  dateText: {
    color: 'var(--ink-soft)',
    fontSize: '0.8rem',
  },
  daysText: {
    color: '#1f6f5d',
    fontSize: '0.82rem',
    fontWeight: 800,
  },
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
  },
  section: {
    display: 'grid',
    gap: '10px',
    padding: '14px 0 0',
    borderTop: '1px solid var(--border)',
  },
  sectionHeading: {
    color: '#2d4c3d',
    fontSize: '0.8rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '1rem',
    fontWeight: 700,
  },
  statusDot: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#2e8b57',
    boxShadow: '0 0 0 4px rgba(46,139,87,0.12)',
  },
  statusMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px 16px',
    color: 'var(--ink-soft)',
    fontSize: '0.82rem',
  },
  activityList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '8px',
  },
  activityItem: {
    display: 'grid',
    gridTemplateColumns: '18px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'var(--surface-soft)',
    color: 'var(--ink-soft)',
  },
  activityCheckComplete: {
    display: 'inline-flex',
    width: '18px',
    height: '18px',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    background: 'rgba(31,111,93,0.10)',
    color: '#1f6f5d',
    fontWeight: 800,
    fontSize: '0.72rem',
  },
  activityCheckPending: {
    display: 'inline-flex',
    width: '18px',
    height: '18px',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    color: '#6a7a70',
    fontWeight: 700,
    fontSize: '0.72rem',
  },
  activityLabel: {
    color: 'var(--ink)',
    lineHeight: 1.5,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activityDate: {
    color: 'var(--ink-soft)',
    fontSize: '0.68rem',
    fontWeight: 600,
    opacity: 0.78,
    whiteSpace: 'nowrap',
  },
  emptyState: {
    margin: 0,
    color: 'var(--ink-soft)',
    lineHeight: 1.6,
  },
  downloadButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    border: '1px solid rgba(31,111,93,0.12)',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #1f6f5d 0%, #2a8c72 100%)',
    color: '#ffffff',
    padding: '12px 14px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 22px rgba(31, 111, 93, 0.18)',
  },
};
