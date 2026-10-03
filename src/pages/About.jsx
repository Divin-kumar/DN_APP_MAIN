import { ArrowLeft, BookOpen, CircleDashed, Info, Sparkles, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  return (
    <div className="feature-page settings-page about-page">
      <header className="settings-subpage-header">
        <button type="button" className="settings-back-button" onClick={() => navigate('/settings')} aria-label="Back to Settings">
          <ArrowLeft size={16} />
        </button>
        <div className="settings-subpage-title-wrap">
          <span className="settings-subpage-eyebrow">Settings</span>
          <h2>About DN</h2>
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
            <strong>1.0.0</strong>
          </div>
          <div className="about-summary-item">
            <span className="about-summary-label">Focus</span>
            <strong>Life + Finance</strong>
          </div>
        </div>

        <div className="about-description">
          DN is a personal life and finance companion built to keep important moments, planning details, memories,
          and financial patterns connected in one place.
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
    </div>
  );
}
