import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, Download, Layers3, Sparkles } from 'lucide-react';
import ModalDialog from '../../../components/common/ModalDialog';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';

const getEventDate = (event) => {
  const date = new Date(event.date || event.startDate || event.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getStartOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const isRecurringEvent = (event) => Boolean(event?.isRecurring === true || (event?.recurrence && String(event.recurrence).toLowerCase() !== 'none'));

const getNextOccurrenceDate = (event, referenceDate = new Date()) => {
  const baseDate = getEventDate(event);
  if (!baseDate || !isRecurringEvent(event)) return baseDate;

  const today = getStartOfDay(referenceDate);
  const recurrence = String(event.recurrence || 'yearly').toLowerCase();
  const baseMonth = baseDate.getMonth();
  const baseDay = baseDate.getDate();

  if (recurrence === 'monthly') {
    const candidate = new Date(today.getFullYear(), today.getMonth(), baseDay);
    if (candidate < today) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, baseDay);
      return nextMonth;
    }
    return candidate;
  }

  const nextYear = new Date(today.getFullYear(), baseMonth, baseDay);
  if (nextYear < today) {
    return new Date(today.getFullYear() + 1, baseMonth, baseDay);
  }

  return nextYear;
};

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
  if (!isRecurringEvent(event)) return getEventDate(event);
  return getNextOccurrenceDate(event, referenceDate);
};

const getDaysRemaining = (eventDate) => {
  if (!eventDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);
  return Math.max(diffDays, 0);
};

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

const resolveGreetingTemplate = (eventType, greetingTemplates = {}) => {
  const rawType = String(eventType || '').trim();
  if (!rawType) return null;

  const exact = greetingTemplates[rawType];
  if (exact) return exact;

  const lowered = rawType.toLowerCase();
  return Object.entries(greetingTemplates).find(([key]) => String(key).toLowerCase() === lowered)?.[1] || null;
};

const getGreetingMessage = (event, greetingTemplates = {}) => {
  const type = String(event?.type || '').trim() || String(event?.name || '').trim();
  const configuredTemplate = resolveGreetingTemplate(type, greetingTemplates);
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
    const [title, ...rest] = String(text).split(/\n+/).filter(Boolean);
    return {
      title: title || `Happy ${ordinal} Birthday ${name} 🎂`,
      body: rest.join(' ') || 'Wishing you a wonderful year filled with happiness, health and success.',
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
    const [title, ...rest] = String(text).split(/\n+/).filter(Boolean);
    return {
      title: title || `Happy ${ordinal} Anniversary ❤️`,
      body: rest.join(' ') || 'Wishing you many more years of happiness, love and beautiful memories together.',
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
    const [title, ...rest] = String(text).split(/\n+/).filter(Boolean);
    return {
      title: title || `Happy ${eventName} 🎉`,
      body: rest.join(' ') || 'Wishing you a joyful celebration and beautiful memories to treasure.',
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
  const [title, ...rest] = String(text).split(/\n+/).filter(Boolean);
  return {
    title: title || `Happy ${eventName}`,
    body: rest.join(' ') || 'Wishing you a wonderful celebration.',
  };
};

function EventSummaryModal({ event, onClose }) {
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
  const greetingTemplates = useAppStore((state) => state.preferences.greetingTemplates || {});
  const greeting = getGreetingMessage(event, greetingTemplates);

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
      });
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(event.name || 'event').toLowerCase().replace(/\s+/g, '-')}-summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalDialog title="Event summary" onClose={onClose}>
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

        <div style={styles.section}>
          <div style={styles.sectionHeading}>Status</div>
          <div style={styles.statusRow}>{statusText}</div>
        </div>

        {activities.length ? (
          <div style={styles.section}>
            <div style={styles.sectionHeading}>Activities</div>
            <ul style={styles.activityList}>
              {activities.map((activity, index) => {
                const label = activity.title || activity.name || 'Untitled activity';
                const isComplete = Boolean(activity.completed);

                return (
                  <li key={`${label}-${activity.id || index}`} style={styles.activityItem}>
                    <span style={isComplete ? styles.activityCheckComplete : styles.activityCheckPending}>
                      {isComplete ? '✓' : '○'}
                    </span>
                    <span style={styles.activityLabel}>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {greeting ? (
          <div style={styles.greetingCard}>
            <div style={styles.greetingTitle}>{greeting.title}</div>
            <p style={styles.greetingBody}>{greeting.body}</p>
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

export default function DashboardOverview() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { events, loading, loadEvents } = useEventStore();
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    if (!user && !isGuest) return;
    if (!events.length) loadEvents(user?.uid, isGuest);
  }, [events.length, isGuest, loadEvents, user]);

  const eventSummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events.filter((event) => {
      const date = getNextOccurrenceForStatus(event, today);
      return date && date >= today;
    });
    const active = events.filter((event) => (
      ['active', 'in progress', 'ongoing'].includes(getEventStatus(event))
      || isSameDay(getNextOccurrenceForStatus(event, today), today)
    ));
    const activityCount = events.reduce((total, event) => total + (event.activities?.length || 0), 0);
    const recent = [...events]
      .sort((a, b) => (getEventDate(b)?.getTime() || 0) - (getEventDate(a)?.getTime() || 0))
      .slice(0, 3);

    return { upcoming, active, activityCount, recent };
  }, [events]);

  const overviewCards = [
    { label: 'Planning', value: `${eventSummary.upcoming.length} upcoming`, icon: CalendarDays },
    { label: 'Active now', value: `${eventSummary.active.length} events`, icon: Sparkles },
    { label: 'Activities', value: `${eventSummary.activityCount} captured`, icon: Activity },
    { label: 'Events', value: `${events.length} total`, icon: Layers3 },
  ];

  return (
    <>
      <div className="dashboard-overview">
        <div className="dashboard-overview-metrics">
          {overviewCards.map((card) => (
            <div key={card.label} className="dashboard-metric-card">
              <div className="dashboard-metric-icon"><card.icon size={17} /></div>
              <div className="dashboard-metric-copy">
                <div className="dashboard-metric-label">{card.label}</div>
                <div className="dashboard-metric-value">{card.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-overview-panels">
          <div className="dashboard-overview-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-panel-kicker">Planning</span><h3>What’s next</h3></div>
              <CalendarDays size={18} />
            </div>
            {loading ? <p style={{ margin: 0, color: '#536a5d' }}>Loading your events...</p> : eventSummary.recent.length ? (
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#294736', lineHeight: 1.8 }}>
                {eventSummary.recent.map((event) => (
                  <li key={event.id || event.firestoreId}>
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(event)}
                      style={{ color: '#1f6f5d', fontWeight: 600, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                    >
                      {event.name || 'Untitled event'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: '#536a5d', lineHeight: 1.7 }}>
                Create your first event to begin your timeline.
              </p>
            )}
          </div>

          <div className="dashboard-overview-panel">
            <div className="dashboard-panel-heading">
              <div><span className="dashboard-panel-kicker">Life archive</span><h3>Remember this</h3></div>
              <Sparkles size={18} />
            </div>
            <p style={{ margin: 0, color: '#536a5d', lineHeight: 1.7 }}>
              Keep milestones, documents, and memories attached to each event so the story remains rich even years later.
            </p>
          </div>
        </div>
      </div>

      {selectedEvent ? <EventSummaryModal event={selectedEvent} onClose={() => setSelectedEvent(null)} /> : null}
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
    display: 'flex',
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
