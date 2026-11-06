import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import ModalDialog from '../common/ModalDialog';
import { pdfContentInventory, pdfContentKey } from '../../utils/pdfContentSelection';

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
    return <button type="button" className="dn-pdf-content-choice" disabled={disabled || !key}
      aria-pressed={included} onClick={() => toggle(field, key)}
      aria-label={`${field === 'excludedActivities' ? 'Activity' : 'Attachment'}: ${item.title || item.name || 'Untitled'}`}>
      <span className="dn-pdf-content-tick" aria-hidden="true">{included ? <Check size={16} /> : null}</span>
      <span>{item.title || item.name || 'Untitled'}</span>
    </button>;
  };
  return <ModalDialog title="PDF content" onClose={onClose} variant="drawer" className="dn-pdf-content-sheet">
    <p className="dn-pdf-content-help">Choose activities and files for this Moment. Cancelled activities are always excluded.</p>
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
              <span>{attachments.length}</span><ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : undefined }} aria-hidden="true" />
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
    <p className="dn-pdf-content-help">Remembered for this Moment in this browser. Book section options in PDF Studio still apply.</p>
    <div className="dialog-actions dn-pdf-content-actions">
      <button type="button" className="secondaryButton" onClick={onClose}>Cancel</button>
      <button type="button" className="primaryButton" onClick={() => onApply(draft)}>Apply selection</button>
    </div>
  </ModalDialog>;
}
