// This component is the main dashboard summary screen.
// It gathers upcoming events, activity progress, greeting ideas, and quick export actions in one place.
import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, Copy, Download, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModalDialog from '../../../components/common/ModalDialog';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';
import { getUpcomingDashboardEvents, getMomentTypeGreetingTemplate } from '../../../utils/dashboardVisibility';
import { getCalendarDaysRemaining, getEventDate, getNextOccurrenceDate, isRecurringEvent } from '../../../utils/momentDates';
import { downloadBlob } from '../../../utils/download';

const EMPTY_GREETING_TEMPLATES = Object.freeze({});
const EMPTY_MOMENT_TYPES = Object.freeze([]);
const EMPTY_EVENTS = Object.freeze([]);

const getEventStatus = (event) => String(event.status || '').toLowerCase();

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

const getBirthdayGreeting = (event) => {
  const eventDate = getEventDate(event);
  if (!eventDate) return null;

  const today = new Date();
  const age = today.getFullYear() - eventDate.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const finalAge = birthdayThisYear > today ? age - 1 : age;

  if (finalAge < 1) return null;

  return {
    title: `Happy ${getOrdinal(finalAge)} Birthday ${getGreetingName(event)} 🎂`,
    body: 'Wishing you a wonderful year filled with happiness, health, and success.',
  };
};

const getAnniversaryGreeting = (event) => {
  const eventDate = getEventDate(event);
  if (!eventDate) return null;

  const today = new Date();
  const anniversaryYears = today.getFullYear() - eventDate.getFullYear();
  const anniversaryThisYear = new Date(today.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const finalYears = anniversaryThisYear > today ? anniversaryYears - 1 : anniversaryYears;

  if (finalYears < 1) return null;

  return {
    title: `Happy ${getOrdinal(finalYears)} Anniversary ❤️`,
    body: 'Wishing you many more years of happiness and beautiful memories together.',
  };
};

const getNextOccurrenceForStatus = (event, referenceDate = new Date()) => {
  return getNextOccurrenceDate(event, referenceDate);
};

const getDaysRemaining = getCalendarDaysRemaining;

const getValueFromEvent = (event, keys) => {
  for (const key of keys) {
    const value = event?.[key];
    if (value) return value;
  }
  return null;
};

const getBirthdayAge = (event) => {
  const rawDate = getValueFromEvent(event, ['birthDate', 'birthdayDate', 'date']);
  const source = new Date(rawDate);
  if (Number.isNaN(source.getTime())) return null;

  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  let age = today.getFullYear() - source.getFullYear();
  if (today < birthdayThisYear) age -= 1;
  return Math.max(age, 0);
};

const getAnniversaryYears = (event) => {
  const rawDate = getValueFromEvent(event, ['anniversaryDate', 'date']);
  const source = new Date(rawDate);
  if (Number.isNaN(source.getTime())) return null;

  const today = new Date();
  const anniversaryThisYear = new Date(today.getFullYear(), source.getMonth(), source.getDate());
  let years = today.getFullYear() - source.getFullYear();
  if (today < anniversaryThisYear) years -= 1;
  return Math.max(years, 0);
};

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
  const pendingActivities = Math.max(totalActivities - completedActivities, 0);
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

  const statusText = eventStatus === 'Upcoming' && daysRemaining !== null && daysRemaining <= 3 && !isRecurring ? 'Event is approaching' : eventStatus;
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || EMPTY_GREETING_TEMPLATES);
  const momentTypes = useAppStore((state) => state.adminValues.eventTypes || EMPTY_MOMENT_TYPES);
  const greeting = event.greetingCard?.title ? event.greetingCard : getGreetingMessage(event, greetingTemplates, momentTypes);

  const handleDownload = () => {
    const lines = [
      `${event.name || 'Untitled event'}`,
      `Type: ${event.type || 'Event'}`,
      `Date: ${formatDisplayDate(eventDate)}`,
      `Status: ${statusText}`,
      '',
    ];

    if (greeting) {
      lines.push(greeting.title, greeting.body, '');
    }

    if (activities.length) {
      lines.push('Activities:');
      activities.forEach((activity) => {
        const label = activity.title || activity.name || 'Untitled activity';
        const check = activity.completed ? '✓' : '○';
        lines.push(`${check} ${label}`);
        const description = String(activity.description || '').trim();
        if (description) lines.push(`  Description: ${description}`);
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${(event.name || 'event').toLowerCase().replace(/\s+/g, '-')}-summary.txt`);
  };

  return (
    <ModalDialog title="Event summary" onClose={onClose} className="dashboard-event-summary-modal">
      <div style={styles.cardWrap}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Event</div>
            <h4 style={styles.heroTitle}>{event.name || 'Untitled event'}</h4>
          </div>
          <div style={styles.heroMeta}>
            <span style={styles.typePill}>{event.type || 'Event'}</span>
            <strong style={styles.daysText}>
              {daysRemaining === null ? 'Date pending' : daysRemaining === 0 ? 'Today' : `${daysRemaining} days left`}
            </strong>
            <span style={styles.dateText}>{formatDisplayDate(eventDate)}</span>
          </div>
        </div>

        {greeting ? (
          <div style={styles.greetingCard}>
            <div style={styles.greetingTitle}>{greeting.title}</div>
            <p className="free-text-content" style={styles.greetingBody}>{greeting.body}</p>
          </div>
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
                    <span className="dashboard-summary-activity-copy">
                      <span style={styles.activityLabel}>{label}</span>
                      <span style={styles.activityDate}>{formatActivityDate(activity.date)}</span>
                      {hasDescription ? (
                        <span className="dashboard-summary-description-wrap">
                          <span className={`dashboard-summary-description free-text-content${canExpandDescription && !descriptionExpanded ? ' free-text-preview is-truncated' : ''}`}>
                            {description}
                          </span>
                          {canExpandDescription ? <button type="button" className="dashboard-summary-description-toggle" aria-expanded={descriptionExpanded} onClick={() => setExpandedDescriptions((current) => ({ ...current, [activity.id || index]: !current[activity.id || index] }))}>{descriptionExpanded ? 'Show less' : 'Show more'}</button> : null}
                        </span>
                      ) : null}
                    </span>
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

function GreetingCardModal({ event, greeting, onClose, onCopy }) {
  return (
    <ModalDialog title="Today's greeting" onClose={onClose} className="dashboard-greeting-modal">
      <article className="dashboard-greeting-card-full">
        <span className="dashboard-greeting-card-kicker"><Sparkles size={15} /> A greeting for today</span>
        <span className="dashboard-greeting-card-event">{event.name || event.type || 'On this day'} · {formatDisplayDate(new Date())}</span>
        <h2>{greeting.title}</h2>
        <p className="free-text-content">{greeting.body}</p>
      </article>
      <div className="dashboard-greeting-modal-actions">
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
  const { events: storedEvents, loading, error, loadedFor, activeLoadKey, loadEvents } = useEventStore();
  const loadKey = `${isGuest ? 'guest' : 'user'}:${user?.uid || 'anonymous'}`;
  const ready = loadedFor === loadKey && activeLoadKey === loadKey;
  const events = ready ? storedEvents : EMPTY_EVENTS;
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [greetingEvent, setGreetingEvent] = useState(null);

  useEffect(() => {
    setSelectedEvent(null);
    setGreetingEvent(null);
  }, [loadKey]);

  useEffect(() => {
    if (!user && !isGuest) return;
    loadEvents(user?.uid, isGuest);
  }, [isGuest, loadEvents, user?.uid, loadedFor]);

  const todayKey = new Date().toDateString();
  const upcomingEvents = useMemo(() => getUpcomingDashboardEvents(events, new Date(), momentTypes), [events, momentTypes, todayKey]);

  const upcomingEmptyMessage = 'No moments in the next 30 days.';

  const focusEvent = upcomingEvents[0] || events[0] || null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const profileName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || (isGuest ? 'Guest' : 'there');
  const focusDate = focusEvent ? getNextOccurrenceForStatus(focusEvent) : null;
  const daysUntilFocus = focusDate ? getDaysRemaining(focusDate) : null;
  const today = new Date();
  const onThisDayEvents = useMemo(() => events.filter((event) => {
    const eventDate = getEventDate(event);
    if (!eventDate || eventDate > today) return false;
    const recurrence = String(event.recurrence || '').toLowerCase();
    if (recurrence === 'monthly') return eventDate.getDate() === today.getDate();
    return eventDate.getMonth() === today.getMonth() && eventDate.getDate() === today.getDate();
  }).sort((first, second) => getEventDate(first) - getEventDate(second)), [events, today.getDate(), today.getMonth(), today.getFullYear()]);
  const spotlightEvent = onThisDayEvents[0] || null;
  const spotlightGreetingEvent = spotlightEvent && !isRecurringEvent(spotlightEvent)
    ? { ...spotlightEvent, recurrence: 'yearly' }
    : spotlightEvent;
  const spotlightDate = spotlightEvent ? getEventDate(spotlightEvent) : null;
  const spotlightGreeting = spotlightEvent?.greetingCard?.title
    ? spotlightEvent.greetingCard
    : spotlightGreetingEvent ? getGreetingMessage(spotlightGreetingEvent, greetingTemplates, momentTypes) : null;
  const activeTodayCount = events.filter((event) => isSameDay(getNextOccurrenceForStatus(event, today), today)).length;
  const dateText = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }).format(today);
  const copyTodaysGreeting = async () => {
    if (!spotlightGreeting) return;
    try {
      await navigator.clipboard.writeText(`${spotlightGreeting.title}\n\n${spotlightGreeting.body}`);
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
        <section className="focus-event-card" aria-label="On this day">
          <div className="focus-event-header"><span className="focus-event-kicker">On this day</span><span className="dashboard-date-chip">{dateText}</span></div>
          {spotlightEvent ? (
            <button type="button" className="dashboard-spotlight" onClick={() => setSelectedEvent(spotlightEvent)}>
              <span className="dashboard-spotlight-date">{formatDisplayDate(spotlightDate)}</span>
              <strong>{spotlightEvent.name || spotlightEvent.type || 'A life moment'}</strong>
              <span>{spotlightDate ? `${today.getFullYear() - spotlightDate.getFullYear()} ${today.getFullYear() - spotlightDate.getFullYear() === 1 ? 'year' : 'years'} ago` : 'A moment to remember'}</span>
            </button>
          ) : (
            <div className="focus-event-empty"><h3>{loading ? 'Finding a moment…' : 'A little space for what matters'}</h3><p>{focusEvent ? `Your next moment is ${focusEvent.name || 'coming up'}${daysUntilFocus === 0 ? ' today' : daysUntilFocus !== null ? ` in ${daysUntilFocus} ${daysUntilFocus === 1 ? 'day' : 'days'}` : ''}.` : 'Your on-this-day stories will appear here.'}</p></div>
          )}
          {spotlightGreeting && spotlightEvent ? (
            <button type="button" className="dashboard-greeting-preview" onClick={() => setGreetingEvent(spotlightGreetingEvent)} aria-label={`View today's greeting: ${spotlightGreeting.title}`}>
              <span>Greeting preview</span><strong>{spotlightGreeting.title}</strong><span className="dashboard-greeting-open">View greeting <span aria-hidden="true">→</span></span>
            </button>
          ) : null}
        </section>
        <section className="dashboard-upcoming-card" aria-label="Upcoming moments">
          <header style={styles.upcomingHeader}>
            <span>Upcoming moments</span>
            <button type="button" className="dashboard-upcoming-all-button" onClick={() => navigate('/events')}>All moments <span aria-hidden="true">→</span></button>
          </header>
          {error === 'Unable to load events.' ? (
            <div className="financial-load-error" role="alert"><span>Moments couldn’t be loaded.</span><button type="button" className="settings-secondary-button" onClick={() => loadEvents(user?.uid, isGuest)}>Try again</button></div>
          ) : !ready || loading ? (
            <p className="dashboard-upcoming-empty" role="status">Loading upcoming moments…</p>
          ) : upcomingEvents.length ? (
            <div style={styles.upcomingListContainer} className="dashboard-upcoming-list-container">
              <div className="dashboard-upcoming-list" style={styles.upcomingList}>
                {upcomingEvents.map((event) => {
                  const date = getNextOccurrenceForStatus(event, today);
                  const days = getDaysRemaining(date);
                  return <button type="button" className="dashboard-upcoming-row" key={event.id || event.firestoreId} onClick={() => setSelectedEvent(event)}><span className="dashboard-upcoming-date"><strong>{date?.toLocaleDateString('en-GB', { day: '2-digit' }) || '—'}</strong><small>{date?.toLocaleDateString('en-GB', { month: 'short' }) || 'Date'}</small></span><span className="dashboard-upcoming-copy"><strong>{event.name || event.type || 'Life moment'}</strong><small>{event.type || 'Personal'} · {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days away`}</small></span><span className="dashboard-upcoming-arrow" aria-hidden="true">›</span></button>;
                })}
              </div>
            </div>
          ) : (
            <p className="dashboard-upcoming-empty">{upcomingEmptyMessage}</p>
          )}
        </section>
        <button type="button" className="dashboard-insights-cta" onClick={() => navigate('/insights')}>
          <span><strong>View Insights</strong><small>Explore reports and patterns across your moments</small></span><Sparkles size={19} /><span className="dashboard-insights-arrow">→</span>
        </button>
      </div>

      {selectedEvent ? <EventSummaryModal event={selectedEvent} onClose={() => setSelectedEvent(null)} /> : null}
      {greetingEvent && spotlightGreeting ? <GreetingCardModal event={greetingEvent} greeting={spotlightGreeting} onClose={() => setGreetingEvent(null)} onCopy={copyTodaysGreeting} /> : null}
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
  upcomingHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
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
  greetingCard: {
    padding: '18px 16px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, #f9f2d6 0%, #fffaf0 50%, #f0f7f6 100%)',
    border: '1px solid rgba(173, 140, 70, 0.18)',
    boxShadow: '0 16px 28px rgba(110, 96, 44, 0.08)',
    color: '#463d1a',
  },
  greetingTitle: {
    margin: '0 0 8px',
    fontSize: '1rem',
    fontWeight: 800,
    color: '#1f6f5d',
    lineHeight: 1.4,
  },
  greetingBody: {
    margin: 0,
    color: '#463d1a',
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
