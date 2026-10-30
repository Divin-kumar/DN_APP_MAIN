import useAppStore from '../../../store/useAppStore';
import { dashboardGreeting, dashboardMonthKey, dashboardProfileName } from '../dashboardSummary';
import './DashboardGreeting.css';

const emojiForGreeting = (greeting) => greeting === 'Good morning' ? '☀️'
  : greeting === 'Good afternoon' ? '🌤️' : '🌙';

// A quiet welcome, based only on the viewer's local clock and identity.
// No finance, activity or Moment reads are needed for this card.
export default function DashboardGreeting({ now = new Date() }) {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const name = dashboardProfileName(user, isGuest);
  const salutation = dashboardGreeting(now);
  // Explicit punctuation is consistent across browser/Node Intl implementations.
  const displayDate = `${now.toLocaleDateString('en-GB', { weekday: 'long' })}, ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return <header className="dashboard-greeting dashboard-greeting-compact" aria-label="Dashboard greeting">
    <div className="dashboard-greeting-topline">
      <span className="dashboard-greeting-eyebrow">Your day</span>
      <span className="dashboard-greeting-emoji" aria-hidden="true">{emojiForGreeting(salutation)}</span>
    </div>
    <h2 className="dashboard-greeting-title">{salutation}, {name}</h2>
    <time className="dashboard-greeting-date"
      dateTime={`${dashboardMonthKey(now)}-${String(now.getDate()).padStart(2, '0')}`}>
      {displayDate}
    </time>
  </header>;
}
