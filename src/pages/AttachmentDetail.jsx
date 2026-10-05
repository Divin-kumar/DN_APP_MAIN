import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, FileText, HardDrive, Image as ImageIcon, Link2, RotateCw, Trash2, Upload, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import AttachmentStatusBadge from '../components/attachments/AttachmentStatusBadge';
import ModalDialog, { ConfirmDialog } from '../components/common/ModalDialog';
import { getAttachmentStatus, getAttachmentTypeBucket, getAttachmentTypeLabel } from '../utils/attachmentStatus.js';

const MAX_LOCAL_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable';
  return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let amount = bytes / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount.toFixed(1)} ${unit}`;
};

const isHttpUrl = (value) => {
  try {
    const protocol = new URL(String(value || '').trim()).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const parentKey = (link) => `${link.parentType}:${link.parentId}`;

export default function AttachmentDetailPage() {
  const { attachmentId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const principal = useAppStore((state) => state.principal);
  const showToast = useAppStore((state) => state.showToast);
  const {
    events,
    loading,
    error: loadError,
    loadedFor,
    loadEvents,
    getAttachmentBlob,
    relinkAttachment,
    replaceAttachmentFile,
    updateAttachmentLinks,
    deleteAttachment,
  } = useEventStore();
  const [retryCount, setRetryCount] = useState(0);
  const [sourceError, setSourceError] = useState(false);
  const [localOpenUrl, setLocalOpenUrl] = useState('');
  const [relinkOpen, setRelinkOpen] = useState(false);
  const [referenceDraft, setReferenceDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [replacementFile, setReplacementFile] = useState(null);
  const [pendingRemoveLink, setPendingRemoveLink] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const principalId = principal?.principalId;
  const loadKey = `device:${principalId || 'active'}`;

  useEffect(() => {
    if (!principalId) return;
    void loadEvents(principalId);
  }, [principalId, loadEvents]);

  useEffect(() => {
    setSourceError(false);
    setLocalOpenUrl('');
  }, [attachmentId]);

  const handleSourceError = useCallback(() => setSourceError(true), []);

  const attachment = useMemo(() => {
    const parentIndex = new Map();
    for (const event of events) {
      parentIndex.set(`moment:${event.id}`, {
        parentType: 'moment',
        parentId: event.id,
        parentName: event.name || 'Untitled Moment',
        route: `/events/${event.id}/overview`,
      });
      for (const activity of event.activities || []) {
        parentIndex.set(`activity:${activity.id}`, {
          parentType: 'activity',
          parentId: activity.id,
          parentName: activity.title || 'Untitled Activity',
          momentName: event.name || 'Untitled Moment',
          route: `/events/${event.id}/activities`,
        });
      }
    }

    let result = null;
    const links = new Map();
    for (const event of events) {
      for (const row of event.attachments || []) {
        if ((row.id || row.attachmentId) !== attachmentId) continue;
        if (!result) result = { ...row, parentLinks: [] };
        const rowLinks = row.parentLinks?.length
          ? row.parentLinks
          : row.momentId || row.eventId ? [{ parentType: 'moment', parentId: row.momentId || row.eventId }] : [];
        for (const link of rowLinks) {
          const key = parentKey(link);
          if (links.has(key)) continue;
          const parent = parentIndex.get(key);
          links.set(key, {
            ...link,
            parentName: parent?.parentName || 'Unavailable parent',
            momentName: parent?.momentName || '',
            route: parent?.route || '',
          });
        }
      }
    }
    if (result) result.parentLinks = [...links.values()];
    return result;
  }, [events, attachmentId]);

  const backTo = location.state?.from || '/attachments';
  const resolvedAttachment = sourceError ? { ...attachment, hasLocalCopy: false, availability: 'reference' } : attachment;
  const status = getAttachmentStatus(resolvedAttachment || {});
  const typeBucket = getAttachmentTypeBucket(attachment || {});
  const externalReference = isHttpUrl(attachment?.fileReference || attachment?.url)
    ? attachment.fileReference || attachment.url
    : isHttpUrl(attachment?.previewReference) ? attachment.previewReference : '';
  const previewReference = typeBucket === 'image' && isHttpUrl(attachment?.previewReference)
    ? attachment.previewReference
    : externalReference;
  const canLoadRecord = Boolean(principalId && loadedFor === loadKey);

  const finishRelink = async (event) => {
    event.preventDefault();
    if (!attachment) return;
    if (!isHttpUrl(referenceDraft)) {
      showToast('Enter a valid http:// or https:// reference.', 'danger');
      return;
    }
    setSaving(true);
    try {
      await relinkAttachment(principalId, attachment.id, {
        fileReference: referenceDraft.trim(),
        previewReference: typeBucket === 'image' ? referenceDraft.trim() : '',
      });
      setRelinkOpen(false);
      setSourceError(false);
      showToast('File reference updated', 'success');
    } catch (error) {
      showToast(error?.message || 'The file reference could not be updated.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const saveReplacement = async () => {
    if (!attachment || !replacementFile) return;
    if (replacementFile.size > MAX_LOCAL_FILE_SIZE) {
      showToast('Local attachment copies are limited to 20 MB each.', 'danger');
      setReplacementFile(null);
      return;
    }
    setSaving(true);
    try {
      await replaceAttachmentFile(principalId, attachment.id, {
        blob: replacementFile,
        name: replacementFile.name,
        mimeType: replacementFile.type || 'application/octet-stream',
      });
      setReplacementFile(null);
      setSourceError(false);
      setRetryCount((count) => count + 1);
      showToast('File replaced. Its links were preserved.', 'success');
    } catch (error) {
      showToast(error?.message || 'The file could not be replaced.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async () => {
    if (!attachment || !pendingRemoveLink) return;
    const remaining = attachment.parentLinks.filter((link) => parentKey(link) !== parentKey(pendingRemoveLink));
    if (!remaining.length) {
      showToast('Every attachment must stay linked. Delete the attachment or add another link first.', 'danger');
      setPendingRemoveLink(null);
      return;
    }
    setSaving(true);
    try {
      await updateAttachmentLinks(principalId, attachment.id, remaining.map(({ parentType, parentId }) => ({ parentType, parentId })));
      setPendingRemoveLink(null);
      showToast('Link removed. The attachment and other links were kept.', 'success');
    } catch (error) {
      showToast(error?.message || 'The link could not be removed.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const removeAttachment = async () => {
    if (!attachment) return;
    setSaving(true);
    try {
      await deleteAttachment(principalId, attachment.id);
      showToast('Attachment deleted with all links and its local copy.', 'success');
      navigate('/attachments', { replace: true });
    } catch (error) {
      showToast(error?.message || 'The attachment could not be deleted.', 'danger');
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const retryPreview = () => {
    setSourceError(false);
    setRetryCount((count) => count + 1);
  };

  const focusPreview = () => {
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    previewRef.current?.focus({ preventScroll: true });
  };

  if (!principalId || loading || !canLoadRecord) {
    if (loadError && !loading) return <section className="attachment-detail-not-found" role="alert"><AlertTriangle size={25} /><h1>Attachment details couldn’t load</h1><p>Your data was not changed. Retry loading the local attachment records.</p><button type="button" className="attachment-detail-primary-action" onClick={() => void loadEvents(principalId)}>Retry loading</button></section>;
    return <div className="attachment-detail-loading" role="status"><span className="attachment-preview-spinner" />Loading attachment details…</div>;
  }

  if (!attachment) {
    return <section className="attachment-detail-not-found">
      <AlertTriangle size={25} />
      <h1>Attachment not found</h1>
      <p>It may have been removed or is not linked to any available Moment or Activity.</p>
      <Link className="attachment-detail-secondary-action" to="/attachments"><ArrowLeft size={15} /> Back to Attachments</Link>
    </section>;
  }

  const fileName = attachment.name || 'Untitled attachment';
  const openTarget = status.value === 'unavailable' ? '' : resolvedAttachment.hasLocalCopy ? localOpenUrl : externalReference;
  const details = [
    ['File type', getAttachmentTypeLabel(attachment)],
    ['File size', formatBytes(attachment.size)],
    ['Date added', formatDate(attachment.createdAt)],
    ['Updated', formatDate(attachment.updatedAt)],
  ];

  return (
    <main className="attachment-detail-page">
      <div className="attachment-detail-back-row">
        <Link to={backTo} className="attachment-detail-back"><ArrowLeft size={15} /> Back to attachments</Link>
      </div>

      <header className="attachment-detail-header">
        <div className="attachment-detail-file-icon" aria-hidden="true">{typeBucket === 'image' ? <ImageIcon size={22} /> : <FileText size={22} />}</div>
        <div className="attachment-detail-title-copy">
          <p className="attachment-detail-eyebrow">Attachment details</p>
          <h1>{fileName}</h1>
          <div className="attachment-detail-status-row"><AttachmentStatusBadge attachment={resolvedAttachment} /><span>{getAttachmentTypeLabel(attachment)} · {formatBytes(attachment.size)}</span></div>
        </div>
      </header>

      <section className="attachment-detail-layout">
        <div className="attachment-detail-main-column">
          <section className="attachment-detail-preview-card" aria-label="Attachment preview">
            <div className="attachment-detail-section-heading"><div><h2>Preview</h2><p>{status.value === 'unavailable' ? 'This file cannot be opened from its current source.' : 'Preview availability depends on the file type and browser.'}</p></div><button type="button" className="attachment-detail-subtle-action" onClick={focusPreview}><ImageIcon size={15} /> Preview</button></div>
            <div ref={previewRef} className="attachment-preview-region" tabIndex={-1}>
              <AttachmentPreview
                attachment={attachment}
                previewReference={previewReference}
                getAttachmentBlob={getAttachmentBlob}
                userId={principalId}
                retryCount={retryCount}
                onSourceError={handleSourceError}
                onSourceReady={setLocalOpenUrl}
                onRetry={retryPreview}
              />
            </div>
          </section>

          <section id="attachment-detail-linked" className="attachment-detail-linked-card" tabIndex={-1}>
            <div className="attachment-detail-section-heading"><div><h2>Linked to</h2><p>This attachment stays connected to its memory context.</p></div><Link2 size={18} aria-hidden="true" /></div>
            {attachment.parentLinks.length ? <div className="attachment-detail-parent-list">{attachment.parentLinks.map((link) => <div className="attachment-detail-parent-row" key={parentKey(link)}>
              <div className="attachment-detail-parent-identity"><span className="attachment-detail-parent-type">{link.parentType === 'moment' ? 'Moment' : 'Activity'}</span>{link.route ? <Link to={link.route}>{link.parentName}</Link> : <strong>{link.parentName}</strong>}{link.momentName ? <small>{link.momentName}</small> : null}</div>
              {attachment.parentLinks.length > 1 ? <button type="button" className="attachment-detail-remove-link" disabled={saving} onClick={() => setPendingRemoveLink(link)}><X size={14} /> Remove Link</button> : <span className="attachment-detail-last-link-note">Keep at least one link</span>}
            </div>)}</div> : <p className="attachment-detail-empty-links">No parent links are available for this attachment.</p>}
          </section>
        </div>

        <aside className="attachment-detail-side-column">
          <section className="attachment-detail-info-card">
            <h2>File information</h2>
            <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>
          <section className="attachment-detail-actions-card" aria-label="Attachment actions">
            <h2>What next?</h2>
            <button type="button" className="attachment-detail-primary-action" onClick={focusPreview}><ImageIcon size={16} /> Preview</button>
            {openTarget ? <a className="attachment-detail-action" href={openTarget} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Open</a> : attachment.hasLocalCopy && status.value !== 'unavailable' ? <span className="attachment-detail-action-disabled"><HardDrive size={16} /> Preparing local file…</span> : <span className="attachment-detail-action-disabled"><ExternalLink size={16} /> Open unavailable</span>}
            {status.value === 'reference-only' || status.value === 'unavailable' ? <button type="button" className="attachment-detail-action" disabled={saving} onClick={retryPreview}><RotateCw size={16} /> Retry</button> : null}
            <button type="button" className="attachment-detail-action" disabled={saving} onClick={() => { setReferenceDraft(attachment.fileReference || attachment.url || ''); setRelinkOpen(true); }}><Link2 size={16} /> Relink File</button>
            <button type="button" className="attachment-detail-action" disabled={saving} onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Replace File</button>
            <button type="button" className="attachment-detail-danger-action" disabled={saving || attachment.parentLinks.length < 2} title={attachment.parentLinks.length < 2 ? 'Add another parent link before removing the final link.' : ''} onClick={() => document.getElementById('attachment-detail-linked')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><X size={16} /> Remove Link</button>
            <button type="button" className="attachment-detail-danger-action" disabled={saving} onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Delete Attachment</button>
            {attachment.parentLinks.length < 2 ? <p className="attachment-detail-action-note">An attachment must keep at least one Moment or Activity link. Delete Attachment removes the record and its local copy.</p> : null}
            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} hidden onChange={(event) => { setReplacementFile(event.currentTarget.files?.[0] || null); event.currentTarget.value = ''; }} />
          </section>
        </aside>
      </section>

      {relinkOpen ? <ModalDialog title="Relink file" onClose={() => setRelinkOpen(false)}>
        <form className="attachment-relink-form" onSubmit={(event) => void finishRelink(event)}>
          <p>Update the external file reference on this attachment. Its identity, Moment/Activity links, and any saved local copy will be preserved; the local copy remains the Open target when present.</p>
          <label><span>File URL</span><input type="url" autoFocus required value={referenceDraft} onChange={(event) => setReferenceDraft(event.target.value)} placeholder="https://…" /></label>
          <div className="attachment-relink-actions"><button type="button" className="secondaryButton" onClick={() => setRelinkOpen(false)}>Cancel</button><button type="submit" className="primaryButton" disabled={saving}>{saving ? 'Saving…' : 'Save reference'}</button></div>
        </form>
      </ModalDialog> : null}

      {replacementFile ? <ModalDialog title="Replace attachment file?" onClose={() => setReplacementFile(null)}>
        <div className="attachment-replace-confirmation"><p>Replace the file for <strong>{fileName}</strong> with <strong>{replacementFile.name}</strong>?</p><p>The attachment ID and all Moment/Activity links will be preserved. The previous local copy will be replaced.</p>
          <div className="attachment-relink-actions"><button type="button" className="secondaryButton" disabled={saving} onClick={() => setReplacementFile(null)}>Cancel</button><button type="button" className="primaryButton" disabled={saving} onClick={() => void saveReplacement()}>{saving ? 'Replacing…' : 'Replace File'}</button></div>
        </div>
      </ModalDialog> : null}

      {pendingRemoveLink ? <ConfirmDialog title="Remove this link?" message={`Remove this attachment from “${pendingRemoveLink.parentName || 'this parent'}”? The attachment, local copy, and other links will remain.`} onCancel={() => setPendingRemoveLink(null)} onConfirm={() => void removeLink()} confirmLabel="Remove Link" /> : null}
      {confirmDelete ? <ConfirmDialog title="Delete this attachment?" message={`Delete “${fileName}”, all of its Moment and Activity links, and its local copy? This cannot be undone.`} onCancel={() => setConfirmDelete(false)} onConfirm={() => void removeAttachment()} confirmLabel="Delete Attachment" /> : null}
    </main>
  );
}

function AttachmentPreview({ attachment, previewReference, getAttachmentBlob, userId, retryCount, onSourceError, onSourceReady, onRetry }) {
  const [blob, setBlob] = useState(null);
  const [localUrl, setLocalUrl] = useState('');
  const [localMissing, setLocalMissing] = useState(false);
  const [previewState, setPreviewState] = useState('loading');
  const [textContent, setTextContent] = useState('');
  const [textError, setTextError] = useState(false);
  const [textLoaded, setTextLoaded] = useState(false);
  const mimeType = String(attachment.mimeType || attachment.type || '').toLowerCase();
  const typeBucket = getAttachmentTypeBucket(attachment);
  const imageLike = typeBucket === 'image';
  const pdfLike = typeBucket === 'pdf';

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setBlob(null);
    setLocalUrl('');
    setLocalMissing(false);
    setPreviewState('loading');
    if (!attachment.hasLocalCopy) return () => { active = false; };

    void getAttachmentBlob(userId, attachment.id).then((localBlob) => {
      if (!active) return;
      if (!localBlob) {
        setLocalMissing(true);
        setPreviewState('unavailable');
        onSourceError();
        return;
      }
      objectUrl = URL.createObjectURL(localBlob);
      setBlob(localBlob);
      setLocalUrl(objectUrl);
      onSourceReady(objectUrl);
      setPreviewState('ready');
    }).catch(() => {
      if (active) {
        setLocalMissing(true);
        setPreviewState('unavailable');
        onSourceError();
      }
    });
    return () => {
      active = false;
      onSourceReady('');
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, attachment.hasLocalCopy, getAttachmentBlob, userId, retryCount, onSourceError, onSourceReady]);

  useEffect(() => {
    if (!blob || !mimeType.startsWith('text/')) return undefined;
    let active = true;
    setTextLoaded(false);
    void blob.text().then((value) => { if (active) { setTextContent(value); setTextError(false); setTextLoaded(true); setPreviewState('ready'); } }).catch(() => { if (active) { setTextError(true); setTextLoaded(true); setPreviewState('restricted'); } });
    return () => { active = false; };
  }, [blob, mimeType, retryCount]);

  const remoteSource = isHttpUrl(previewReference) ? previewReference : isHttpUrl(attachment.fileReference || attachment.url)
    ? attachment.fileReference || attachment.url
    : isHttpUrl(attachment.previewReference) ? attachment.previewReference : '';
  const source = localMissing && remoteSource ? remoteSource : localUrl || remoteSource;
  const localCopyMissingWithReference = localMissing && Boolean(remoteSource);
  const hasSource = Boolean(source);

  useEffect(() => {
    if (!pdfLike || !hasSource || localUrl) return undefined;
    setPreviewState('loading');
    const timeoutId = window.setTimeout(() => setPreviewState((current) => current === 'loading' ? 'restricted' : current), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [pdfLike, hasSource, localUrl, retryCount]);

  if (!hasSource && attachment.hasLocalCopy && !localMissing) return <PreviewLoading label="Loading local file…" />;
  if (!hasSource) return <PreviewMessage tone="unavailable" Icon={AlertTriangle} title="Preview unavailable" message="No readable local file or usable reference is available. Relink or replace the file to recover it." onRetry={onRetry} />;

  if (imageLike) return <div className="attachment-preview-content">
    {localCopyMissingWithReference ? <p className="attachment-preview-caption">The local copy is unavailable; showing the saved reference instead.</p> : null}
    {previewState === 'loading' ? <><PreviewLoading label="Loading image preview…" /><img className="attachment-preview-image is-loading" src={source} alt="" aria-hidden="true" onLoad={() => setPreviewState('ready')} onError={() => { setPreviewState('error'); if (!localUrl) onSourceError(); }} /></> : null}
    {previewState === 'ready' ? <img className="attachment-preview-image" src={source} alt={attachment.name || 'Attachment image'} onError={() => { setPreviewState('error'); if (!localUrl) onSourceError(); }} /> : null}
    {previewState === 'error' ? <PreviewMessage tone="restricted" Icon={ImageIcon} title="Image preview could not load" message="The current reference did not return a displayable image. You can retry, relink the file, or replace it." onRetry={onRetry} /> : null}
  </div>;

  if (pdfLike) return <div className="attachment-preview-content attachment-preview-pdf">
    {localCopyMissingWithReference ? <p className="attachment-preview-caption">The local copy is unavailable; showing the saved reference instead.</p> : null}
    {previewState === 'loading' ? <PreviewLoading label="Opening PDF preview…" /> : null}
    {previewState === 'restricted' ? <PreviewMessage tone="restricted" Icon={FileText} title="PDF preview may be restricted" message="This browser may not display the PDF inline. Use Open to view it in a new tab, or Replace File if the source is no longer valid." onRetry={onRetry} /> : null}
    <iframe key={`${source}-${retryCount}`} title={`PDF preview: ${attachment.name || 'attachment'}`} src={source} sandbox="allow-scripts" onLoad={() => setPreviewState('ready')} onError={() => setPreviewState('restricted')} />
    <p className="attachment-preview-caption">PDF display is controlled by your browser. If the preview area stays blank, use Open above.</p>
  </div>;

  if (mimeType.startsWith('text/') && blob) return <div className="attachment-preview-content attachment-preview-text">
    {textError ? <PreviewMessage tone="restricted" Icon={FileText} title="Text preview could not be loaded" message="Open the file with a compatible app, or replace it with a readable copy." onRetry={onRetry} /> : !textLoaded ? <PreviewLoading label="Loading document preview…" /> : <pre>{textContent}</pre>}
  </div>;

  return <PreviewMessage tone="restricted" Icon={FileText} title="This document can’t be previewed here" message="DN keeps this document connected to its Moment or Activity. Open it with a compatible app, or replace the file if this copy is unavailable." />;
}

function PreviewLoading({ label }) {
  return <div className="attachment-preview-loading" role="status"><span className="attachment-preview-spinner" />{label}</div>;
}

function PreviewMessage({ tone, Icon, title, message, onRetry }) {
  return <div className={`attachment-preview-message is-${tone}`} role="status">
    <Icon size={24} aria-hidden="true" />
    <strong>{title}</strong>
    <p>{message}</p>
    {onRetry ? <button type="button" onClick={onRetry}><RotateCw size={14} /> Retry</button> : null}
  </div>;
}
