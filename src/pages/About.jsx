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
  { title: 'Home', description: 'A short personal greeting welcomes you. Moments and Activities each have small Upcoming and On This Day controls beside their heading and Hide button. Tap an Activity for Detail; deliberately swipe left to complete or reopen it, or use Activity options. In Code Lists, each Moment type has separate Show Moments on Dashboard and Show Activities on Dashboard switches. You can also hide either entire Dashboard section.' },
  { title: 'Moments', description: 'Create and search your Moments in one list. The compact Filters panel remembers your last choices automatically. Choose a field, a simple comparison and a value; add another filter when needed. The list starts with Event date from oldest to newest; choose Event date, Name or Status and change the direction in the same panel. Reset restores the defaults. Swipe a Moment for Edit, Summary, Archive or Delete.' },
  { title: 'Moment workspace', description: 'Move between Overview, Activities, Transactions, Memories and Attachments using one horizontally scrolling section row. Overview is a compact contents list. Moment Activity cards are read-only; open Activity Detail for actions. Timeline is removed. Moment Transactions shows existing income and expenses with full-Moment totals and no transaction editing. Use the universal + to add items; Memory and Attachment are available there while a Moment is open.' },
  { title: 'Activities', description: 'Open Activities from the main navigation to see tasks across Moments. Filters and sorting expand within the page, and each phone filter stays on one row. Completed titles stay readable; Reopen is required before editing. Open Detail for its linked cover, description, finance and original files. Pinch the cover or open Reposition for zoom buttons, Reset and drag, then Done or Cancel. Swipe left deliberately on a list card to complete or reopen it; Activity options also offers Edit, Cancel/Restore and confirmed Delete.' },
  { title: 'Memories and greetings', description: 'Write with visible formatting on phones and computers. Select text for compact styling tools, or use keyboard shortcuts. Memories stay within their Moment; personalized greeting cards have a matching preview and HTML download.' },
  { title: 'Attachments', description: 'Use + inside a Moment to keep an original photo or file up to 10 MB, optionally with an Activity. Photos preview in Activities and Attachments. Identical originals share one stored file. All new originals stay in this browser, separately for each account or Guest. Only filenames and reference details sync to an account. Download a backup to move or recover originals; no paid cloud file storage is used for new saves. Older file details cannot recover an original that was never stored.' },
  { title: 'Transactions', description: 'Use universal + to add income or expenses, optionally linked to a Moment or Activity. It presets the current Moment or Activity Detail. Edit or delete existing transactions in Transactions under Profile; Activity and Moment histories are read-only. Search or use friendly filters, then sort by Date, Amount or Title in either direction. History starts newest first. Income, Expense and Balance follow date filters; other filters narrow history only. Moment totals always cover the complete Moment.' },
  { title: 'Insights', description: 'Open Insights under Profile to review counts, spending and income patterns. Its JSON report is separate from a recovery backup.' },
  { title: 'Settings and backup', description: 'Open Settings under Profile to manage theme, preferences, greeting options and Code Lists. Export a JSON backup and review the restore summary before importing it. Reminder preferences do not schedule background notifications.' },
];

const whatsNew = [
  'Phone filters use a small inline panel with simple comparisons. Your last choices are remembered automatically, with no saved-filter tabs or group-creation controls.',
  'Opening choices keeps the keyboard closed. Tap a search or text field when you want to type; long choice lists still support searching.',
  'The Dashboard welcome card is a short personal greeting without activity or finance statistics.',
  'Small Upcoming and On This Day controls sit beside each Moments or Activities heading and its Hide button.',
];

const dataInfo = [
  'Signed-in records are stored in your account. Guest records stay in this browser; export a backup before changing browsers or devices.',
  'Original attachment files stay on this device even when signed in. Clearing browser site data or losing the device can remove originals; cloud filenames cannot recover them. Keep a backup.',
  'Recovery backups include supported records, settings and stored original attachments, with no fixed DN backup size cap. Available browser memory and storage still apply. Missing or corrupted originals stop export. Older metadata-only entries have no file bytes to recover.',
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
