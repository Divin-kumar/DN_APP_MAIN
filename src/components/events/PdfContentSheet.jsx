import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FileText, ImageOff, BookOpen, Minus } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import useAttachmentOriginal from '../../hooks/useAttachmentOriginal';
import { isAttachmentImage } from '../../utils/activityDetail';
import ModalDialog from '../common/ModalDialog';
import { pdfContentInventory, pdfContentKey } from '../../utils/pdfContentSelection';

function PhotoThumbnail({ attachment }) {
  const uid = useAppStore(state => state.user?.uid || null);
  const isGuest = useAppStore(state => state.isGuest);
  const container = useRef(null);
  const [nearby, setNearby] = useState(false);
  const [broken, setBroken] = useState('');
  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') { setNearby(true); return undefined; }
    const observer = new IntersectionObserver(entries => setNearby(entries.some(entry => entry.isIntersecting)), { rootMargin: '80px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const original = useAttachmentOriginal(attachment, { uid, isGuest, enabled: nearby });
  const ready = original.source && !original.error && broken !== original.source;
  return <span ref={container} className="dn-pdf-content-thumbnail" aria-hidden="true">
    {ready ? <img src={original.source} alt="" loading="lazy" onError={() => setBroken(original.source)} />
      : <ImageOff size={17} strokeWidth={1.6} />}
  </span>;
}

export default function PdfContentSheet({ event, selection, onApply, onClose }) {
  const [draft, setDraft] = useState(selection);
  const [expanded, setExpanded] = useState([]);
  const inventory = pdfContentInventory(event);
  const toggle = (field, key) => setDraft(current => ({ ...current,
    [field]: current[field].includes(key) ? current[field].filter(id => id !== key) : [...current[field], key],
  }));
  const choice = (item, field, disabled = false) => {
    const key = pdfContentKey(item);
    const included = !disabled && !draft[field].includes(key);
    const Icon = field === 'excludedActivities' ? BookOpen : FileText;
    const photo = field === 'excludedAttachments' && isAttachmentImage(item.type);
    return <button type="button" className="dn-pdf-content-choice" disabled={disabled || !key}
      aria-pressed={included} onClick={() => toggle(field, key)}
      aria-label={`${field === 'excludedActivities' ? 'Activity' : 'Attachment'}: ${item.title || item.name || 'Untitled'}`}>
      <>{photo ? <PhotoThumbnail attachment={item} /> : <Icon className="dn-pdf-content-kind" size={18} strokeWidth={1.6} aria-hidden="true" />}</>
      <span className="dn-pdf-content-name">{item.title || item.name || 'Untitled'}</span>
      <span className="dn-pdf-content-tick" aria-hidden="true">{included ? <Check size={17} strokeWidth={2} /> : <Minus size={15} />}</span>
    </button>;
  };
  return <ModalDialog title="PDF content" onClose={onClose} variant="drawer" className="dn-pdf-content-sheet">
    <p className="dn-pdf-content-help">Keep what belongs in your book. Tap a row to include or leave it out.</p>
    <button type="button" className="dn-pdf-content-reset" onClick={() => setDraft({ excludedActivities: [], excludedAttachments: [] })}>Select all / Reset</button>
    <div className="dn-pdf-content-list">
      {inventory.activities.map(({ activity, attachments }) => {
        const key = pdfContentKey(activity);
        const open = expanded.includes(key);
        return <div key={key}>
          <div className="dn-pdf-content-activity">
            {choice(activity, 'excludedActivities')}
            {attachments.length ? <button type="button" className="dn-pdf-content-expand"
              aria-label={`Attachments for ${activity.title || 'Untitled'}`} aria-expanded={open}
              onClick={() => setExpanded(current => open ? current.filter(id => id !== key) : [...current, key])}>
              <span>{attachments.length} {attachments.length === 1 ? 'file' : 'files'}</span><ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} aria-hidden="true" />
            </button> : null}
          </div>
          {open ? <div className="dn-pdf-content-files">
            {attachments.map(file => <div key={pdfContentKey(file)}>{choice(file, 'excludedAttachments', draft.excludedActivities.includes(key))}</div>)}
          </div> : null}
        </div>;
      })}
      {inventory.attachments.length ? <><h4>Moment attachments</h4>
        {inventory.attachments.map(file => <div key={pdfContentKey(file)}>{choice(file, 'excludedAttachments')}</div>)}
      </> : null}
      {!inventory.activities.length && !inventory.attachments.length ? <p>No eligible activities or attachments yet.</p> : null}
    </div>
    <p className="dn-pdf-content-help">Saved for this Moment on this device. Cancelled activities stay out.</p>
    <div className="dialog-actions dn-pdf-content-actions">
      <button type="button" className="secondaryButton" onClick={onClose}>Cancel</button>
      <button type="button" className="primaryButton" onClick={() => onApply(draft)}>Apply selection</button>
    </div>
  </ModalDialog>;
}
