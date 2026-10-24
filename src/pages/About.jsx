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
import { ArrowLeft, BookOpen, Info, RefreshCw, Sparkles } from 'lucide-react';
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
  { title: 'Home', description: 'Moments and Activities each have one card with small Upcoming and On This Day text controls. Upcoming Activity rows open their own editor without leaving Home; swipe sideways to complete one. See the next 30 days or revisit this date in previous years. Choose which Moment types appear using Show on Dashboard in Code Lists.' },
  { title: 'Moments', description: 'Create and search your Moments in one list. Open Filters & sort to narrow the list or change its order. Filter choices stay open while you use them and close when you click elsewhere; Sort is on the second line and a tiny Reset option is below it. Swipe a Moment for Edit, Summary, Archive or Delete.' },
  { title: 'Moment workspace', description: 'Move between Overview, Activities, Timeline, Memories and Attachments using the section row. Use the universal + to add items; Memory and Attachment are available there while a Moment is open.' },
  { title: 'Activities', description: 'Open Activities from the main navigation to see tasks across Moments. Filters and sorting expand within the page; swipe sideways for more controls. Filter choices close when you click elsewhere; Sort is on the second line and a tiny Reset option is below it. Completed titles stay readable without being crossed out. Complete, cancel or edit tasks and add linked transactions in place. Each activity still belongs to its original Moment.' },
  { title: 'Memories and greetings', description: 'Write with visible formatting on phones and computers. Select text for compact styling tools, or use keyboard shortcuts. Memories stay within their Moment; personalized greeting cards have a matching preview and HTML download.' },
  { title: 'Attachments', description: 'Use + inside a Moment to keep an original photo or file up to 10 MB, optionally with an Activity. Photos preview in Activities and Attachments. Identical originals share one stored file. Account saves require a successful cloud upload; Guest files stay in this browser. Older file details cannot recover an original that was never stored.' },
  { title: 'Transactions', description: 'Open Transactions under Profile to add income and expenses, optionally linked to a Moment or Activity. Search beside Filters; choose type or month inside. History is newest first, and Income, Expense and Balance totals follow the selected month.' },
  { title: 'Insights', description: 'Open Insights under Profile to review counts, spending and income patterns. Its JSON report is separate from a recovery backup.' },
  { title: 'Settings and backup', description: 'Open Settings under Profile to manage theme, preferences, greeting options and Code Lists. Export a JSON backup and review the restore summary before importing it. Reminder preferences do not schedule background notifications.' },
];

const whatsNew = [
  'Activities puts Status first and keeps the rarely used Moment visibility filter under More. The Moment picker shows unarchived Moments by default.',
  'Dropdown text is larger and menus have more room for readable names. Sort and the tiny Reset option keep their own rows.',
  'Upcoming activities on Home have a small pencil cue for editing in place. On This Day activities use a book icon for opening their Moment.',
];

const dataInfo = [
  'Signed-in records are stored in your account. Guest records stay in this browser; export a backup before changing browsers or devices.',
  'Recovery backups include supported records, settings and stored original attachments. Complete JSON backups must be 50 MB or smaller; missing or corrupted originals stop export. Older metadata-only entries have no file bytes to recover.',
  'Downloaded JSON backups are not encrypted. Store them privately because they can contain personal and financial information.',
  'Refresh app checks for an available app-shell update and reloads the page. It does not clear your saved records or replace a data backup.',
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

      let timeoutId;
      const finish = () => {
        window.clearTimeout(timeoutId);
        worker.removeEventListener('statechange', handleStateChange);
        resolve();
      };
      const handleStateChange = () => {
        if (['installed', 'activated', 'redundant'].includes(worker.state)) finish();
      };
      timeoutId = window.setTimeout(finish, 6000);
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
            <h3>What&apos;s New in v{appVersion}</h3>
            <p>Changes in this version of DN</p>
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
          <span className="settings-accordion-icon"><Info size={18} /></span>
          <div>
            <h3>Your Data</h3>
            <p>Storage, backups and app updates</p>
          </div>
        </div>
        <ul className="about-list compact-list">
          {dataInfo.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <footer className="about-version-footer">DN · v{appVersion} · {deployEnvironment}</footer>
    </div>
  );
}
