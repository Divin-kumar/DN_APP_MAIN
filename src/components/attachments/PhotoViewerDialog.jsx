import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Images } from 'lucide-react';
import { Link } from 'react-router-dom';
import ModalDialog from '../common/ModalDialog';
import AttachmentStatusBadge from './AttachmentStatusBadge';
import { getAttachmentLinkLabel, getAttachmentStatus } from '../../utils/attachmentStatus.js';

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || '').trim());
const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image preview could not be read.'));
  reader.onerror = () => reject(reader.error || new Error('Image preview could not be read.'));
  reader.readAsDataURL(blob);
});

export default function PhotoViewerDialog({ photos, index, setIndex, contextName, getAttachmentBlob, userId, eventId, onClose }) {
  const photo = photos[index];
  const [localMissing, setLocalMissing] = useState(false);
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(photos.length - 1, current + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, setIndex]);

  useEffect(() => setLocalMissing(false), [photo?.id]);

  if (!photo) return null;
  const resolvedPhoto = localMissing ? { ...photo, hasLocalCopy: false } : photo;
  const status = getAttachmentStatus(resolvedPhoto);
  const reference = photo.previewReference || photo.fileReference || photo.url || '';
  const canOpenReference = isHttpUrl(reference);

  return <ModalDialog title={photo.name || 'Photo viewer'} onClose={onClose} className="attachment-photo-viewer-modal">
    <div className="attachment-photo-viewer">
      <header className="attachment-photo-viewer-topbar"><span>{index + 1} of {photos.length}</span><AttachmentStatusBadge attachment={photo} small /></header>
      <div className="attachment-photo-viewer-stage">
        <button type="button" className="attachment-photo-viewer-nav" aria-label="Previous photo" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}><ChevronLeft size={24} /></button>
        <PhotoViewerImage key={photo.id} photo={photo} getAttachmentBlob={getAttachmentBlob} userId={userId} onLocalMissing={setLocalMissing} />
        <button type="button" className="attachment-photo-viewer-nav" aria-label="Next photo" disabled={index >= photos.length - 1} onClick={() => setIndex((current) => Math.min(photos.length - 1, current + 1))}><ChevronRight size={24} /></button>
      </div>
      <footer className="attachment-photo-viewer-footer">
        <div className="attachment-photo-viewer-context"><strong>{photo.name || 'Untitled photo'}</strong><span>Linked to: {getAttachmentLinkLabel(photo.parentLinks || [])} · {contextName}</span></div>
        <div className="attachment-photo-viewer-actions">
          {status.value !== 'unavailable' && !resolvedPhoto.hasLocalCopy && canOpenReference ? <a href={reference} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open</a> : null}
          <Link to={`/attachments/${photo.id}`} state={{ from: `/events/${eventId}/attachments` }} onClick={onClose}>Photo details</Link>
        </div>
      </footer>
    </div>
  </ModalDialog>;
}

function PhotoViewerImage({ photo, getAttachmentBlob, userId, onLocalMissing }) {
  const [source, setSource] = useState('');
  const [localBlob, setLocalBlob] = useState(null);
  const [dataUrlFallback, setDataUrlFallback] = useState('');
  const [dataUrlAttempted, setDataUrlAttempted] = useState(false);
  const [loading, setLoading] = useState(Boolean(photo.hasLocalCopy));
  const [failed, setFailed] = useState(false);
  const reference = photo.previewReference || photo.fileReference || photo.url || '';
  const status = getAttachmentStatus(photo);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSource('');
    setLocalBlob(null);
    setDataUrlFallback('');
    setDataUrlAttempted(false);
    setFailed(false);
    onLocalMissing(false);
    if (photo.hasLocalCopy) {
      setLoading(true);
      void getAttachmentBlob(userId, photo.id).then((blob) => {
        if (!active) return;
        if (blob) {
          setLocalBlob(blob);
          try {
            objectUrl = URL.createObjectURL(blob);
            setSource(objectUrl);
          } catch {
            setDataUrlAttempted(true);
            void blobToDataUrl(blob).then((dataUrl) => { if (active) setDataUrlFallback(dataUrl); }).catch(() => { if (active) { setFailed(true); setLoading(false); } });
          }
        } else {
          onLocalMissing(true);
          if (isHttpUrl(reference)) setSource(reference);
          else setFailed(true);
          setLoading(isHttpUrl(reference));
        }
      }).catch(() => { if (active) { onLocalMissing(true); if (isHttpUrl(reference)) { setSource(reference); setLoading(true); } else { setFailed(true); setLoading(false); } } });
    } else if (isHttpUrl(reference)) {
      setSource(reference);
      setLoading(true);
    } else {
      setFailed(true);
      setLoading(false);
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, photo.hasLocalCopy, reference, getAttachmentBlob, userId, onLocalMissing]);

  const imageSource = dataUrlFallback || source;
  if (loading && !imageSource) return <div className="attachment-photo-viewer-message" role="status"><span className="attachment-preview-spinner" />Loading photo…</div>;
  if (failed || !imageSource || status.value === 'unavailable') return <div className="attachment-photo-viewer-message is-unavailable" role="status"><Images size={34} /><strong>Photo unavailable</strong><span>Choose Replace File or Relink from Photo details to recover this photo.</span></div>;
  return <div className="attachment-photo-viewer-image-wrap">
    {loading ? <div className="attachment-photo-viewer-image-loading" role="status"><span className="attachment-preview-spinner" />Loading photo…</div> : null}
    <img className="attachment-photo-viewer-image" src={imageSource} alt={photo.name || 'Photo'} onLoad={() => setLoading(false)} onError={() => {
      if (localBlob && !dataUrlAttempted) {
        setDataUrlAttempted(true);
        void blobToDataUrl(localBlob).then(setDataUrlFallback).catch(() => { setFailed(true); setLoading(false); });
      } else { setFailed(true); setLoading(false); }
    }} />
  </div>;
}
