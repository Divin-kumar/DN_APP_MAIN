import { useEffect, useId, useRef, useState } from 'react';
import { runVisualTransition } from '../../utils/visualTransitions';
import { Download, FileText, ImageOff, X } from 'lucide-react';
import useAttachmentOriginal from '../../hooks/useAttachmentOriginal';
import { coverImageKey, isAttachmentImage as isImage } from '../../utils/activityDetail';
import { downloadBlob } from '../../utils/download';
import ModalDialog from './ModalDialog';
import './AttachmentGallery.css';

function AttachmentTile({ attachment, uid, isGuest, onRemove, compact, showMetadata, showImageNames, onSelect, selectedKey, retainLoaded }) {
  const [broken, setBroken] = useState('');
  const [open, setOpen] = useState(false);
  const photoName = 'dn-gallery-photo-' + useId().replace(/[^a-z0-9-]/gi, '-');
  const tile = useRef(null);
  const [nearby, setNearby] = useState(false);
  const visible = nearby || open;
  const original = useAttachmentOriginal(attachment, { uid, isGuest, enabled: visible });
  const { source, blob } = original;
  const error = original.error || (broken === source ? 'Unable to display this image' : '');
  const photoReady = Boolean(source && !error && isImage(attachment.type));
  const openPreview = () => runVisualTransition(() => setOpen(true), photoReady);
  const closePreview = () => runVisualTransition(() => setOpen(false), photoReady);
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
    <button type="button" className="dn-attachment-open" onClick={() => onSelect ? onSelect(attachment) : openPreview()}
      disabled={Boolean(onSelect && (!source || error))} aria-pressed={onSelect ? selectedKey === coverImageKey(attachment) : undefined}
      aria-label={`${onSelect ? 'Use as cover:' : 'Preview'} ${attachment.name || 'attachment'}`}>
      {photoReady ? <img src={source} alt={attachment.name || 'Attached photo'} loading="lazy"
        style={open ? undefined : { viewTransitionName: photoName }} onError={() => setBroken(source)} />
        : error ? <ImageOff size={20} aria-hidden="true" /> : <FileText size={20} aria-hidden="true" />}
      {showImageNames || !isImage(attachment.type) ? <span><strong>{attachment.name || 'Attachment'}</strong>{!compact && showMetadata ? <small>{error || `${Math.ceil(Number(attachment.size || 0) / 1024)} KB`}</small> : null}</span> : null}
    </button>
    {onRemove ? <button className="dn-attachment-remove" type="button" aria-label={`Remove ${attachment.name}`} onClick={() => onRemove(attachment)}><X size={14} /></button> : null}
    {open ? <ModalDialog title={attachment.name || 'Attachment'} className="dn-attachment-viewer" onClose={closePreview}
      footer={blob ? <div className="dn-attachment-viewer-actions">
        <button type="button" className="secondaryButton" onClick={() => downloadBlob(blob, attachment.name || 'attachment')}>
          <Download size={16} aria-hidden="true" /> Download original
        </button>
      </div> : null}>
      {photoReady ? <img className="dn-attachment-original" src={source} alt={attachment.name || 'Attached photo'}
        style={{ viewTransitionName: photoName }} onError={() => setBroken(source)} />
        : <p role="status">{error || (blob ? 'Your original file is ready to download.' : 'Loading original file…')}</p>}
    </ModalDialog> : null}
  </div>;
}
export default function AttachmentGallery({ attachments = [], uid, isGuest, onRemove, compact = false, showMetadata = true, showImageNames = true, onSelect, selectedKey, retainLoaded = false }) {
  if (!attachments.length) return null;
  return <div className={`dn-attachment-gallery${compact ? ' is-compact' : ''}`} aria-label="Attachments">
    {attachments.map((attachment) => <AttachmentTile key={attachment.id} attachment={attachment} uid={uid} isGuest={isGuest} onRemove={onRemove} compact={compact} showMetadata={showMetadata} showImageNames={showImageNames} onSelect={onSelect} selectedKey={selectedKey} retainLoaded={retainLoaded} />)}
  </div>;
}
