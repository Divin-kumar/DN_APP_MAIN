import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, HardDrive, Image as ImageIcon, Link2, Search, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import useEventStore from '../store/useEventStore';
import { getAttachmentHealthSummary, getAttachmentStatus, getAttachmentTypeBucket, getAttachmentTypeLabel, sortAttachmentsForGallery } from '../utils/attachmentStatus.js';
import AttachmentStatusBadge from '../components/attachments/AttachmentStatusBadge';
import ModalDialog from '../components/common/ModalDialog';
import StatePanel from '../components/common/StatePanel';
import DropdownSelect from '../components/common/DropdownSelect';

const formatDate = (value) => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'No date';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatBytes = (value = 0) => {
  if (!Number.isFinite(value)) return 'Unknown';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount.toFixed(1)} ${unit}`;
};

const getParentKey = (link) => `${link.parentType}:${link.parentId}`;

export default function AttachmentsPage() {
  const principal = useAppStore((state) => state.principal);
  const showToast = useAppStore((state) => state.showToast);
  const { events, loading, error, loadedFor, loadEvents, updateAttachmentLinks, getAttachmentBlob } = useEventStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortMode, setSortMode] = useState('recent');
  const [editingAttachment, setEditingAttachment] = useState(null);
  const [selectedParentKeys, setSelectedParentKeys] = useState([]);
  const [savingLinks, setSavingLinks] = useState(false);

  useEffect(() => {
    if (!principal?.principalId) return;
    void loadEvents(principal.principalId);
  }, [principal?.principalId, loadEvents]);

  const { attachments, parentOptions } = useMemo(() => {
    const parents = new Map();
    const records = new Map();

    for (const event of events) {
      parents.set(`moment:${event.id}`, {
        parentType: 'moment',
        parentId: event.id,
        parentName: event.name || 'Untitled Moment',
        momentName: event.name || 'Untitled Moment',
        route: `/events/${event.id}/attachments`,
      });
      for (const activity of event.activities || []) {
        parents.set(`activity:${activity.id}`, {
          parentType: 'activity',
          parentId: activity.id,
          parentName: activity.title || 'Untitled Activity',
          momentName: event.name || 'Untitled Moment',
          route: `/events/${event.id}/activities`,
        });
      }

      for (const attachment of event.attachments || []) {
        const attachmentId = attachment.id || attachment.attachmentId;
        if (!attachmentId) continue;
        const record = records.get(attachmentId) || { ...attachment, parentLinks: [], momentNames: [] };
        const links = attachment.parentLinks?.length
          ? attachment.parentLinks
          : attachment.momentId || attachment.eventId ? [{ parentType: 'moment', parentId: attachment.momentId || attachment.eventId }] : [];
        const knownLinks = new Set(record.parentLinks.map(getParentKey));
        for (const link of links) {
          const key = getParentKey(link);
          if (knownLinks.has(key)) continue;
          const parent = parents.get(key);
          record.parentLinks.push({
            ...link,
            parentName: parent?.parentName || 'Unavailable parent',
            momentName: parent?.momentName || '',
            route: parent?.route || '',
          });
          knownLinks.add(key);
        }
        records.set(attachmentId, record);
      }
    }

    const options = [...parents.entries()].map(([key, parent]) => ({ key, ...parent }));
    return { attachments: [...records.values()], parentOptions: options };
  }, [events]);

  const visibleAttachments = useMemo(() => {
    const matchesQuery = query.trim().toLowerCase();
    const filtered = attachments.filter((attachment) => {
      const typeBucket = getAttachmentTypeBucket(attachment);
      const status = getAttachmentStatus(attachment).value;
      const parentSearch = attachment.parentLinks.map((link) => `${link.parentName} ${link.parentType} ${link.momentName}`).join(' ').toLowerCase();
      const queryMatch = !matchesQuery
        || String(attachment.name || '').toLowerCase().includes(matchesQuery)
        || parentSearch.includes(matchesQuery);
      const typeMatch = typeFilter === 'all' || typeBucket === typeFilter;
      const statusMatch = statusFilter === 'all' || status === statusFilter;
      return queryMatch && typeMatch && statusMatch;
    });

    return sortAttachmentsForGallery(filtered, sortMode);
  }, [attachments, query, statusFilter, typeFilter, sortMode]);

  const health = getAttachmentHealthSummary(attachments);
  const collectionResolved = loadedFor === `device:${principal?.principalId || 'active'}` && !loading && !error;

  const beginRelink = (attachment) => {
    setEditingAttachment(attachment);
    setSelectedParentKeys(attachment.parentLinks.map(getParentKey));
  };

  const saveRelink = async (event) => {
    event.preventDefault();
    if (!editingAttachment || !selectedParentKeys.length) {
      showToast('Link the attachment to at least one Moment or Activity.', 'danger');
      return;
    }
    setSavingLinks(true);
    try {
      const parentLinks = selectedParentKeys.map((key) => {
        const [parentType, ...parentIdParts] = key.split(':');
        return { parentType, parentId: parentIdParts.join(':') };
      });
      await updateAttachmentLinks(principal?.principalId, editingAttachment.id || editingAttachment.attachmentId, parentLinks);
      setEditingAttachment(null);
      showToast('Attachment links updated', 'success');
    } catch (error) {
      showToast(error?.message || 'Attachment links could not be updated.', 'danger');
    } finally {
      setSavingLinks(false);
    }
  };

  return (
    <div className="attachment-library-page">
      <header className="attachment-library-heading">
        <div>
          <div className="attachment-library-eyebrow">Your local collection</div>
          <h1>Attachments</h1>
          <p>Files and references connected to your Moments and Activities.</p>
        </div>
        <span className="attachment-library-count">{collectionResolved ? health.total : '—'} {collectionResolved ? health.total === 1 ? 'attachment' : 'attachments' : 'attachments'}</span>
      </header>

      <section className="attachment-health-grid" aria-label="Attachment status summary">
        <SummaryTile label="Available" value={collectionResolved ? health.available : '—'} Icon={CheckCircle2} tone="available" />
        <SummaryTile label="On This Device" value={collectionResolved ? health.onDevice : '—'} Icon={HardDrive} tone="on-device" />
        <SummaryTile label="Reference Only" value={collectionResolved ? health.referenceOnly : '—'} Icon={Link2} tone="reference-only" />
        <SummaryTile label="Unavailable" value={collectionResolved ? health.unavailable : '—'} Icon={AlertCircle} tone="unavailable" />
      </section>

      <section className="attachment-library-toolbar" aria-label="Search and filter attachments">
        <label className="attachment-library-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by file or Moment / Activity" aria-label="Search attachment name or linked parent" />
        </label>
        <div className="attachment-library-filters">
          <FilterSelect label="Type" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          <FilterSelect label="Sort" value={sortMode} onChange={setSortMode} options={SORT_OPTIONS} />
        </div>
      </section>

      <section className="attachment-library-list" aria-label="Attachment library">
        {error === 'Unable to load events.' ? (
          <StatePanel variant="error" icon={AlertCircle} title="Attachments couldn’t be loaded" description="The attachment library is based on your saved Moments. Try again to reload them." actionLabel="Try again" onAction={() => loadEvents(principal?.principalId)} />
        ) : loading || (!loadedFor && !events.length) ? (
          <StatePanel variant="loading" icon={ImageIcon} title="Loading attachments" description="Checking your local collection and linked records." />
        ) : visibleAttachments.length ? visibleAttachments.map((attachment) => (
          <LibraryAttachmentCard
            key={attachment.id || attachment.attachmentId}
            attachment={attachment}
            getAttachmentBlob={getAttachmentBlob}
            onRelink={() => beginRelink(attachment)}
          />
        )) : <StatePanel variant="empty" icon={ImageIcon} title={attachments.length ? 'No attachments match these filters' : 'Your attachment library is ready'} description={attachments.length ? 'Try a different search or clear one of the filters.' : 'Add a photo, receipt, or document to a Moment or Activity to see it here.'} />}
      </section>

      {editingAttachment ? <ModalDialog title="Manage attachment links" onClose={() => setEditingAttachment(null)}>
        <form className="attachment-link-editor" onSubmit={(event) => void saveRelink(event)}>
          <p>Select one or more Moments or Activities. This changes links on the existing attachment; it does not create a duplicate.</p>
          <div className="attachment-link-options">
            {parentOptions.map((parent) => <label key={parent.key}>
              <input type="checkbox" checked={selectedParentKeys.includes(parent.key)} onChange={(event) => setSelectedParentKeys((current) => event.target.checked ? [...new Set([...current, parent.key])] : current.filter((key) => key !== parent.key))} />
              <span><strong>{parent.parentType === 'moment' ? 'Moment' : 'Activity'}:</strong> {parent.parentName}{parent.parentType === 'activity' && parent.momentName ? <small>{parent.momentName}</small> : null}</span>
            </label>)}
          </div>
          <div className="attachment-link-editor-actions">
            <button type="button" className="secondaryButton" onClick={() => setEditingAttachment(null)}>Cancel</button>
            <button type="submit" className="primaryButton" disabled={savingLinks}>{savingLinks ? 'Saving…' : 'Save links'}</button>
          </div>
        </form>
      </ModalDialog> : null}
    </div>
  );
}

function LibraryAttachmentCard({ attachment, getAttachmentBlob, onRelink }) {
  const [localPreview, setLocalPreview] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const mimeType = String(attachment.mimeType || attachment.type || '').toLowerCase();
  const imageLike = mimeType.startsWith('image/');
  const reference = attachment.previewReference || attachment.fileReference || attachment.url || '';
  const [localFileMissing, setLocalFileMissing] = useState(false);
  const resolvedAttachment = localFileMissing ? { ...attachment, hasLocalCopy: false } : attachment;
  const status = getAttachmentStatus(resolvedAttachment);
  const previewSource = localPreview || (imageLike && /^https?:\/\//i.test(reference) ? reference : '');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (attachment.hasLocalCopy) {
      void getAttachmentBlob(attachment.userId, attachment.id || attachment.attachmentId).then((blob) => {
        if (!active) return;
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setLocalPreview(objectUrl);
        } else {
          setLocalFileMissing(true);
        }
      }).catch(() => { if (active) setLocalFileMissing(true); });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.hasLocalCopy, attachment.userId, attachment.id, attachment.attachmentId, getAttachmentBlob]);

  const fileLabel = getAttachmentTypeLabel(attachment);
  const preview = imageLike && previewSource && !previewFailed && status.value !== 'unavailable';
  const openTarget = status.value === 'unavailable' ? '' : localPreview || (/^https?:\/\//i.test(reference) ? reference : '');
  const PreviewIcon = fileLabel === 'Image' ? ImageIcon : FileText;

  return (
    <article className="attachment-library-card">
      {preview ? <a className="attachment-library-thumb" href={previewSource} target="_blank" rel="noreferrer" aria-label={`Open ${attachment.name || 'attachment'}`}>
        <img src={previewSource} alt="" loading="lazy" onError={() => setPreviewFailed(true)} />
      </a> : <div className={`attachment-library-thumb attachment-library-thumb-placeholder${status.value === 'unavailable' ? ' is-unavailable' : ''}`} aria-label={status.value === 'unavailable' ? 'File unavailable' : `${fileLabel} file`}>
        <PreviewIcon size={23} aria-hidden="true" />
        {status.value === 'unavailable' ? <span>Unavailable</span> : null}
      </div>}
      <div className="attachment-library-card-main">
        <strong className="attachment-library-file-name"><Link to={`/attachments/${attachment.id || attachment.attachmentId}`} state={{ from: '/attachments' }}>{attachment.name || 'Untitled attachment'}</Link></strong>
        <div className="attachment-library-metadata"><span>{fileLabel}</span><span>{formatBytes(Number(attachment.size || 0))}</span><span>{formatDate(attachment.createdAt || attachment.updatedAt)}</span></div>
        <div className="attachment-library-parent-links" aria-label="Linked to">
          <strong>Linked to:</strong>
          {attachment.parentLinks.length ? attachment.parentLinks.map((link) => <span className="attachment-parent-chip" key={getParentKey(link)}>
            {link.route ? <Link to={link.route}>{link.parentType === 'moment' ? 'Moment' : 'Activity'} · {link.parentName}</Link> : <span>{link.parentType === 'moment' ? 'Moment' : 'Activity'} · {link.parentName}</span>}
          </span>) : <span className="attachment-parent-chip">Not linked</span>}
        </div>
      </div>
      <div className="attachment-library-card-actions">
        <AttachmentStatusBadge attachment={resolvedAttachment} small />
        {openTarget ? <a className="attachment-manage-links-button" href={openTarget} target="_blank" rel="noreferrer">Open</a> : null}
        <button type="button" className="attachment-manage-links-button" onClick={onRelink}>Manage links</button>
      </div>
    </article>
  );
}

function SummaryTile({ label, value, Icon, tone }) {
  return <div className="attachment-health-tile" data-tone={tone}>
    <div><Icon size={15} aria-hidden="true" /><span>{label}</span></div>
    <strong>{value}</strong>
  </div>;
}

function FilterSelect({ label, value, onChange, options }) {
  return <label className="attachment-filter-select">
    <SlidersHorizontal size={14} aria-hidden="true" />
    <span>{label}</span>
    <DropdownSelect value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Filter attachments by ${label.toLowerCase()}`}>
      {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
    </DropdownSelect>
  </label>;
}

const TYPE_OPTIONS = [['all', 'All types'], ['image', 'Images'], ['pdf', 'PDFs'], ['document', 'Documents']];
const STATUS_OPTIONS = [['all', 'All statuses'], ['available', 'Available'], ['on-device', 'On This Device'], ['reference-only', 'Reference Only'], ['unavailable', 'Unavailable']];
const SORT_OPTIONS = [['recent', 'Most recent'], ['oldest', 'Oldest'], ['name', 'Name'], ['type', 'Type'], ['status', 'Status']];
