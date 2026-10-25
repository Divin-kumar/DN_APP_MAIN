import { CalendarDays, Check, Circle } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import RichText from '../common/RichText';
import { getEventStatus } from '../../utils/eventStatus';
import MomentSummaryExtras from './MomentSummaryExtras';
import GreetingCard from '../common/GreetingCard';
import { activityStatus } from '../../utils/activityDetail';

const formatDate = (value) => {
  if (!value) return 'Date to be decided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date to be decided' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function EventSummaryDialog({ event, onClose }) {
  if (!event) return null;
  const activities = event.activities || [];
  const status = getEventStatus(event);
  const statusLabel = { 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled', archived: 'Archived' }[status];

  return (
    <ModalDialog title="Moment summary" onClose={onClose} className="event-summary-dialog">
      <div className="event-summary-content">
        <header className="event-summary-header">
          <span><CalendarDays size={15} /> {event.type || 'Life moment'}</span>
          <h3>{event.name || 'Untitled moment'}</h3>
          <p>{formatDate(event.date)} · {statusLabel}</p>
        </header>
        {event.notes ? <RichText className="event-summary-notes" value={event.notes} /> : null}
        {event.greetingCard ? <GreetingCard {...event.greetingCard} momentName={event.name} momentType={event.type} dateLabel={formatDate(event.date)} /> : null}
        <section className="event-summary-activities" aria-label="Activity summary">
          <h4>Activities <span>{activities.length}</span></h4>
          {activities.length ? <ul>
            {activities.map((activity, index) => {
              const description = String(activity.description || '');
              const hasDescription = Boolean(description.trim());
              const key = activity.id || `activity-${index}`;
              const completed = activityStatus(activity) === 'completed';
              return (
                <li key={key}>
                  <span className={completed ? 'is-complete' : 'is-pending'} aria-hidden="true">{completed ? <Check size={14} /> : <Circle size={13} />}</span>
                  <div className="event-summary-activity-copy">
                    <strong>{activity.title || activity.name || 'Untitled activity'}</strong>
                    <small>{formatDate(activity.date)}{activityStatus(activity) === 'cancelled' ? ' · Cancelled' : completed ? ' · Completed' : ''}</small>
                    {hasDescription ? <RichText value={description} /> : null}
                  </div>
                </li>
              );
            })}
          </ul> : <p className="event-summary-empty">No activities have been added yet.</p>}
        </section>
        <MomentSummaryExtras event={event} />
      </div>
    </ModalDialog>
  );
}
