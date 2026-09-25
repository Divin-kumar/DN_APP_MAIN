import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CalendarDays, Layers3, Sparkles } from 'lucide-react';
import useAppStore from '../../../store/useAppStore';
import useEventStore from '../../../store/useEventStore';

const getEventDate = (event) => {
  const date = new Date(event.date || event.startDate || event.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getEventStatus = (event) => String(event.status || '').toLowerCase();

const isSameDay = (first, second) => (
  first && second
  && first.getFullYear() === second.getFullYear()
  && first.getMonth() === second.getMonth()
  && first.getDate() === second.getDate()
);

export default function DashboardOverview() {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const { events, loading, loadEvents } = useEventStore();

  useEffect(() => {
    if (!user && !isGuest) return;
    if (!events.length) loadEvents(user?.uid, isGuest);
  }, [events.length, isGuest, loadEvents, user]);

  const eventSummary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events.filter((event) => {
      const date = getEventDate(event);
      return date && date >= today;
    });
    const active = events.filter((event) => (
      ['active', 'in progress', 'ongoing'].includes(getEventStatus(event))
      || isSameDay(getEventDate(event), today)
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
    <div className="dashboard-overview">
      <div className="dashboard-overview-metrics">
        {overviewCards.map((card) => (
          <div
            key={card.label}
            className="dashboard-metric-card"
          >
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
                  <Link
                    to={`/events/${event.id || event.firestoreId}`}
                    style={{ color: '#1f6f5d', fontWeight: 600 }}
                  >
                    {event.name || 'Untitled event'}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: '#536a5d', lineHeight: 1.7 }}>
              Create your first event to begin your timeline. <Link to="/events" style={{ color: '#1f6f5d', fontWeight: 700 }}>Create an event</Link>
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
  );
}
