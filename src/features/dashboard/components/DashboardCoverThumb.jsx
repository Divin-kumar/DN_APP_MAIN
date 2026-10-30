import { useEffect, useRef, useState } from 'react';
import useAttachmentOriginal from '../../../hooks/useAttachmentOriginal';
import usePersistentListState from '../../../hooks/usePersistentListState';
import { activityCoverImages, coverImageKey, isAttachmentImage, legacyAttachmentImage } from '../../../utils/activityDetail';

// The home tile reuses an Activity's chosen list cover. Moment-only originals
// take precedence for Moments, and no arbitrary/remote stock image is shown.
// Images load only near the viewport, and the original reader owns URL cleanup.
export default function DashboardCoverThumb({ moment, activity, uid, isGuest, sample }) {
  const activityId = activity?.id || '';
  const preferenceKey = activityId
    ? 'activity-cover:' + JSON.stringify([sample, moment.id || moment.firestoreId, activityId])
    : 'dashboard-moment-cover:' + JSON.stringify([sample, moment.id || moment.firestoreId]);
  const [selection] = usePersistentListState(preferenceKey, { imageKey: '' });
  const originals = (moment.attachments || []).filter((item) => isAttachmentImage(item.type)
    && (/^[a-f0-9]{64}$/.test(item.assetId || '') || legacyAttachmentImage(item)));
  const options = activityId ? activityCoverImages(moment, activityId)
    : originals.filter((item) => !item.activityId);
  const image = options.find((item) => coverImageKey(item) === selection.imageKey) || options[0] || null;
  const tile = useRef(null);
  const [nearby, setNearby] = useState(typeof IntersectionObserver !== 'function');
  const [broken, setBroken] = useState('');
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') { setNearby(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNearby(true);
    }, { rootMargin: '140px' });
    if (tile.current) observer.observe(tile.current);
    return () => observer.disconnect();
  }, []);
  const original = useAttachmentOriginal(image, { uid, isGuest, enabled: Boolean(image) && nearby });
  const source = original.source && !original.error && original.source !== broken ? original.source : '';
  return <span ref={tile} className={`dashboard-cover-photo${source ? ' has-photo' : ''}`} aria-hidden="true">
    {source ? <img src={source} alt="" loading="lazy" onError={() => setBroken(source)} /> : null}
  </span>;
}
