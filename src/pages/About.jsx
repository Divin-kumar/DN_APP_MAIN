/**
 * About.jsx
 *
 * Purpose:
 * Product guidance and release information for the DN app.
 * This screen helps new users understand the key flows and helps existing users keep pace with
 * updates without needing engineering knowledge.
 *
 * Main Responsibilities:
 * - explain the app's major workflows
 * - show release and deployment context
 * - guide users through the app experience
 * - support quick refresh and update checks for the PWA shell
 */
import { ArrowLeft, BookOpen, CircleDashed, Info, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
const deployedAt = new Date(import.meta.env.VITE_DEPLOYED_AT);
const publishedDate = Number.isNaN(deployedAt.getTime())
  ? 'Not published yet'
  : (() => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Kolkata',
      }).formatToParts(deployedAt);
      const part = (type) => parts.find((item) => item.type === type)?.value || '';
      return `${part('day')} ${part('month')} ${part('year')} · ${part('hour')}:${part('minute')} IST`;
    })();
const deployEnvironment = import.meta.env.VITE_DEPLOY_ENV || 'Test';

const guideItems = [
  { title: 'Dashboard Overview', description: 'Start with the dashboard to view upcoming events, recent activity, and a quick summary of your personal and financial life.' },
  { title: 'Events Management', description: 'Create life moments, organize event details, and keep each occasion linked to planning notes, memories, and attachments.' },
  { title: 'Activities', description: 'Add tasks and action items for each event so important follow-ups never get buried.' },
  { title: 'Memories', description: 'Capture meaningful notes and moments that shape the story behind each birthday, anniversary, festival, or personal milestone.' },
  { title: 'Attachments', description: 'Attach files, photos, or references to keep the event record complete and easy to revisit.' },
  { title: 'Financials', description: 'Track income, expenses, and spending trends to maintain a clear view of your monthly financial picture.' },
  { title: 'Insights', description: 'Review your personal data and financial patterns for a clearer understanding of habits and progress.' },
  { title: 'Settings', description: 'Tune defaults, reminders, categories, and personalization choices to fit your daily rhythm.' },
];

const whatsNew = [
  'Improved mobile-first Settings navigation for faster access to core controls.',
  'Dedicated About page for cleaner app navigation and simpler user onboarding.',
  'Application guide added to help new users understand major DN flows.',
  'Consistent back-navigation for single-screen app experiences on smaller devices.',
];

const futureReleaseInfo = [
  'Expanded reminder notifications for birthdays, anniversaries, and important activity checkpoints.',
  'Improved monthly summaries and budgeting insights for deeper financial awareness.',
  'More advanced memory and attachment management for richer event records.',
  'Additional personalization controls for app defaults and user-defined life categories.',
];

export default function About() {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const refreshApp = async () => {
    if (refreshing) return;
    setRefreshing(true);

    const waitForInstalledWorker = (worker) => new Promise((resolve) => {
      if (!worker || ['installed', 'activated', 'redundant'].includes(worker.state)) {
        resolve();
        return;
      }

      const timeoutId = window.setTimeout(finish, 6000);
      const finish = () => {
        window.clearTimeout(timeoutId);
        worker.removeEventListener('statechange', handleStateChange);
        resolve();
      };
      const handleStateChange = () => {
        if (['installed', 'activated', 'redundant'].includes(worker.state)) finish();
      };
      worker.addEventListener('statechange', handleStateChange);
    });

    try {
      if ('serviceWorker' in navigator) {
        const serviceWorkers = navigator.serviceWorker;
        const registration = await serviceWorkers.getRegistration();
        if (registration) {
          const previousInstallingWorker = registration.installing;
          await registration.update();
          const installingWorker = registration.installing || previousInstallingWorker;
          if (installingWorker && !registration.waiting) await waitForInstalledWorker(installingWorker);

          const waitingWorker = registration.waiting;
          if (waitingWorker) {
            const controllerChange = new Promise((resolve) => {
              const timeoutId = window.setTimeout(resolve, 2500);
              serviceWorkers.addEventListener('controllerchange', () => {
                window.clearTimeout(timeoutId);
                resolve();
              }, { once: true });
            });
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            await controllerChange;
          }
        }
      }
    } catch (error) {
      console.warn('Could not check for an app update before refreshing:', error);
    }

    window.location.reload();
  };

  return (
    <div className="feature-page settings-page about-page">
      <header className="settings-subpage-header">
        <button type="button" className="settings-back-button" onClick={() => navigate('/settings')} aria-label="Back to Settings">
          <ArrowLeft size={16} />
        </button>
        <div className="settings-subpage-title-wrap">
          <span className="settings-subpage-eyebrow">Settings</span>
          <div className="about-title-row">
            <h2>About DN</h2>
            <span className="about-version-badge">v{appVersion}</span>
          </div>
        </div>
      </header>

      <section className="settings-section about-panel">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><Info size={18} /></span>
          <div>
            <h3>Version Information</h3>
            <p>Application details</p>
          </div>
        </div>

        <div className="about-summary-grid">
          <div className="about-summary-item">
            <span className="about-summary-label">Application</span>
            <strong>DN</strong>
          </div>
          <div className="about-summary-item">
            <span className="about-summary-label">Version</span>
            <strong>v{appVersion}</strong>
          </div>
          <div className="about-summary-item">
            <span className="about-summary-label">Published</span>
            <strong>{publishedDate}</strong>
          </div>
          <div className="about-summary-item">
            <span className="about-summary-label">Environment</span>
            <strong>{deployEnvironment}</strong>
          </div>
        </div>

        <div className="about-description">
          DN is a personal life and finance companion built to keep important moments, planning details, memories,
          and financial patterns connected in one place.
        </div>

        <div className="about-refresh-row">
          <div>
            <strong>App updates</strong>
            <span>Check for and apply the latest release.</span>
          </div>
          <button type="button" className="settings-secondary-button about-refresh-button" onClick={refreshApp} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'is-spinning' : ''} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh app'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><Sparkles size={18} /></span>
          <div>
            <h3>What&apos;s New</h3>
            <p>Recent improvements in the DN experience</p>
          </div>
        </div>
        <ul className="about-list compact-list">
          {whatsNew.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><BookOpen size={18} /></span>
          <div>
            <h3>Application Guide</h3>
            <p>How to use DN across key flows</p>
          </div>
        </div>

        <div className="about-guide-grid compact-grid">
          {guideItems.map(({ title, description }) => (
            <article key={title} className="about-guide-item compact-item">
              <h4>{title}</h4>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><TrendingUp size={18} /></span>
          <div>
            <h3>Future Roadmap</h3>
            <p>Planned enhancements and upcoming capabilities</p>
          </div>
        </div>
        <ul className="about-list compact-list">
          {futureReleaseInfo.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <footer className="about-version-footer">DN · v{appVersion} · {deployEnvironment}</footer>
    </div>
  );
}
