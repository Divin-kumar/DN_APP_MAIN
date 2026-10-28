import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenText, CalendarDays, CheckCircle2, Clock3, Compass, FileText, NotebookPen, Pencil, Route, Rows3, Sparkles } from 'lucide-react';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import RichText from '../../../components/common/RichText';
import { buildMomentStory, STORY_PRESENTATIONS } from '../../../utils/momentStory';
import { activityDateLabel, activityDetailPath } from '../../../utils/activityDetail';
import './MomentStory.css';

function Media({ items, uid, isGuest, label }) {
  return items?.length ? <div className="dn-v2-story-media" aria-label={label}>
    <AttachmentGallery attachments={items} uid={uid} isGuest={isGuest} showImageNames={false} />
  </div> : null;
}
const statuses = { 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled' };

// Presentation is a view of the same Story records, never a separate record
// model. The configured Moment Type selects one editorial voice for its Story.
const editions = {
  [STORY_PRESENTATIONS.JOURNEY]: {
    label: 'Journey', icon: Route,
    heading: 'The moments along the way',
    description: 'Follow the chapters in the order they happened.',
    introduction: 'How it began',
    recorded: 'The journey so far', upcoming: 'The road ahead',
    empty: 'Your journey begins with an Activity',
  },
  [STORY_PRESENTATIONS.DIARY]: {
    label: 'Diary', icon: NotebookPen,
    heading: 'Pages from this Moment',
    description: 'A personal record, page by page, in the dates you saved.',
    introduction: 'Opening note',
    recorded: 'Dated entries', upcoming: 'Pages still to come',
    empty: 'Your first journal entry is waiting',
  },
  [STORY_PRESENTATIONS.CHRONICLE]: {
    label: 'Chronicle', icon: Rows3,
    heading: 'The record of progress',
    description: 'Milestones and decisions in their recorded order.',
    introduction: 'Context and purpose',
    recorded: 'Milestone log', upcoming: 'Next milestones',
    empty: 'Your first milestone is waiting',
  },
};
function Chapter({ entry, momentId, uid, isGuest, presentation, ordinal = null }) {
  const link = entry.id ? activityDetailPath(momentId, entry.id) : null;
  return <article className="dn-v2-story-entry" data-story-activity={entry.id || undefined} data-story-entry-style={presentation}>
    {presentation === STORY_PRESENTATIONS.CHRONICLE && ordinal !== null
      ? <span className="dn-v2-story-sequence" aria-label={`Milestone ${ordinal}`}>{String(ordinal).padStart(2, '0')}</span> : null}
    <div className="dn-v2-story-entry-symbol" aria-hidden="true">{entry.status === 'completed' ? <CheckCircle2 size={17} /> : <span />}</div>
    <div className="dn-v2-story-entry-body">
      <div className="dn-v2-story-entry-meta">
        <span className={'dn-v2-story-status is-' + entry.status}>{statuses[entry.status] || 'In progress'}</span>
        {entry.date ? <span><CalendarDays size={13} />{activityDateLabel(entry.date)}</span> : null}
      </div>
      <h4>{link ? <Link to={link} state={{ activityOrigin: `/events/${encodeURIComponent(momentId)}/overview` }}>
        {entry.title || 'Untitled activity'} <ArrowUpRight size={15} aria-hidden="true" />
      </Link> : (entry.title || 'Untitled activity')}</h4>
      {entry.description ? <RichText value={entry.description} className="dn-v2-story-entry-description free-text-content" /> : null}
      <Media items={entry.attachments} uid={uid} isGuest={isGuest} label={`Files for ${entry.title || 'Activity'}`} />
    </div>
  </article>;
}

function RecordedJourney({ story, entries }) {
  return <div className="dn-journey-map" data-story-layout="journey-trail">
    {story.timeline.map((month) => <section key={month.key} className="dn-journey-season" aria-label={`Activities in ${month.key}`}>
      <h4 className="dn-journey-season-heading"><span className="dn-journey-season-dot" aria-hidden="true" />{monthName(month.key)}</h4>
      {month.days.map((day, index) => <div className="dn-journey-stop" key={day.date}>
        <div className="dn-journey-stop-date">
          <span className="dn-journey-stop-day">{day.date.slice(-2)}</span>
          <span className="dn-journey-stop-month">{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', month: 'short' })}</span>
          <span className="dn-journey-stop-mark" aria-hidden="true" />
        </div>
        <div className="dn-journey-stop-chapters" data-journey-side={index % 2 ? 'inset' : 'edge'}>
          {entries(day.entries,day.date)}
        </div>
      </div>)}
    </section>)}
  </div>;
}

function RecordedDiary({ story, entries }) {
  return <div className="dn-diary-book" data-story-layout="diary-pages">
    {story.timeline.map((month) => <section className="dn-diary-volume" key={month.key} aria-label={`Activities in ${month.key}`}>
      <div className="dn-diary-volume-title"><NotebookPen size={19} aria-hidden="true"/><h4>{monthName(month.key)}</h4></div>
      {month.days.map((day) => <section key={day.date} className="dn-diary-sheet">
        <header className="dn-diary-sheet-date">
          <span className="dn-diary-sheet-weekday">{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })}</span>
          <span className="dn-diary-sheet-number">{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </header>
        <div className="dn-diary-sheet-entries">{entries(day.entries, day.date)}</div>
        <span className="dn-diary-sheet-foot" aria-hidden="true">✦</span>
      </section>)}
    </section>)}
  </div>;
}

function RecordedChronicle({ story, entries }) {
  return <div className="dn-chronicle-ledger" data-story-layout="chronicle-ledger">
    <div className="dn-chronicle-column-head" aria-hidden="true"><span>Date</span><span>Milestone / record</span></div>
    {story.timeline.map((month) => <section className="dn-chronicle-period" key={month.key} aria-label={`Activities in ${month.key}`}>
      <h4><CalendarDays size={15} aria-hidden="true" />{monthName(month.key)}</h4>
      {month.days.map((day) => <div className="dn-chronicle-record" key={day.date}>
        <div className="dn-chronicle-record-date"><time dateTime={day.date}>{activityDateLabel(day.date)}</time></div>
        <div className="dn-chronicle-record-entries">{entries(day.entries,day.date)}</div>
      </div>)}
    </section>)}
  </div>;
}
const monthName = (key) => new Date(`${key}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

function RecordedStory({ story, entries }) {
  if (story.presentation === STORY_PRESENTATIONS.DIARY) return <RecordedDiary story={story} entries={entries} />;
  if (story.presentation === STORY_PRESENTATIONS.CHRONICLE) return <RecordedChronicle story={story} entries={entries} />;
  return <RecordedJourney story={story} entries={entries} />;
}

// Phase 1 Story projections are immutable views, not copied or rewritten records.
export default function MomentStory({ moment, momentTypes, uid, isGuest, onEditIntro }) {
  const story = buildMomentStory(moment, { momentTypes });
  const recorded = story.timeline.reduce((sum, month) => sum + month.days.reduce((count, day) => count + day.entries.length, 0), 0);
  const hasActivities = recorded || story.upcoming.length || story.undated.length;
  const edition = editions[story.presentation] || editions[STORY_PRESENTATIONS.JOURNEY];
  const EditionIcon = edition.icon;
  const recordedOrder = new Map();
  let sequence = 0;
  for (const month of story.timeline) for (const day of month.days) for (const entry of day.entries) {
    recordedOrder.set(entry, ++sequence);
  }
  const entries = (items, group) => items.map((entry, i) =>
    <Chapter key={entry.id || `${group}-${i}`} entry={entry} momentId={story.momentId} uid={uid} isGuest={isGuest}
      presentation={story.presentation} ordinal={recordedOrder.get(entry) ?? null} />);
  return <div className="dn-v2-story" data-presentation={story.presentation}>
    <header className="dn-v2-story-header">
      <div><span className="dn-v2-story-kicker"><EditionIcon size={15} /> {edition.label} Story</span>
        <h3>{edition.heading}</h3>
        <p>{edition.description}</p>
      </div>
      <div className="dn-v2-story-stats"><span><strong>{recorded}</strong> recorded</span><span><strong>{story.upcoming.length}</strong> upcoming</span></div>
    </header>
    <section className="dn-v2-story-intro" aria-label="Moment introduction">
      <div className="dn-v2-story-intro-head"><h4><BookOpenText size={17} /> {edition.introduction}</h4>
        <button type="button" onClick={onEditIntro}><Pencil size={14} />{story.introduction ? 'Edit introduction' : 'Add introduction'}</button>
      </div>
      {story.introduction ? <RichText value={story.introduction} className="free-text-content dn-v2-story-intro-text" />
        : <p>What made this Moment important? Add a few words to introduce the story.</p>}
      <Media items={story.keepsakes} uid={uid} isGuest={isGuest} label="Moment keepsakes and older unlinked files" />
    </section>
    {story.timeline.length ? <section aria-label="Recorded chapters" className="dn-v2-story-recorded">
      <div className="dn-v2-story-section-head"><h3><Compass size={18} /> {edition.recorded}</h3><small>{edition.label === 'Diary' ? 'In your recorded order' : 'Oldest to newest'}</small></div>
      <RecordedStory story={story} entries={entries} />
    </section> : !hasActivities ? <div className="dn-v2-story-empty"><BookOpenText size={23} /><strong>{edition.empty}</strong>
      <p>Every story starts with an Activity.</p><Link to={`/events/${encodeURIComponent(story.momentId)}/activities`}>View Activities <ArrowUpRight size={15} /></Link></div> : null}
    {story.upcoming.length ? <section aria-label="Upcoming activities" className="dn-v2-story-aux">
      <div className="dn-v2-story-section-head"><h3><Clock3 size={18} /> {edition.upcoming}</h3><small>Future unfinished plans</small></div>
      <div className="dn-v2-story-aux-items">{entries(story.upcoming,'upcoming')}</div>
    </section> : null}
    {story.undated.length ? <section aria-label="Activities without dates" className="dn-v2-story-aux">
      <div className="dn-v2-story-section-head"><h3><CalendarDays size={18} /> Without a recorded date</h3><small>No date is assumed</small></div>
      <div className="dn-v2-story-aux-items">{entries(story.undated,'undated')}</div>
    </section> : null}
    {story.reflections.length ? <section aria-label="Legacy reflections" className="dn-v2-story-aux">
      <div className="dn-v2-story-section-head"><h3><FileText size={18} /> Earlier reflections</h3><small>Preserved from Memories · read-only</small></div>
      <p className="dn-v2-story-reflections-help">These earlier notes are unchanged. Their creation times are not treated as story dates.</p>
      <div className="dn-v2-story-reflections">{story.reflections.map((item,i) => <article key={item.id || `legacy-${i}`}>
        <h4>{item.title || 'Untitled reflection'}</h4>
        {item.body ? <RichText value={item.body} className="free-text-content" /> : <p>No written details</p>}
      </article>)}</div>
    </section> : null}
  </div>;
}
