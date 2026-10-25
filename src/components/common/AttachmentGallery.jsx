import { useEffect, useRef, useState } from 'react';
import { Download, FileText, ImageOff, X } from 'lucide-react';
import useAttachmentOriginal from '../../hooks/useAttachmentOriginal';
import { coverImageKey, isAttachmentImage as isImage } from '../../utils/activityDetail';
import { downloadBlob } from '../../utils/download';
import ModalDialog from './ModalDialog';
import './AttachmentGallery.css';

function AttachmentTile({ attachment, uid, isGuest, onRemove, compact, showMetadata, onSelect, selectedKey, retainLoaded }) {
  const [broken, setBroken] = useState('');
  const [open, setOpen] = useState(false);
  const tile = useRef(null);
  const [nearby, setNearby] = useState(false);
  const visible = nearby || open;
  const original = useAttachmentOriginal(attachment, { uid, isGuest, enabled: visible });
  const { source, blob } = original;
  const error = original.error || (broken === source ? 'Unable to display this image' : '');
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') { setNearby(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      const intersecting = entries.some((entry) => entry.isIntersecting);
      setNearby((current) => retainLoaded ? current || intersecting : intersecting);
    }, { rootMargin: '160px' });
    if (tile.current) observer.observe(tile.current);
    return () => observer.disconnect();
  }, [retainLoaded]);
  return <div ref={tile} className={`dn-attachment-tile${compact ? ' is-compact' : ''}`}
    onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}
    onTouchStart={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
    <button type="button" className="dn-attachment-open" onClick={() => onSelect ? onSelect(attachment) : setOpen(true)}
      disabled={Boolean(onSelect && (!source || error))} aria-pressed={onSelect ? selectedKey === coverImageKey(attachment) : undefined}
      aria-label={`${onSelect ? 'Use as cover:' : 'Preview'} ${attachment.name || 'attachment'}`}>
      {source && !error && isImage(attachment.type) ? <img src={source} alt={attachment.name || 'Attached photo'} loading="lazy" onError={() => setBroken(source)} />
        : error ? <ImageOff size={20} aria-hidden="true" /> : <FileText size={20} aria-hidden="true" />}
      <span><strong>{attachment.name || 'Attachment'}</strong>{!compact && showMetadata ? <small>{error || `${Math.ceil(Number(attachment.size || 0) / 1024)} KB`}</small> : null}</span>
    </button>
    {onRemove ? <button className="dn-attachment-remove" type="button" aria-label={`Remove ${attachment.name}`} onClick={() => onRemove(attachment)}><X size={14} /></button> : null}
    {open ? <ModalDialog title={attachment.name || 'Attachment'} className="dn-attachment-viewer" onClose={() => setOpen(false)}>
      {source && !error && isImage(attachment.type) ? <img className="dn-attachment-original" src={source} alt={attachment.name || 'Attached photo'} onError={() => setBroken(source)} /> : <p>{error || (blob ? 'Your original file is ready to download.' : 'Loading original file…')}</p>}
      {blob ? <button type="button" className="secondaryButton" onClick={() => downloadBlob(blob, attachment.name || 'attachment')}><Download size={15} /> Download original</button> : null}
    </ModalDialog> : null}
  </div>;
}
export default function AttachmentGallery({ attachments = [], uid, isGuest, onRemove, compact = false, showMetadata = true, onSelect, selectedKey, retainLoaded = false }) {
  if (!attachments.length) return null;
  return <div className={`dn-attachment-gallery${compact ? ' is-compact' : ''}`} aria-label="Attachments">
    {attachments.map((attachment) => <AttachmentTile key={attachment.id} attachment={attachment} uid={uid} isGuest={isGuest} onRemove={onRemove} compact={compact} showMetadata={showMetadata} onSelect={onSelect} selectedKey={selectedKey} retainLoaded={retainLoaded} />)}
  </div>;
}
