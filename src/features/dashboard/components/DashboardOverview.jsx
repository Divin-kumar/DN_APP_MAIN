// This component is the main dashboard summary screen.
// It gathers upcoming events, activity progress, greeting ideas, and quick export actions in one place.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModalDialog from '../../../components/common/ModalDialog';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import { getOnThisDayDashboardEvents, getUpcomingDashboardEvents, getMomentTypeGreetingTemplate } from '../../../utils/dashboardVisibility';
import { getOnThisDayDashboardActivities, getUpcomingDashboardActivities } from '../../../utils/dashboardActivities';
import { formatMomentDate, getCalendarDaysRemaining, getEventDate, getNextOccurrenceDate, isRecurringEvent, parseMomentDate } from '../../../utils/momentDates';
import { downloadBlob } from '../../../utils/download';
import RichText from '../../../components/common/RichText';
import { plainRichText } from '../../../utils/richText';
import GreetingCard, { buildGreetingCardHtml } from '../../../components/common/GreetingCard';
import SwipeToComplete from '../../../components/common/SwipeToComplete';
import DashboardActivityEditor from './DashboardActivityEditor';
import { recordId } from '../../../utils/recordIdentity';
import { getActiveSampleScenario } from '../../../dev/sampleData';

const EMPTY_GREETING_TEMPLATES = Object.freeze({});
const EMPTY_MOMENT_TYPES = Object.freeze([]);
const EMPTY_EVENTS = Object.freeze([]);

const isSameDay = (first, second) => (
  first && second
  && first.getFullYear() === second.getFullYear()
  && first.getMonth() === second.getMonth()
  && first.getDate() === second.getDate()
);

const formatDisplayDate = (date) => {
  if (!date) return 'Date not set';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatActivityDate = (value) => {
  if (!value) return 'No date';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? (() => {
      const [year, month, day] = String(value).split('-').map(Number);
      return new Date(year, month - 1, day);
    })()
    : new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);
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
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const eventDate = getNextOccurrenceForStatus(event);
  const activities = Array.isArray(event.activities) ? event.activities : [];
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

    if (activities.length) {
      lines.push('Activities:');
      activities.forEach((activity) => {
        const label = activity.title || activity.name || 'Untitled activity';
        const check = activity.completed ? '✓' : '○';
        lines.push(`${check} ${label}`);
        const description = plainRichText(activity.description || '');
        if (description) lines.push(`  Description: ${description}`);
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${(event.name || 'event').toLowerCase().replace(/\s+/g, '-')}-summary.txt`);
  };

  return (
    <ModalDialog title="Moment summary" onClose={onClose} className="dashboard-event-summary-modal">
      <div style={styles.cardWrap}>
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
                const canExpandDescription = description.length > 150 || description.split(/\r\n|\r|\n/).length > 2;
                const descriptionExpanded = Boolean(expandedDescriptions[activity.id || index]);

                return (
                  <li key={`${label}-${activity.id || index}`} className="dashboard-summary-activity-item" style={styles.activityItem}>
                    <span style={isComplete ? styles.activityCheckComplete : styles.activityCheckPending}>
                      {isComplete ? '✓' : '○'}
                    </span>
                    <div className="dashboard-summary-activity-copy">
                      <span style={styles.activityLabel}>{label}</span>
                      <span style={styles.activityDate}>{formatActivityDate(activity.date)}</span>
                      {hasDescription ? (
                        <div className="dashboard-summary-description-wrap">
                          <RichText className={`dashboard-summary-description${canExpandDescription && !descriptionExpanded ? ' free-text-preview is-truncated' : ''}`} value={description} />
                          {canExpandDescription ? <button type="button" className="dashboard-summary-description-toggle" aria-expanded={descriptionExpanded} onClick={() => setExpandedDescriptions((current) => ({ ...current, [activity.id || index]: !current[activity.id || index] }))}>{descriptionExpanded ? 'Show less' : 'Show more'}</button> : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

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
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const showToast = useAppStore((state) => state.showToast);
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || EMPTY_GREETING_TEMPLATES);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes || EMPTY_MOMENT_TYPES);
  const priorities = useAppStore((state) => state.adminValues.activityPriorities || EMPTY_MOMENT_TYPES);
  const { events: storedEvents, loading, error, loadedFor, activeLoadKey, loadEvents } = useEventStore();
  const loadKey = `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
  const ready = loadedFor === loadKey && activeLoadKey === loadKey;
  const events = ready ? storedEvents : EMPTY_EVENTS;
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [greetingEvent, setGreetingEvent] = useState(null);
  const [momentView, setMomentView] = useState('upcoming');
  const [activityView, setActivityView] = useState('upcoming');
  const [activityDraft, setActivityDraft] = useState(null);
  const [activityError, setActivityError] = useState('');
  const [busyActivityParents, setBusyActivityParents] = useState(() => new Set());
  const pendingActivityWrites = useRef(new Map());
  const activityEditorToken = useRef(0);
  const activityDraftRef = useRef(activityDraft);
  activityDraftRef.current = activityDraft;
  const mounted = useRef(false);
  const dashboardScope = useRef(loadKey);
  dashboardScope.current = loadKey;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; activityDraftRef.current = null; }; }, []);

  useEffect(() => {
    setSelectedEvent(null);
    setGreetingEvent(null);
    setMomentView('upcoming');
    setActivityView('upcoming');
    setActivityDraft(null);
    activityDraftRef.current = null;
    setActivityError('');
  }, [loadKey]);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
  }, [isGuest, loadEvents, user?.uid, loadedFor]);

  const todayKey = new Date().toDateString();
  const upcomingEvents = useMemo(() => getUpcomingDashboardEvents(events, new Date(), momentTypes), [events, momentTypes, todayKey]);
  const onThisDayEvents = useMemo(() => getOnThisDayDashboardEvents(events, new Date(), momentTypes), [events, momentTypes, todayKey]);
  const dashboardMoments = momentView === 'upcoming' ? upcomingEvents : onThisDayEvents;
  const upcomingActivities = useMemo(() => getUpcomingDashboardActivities(events, new Date(), momentTypes), [events, momentTypes, todayKey]);
  const onThisDayActivities = useMemo(() => getOnThisDayDashboardActivities(events, new Date(), momentTypes), [events, momentTypes, todayKey]);
  const dashboardActivities = activityView === 'upcoming' ? upcomingActivities : onThisDayActivities;

  const activityTarget = (event, activity) => ({
    scope: loadKey, uid: user?.uid || null, isGuest: Boolean(isGuest), sample: getActiveSampleScenario(user?.uid),
    momentId: recordId(event.id) || recordId(event.firestoreId), activityId: recordId(activity.id),
  });
  const activityParentKey = (target) => JSON.stringify([target.scope, target.sample, target.momentId]);
  const isCurrentActivityScope = (target) => {
    const session = useAppStore.getState();
    const current = useEventStore.getState();
    return mounted.current && dashboardScope.current === target.scope
      && (Boolean(session.isGuest) || Boolean(session.user?.uid))
      && (session.user?.uid || null) === target.uid && Boolean(session.isGuest) === target.isGuest
      && `${session.isGuest ? 'guest' : 'user'}:${session.user?.uid || 'anonymous'}` === target.scope
      && getActiveSampleScenario(session.user?.uid) === target.sample
      && current.loadedFor === target.scope && current.activeLoadKey === target.scope && !current.loading;
  };
  const resolveDashboardActivity = (target) => {
    if (!isCurrentActivityScope(target)) throw new Error('Your session changed or Moments are still loading. Reopen this activity and try again.');
    const current = useEventStore.getState();
    const moment = current.events.find((item) => (recordId(item.id) || recordId(item.firestoreId)) === target.momentId);
    const activity = target.activityId && moment?.activities?.find((item) => recordId(item.id) === target.activityId);
    if (!moment || !activity) throw new Error('This Moment or activity is no longer available.');
    return { current, moment, activity };
  };
  const openDashboardActivity = (event, activity) => {
    const target = activityTarget(event, activity);
    if (pendingActivityWrites.current.has(activityParentKey(target))) return;
    try {
      const latest = resolveDashboardActivity(target);
      const draft = { ...target, token: ++activityEditorToken.current, momentName: latest.moment.name,
        title: latest.activity.title || latest.activity.name || '', date: formatMomentDate(parseMomentDate(latest.activity.date)),
        priority: latest.activity.priority || 'medium', description: latest.activity.description || '' };
      activityDraftRef.current = draft;
      setActivityDraft(draft);
      setActivityError('');
    } catch (reason) {
      if (isCurrentActivityScope(target)) setActivityError(reason.message);
    }
  };
  const changeDashboardActivity = (patch) => {
    setActivityDraft((draft) => {
      if (!draft || pendingActivityWrites.current.has(activityParentKey(draft))) return draft;
      const next = { ...draft, ...patch };
      activityDraftRef.current = next;
      return next;
    });
  };
  const closeDashboardActivity = () => {
    if (activityDraftRef.current && pendingActivityWrites.current.has(activityParentKey(activityDraftRef.current))) return;
    activityDraftRef.current = null;
    setActivityDraft(null);
    setActivityError('');
  };
  const writeDashboardActivity = async (target, patch, completion = false) => {
    const parentKey = activityParentKey(target);
    if (pendingActivityWrites.current.has(parentKey)) return false;
    const operationKey = JSON.stringify([target.scope, target.sample, target.momentId, target.activityId]);
    try {
      const { current, moment, activity } = resolveDashboardActivity(target);
      if (completion && (activity.completed || String(activity.status || '').toLowerCase() === 'completed')) return false;
      if (completion && (moment.archived || ['archived', 'cancelled'].includes(String(moment.status || '').toLowerCase())
        || activity.cancelled || ['cancelled', 'canceled'].includes(String(activity.status || '').toLowerCase()))) {
        throw new Error('This activity is no longer available to complete.');
      }
      pendingActivityWrites.current.set(parentKey, operationKey);
      setBusyActivityParents(new Set(pendingActivityWrites.current.keys()));
      setActivityError('');
      await current.updateEventItem(target.uid, target.isGuest, { ...moment,
        activities: moment.activities.map((item) => recordId(item.id) === target.activityId ? { ...item, ...patch } : item),
      });
      if (isCurrentActivityScope(target)) {
        if (!completion && activityDraftRef.current?.token === target.token) {
          activityDraftRef.current = null;
          setActivityDraft(null);
        }
        showToast(completion ? 'Activity completed' : 'Activity updated', 'success');
      }
      return true;
    } catch (reason) {
      if (isCurrentActivityScope(target)) {
        setActivityError(reason?.message || 'Could not save this activity. Please try again.');
        if (completion) showToast('Could not complete this activity. Please try again.', 'danger');
      }
      throw reason;
    } finally {
      if (pendingActivityWrites.current.get(parentKey) === operationKey) pendingActivityWrites.current.delete(parentKey);
      // The lock belongs to this mounted Dashboard, not to a visible session.
      // Reconcile it even after a scope change so returning to an account does
      // not retain a disabled row after that account's request has settled.
      if (mounted.current) setBusyActivityParents(new Set(pendingActivityWrites.current.keys()));
    }
  };
  const saveDashboardActivity = (submitEvent) => {
    submitEvent.preventDefault();
    const draft = activityDraftRef.current;
    if (!draft || pendingActivityWrites.current.has(activityParentKey(draft))) return;
    if (!draft.title.trim() || !parseMomentDate(draft.date)) { setActivityError('Enter an activity title and a valid date.'); return; }
    return writeDashboardActivity(draft, { title: draft.title.trim(), date: draft.date, description: draft.description, priority: draft.priority }).catch(() => {});
  };
  const completeDashboardActivity = (target) => writeDashboardActivity(target, { completed: true, completedAt: new Date().toISOString() }, true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const profileName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || (isGuest ? 'Guest' : 'there');
  const today = new Date();
  const getMomentGreeting = (event) => {
    const greetingSource = momentView === 'on-this-day' && !isRecurringEvent(event) ? { ...event, recurrence: 'yearly' } : event;
    return event.greetingCard?.title ? event.greetingCard : getGreetingMessage(greetingSource, greetingTemplates, momentTypes);
  };
  const selectedGreeting = greetingEvent?.greeting;
  const activeTodayCount = events.filter((event) => isSameDay(getNextOccurrenceForStatus(event, today), today)).length;
  const dateText = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }).format(today);
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
      <div className="dashboard-overview">
        <header className="dashboard-greeting">
          <span>{greeting}, {profileName}</span>
          <p>{activeTodayCount} {activeTodayCount === 1 ? 'moment' : 'moments'} today <i>·</i> {dateText}</p>
        </header>
        <section className="dashboard-upcoming-card" aria-label="Moments">
          <header style={styles.upcomingHeader}>
            <span>Moments</span>
          </header>
          <div role="group" aria-label="Moment dates" className="dashboard-date-views">
            <button type="button" aria-pressed={momentView === 'upcoming'} onClick={() => setMomentView('upcoming')}>Upcoming</button>
            <button type="button" aria-pressed={momentView === 'on-this-day'} onClick={() => setMomentView('on-this-day')}>On This Day</button>
          </div>
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
        </section>
        <section className="dashboard-upcoming-card" aria-label="Activities">
          <header style={styles.upcomingHeader}>
            <span>Activities</span>
          </header>
          <div role="group" aria-label="Activity dates" className="dashboard-date-views">
            <button type="button" aria-pressed={activityView === 'upcoming'} onClick={() => setActivityView('upcoming')}>Upcoming</button>
            <button type="button" aria-pressed={activityView === 'on-this-day'} onClick={() => setActivityView('on-this-day')}>On This Day</button>
          </div>
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
                  const target = activityTarget(event, activity);
                  const busy = busyActivityParents.has(activityParentKey(target));
                  const row = (
                    <button type="button" className="dashboard-upcoming-row" disabled={activityView === 'upcoming' && busy}
                      aria-label={activityView === 'upcoming' ? `Edit ${activity.title || activity.name || 'activity'}` : undefined}
                      onClick={() => activityView === 'upcoming' ? openDashboardActivity(event, activity) : navigate(`/events/${encodeURIComponent(event.id || event.firestoreId)}/activities`)}>
                      <span className="dashboard-upcoming-date"><strong>{date.toLocaleDateString('en-GB', { day: '2-digit' })}</strong><small>{date.toLocaleDateString('en-GB', { month: 'short' })}</small></span>
                      <span className="dashboard-upcoming-copy"><strong>{activity.title || activity.name || 'Untitled activity'}</strong><small>{event.name || event.type || 'Moment'} · {activityView === 'on-this-day' ? `${date.getFullYear()} · ${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`}</small></span>
                      <span className="dashboard-upcoming-arrow" aria-hidden="true">›</span>
                    </button>
                  );
                  const key = JSON.stringify([target.momentId, target.activityId || index]);
                  return activityView === 'upcoming'
                    ? <SwipeToComplete key={key} label={activity.title || activity.name || 'activity'} disabled={busy}
                      onComplete={() => completeDashboardActivity(target)}>{row}</SwipeToComplete>
                    : <div key={key}>{row}</div>;
                })}
              </div>
            </div>
          ) : (
            <p className="dashboard-upcoming-empty">{activityView === 'upcoming' ? 'No pending activities in the next 30 days.' : 'No activities on this day in previous years.'}</p>
          )}
          {activityError && !activityDraft ? <p className="dashboard-activity-action-error" role="alert">{activityError}</p> : null}
        </section>
      </div>

      {selectedEvent ? <EventSummaryModal event={selectedEvent} onClose={() => setSelectedEvent(null)} /> : null}
      {greetingEvent && selectedGreeting ? <GreetingCardModal event={greetingEvent.event} greeting={selectedGreeting} dateLabel={greetingEvent.dateLabel} onClose={() => setGreetingEvent(null)} onCopy={copyTodaysGreeting} /> : null}
      {activityDraft && isCurrentActivityScope(activityDraft) ? <DashboardActivityEditor draft={activityDraft} priorities={priorities}
        busy={busyActivityParents.has(activityParentKey(activityDraft))} error={activityError}
        onChange={changeDashboardActivity} onSubmit={saveDashboardActivity} onClose={closeDashboardActivity} /> : null}
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
  upcomingHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
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
