import { useState } from 'react';
import { CalendarDays, Check, Circle } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import { getEventStatus } from '../../utils/eventStatus';
import { getMomentTypeLabel } from '../../utils/codeLists';

const formatDate = (value) => {
  if (!value) return 'Date to be decided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date to be decided' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function EventSummaryDialog({ event, momentTypes, onClose }) {
  const [expandedActivities, setExpandedActivities] = useState({});
  if (!event) return null;
  const activities = event.activities || [];
  const status = getEventStatus(event);
  const statusLabel = status === 'in-progress' ? 'In Progress' : status === 'completed' ? 'Completed' : 'Cancelled';

  return (
    <ModalDialog title="Event summary" onClose={onClose} className="event-summary-dialog">
      <div className="event-summary-content">
        <header className="event-summary-header">
          <span><CalendarDays size={15} /> {getMomentTypeLabel(event, momentTypes)}</span>
          <h3>{event.name || 'Untitled moment'}</h3>
          <p>{formatDate(event.date)} · {statusLabel}</p>
        </header>
        {event.notes ? <p className="event-summary-notes free-text-content">{event.notes}</p> : null}
        <section className="event-summary-activities" aria-label="Activity summary">
          <h4>Activities <span>{activities.length}</span></h4>
          {activities.length ? <ul>
            {activities.map((activity, index) => {
              const description = String(activity.description || '');
              const hasDescription = Boolean(description.trim());
              const expanded = Boolean(expandedActivities[activity.id || index]);
              const canExpand = description.length > 150 || description.split(/\r\n|\r|\n/).length > 2;
              const key = activity.id || `activity-${index}`;
              return (
                <li key={key}>
                  <span className={activity.completed ? 'is-complete' : 'is-pending'} aria-hidden="true">{activity.completed ? <Check size={14} /> : <Circle size={13} />}</span>
                  <div className="event-summary-activity-copy">
                    <strong>{activity.title || activity.name || 'Untitled activity'}</strong>
                    <small>{formatDate(activity.date)}{activity.cancelled || activity.status === 'cancelled' ? ' · Cancelled' : activity.completed ? ' · Completed' : ''}</small>
                    {hasDescription ? <>
                      <p className={`free-text-content${canExpand && !expanded ? ' free-text-preview is-truncated' : ''}`}>{description}</p>
                      {canExpand ? <button type="button" onClick={() => setExpandedActivities((current) => ({ ...current, [key]: !current[key] }))} aria-expanded={expanded}>{expanded ? 'Show less' : 'Show more'}</button> : null}
                    </> : null}
                  </div>
                </li>
              );
            })}
          </ul> : <p className="event-summary-empty">No activities have been added yet.</p>}
        </section>
      </div>
    </ModalDialog>
  );
}
