import useAppStore from '../../store/useAppStore';
import AttachmentGallery from '../common/AttachmentGallery';
import RichText from '../common/RichText';
import { activityDateLabel } from '../../utils/activityDetail';

// Both Moment summaries share full memories and original-backed photos/files.
export default function MomentSummaryExtras({ event }) {
  const uid = useAppStore((state) => state.user?.uid);
  const isGuest = useAppStore((state) => state.isGuest);
  return <>
    {event.memories?.length ? <section className="moment-summary-memories" aria-label="Memories">
      <h4>Memories</h4>{event.memories.map((memory) => <div key={memory.id}>
        <strong>{memory.title}</strong><RichText value={memory.body || ''} />
        <small>{activityDateLabel(memory.createdAt, '')}</small>
      </div>)}
    </section> : null}
    {event.attachments?.length ? <section className="moment-summary-attachments" aria-label="Photos and files">
      <h4>Photos and files</h4><AttachmentGallery attachments={event.attachments} uid={uid} isGuest={isGuest} retainLoaded />
    </section> : null}
  </>;
}
