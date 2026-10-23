import { useEffect, useRef, useState } from 'react';
import { Download, FileText, ImageOff, X } from 'lucide-react';
import { attachmentRepository } from '../../services/attachmentService';
import { getActiveSampleData } from '../../dev/sampleData';
import { downloadBlob } from '../../utils/download';
import ModalDialog from './ModalDialog';
import './AttachmentGallery.css';

const isImage = (type) => /^image\/(jpeg|png|webp|gif|avif|bmp)$/i.test(type || '');
function AttachmentTile({ attachment, uid, isGuest, onRemove, compact }) {
  const [source, setSource] = useState('');
  const [blob, setBlob] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const tile = useRef(null);
  const [nearby, setNearby] = useState(false);
  const visible = nearby || open;
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') { setNearby(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      setNearby(entries.some((entry) => entry.isIntersecting));
    }, { rootMargin: '160px' });
    if (tile.current) observer.observe(tile.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) { setSource(''); setBlob(null); return undefined; }
    let active = true, objectUrl;
    setSource(''); setBlob(null); setError('');
    if (!attachment.assetId) {
      const legacy = attachment.url || attachment.downloadURL || attachment.src;
      if (typeof legacy === 'string' && /^https:\/\//i.test(legacy) && isImage(attachment.type)) setSource(legacy);
      else setError('Original file not stored');
      return undefined;
    }
    attachmentRepository.read(attachment, { uid, isGuest, sample: Boolean(getActiveSampleData(uid)) }).then((file) => {
      if (!active) return;
      if (!file) throw new Error('Original file not stored');
      objectUrl = URL.createObjectURL(file);
      setBlob(file); setSource(objectUrl);
    }).catch((reason) => { if (active) setError(reason?.message || 'Unable to open file'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.assetId, attachment.storage, attachment.url, uid, isGuest, visible]);
  return <div ref={tile} className={`dn-attachment-tile${compact ? ' is-compact' : ''}`}
    onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}
    onTouchStart={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
    <button type="button" className="dn-attachment-open" onClick={() => setOpen(true)} aria-label={`Preview ${attachment.name || 'attachment'}`}>
      {source && isImage(attachment.type) ? <img src={source} alt={attachment.name || 'Attached photo'} loading="lazy" />
        : error ? <ImageOff size={20} aria-hidden="true" /> : <FileText size={20} aria-hidden="true" />}
      <span><strong>{attachment.name || 'Attachment'}</strong>{!compact ? <small>{error || `${Math.ceil(Number(attachment.size || 0) / 1024)} KB`}</small> : null}</span>
    </button>
    {onRemove ? <button className="dn-attachment-remove" type="button" aria-label={`Remove ${attachment.name}`} onClick={() => onRemove(attachment)}><X size={14} /></button> : null}
    {open ? <ModalDialog title={attachment.name || 'Attachment'} className="dn-attachment-viewer" onClose={() => setOpen(false)}>
      {source && isImage(attachment.type) ? <img className="dn-attachment-original" src={source} alt={attachment.name || 'Attached photo'} /> : <p>{error || (blob ? 'Your original file is ready to download.' : 'Loading original file…')}</p>}
      {blob ? <button type="button" className="secondaryButton" onClick={() => downloadBlob(blob, attachment.name || 'attachment')}><Download size={15} /> Download original</button> : null}
    </ModalDialog> : null}
  </div>;
}
export default function AttachmentGallery({ attachments = [], uid, isGuest, onRemove, compact = false }) {
  if (!attachments.length) return null;
  return <div className={`dn-attachment-gallery${compact ? ' is-compact' : ''}`} aria-label="Attachments">
    {attachments.map((attachment) => <AttachmentTile key={attachment.id} attachment={attachment} uid={uid} isGuest={isGuest} onRemove={onRemove} compact={compact} />)}
  </div>;
}
