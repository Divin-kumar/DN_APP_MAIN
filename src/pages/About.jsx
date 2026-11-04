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
import { BookOpen, ChevronDown, Info, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import './AboutPremium.css';

const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
const deployedAt = new Date(import.meta.env.VITE_DEPLOYED_AT);
const buildDate = Number.isNaN(deployedAt.getTime())
  ? 'Not recorded'
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
  { title: 'Tasks', description: 'Use universal + → Task for a standalone or Moment-linked Task. Tap or swipe for actions; Edit opens only when chosen. Counts follow your filters. Sign in for account sync, or keep Guest Tasks on this device. Backups include independent Tasks.' },
  { title: 'Moments', description: 'Create and search your Moments in one list. The compact Filters panel remembers your last choices automatically. Choose a field, a simple comparison and a value; add another filter when needed. The list starts with Event date from oldest to newest; choose Event date, Name or Status and change the direction in the same panel. Reset restores the defaults. Use a Moment’s actions for Edit, PDF Studio, Archive or Delete.' },
  { title: 'Moment workspace', description: 'Move between Story, Activities, Transactions, Gallery and PDF Studio using one compact section row. Story presents your Moment as a Journal, Diary or Tasks view. Moment Activity cards share the same three-dot actions as global Activities; open Detail to edit individual Diary and Journal entries. Moment Transactions shows existing income and expenses with totals for the matching filtered rows. Manage existing records from Transactions under Profile. Use the universal + to add items; Attachment is available there while a Moment is open.' },
  { title: 'Activities', description: 'Open Activities from the main navigation to see tasks across Moments. Open Refine for sorting and filters; phone filter labels wrap onto readable rows. Completed titles stay readable; Reopen is required before editing. Diary days now support the same three-dot actions as other Activities. Open Detail for its linked cover, description, finance and original files. Pinch the cover or open Reposition for zoom buttons, Reset and drag, then Done or Cancel. Swipe left deliberately on a list card to complete or reopen it; Activity options also offers Edit, Cancel/Restore and confirmed Delete.' },
  { title: 'Writing and greetings', description: 'Write with visible formatting on phones and computers. Select text for compact styling tools, or use keyboard shortcuts. Earlier Memories remain safe, read-only reflections in Story; personalized greeting cards have a matching preview and HTML download.' },
  { title: 'Attachments', description: 'Use + inside a Moment to keep an original photo or file up to 10 MB, optionally with an Activity. Photos preview in Story, Activity Detail and Gallery. Identical originals share one stored file. All new originals stay in this browser, separately for each account or Guest. Only filenames and reference details sync to an account. Download a backup to move or recover originals; no paid cloud file storage is used for new saves. Older file details cannot recover an original that was never stored.' },
  { title: 'PDF Studio', description: 'Open PDF Studio from a Moment, its actions or the Dashboard. Choose a Story format, design and Light or Dark page theme, page spacing, activity/day pagination and included sections, then update the actual page preview and download the PDF. Optional Searchable writing adds a text layer; image-based pages remain the visual source. Original photos stay in their current browser scope. Use a recovery backup to preserve editable records and original files.' },
  { title: 'Transactions', description: 'Use universal + to add income or expenses, optionally linked to a Moment or Activity. It presets the current Moment or Activity Detail. Edit or delete existing transactions in Transactions under Profile; Activity and Moment histories are read-only. Search or use friendly filters, then sort by Date, Amount or Title in either direction. Export CSV saves exactly the matching records in their displayed order, including search and Refine conditions. History starts newest first. Income, Expense and Balance follow all filters and search on this page and in Moment Transactions. Add your own payment choices in Settings → Code Lists → Payment Methods.' },
  { title: 'Insights', description: 'Open Insights under Profile to review counts, spending and income patterns. Its JSON report is separate from a recovery backup.' },
  { title: 'Settings and backup', description: 'Open Settings under Profile. Appearance manages theme and Story/PDF designs; List defaults manages saved sorting and filters. Code Lists manages your choices. Export a JSON backup and review the restore summary before importing it. Notifications is Coming Soon; saved preferences and Reminder Presets are retained.' },
];

// Documented product milestones, not an automatic log of GitHub commits.
// v2.0.1 had a public worker version but no independently verified per-patch feature log.
const versionHistory = [
  {
    version: '2.3.0',
    title: 'Clearer everyday use, connected Tasks',
    summary: 'Since 2.2.0: a calmer phone experience, account Tasks and more consistent Story and PDF controls.',
    highlights: [
      'Cleaner Tasks, filters and Settings on small screens.',
      'Independent Tasks with account sync and backup support.',
      'Story dark mode and a separate Light or Dark PDF page theme.',
    ],
    changes: [
      'Tasks — Create standalone Tasks or link them to a Moment or Activity. Compact date/time squares and priority flags keep rows clear; tap or swipe for actions. Counts follow the applied filters and search.',
      'Account sync & recovery — Signed-in Tasks use live account updates. Task backups and Guest transfer preserve existing matching IDs; failed saves keep the draft, and switching accounts clears the previous list.',
      'Filters & sorting — Phone sort choices use two centered columns with visible direction arrows. Filter labels wrap, remove buttons have their own space, and Refine keeps changes pending until applied.',
      'Settings — Dedicated Appearance and grouped List defaults make choices easier to find. Appearance actions share one row; Code Lists has a sticky shortcut bar, softer rows and recoverable Add/Rename drafts.',
      'Story & PDF — Story follows the app theme across designs. PDF Studio adds Light or Dark pages, clearer preview-update feedback and more reachable phone controls; update the preview before downloading.',
      'Phone navigation & forms — Moment titles and workspace tabs fit more reliably. Search, dropdowns, date/time fields and keyboard access receive focused readability and interaction fixes.',
      'Data continuity — Existing Moments, Activities, writing and original files keep their roles. Independent Tasks remain separate from Story/PDF chapters; removing a linked parent retains the Task.',
    ],
  },
  {
    version: '2.2.0',
    title: 'A more beautiful home for your memories',
    summary: 'Refined Story reading and PDF Studio designs, pagination and export quality.',
    changes: [
      'Story pages have Heritage, Editorial and Minimal designs, with clearer writing in both light and dark mode.',
      'PDF Studio has premium visual choices, searchable writing (optional), and Standard, Enhanced and experimental Print draft page quality.',
      'Natural flow, New day, new page, and New activity, new page keep same-day writing together when selected; a continuation is never treated as a separate Activity.',
      'Included content stays collapsed until opened, and PDF page numbers, cover numbering and long-book navigation are adjustable.',
      'A lone original photo fits on the current PDF page when enough writable space remains; the original file is never altered.',
      'Activity Detail presents cleaner attachments, readable writing and Date/Time aligned in a single mobile row.',
    ],
  },
  {
    version: '2.1.4',
    title: 'Independent Activities and a cleaner writing flow',
    summary: 'One clear place to add each Activity, with a lighter mobile date and time row.',
    changes: [
      'Journal, Diary and Tasks create independent Activities, even on the same date; older records and their links remain accessible.',
      'Use the Activity Detail + menu to add dated writing to the same Activity, without another nested Activity.',
      'Story and PDF Studio show continued writing as flowing paragraphs with appropriate date and time headings.',
      'New and Edit Moment forms always show Moment Name and Type immediately; Date and optional Time stay under More options.',
      'Date and Time controls stay side by side with a compact Clear time action, including on narrow mobile screens.',
      'Compact iPhone layouts refine Activity metadata and Transactions scrolling above the bottom navigation dock.',
    ],
  },
  {
    version: '2.1.3',
    title: 'Filtered transaction export and quieter editing',
    summary: 'Export the exact transaction view and see defaults before opening More options.',
    changes: [
      'Export CSV downloads only the transactions matching current search, Refine conditions and sort order.',
      'CSV includes details and linked Moment/Activity names with spreadsheet-safe text.',
      'Activity and Transaction forms preview date, time and selected links under More options.',
      'Activities show Diary and Journal dates as writing dates instead of task deadlines.',
    ],
  },
  {
    version: '2.1.2',
    title: 'Journal editing that matches creation',
    summary: 'New and Append are now available when editing Journal memories and continuations.',
    changes: [
      'Journal editors now show the same New entry or Append to existing entry selector used when creating a memory.',
      'Existing memories can be continued in another Journal entry while preserving original photo and transaction references.',
      'Appended Journal entries can remain attached, move to another entry or become separate memories without changing parent transaction ownership.',
      'The same editing controls appear across Activities, Dashboard and Activity Detail; the Guest tour explains the new choices.',
    ],
  },
  {
    version: '2.1.1',
    title: 'Thoughtful writing, consistent actions',
    summary: 'The same clear controls for Diary and Journal entries, with more readable Journal pages.',
    changes: [
      'Diary day Activities and individual Diary entries offer Complete, Reopen, Cancel, Restore and Edit through the familiar three-dot menu.',
      'Appended Journal entries also have their own three-dot actions and completion state, without becoming duplicate Activities.',
      'Standalone and appended writing use the same Activity fields; prefilled date, time and priority stay under More options.',
      'Diary entries retain their parent day date while allowing edits to their writing, time and priority.',
      'Journal chapter and continuation headings now stand out clearly above their prose.',
    ],
  },
  {
    version: '2.1.0',
    title: 'An iPhone-first DN',
    summary: 'Cleaner navigation, contextual creation and a quieter writing experience.',
    changes: [
      'The five-position bottom dock centers universal + beside Dashboard, Activities, Moments and Transactions.',
      'One contextual form each for Moments, Activities and Transactions hides prefilled details in More options, while keeping them editable.',
      'Journal continuations flow into the original memory instead of appearing in a separate box. New and Append remain explicit choices.',
      'Refine controls, saved list defaults, compact financial totals and photo-led Activity cards share a consistent mobile design.',
      'Data & Backup has a dedicated page for local backups, recovery and carefully confirmed data-management actions.',
    ],
  },
  {
    version: '2.0.3',
    title: 'Connected planning and finances',
    summary: 'More control over dates, payment choices and the numbers in your lists.',
    changes: [
      'New Moment, Activity and Transaction dates can include the current local time; clear or adjust it as needed.',
      'Date filtering includes the whole selected day, while saved times determine the order of entries on that day.',
      'Payment methods can be customized in Code Lists; Income, Expense and Balance reflect active search and filters.',
    ],
  },
  {
    version: '2.0.2',
    title: 'Time-aware activities',
    summary: 'Plan multiple Activities on the same day without losing their order.',
    changes: [
      'Activities support an optional time alongside their date, including a Clear time choice.',
      'Same-day chronology remains consistent in Story, filtered lists and exported PDF pages.',
      'Filter controls and the mobile date/time row were refined for easier scanning.',
    ],
  },
  {
    version: '2.0.1',
    title: 'Early 2.0 maintenance',
    summary: 'This version was observed in the live app, but a verified per-patch feature list was not preserved.',
    changes: [
      'The individual changes for v2.0.1 are not documented precisely enough to list as confirmed release notes.',
      'See v2.0.0 for the documented foundation of the DN 2.0 experience.',
    ],
  },
  {
    version: '2.0.0',
    title: 'The DN 2.0 foundation',
    summary: 'A connected home for life Moments, writing, Activities and finances.',
    changes: [
      'Moment Story offers Journal, Diary and Tasks presentations, with Gallery and PDF Studio alongside them.',
      'Activities, earlier Memories, linked original photos and documents stay connected to their Moment.',
      'One Transactions experience records income and expenses with Cash and Online payment choices.',
      'Recovery backups carry supported records, settings and local original-file bytes; Guest examples let you explore safely.',
      'Notifications remain Coming Soon. Existing reminders and preferences are preserved.',
    ],
  },
];

const versionNumbers = (value) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value || ''));
  return match ? match.slice(1).map(Number) : null;
};
const isAtLeastVersion = (current, baseline) => {
  const a = versionNumbers(current), b = versionNumbers(baseline);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
};
const documentedRelease = versionHistory.find((release) => isAtLeastVersion(appVersion, release.version))
  || versionHistory.at(-1);

const dataInfo = [
  'Signed-in records are stored in your account. Guest records stay in this browser; export a backup before changing browsers or devices.',
  'Original attachment files stay on this device even when signed in. Clearing browser site data or losing the device can remove originals; cloud filenames cannot recover them. Keep a backup.',
  'Recovery backups include supported records, settings and stored original attachments, with no fixed DN backup size cap. Available browser memory and storage still apply. Missing or corrupted originals stop export. Older metadata-only entries have no file bytes to recover.',
  'Downloaded JSON backups are not encrypted. Store them privately because they can contain personal and financial information.',
  'Refresh app checks for an available app-shell update and reloads the page. It does not clear your saved records or replace a data backup.',
];

export default function About() {
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
    <div className="feature-page settings-page about-page dn-premium-about">
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
            <span className="about-summary-label">Build date</span>
            <strong>{buildDate}</strong>
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
            <h3>What&apos;s New in v{documentedRelease.version}</h3>
            <p>{documentedRelease.version === appVersion ? 'Changes in your installed version' : 'Latest documented highlights for this version range'}</p>
          </div>
        </div>
        <ul className="about-list compact-list">
          {(documentedRelease.highlights || documentedRelease.changes.slice(0, 3)).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="settings-helper">Open a version below for the full changes.</p>
      </section>

      <section className="settings-section dn-about-history" aria-labelledby="dn-about-history-title">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><BookOpen size={18} /></span>
          <div>
            <h3 id="dn-about-history-title">Version History</h3>
            <p>What changed in DN, starting with 2.0</p>
          </div>
        </div>
        <div className="dn-about-release-list">
          {versionHistory.map((release) => {
            const current = appVersion === release.version;
            const future = !isAtLeastVersion(appVersion, release.version);
            return <details key={release.version} className="dn-about-release-entry"
              data-version={release.version}>
              <summary>
                <span className="dn-about-release-meta">
                  <span className="dn-about-release-version">
                    <strong>v{release.version}</strong>
                    {current ? <span className="dn-about-release-status">Installed</span> : null}
                    {future ? <span className="dn-about-release-status">In development</span> : null}
                  </span>
                  <span className="dn-about-release-title">{release.title}</span>
                </span>
                <ChevronDown size={17} strokeWidth={1.9} aria-hidden="true" />
              </summary>
              <div className="dn-about-release-body">
                <p>{release.summary}</p>
                <ul className="about-list compact-list">
                  {release.changes.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </details>;
          })}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading">
          <span className="settings-accordion-icon"><BookOpen size={18} /></span>
          <div>
            <h3>Application Guide</h3>
            <p>How to use DN across key flows</p>
          </div>
        </div>

        <div className="about-guide-grid compact-grid dn-about-guide-accordion">
          {guideItems.map(({ title, description }) => (
            <details key={title} className="about-guide-item compact-item dn-about-guide-entry">
              <summary>
                <h4>{title}</h4>
                <ChevronDown size={17} strokeWidth={1.9} aria-hidden="true" />
              </summary>
              <p>{description}</p>
            </details>
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
