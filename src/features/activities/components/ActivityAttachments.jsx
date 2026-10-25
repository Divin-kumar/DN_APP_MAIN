import { useEffect, useRef, useState } from 'react';
import { Link2, Plus } from 'lucide-react';
import AttachmentGallery from '../../../components/common/AttachmentGallery';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import { attachmentRepository, MAX_ATTACHMENT_BYTES } from '../../../services/attachmentService';
import { scopedRecordActions as records } from '../../../services/scopedRecordActions';
import { activityAttachments } from '../../../utils/activityDetail';
import { recordId } from '../../../utils/recordIdentity';

export default function ActivityAttachments({ moment, activityId, uid, isGuest }) {
  const input = useRef(null);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const context = records.capture();
  const eventId = recordId(moment.id || moment.firestoreId);
  const attachments = activityAttachments(moment, activityId);
  const available = (moment.attachments || []).filter((item) => !item.activityId
    && (isGuest || context.sample || (item.assetId && ['local', 'firebase'].includes(item.storage))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const assertCurrent = () => {
    if (!mounted.current) throw new Error('Reopen this activity before adding a file.');
    records.resolveActivity(context, eventId, activityId);
  };
  const run = async (operation, after) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { assertCurrent(); await operation(); if (mounted.current && records.isCurrent(context)) after?.(); }
    catch (reason) { if (mounted.current && records.isCurrent(context)) setError(reason?.message || 'Unable to save this attachment. Please try again.'); }
    finally { saving.current = false; if (mounted.current && records.isCurrent(context)) setBusy(false); }
  };
  const addFile = (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.size || file.size > MAX_ATTACHMENT_BYTES) { setError('Choose a file between 1 byte and 10 MB.'); return; }
    run(async () => {
      const reference = await attachmentRepository.save(file, { uid, isGuest, sample: Boolean(context.sample), assertCurrent });
      assertCurrent();
      await records.mutateMoment(context, eventId, (latest) => {
        if (!latest.activities?.some((item) => recordId(item.id) === activityId)) throw new Error('This activity is no longer available.');
        return { ...latest, attachments: [...(latest.attachments || []), { id: crypto.randomUUID(), name: file.name,
          type: file.type || 'application/octet-stream', size: file.size, createdAt: new Date().toISOString(), ...reference, activityId }] };
      });
    });
  };
  const link = (item) => run(async () => {
    if (!isGuest && !context.sample) {
      // Verify the scoped original before creating another account relationship.
      if (!item.assetId || !['local', 'firebase'].includes(item.storage)) throw new Error('Reattach the original file before linking this attachment.');
      await attachmentRepository.read(item, { uid, isGuest, sample: false, assertCurrent });
      assertCurrent();
    }
    return records.mutateMoment(context, eventId, (latest) => {
      const attachment = latest.attachments?.find((entry) => recordId(entry.id) === recordId(item.id));
      if (!attachment || attachment.activityId) throw new Error('This attachment is no longer available to link.');
      if (!isGuest && !context.sample && (attachment.assetId !== item.assetId || attachment.storage !== item.storage)) {
        throw new Error('This attachment changed. Reopen it before linking.');
      }
      if (!latest.activities?.some((entry) => recordId(entry.id) === activityId)) throw new Error('This activity is no longer available.');
      return { ...latest, attachments: latest.attachments.map((entry) => entry === attachment ? { ...entry, activityId } : entry) };
    });
  }, () => setLinking(false));
  return <div className="activity-attachments">
    <div className="activity-section-heading"><h2>Attachments <small>{attachments.length || ''}</small></h2>
      <button type="button" className="moment-text-action" disabled={busy} onClick={() => input.current?.click()}><Plus size={15} aria-hidden="true" /> Add attachment</button></div>
    <p className="moment-empty-state">Original files stay in this browser. Use a backup to move them to another device.</p>
    <input ref={input} hidden type="file" aria-label="Add Activity attachment" onChange={addFile} />
    {busy ? <p role="status">Saving attachment…</p> : null}
    {error && !linking && !deleting ? <p role="alert" className="quick-create-error">{error}</p> : null}
    {attachments.length ? <AttachmentGallery attachments={attachments} uid={uid} isGuest={isGuest} onRemove={setDeleting} />
      : <p className="moment-empty-state">No attachments added.</p>}
    {available.length ? <button type="button" className="moment-text-action" disabled={busy} onClick={() => setLinking(true)}><Link2 size={14} aria-hidden="true" /> Link a Moment attachment</button> : null}
    {linking ? <ModalDialog title="Link Moment attachment" onClose={() => { if (!saving.current) setLinking(false); }}>
      <p>Keep an existing Moment attachment with this activity. Stored originals are reused.</p>
      {error ? <p role="alert" className="quick-create-error">{error}</p> : null}
      {available.map((item) => <button key={item.id} type="button" className="activity-attachment-link" disabled={busy} onClick={() => link(item)}>{item.name || 'Attachment'}</button>)}
    </ModalDialog> : null}
    {deleting ? <ConfirmDialog title="Remove attachment?" message="Remove this attachment reference? The original file will be retained."
      busy={busy} error={error} onCancel={() => { if (!saving.current) setDeleting(null); }}
      onConfirm={() => run(() => records.mutateMoment(context, eventId, (latest) => ({ ...latest,
        attachments: (latest.attachments || []).filter((item) => recordId(item.id) !== recordId(deleting.id)) })), () => setDeleting(null))} /> : null}
  </div>;
}
