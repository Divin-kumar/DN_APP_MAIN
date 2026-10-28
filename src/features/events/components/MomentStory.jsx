import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenText, CalendarDays, CheckCircle2, Clock3, Compass, FileText, Pencil, Sparkles } from 'lucide-react';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import RichText from '../../../components/common/RichText';
import { buildMomentStory } from '../../../utils/momentStory';
import { activityDateLabel, activityDetailPath } from '../../../utils/activityDetail';
import './MomentStory.css';

function Media({ items, uid, isGuest, label }) {
  return items?.length ? <div className="dn-v2-story-media" aria-label={label}>
    <AttachmentGallery attachments={items} uid={uid} isGuest={isGuest} showImageNames={false} />
  </div> : null;
}
const statuses = { 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled' };
function Chapter({ entry, momentId, uid, isGuest }) {
  const link = entry.id ? activityDetailPath(momentId, entry.id) : null;
  return <article className="dn-v2-story-entry" data-story-activity={entry.id || undefined}>
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
// Phase 1 Story projections are immutable views, not copied or rewritten records.
export default function MomentStory({ moment, momentTypes, uid, isGuest, onEditIntro }) {
  const story = buildMomentStory(moment, { momentTypes });
  const recorded = story.timeline.reduce((sum, month) => sum + month.days.reduce((count, day) => count + day.entries.length, 0), 0);
  const hasActivities = recorded || story.upcoming.length || story.undated.length;
  const entries = (items, group) => items.map((entry, i) =>
    <Chapter key={entry.id || `${group}-${i}`} entry={entry} momentId={story.momentId} uid={uid} isGuest={isGuest} />);
  return <div className="dn-v2-story" data-presentation={story.presentation}>
    <header className="dn-v2-story-header">
      <div><span className="dn-v2-story-kicker"><Sparkles size={14} /> The Moment Story</span>
        <h3>The days that made this Moment</h3>
        <p>Each chapter follows its recorded Activity date.</p>
      </div>
      <div className="dn-v2-story-stats"><span><strong>{recorded}</strong> recorded</span><span><strong>{story.upcoming.length}</strong> upcoming</span></div>
    </header>
    <section className="dn-v2-story-intro" aria-label="Moment introduction">
      <div className="dn-v2-story-intro-head"><h4><BookOpenText size={17} /> The beginning</h4>
        <button type="button" onClick={onEditIntro}><Pencil size={14} />{story.introduction ? 'Edit introduction' : 'Add introduction'}</button>
      </div>
      {story.introduction ? <RichText value={story.introduction} className="free-text-content dn-v2-story-intro-text" />
        : <p>What made this Moment important? Add a few words to introduce the story.</p>}
      <Media items={story.keepsakes} uid={uid} isGuest={isGuest} label="Moment keepsakes and older unlinked files" />
    </section>
    {story.timeline.length ? <section aria-label="Recorded chapters" className="dn-v2-story-recorded">
      <div className="dn-v2-story-section-head"><h3><Compass size={18} /> The journey so far</h3><small>Oldest to newest</small></div>
      {story.timeline.map((month) => <section key={month.key} className="dn-v2-story-month" aria-label={`Activities in ${month.key}`}>
        <h4>{new Date(`${month.key}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h4>
        {month.days.map((day) => <div key={day.date} className="dn-v2-story-day">
          <div className="dn-v2-story-day-date"><CalendarDays size={14} />{activityDateLabel(day.date)}</div>
          <div className="dn-v2-story-day-items">{entries(day.entries,day.date)}</div>
        </div>)}
      </section>)}
    </section> : !hasActivities ? <div className="dn-v2-story-empty"><BookOpenText size={23} /><strong>The first chapter is still ahead</strong>
      <p>Every story starts with an Activity.</p><Link to={`/events/${encodeURIComponent(story.momentId)}/activities`}>View Activities <ArrowUpRight size={15} /></Link></div> : null}
    {story.upcoming.length ? <section aria-label="Upcoming activities" className="dn-v2-story-aux">
      <div className="dn-v2-story-section-head"><h3><Clock3 size={18} /> Coming up</h3><small>Future unfinished plans</small></div>
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
