import { useState } from 'react';
import { CalendarDays, Check, Circle, SlidersHorizontal } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import RichText from '../common/RichText';
import { getEventStatus } from '../../utils/eventStatus';
import MomentSummaryExtras, { MomentSummaryPhotos, sortedSummaryActivities } from './MomentSummaryExtras';
import GreetingCard from '../common/GreetingCard';
import { activityDateLabel as formatDate, activityStatus } from '../../utils/activityDetail';
import MomentPdfStudio from './MomentPdfStudio';

export default function EventSummaryDialog({ event, onClose }) {
  const [studioOpen, setStudioOpen] = useState(false);
  if (!event) return null;
  const activities = sortedSummaryActivities(event.activities);
  const status = getEventStatus(event);
  const statusLabel = { 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled', archived: 'Archived' }[status];

  return (
    <>
    <ModalDialog title="Moment summary" onClose={onClose} className="event-summary-dialog">
      <div className="event-summary-content">
        <div className="dn-summary-export-top">
          <button type="button" className="secondaryButton dn-summary-export-button" onClick={() => setStudioOpen(true)}
            aria-label="Open PDF Studio">
            <SlidersHorizontal size={16} aria-hidden="true" /> Customize PDF
          </button>
          <span>Preview and arrange your pages before downloading.</span>
        </div>
        <section className="moment-summary-story moment-summary-moment" aria-label="Moment story">
          <header className="event-summary-header">
            <span><CalendarDays size={15} /> {event.type || 'Life moment'}</span>
            <h3>{event.name || 'Untitled moment'}</h3>
            <p>{formatDate(event.date)} · {statusLabel}</p>
          </header>
          {event.notes ? <RichText className="event-summary-notes" value={event.notes} /> : null}
          {event.greetingCard ? <GreetingCard {...event.greetingCard} momentName={event.name} momentType={event.type} dateLabel={formatDate(event.date)} /> : null}
          <MomentSummaryPhotos event={event} />
        </section>
        <section className="event-summary-activities" aria-label="Activity summary">
          <h4>Activities <span>{activities.length}</span></h4>
          {activities.length ? <ul>
            {activities.map((activity, index) => {
              const description = String(activity.description || '');
              const hasDescription = Boolean(description.trim());
              const key = activity.id ?? `activity-${index}`;
              const completed = activityStatus(activity) === 'completed';
              return (
                <li key={key} className="moment-summary-story moment-summary-activity">
                  <span className={completed ? 'is-complete' : 'is-pending'} aria-hidden="true">{completed ? <Check size={14} /> : <Circle size={13} />}</span>
                  <div className="event-summary-activity-copy">
                    <strong>{activity.title || activity.name || 'Untitled activity'}</strong>
                    <small>{formatDate(activity.date)}{activityStatus(activity) === 'cancelled' ? ' · Cancelled' : completed ? ' · Completed' : ''}</small>
                    {hasDescription ? <RichText value={description} /> : null}
                    {activity.id !== undefined && activity.id !== null && String(activity.id).trim() ? <MomentSummaryPhotos event={event} activityId={activity.id} /> : null}
                  </div>
                </li>
              );
            })}
          </ul> : <p className="event-summary-empty">No activities have been added yet.</p>}
        </section>
        <MomentSummaryExtras event={event} />

      </div>
    </ModalDialog>
    {studioOpen ? <MomentPdfStudio event={event} onClose={() => setStudioOpen(false)} /> : null}
    </>
  );
}
