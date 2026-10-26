import { Sunrise, Sun, Moon } from 'lucide-react';
import useAppStore from '../../../store/useAppStore';
import { dashboardGreeting, dashboardMonthKey, dashboardProfileName } from '../dashboardSummary';
import './DashboardGreeting.css';

export default function DashboardGreeting({ now = new Date() }) {
  const user = useAppStore((state) => state.user);
  const isGuest = useAppStore((state) => state.isGuest);
  const name = dashboardProfileName(user, isGuest);
  const GreetingIcon = now.getHours() < 12 ? Sunrise : now.getHours() < 18 ? Sun : Moon;
  return <header className="dashboard-greeting dashboard-greeting-compact" aria-label="Dashboard greeting">
    <div className="dashboard-greeting-salutation"><GreetingIcon size={20} aria-hidden="true" /><h2>{dashboardGreeting(now)}, {name}</h2></div>
    <time dateTime={`${dashboardMonthKey(now)}-${String(now.getDate()).padStart(2, '0')}`}>{now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</time>
  </header>;
}
