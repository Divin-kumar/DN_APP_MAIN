import { useEffect, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { attachmentRepository } from '../services/attachmentService';
import { getActiveSampleScenario } from '../dev/sampleData';
import { legacyAttachmentImage } from '../utils/activityDetail';

// Shared loading/integrity path for gallery and cover. A context/source change
// hides the previous source synchronously and revokes only URLs we created.
export default function useAttachmentOriginal(attachment, { uid, isGuest, enabled = true }) {
  const sample = getActiveSampleScenario(uid);
  const key = JSON.stringify([uid || null, Boolean(isGuest), sample, enabled, attachment?.assetId,
    attachment?.storage, attachment?.type, attachment?.url, attachment?.downloadURL, attachment?.src]);
  const [state, setState] = useState({});
  useEffect(() => {
    if (!enabled || !attachment) { setState({ key, loading: false }); return undefined; }
    let active = true, objectUrl;
    const assertCurrent = () => {
      const session = useAppStore.getState();
      if (!active || (session.user?.uid || null) !== (uid || null) || Boolean(session.isGuest) !== Boolean(isGuest)
        || getActiveSampleScenario(uid) !== sample) throw new Error('Your session changed. Reopen this file.');
    };
    setState({ key, loading: true });
    if (!attachment.assetId) {
      const source = legacyAttachmentImage(attachment);
      setState({ key, source, loading: false, error: source ? '' : 'Original file not stored' });
      return () => { active = false; };
    }
    attachmentRepository.read(attachment, { uid, isGuest, sample: Boolean(sample), assertCurrent }).then((blob) => {
      if (!active) return;
      assertCurrent();
      if (!blob) throw new Error('Original file not stored');
      objectUrl = URL.createObjectURL(blob);
      setState({ key, source: objectUrl, blob, loading: false, error: '' });
    }).catch((reason) => { if (active) setState({ key, loading: false, error: reason?.message || 'Unable to open file' }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [key]);
  return state.key === key ? state : { loading: enabled && Boolean(attachment) };
}
