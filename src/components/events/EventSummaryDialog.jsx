import { useEffect, useState } from 'react';
import { CalendarDays, Check, Circle, Image as ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import ModalDialog from '../common/ModalDialog';
import { getEventStatus } from '../../utils/eventStatus';
import { getMomentTypeLabel } from '../../utils/codeLists';

const formatDate = (value) => {
  if (!value) return 'Date to be decided';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date to be decided' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isImage = (attachment) => String(attachment.mimeType || attachment.type || '').toLowerCase().startsWith('image/');
const dataUrlFromBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image data.'));
  reader.onerror = () => reject(reader.error || new Error('Could not read image data.'));
  reader.readAsDataURL(blob);
});

export default function EventSummaryDialog({ event, momentTypes, getAttachmentBlob, userId, onClose }) {
  const [expandedActivities, setExpandedActivities] = useState({});
  if (!event) return null;
  const activities = event.activities || [];
  const photos = [...new Map((event.attachments || []).filter(isImage).map((attachment) => [attachment.id || attachment.attachmentId, attachment])).values()];
  const status = getEventStatus(event);
  const statusLabel = status === 'in-progress' ? 'In Progress' : status === 'completed' ? 'Completed' : 'Cancelled';

  return (
    <ModalDialog title="Moment summary" onClose={onClose} className="event-summary-dialog">
      <div className="event-summary-content">
        <header className="event-summary-header">
          <span><CalendarDays size={15} /> {getMomentTypeLabel(event, momentTypes)}</span>
          <h3>{event.name || 'Untitled moment'}</h3>
          <p>{formatDate(event.date)} · {statusLabel}</p>
        </header>
        {event.notes ? <p className="event-summary-notes free-text-content">{event.notes}</p> : null}
        {photos.length ? <section className="event-summary-photos" aria-label="Photo gallery linked to this moment">
          <h4>Photos <span>{photos.length}</span></h4>
          <div className="event-summary-photo-grid">
            {photos.map((photo) => <SummaryPhoto key={photo.id || photo.attachmentId} photo={photo} getAttachmentBlob={getAttachmentBlob} userId={userId} eventId={event.id || event.firestoreId} />)}
          </div>
        </section> : null}
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

function SummaryPhoto({ photo, getAttachmentBlob, userId, eventId }) {
  const [source, setSource] = useState('');
  const [blob, setBlob] = useState(null);
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(photo.hasLocalCopy || photo.availability === 'local-copy'));
  const reference = [photo.previewReference, photo.fileReference, photo.url]
    .find((value) => /^(https?:\/\/|data:image\/)/i.test(String(value || ''))) || '';
  const attachmentId = photo.id || photo.attachmentId;

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSource('');
    setBlob(null);
    setDataUrl('');
    setFailed(false);
    const hasLocal = photo.hasLocalCopy || photo.availability === 'local-copy';
    setLoading(Boolean(hasLocal));
    if (!hasLocal || !getAttachmentBlob) {
      if (active) setSource(reference);
      return () => { active = false; };
    }
    void getAttachmentBlob(userId, attachmentId).then(async (localBlob) => {
      if (!active) return;
      if (!localBlob) {
        setSource(reference);
        setLoading(false);
        return;
      }
      setBlob(localBlob);
      try {
        objectUrl = URL.createObjectURL(localBlob);
        setSource(objectUrl);
      } catch {
        try {
          setDataUrl(await dataUrlFromBlob(localBlob));
        } catch {
          if (active) setFailed(true);
        }
      }
      if (active) setLoading(false);
    }).catch(() => {
      if (active) {
        setSource(reference);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, getAttachmentBlob, photo.availability, photo.hasLocalCopy, reference, userId]);

  const imageSource = dataUrl || source;
  return <Link to={`/attachments/${attachmentId}`} state={{ from: `/events/${eventId}/overview` }} className="event-summary-photo-button" aria-label={`View details and configure ${photo.name || 'photo'}`}>
    {imageSource && !failed ? <img src={imageSource} alt={photo.name || 'Linked photo'} loading="lazy" onLoad={() => setLoading(false)} onError={() => {
      if (blob && !dataUrl) void dataUrlFromBlob(blob).then(setDataUrl).catch(() => setFailed(true));
      else setFailed(true);
    }} /> : <span className="event-summary-photo-fallback"><ImageIcon size={22} aria-hidden="true" /><small>{loading ? 'Loading photo…' : 'Preview unavailable'}</small></span>}
    {photo.name ? <span className="event-summary-photo-name">{photo.name}</span> : null}
    <span className="event-summary-photo-details-link">View photo details</span>
  </Link>;
}
