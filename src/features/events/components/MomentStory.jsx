import { Link } from 'react-router-dom';
import { ArrowUpRight, BookHeart, BookOpenText, CalendarDays, CheckCircle2, ChevronDown, Clock3, FileText, NotebookPen, Pencil, Rows3 } from 'lucide-react';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import RichText from '../../../components/common/RichText';
import { activityDateLabel, activityDetailPath, isAttachmentImage } from '../../../utils/activityDetail';
import { buildMomentStory, groupMomentStoryTasks, STORY_PRESENTATIONS } from '../../../utils/momentStory';
import './MomentStory.css';

// Existing persisted values stay "journey"/"chronicle". Only the owner-facing
// names and their read-only Story compositions change. No backup migration.
const editions = {
  [STORY_PRESENTATIONS.JOURNEY]: {
    label: 'Journal', icon: BookHeart, heading: 'A book of beautiful memories',
    description: 'Photographs, places and the little details worth keeping.',
    intro: 'The opening page', recorded: 'Pages from our story',
    upcoming: 'Memories in the making',
    empty: 'The first page is waiting for a memory',
  },
  [STORY_PRESENTATIONS.DIARY]: {
    label: 'Diary', icon: NotebookPen, heading: 'My monthly diary',
    description: 'A quiet place for the words behind each day.',
    intro: 'A note to begin', recorded: 'This month, day by day',
    upcoming: 'Notes for later',
    empty: 'The first diary entry is waiting',
  },
  [STORY_PRESENTATIONS.CHRONICLE]: {
    label: 'Tasks', icon: Rows3, heading: 'Tasks & progress',
    description: 'Open work first. Completed and cancelled tasks follow.',
    intro: 'About these tasks', recorded: 'Task overview',
    upcoming: '', empty: 'Create an Activity to begin this task list',
  },
};
const taskLabels = {
  'in-progress': { label: 'In progress', subtitle: 'What needs attention', icon: Clock3 },
  completed: { label: 'Completed', subtitle: 'Finished work', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', subtitle: 'No longer planned', icon: FileText },
};
const monthLabel = (key) => new Date(key + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const fullDate = (date) => new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const activityLink = (momentId, entry) => (entry.activityId || entry.id) ? activityDetailPath(momentId, entry.activityId || entry.id) : null;

function Media({ items, uid, isGuest, label, album = false }) {
  if (!items?.length) return null;
  const photos = items.filter((item) => isAttachmentImage(item.type));
  const other = items.filter((item) => !isAttachmentImage(item.type));
  const spread = photos.length === 1 ? 'solo' : photos.length === 2 ? 'pair' : 'series';
  return <div className={'dn-v2-story-media' + (album ? ' dn-journal-gallery' : '')}
    data-album-layout={album ? spread : undefined} aria-label={label}>
    {photos.length ? <AttachmentGallery attachments={photos} uid={uid} isGuest={isGuest}
      showImageNames={false} showMetadata={false} retainLoaded /> : null}
    {other.length ? <div className="dn-story-files"><AttachmentGallery attachments={other} uid={uid}
      isGuest={isGuest} compact showImageNames retainLoaded /></div> : null}
  </div>;
}

function ActivityTitle({ entry, momentId }) {
  const url = activityLink(momentId, entry);
  return <h4>{url ? <Link to={url} state={{ activityOrigin: '/events/' + encodeURIComponent(momentId) + '/overview' }}>
    {entry.title || 'Untitled activity'} <ArrowUpRight size={15} aria-hidden="true" />
  </Link> : (entry.title || 'Untitled activity')}</h4>;
}

function Chapter({ entry, momentId, uid, isGuest, presentation }) {
  const isJournal = presentation === STORY_PRESENTATIONS.JOURNEY;
  const files = entry.attachments?.length || 0;
  return <article className={'dn-v2-story-entry ' + (isJournal ? 'dn-journal-chapter' : 'dn-diary-paragraph')}
    data-story-activity={entry.id || undefined} data-story-entry-style={presentation}>
    {isJournal ? <Media items={entry.attachments} uid={uid} isGuest={isGuest}
      label={'Photos for ' + (entry.title || 'Activity')} album /> : null}
    <div className="dn-v2-story-entry-body">
      <ActivityTitle entry={entry} momentId={momentId} />
      {entry.displayTime ? <time className="dn-story-entry-aside">{entry.displayTime}</time> : null}
      {entry.description ? <RichText value={entry.description} className="dn-v2-story-entry-description free-text-content" /> : null}
      {entry.subEntries?.length ? <div className="dn-story-subentries" aria-label="Appended entries">
        {entry.subEntries.map((item) => <section className="dn-story-subentry" key={item.id}>
          <small>{item.date || entry.date}{item.time ? ` · ${item.time}` : ''}</small>
          <strong>{item.title || 'Untitled entry'}</strong>
          {item.description ? <RichText value={item.description} className="free-text-content" /> : null}
        </section>)}
      </div> : null}
      {entry.status === 'cancelled' ? <small className="dn-story-entry-aside">Cancelled activity</small> : null}
      {!isJournal && files ? <Link className="dn-story-entry-files" to={activityLink(momentId, entry)}>
        {files} original {files === 1 ? 'file' : 'files'} saved with this entry <ArrowUpRight size={13} aria-hidden="true" />
      </Link> : null}
    </div>
  </article>;
}

// Journal is not an Activity timeline. One free-flowing image spread per day,
// with each original picture attached to its own entry and an editable source
// Activity behind the title.
function RecordedJournal({ story, entries }) {
  return <div className="dn-journal-book" data-story-layout="journal-book">
    {story.timeline.map((month) => <section key={month.key} className="dn-journal-month" aria-label={'Activities in ' + month.key}>
      <p className="dn-journal-month-caption">{monthLabel(month.key)}</p>
      {month.days.map((day) => <section key={day.date} className="dn-journal-page">
        <header className="dn-journal-page-date"><span>✦</span><time dateTime={day.date}>{fullDate(day.date)}</time><span>✦</span></header>
        <div className="dn-journal-page-entries">{entries(day.entries, day.date)}</div>
      </section>)}
    </section>)}
  </div>;
}

// The Moment is the monthly container. Do not nest further month volumes
// inside it. Multiple dated entries form one calm, continuous reading surface.
function RecordedDiary({ story, entries }) {
  const days = story.timeline.flatMap((month) => month.days);
  const title = story.momentDate ? monthLabel(story.momentDate.slice(0, 7)) : 'Monthly entries';
  return <div className="dn-diary-monthbook" data-story-layout="diary-monthbook">
    <div className="dn-diary-month-heading"><NotebookPen size={18} aria-hidden="true" /><h4>{title}</h4></div>
    <div className="dn-diary-writing">
      {days.map((day) => <section key={day.date} className="dn-diary-entry">
        <div className="dn-diary-entry-date"><time dateTime={day.date}>{fullDate(day.date)}</time></div>
        <div className="dn-diary-entry-prose">{entries(day.entries, day.date)}</div>
      </section>)}
    </div>
  </div>;
}

function TaskRow({ entry, momentId, onStatusChange, statusBusy, completionBlocked }) {
  const url = activityLink(momentId, entry);
  return <article className={'dn-task-row is-' + entry.status} data-story-activity={entry.id || undefined}
    data-story-entry-style="chronicle">
    <span className="dn-task-row-indicator" aria-hidden="true">
      {entry.status === 'completed' ? <CheckCircle2 size={19} /> : entry.status === 'cancelled' ? '×' : '○'}
    </span>
    <div className="dn-task-row-main">
      <div className="dn-task-row-heading">
        {url ? <Link to={url} state={{ activityOrigin: '/events/' + encodeURIComponent(momentId) + '/overview' }}>
          {entry.title || 'Untitled task'} <ArrowUpRight size={13} aria-hidden="true" />
        </Link> : <strong>{entry.title || 'Untitled task'}</strong>}
      </div>
      {entry.description ? <RichText className="dn-task-row-description free-text-content" value={entry.description} /> : null}
      {entry.attachments?.length ? <span className="dn-task-files-note">
        {entry.attachments.length} {entry.attachments.length === 1 ? 'file' : 'files'} available in Activity detail
      </span> : null}
    </div>
    <div className="dn-task-row-end">
      <div className="dn-task-row-when">
        {entry.date ? <time dateTime={entry.date}>{activityDateLabel(entry.date)}</time> : <span>No date</span>}
        {entry.displayTime ? <span>{entry.displayTime}</span> : null}
      </div>
      {entry.id ? <span className="dn-task-status-switcher"><select className="dn-task-status-control" value={entry.status}
        disabled={statusBusy || !onStatusChange} aria-label={'Change status for ' + (entry.title || 'Untitled task')}
        onChange={(changeEvent) => onStatusChange?.(entry.id, changeEvent.target.value)}>
        <option value="in-progress">In progress</option>
        <option value="completed" disabled={completionBlocked && entry.status !== 'completed'}>Completed</option>
        <option value="cancelled">Cancelled</option>
      </select><ChevronDown size={12} aria-hidden="true" /></span> : null}
    </div>
  </article>;
}

// Every Activity appears exactly once: status (open/done/cancelled) is primary,
// then saved Activity date/time is secondary. No picture blocks in the Tasks UI.
function TaskBoard({ story, onStatusChange, statusBusy, completionBlocked }) {
  const groups = groupMomentStoryTasks(story);
  return <div className="dn-task-board" data-story-layout="task-board" aria-label="Task groups by status">
    {groups.map((group) => {
      const config = taskLabels[group.status];
      const Icon = config.icon;
      return <section key={group.status} className={'dn-task-group is-' + group.status} data-task-status={group.status}
        aria-label={'Tasks ' + config.label.toLowerCase()}>
        <header className="dn-task-group-header"><div><Icon size={17} aria-hidden="true" />
          <h4>{config.label}</h4><span className="dn-task-group-count">{group.entries.length}</span></div>
          <small>{config.subtitle}</small>
        </header>
        {group.entries.length ? <div className="dn-task-group-rows">{group.entries.map((entry, i) =>
          <TaskRow key={entry.id || group.status + '-' + i} entry={entry} momentId={story.momentId}
            onStatusChange={onStatusChange} statusBusy={statusBusy} completionBlocked={completionBlocked} />)}</div>
          : <p className="dn-task-group-empty">No {config.label.toLowerCase()} tasks</p>}
      </section>;
    })}
  </div>;
}

function EarlierReflections({ reflections }) {
  if (!reflections.length) return null;
  return <section aria-label="Legacy reflections" className="dn-v2-story-aux dn-v2-story-reflection-section">
    <div className="dn-v2-story-section-head"><h3><FileText size={18} /> Earlier reflections</h3>
      <small>Preserved from Memories · read-only</small></div>
    <p className="dn-v2-story-reflections-help">Saved notes remain unchanged. Their creation timestamps are not story dates.</p>
    <div className="dn-v2-story-reflections">{reflections.map((item, i) => <article key={item.id || 'legacy-' + i}>
      <h4>{item.title || 'Untitled reflection'}</h4>
      {item.body ? <RichText value={item.body} className="free-text-content" /> : <p>No written details</p>}
    </article>)}</div>
  </section>;
}

// Story projection remains read-only. Task status controls dispatch through
// scoped Event workspace actions; no secondary Activity store or saved fields.
export default function MomentStory({ moment, momentTypes, uid, isGuest, onEditIntro, onTaskStatusChange, taskStatusBusy = false }) {
  const story = buildMomentStory(moment, { momentTypes });
  const edition = editions[story.presentation] || editions[STORY_PRESENTATIONS.JOURNEY];
  const EditionIcon = edition.icon;
  const isTask = story.presentation === STORY_PRESENTATIONS.CHRONICLE;
  const isJournal = story.presentation === STORY_PRESENTATIONS.JOURNEY;
  const recorded = story.timeline.reduce((sum, month) => sum + month.days.reduce((count, day) => count + day.entries.length, 0), 0);
  const total = recorded + story.upcoming.length + story.undated.length;
  const entries = (items, key) => items.map((entry, i) => <Chapter key={entry.id || key + '-' + i} entry={entry}
    momentId={story.momentId} uid={uid} isGuest={isGuest} presentation={story.presentation} />);
  return <div className="dn-v2-story" data-presentation={story.presentation}>
    <header className="dn-v2-story-header">
      <div><span className="dn-v2-story-kicker"><EditionIcon size={16} /> {edition.label}</span>
        <h3>{edition.heading}</h3><p>{edition.description}</p></div>
      <div className="dn-v2-story-stats">
        <span><strong>{isTask ? total : recorded}</strong> {isTask ? 'tasks' : 'entries'}</span>
        {!isTask && story.upcoming.length ? <span><strong>{story.upcoming.length}</strong> upcoming</span> : null}
      </div>
    </header>
    <section className="dn-v2-story-intro" aria-label="Moment introduction">
      <div className="dn-v2-story-intro-head"><h4><BookOpenText size={17} /> {edition.intro}</h4>
        <button type="button" onClick={onEditIntro}><Pencil size={14} />
          {story.introduction ? 'Edit introduction' : 'Add introduction'}</button></div>
      {story.introduction ? <RichText value={story.introduction} className="free-text-content dn-v2-story-intro-text" />
        : <p>{isJournal ? 'Every keepsake has a story. What made this Moment special?'
          : isTask ? 'What are you working toward?' : 'What is this month about?'}</p>}
      {isJournal ? <Media items={story.keepsakes} uid={uid} isGuest={isGuest}
        label="Moment keepsakes and older unlinked files" album /> : null}
      {!isJournal && story.keepsakes.length ? <Link className="dn-story-entry-files"
        to={'/events/' + encodeURIComponent(story.momentId) + '/gallery'}>
        {story.keepsakes.length} {story.keepsakes.length === 1 ? 'file' : 'files'} saved with this Moment <ArrowUpRight size={13}/>
      </Link> : null}
    </section>
    {isTask ? <section className="dn-v2-story-recorded" aria-label="Task status groups">
      <TaskBoard story={story} onStatusChange={onTaskStatusChange} statusBusy={taskStatusBusy}
        completionBlocked={Boolean(moment?.archived || ['archived', 'cancelled'].includes(moment?.status))} />
    </section> : <>
      {story.timeline.length ? <section className="dn-v2-story-recorded" aria-label="Recorded chapters">
        <div className="dn-v2-story-section-head"><h3>{edition.recorded}</h3>
          <small>{isJournal ? 'A memory book, not a checklist' : 'One Moment for this month'}</small></div>
        {isJournal ? <RecordedJournal story={story} entries={entries} /> : <RecordedDiary story={story} entries={entries} />}
      </section> : !total ? <div className="dn-v2-story-empty"><BookOpenText size={23}/>
        <strong>{edition.empty}</strong><Link to={'/events/' + encodeURIComponent(story.momentId) + '/activities'}>
          View Activities <ArrowUpRight size={15}/></Link></div> : null}
      {story.upcoming.length ? <section aria-label="Upcoming activities" className="dn-v2-story-aux">
        <div className="dn-v2-story-section-head"><h3><Clock3 size={18}/> {edition.upcoming}</h3><small>Future plans</small></div>
        <div className="dn-v2-story-aux-items">{entries(story.upcoming, 'upcoming')}</div>
      </section> : null}
      {story.undated.length ? <section aria-label="Activities without dates" className="dn-v2-story-aux">
        <div className="dn-v2-story-section-head"><h3><CalendarDays size={18}/> Without a recorded date</h3><small>No date assumed</small></div>
        <div className="dn-v2-story-aux-items">{entries(story.undated, 'undated')}</div>
      </section> : null}
    </>}
    <EarlierReflections reflections={story.reflections} />
  </div>;
}
