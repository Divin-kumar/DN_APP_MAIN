import useAppStore from '../../store/useAppStore';
import AttachmentGallery from '../common/AttachmentGallery';
import RichText from '../common/RichText';
import { activityDateLabel } from '../../utils/activityDetail';
import { summaryAttachmentsFor } from '../../utils/summaryAttachments';
import './MomentSummaryExtras.css';

export { sortedSummaryActivities } from '../../utils/summaryAttachments';

// Keep media inside its story card: the main Moment first, then each Activity.
export function MomentSummaryPhotos({ event, activityId = null }) {
  const uid = useAppStore((state) => state.user?.uid);
  const isGuest = useAppStore((state) => state.isGuest);
  const attachments = summaryAttachmentsFor(event, activityId);
  if (!attachments.length) return null;
  const label = activityId === null ? 'Moment photos and files' : 'Activity photos and files';
  return <section className="moment-summary-media" aria-label={label}>
    <AttachmentGallery attachments={attachments} uid={uid} isGuest={isGuest} retainLoaded />
  </section>;
}

// Memories are separate written keepsakes; pictures are owned by the Moment or Activity above.
export default function MomentSummaryExtras({ event }) {
  return event.memories?.length ? <section className="moment-summary-memories" aria-label="Memories">
    <h4>Memories</h4>{event.memories.map((memory, index) => <div key={memory.id || index}>
      <strong>{memory.title}</strong><RichText value={memory.body || ''} />
      <small>{activityDateLabel(memory.createdAt, '')}</small>
    </div>)}
  </section> : null;
}
