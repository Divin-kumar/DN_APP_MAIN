import { useEffect, useRef, useState } from 'react';
import { Images } from 'lucide-react';
import AttachmentGallery from '../common/AttachmentGallery';
import ModalDialog from '../common/ModalDialog';
import usePersistentListState from '../../hooks/usePersistentListState';
import useAttachmentOriginal from '../../hooks/useAttachmentOriginal';
import { activityCoverImages, coverImageKey } from '../../utils/activityDetail';

// Uses the same scoped display preference as Activity Detail without mutating any record.
export default function ActivityCardCover({ moment, activity, uid, isGuest, sample, date, onOpen, disabled = false }) {
  const preferenceKey = 'activity-cover:' + JSON.stringify([sample, moment.id || moment.firestoreId, activity.id]);
  const [selection, select] = usePersistentListState(preferenceKey, { imageKey: '' });
  const [choosing, setChoosing] = useState(false);
  const options = activityCoverImages(moment, activity.id);
  const image = options.find((item) => coverImageKey(item) === selection.imageKey) || options[0] || null;
  const tile = useRef(null);
  const [nearby, setNearby] = useState(typeof IntersectionObserver !== 'function');
  const [broken, setBroken] = useState('');
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') { setNearby(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNearby(true);
    }, { rootMargin: '180px' });
    if (tile.current) observer.observe(tile.current);
    return () => observer.disconnect();
  }, []);
  const original = useAttachmentOriginal(image, { uid, isGuest, enabled: nearby && Boolean(image) });
  const source = original.source && !original.error && original.source !== broken ? original.source : '';
  return <><span ref={tile} className={'dn-v2-activity-cover' + (source ? ' has-photo' : '')} >
    {source ? <img src={source} alt="" loading="lazy" onError={() => setBroken(source)} />
      : <Images size={24} strokeWidth={1.5} className="dn-v2-activity-cover-symbol" aria-hidden="true" />}
    <span className="dn-v2-activity-cover-glow" />
    <span className="dn-v2-activity-cover-date" aria-hidden="true">
      <strong>{date ? date.toLocaleDateString('en-GB', { day: '2-digit' }) : '—'}</strong>
      <small>{date ? date.toLocaleDateString('en-GB', { month: 'short' }) : 'Date'}</small>
    </span>
    {onOpen ? <button type="button" data-swipe-ignore disabled={disabled}
      className="dn-v2-activity-cover-action"
      aria-label={options.length > 1 ? 'Choose cover photo for ' + (activity.title || 'activity') : 'Manage photos for ' + (activity.title || 'activity')}
      title={options.length > 1 ? 'Choose cover photo' : 'Open activity to add photos'}
      onClick={(event) => { event.stopPropagation(); if (options.length > 1) setChoosing(true); else onOpen(); }}>
      <Images size={17} strokeWidth={1.8} aria-hidden="true" />
    </button> : null}
  </span>
  {choosing ? <ModalDialog title="Choose activity cover photo" className="activity-cover-picker" onClose={() => setChoosing(false)}>
    <AttachmentGallery attachments={options} uid={uid} isGuest={isGuest} selectedKey={coverImageKey(image)}
      onSelect={(photo) => { select({ imageKey: coverImageKey(photo) }); setChoosing(false); }} />
  </ModalDialog> : null}</>;
}
