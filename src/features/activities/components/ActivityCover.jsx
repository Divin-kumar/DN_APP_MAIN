import { useState } from 'react';
import { ArrowLeft, ImageOff, Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAttachmentOriginal from '../../../hooks/useAttachmentOriginal';
import { activityCoverRatio } from '../../../utils/activityDetail';

// Intrinsic measurements are a runtime hint only, never a persisted crop/asset.
const dimensions = new Map();
export default function ActivityCover({ attachment, uid, isGuest, backTo }) {
  const original = useAttachmentOriginal(attachment, { uid, isGuest });
  const [brokenSource, setBrokenSource] = useState('');
  const identity = attachment?.assetId || attachment?.url || attachment?.downloadURL || attachment?.src;
  const initial = attachment?.width && attachment?.height ? attachment : dimensions.get(identity);
  // Freeze the reserved geometry for this source. Loading never moves the details.
  const [geometry] = useState(() => ({ width: initial?.width, height: initial?.height,
    ratio: activityCoverRatio(initial?.width, initial?.height) }));
  const usable = original.source && !original.error && brokenSource !== original.source;
  const loading = original.loading;
  return <div className={`activity-cover${loading ? ' is-loading' : ''}${usable ? ' has-photo' : ' is-fallback'}`}
    style={{ '--activity-cover-ratio': geometry.ratio }} aria-busy={Boolean(loading)}>
    {usable ? <img className="activity-cover-photo" src={original.source}
      alt={attachment.name || 'Attached activity photo'} width={geometry.width} height={geometry.height}
      onLoad={(event) => {
        const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
        if (width && height && dimensions.size < 100) dimensions.set(identity, { width, height });
      }} onError={() => setBrokenSource(original.source)} /> : <div className="activity-cover-fallback">
      <span aria-hidden="true">{attachment && !loading ? <ImageOff size={28} /> : <Images size={28} />}</span>
      <small className="sr-only">{loading ? 'Loading photo…' : attachment ? 'Cover photo unavailable' : 'No cover photo'}</small>
    </div>}
    <Link to={backTo} className="activity-cover-back" aria-label="Back to Moment activities"><ArrowLeft size={19} aria-hidden="true" /></Link>
  </div>;
}
