import { useState } from 'react';
import { Pencil } from 'lucide-react';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import RichText from '../../../components/common/RichText';
import RichTextEditor from '../../../components/common/RichTextEditor';
import DateField from '../../../components/common/DateField';
import ActivityTimeField from '../../../components/common/ActivityTimeField';
import { orderedUnifiedContent } from '../../../utils/activityEntries';
import { parseMomentDate } from '../../../utils/momentDates';

// A linear reading surface. Legacy root descriptions and historical nested
// entries are rendered as content rows without changing their stored identity.
const readableDate = (value) => {
  const date = parseMomentDate(value);
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not recorded';
};
const readableTime = (value) => {
  if (!value) return 'Time not recorded';
  const [hours, minutes] = value.split(':').map(Number);
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 1, hours, minutes)));
};

export default function ActivityEntryTimeline({ activity, actions, target }) {
  const [draft, setDraft] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const rows = orderedUnifiedContent(activity);
  const save = async (event) => {
    event.preventDefault();
    if (!draft?.description?.trim() || !draft.date) return;
    try {
      if (draft.root) {
        // The existing Activity edit path retains the root description and ID.
        setDraft(null);
        actions.edit(target);
        return;
      }
      const changed = await actions.saveEntry(target, draft.id, {
        description: draft.description, date: draft.date, time: draft.time || '',
      });
      if (changed) setDraft(null);
    } catch { /* Scoped action displays the failure. */ }
  };
  return <section className="activity-detail-section dn-content-section" aria-label="Activity entries">
    <div className="dn-content-heading">
      <h2>Entries</h2>
      <span>{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
    </div>
    {rows.length ? <div className="dn-content-rows">{rows.map((row) => {
      const differentDay = !row.date || row.date !== activity.date;
      return <article className="dn-content-row" key={row.id}>
        <div className="dn-content-row-main">
          <div className="dn-content-row-meta">
            {differentDay ? <span className="dn-content-row-date">{readableDate(row.date)}</span> : null}
            <span className="dn-content-row-time">{readableTime(row.time)}</span>
          </div>
          <div className="dn-content-row-body">
            {!row.root && row.title ? <strong className="dn-content-legacy-title">{row.title}</strong> : null}
            {row.description ? <RichText value={row.description} className="free-text-content" /> : null}
          </div>
        </div>
        <div className="dn-content-row-actions">
          <button type="button" aria-label={row.root ? 'Edit original activity writing' : 'Edit entry'}
            title="Edit" disabled={actions.busy} onClick={() => row.root
              ? actions.edit(target) : setDraft({ ...row, date: row.date || activity.date })}>
            <Pencil size={15} aria-hidden="true" />
          </button>
          {!row.root ? <button type="button" disabled={actions.busy} className="dn-content-remove"
            onClick={() => setDeleting(row)} aria-label="Delete entry">Delete</button> : null}
        </div>
      </article>;
    })}</div> : <p className="dn-content-empty">No entries yet. Use + and choose Add entry to write your first update.</p>}
    {draft ? <ModalDialog title="Edit entry" onClose={() => { if (!actions.busy) setDraft(null); }}>
      <form className="form-surface dn-entry-edit-form" aria-busy={actions.busy} onSubmit={save}>
        <RichTextEditor label="Entry content" value={draft.description || ''} rows={5}
          disabled={actions.busy} onChange={(description) => setDraft((previous) => ({ ...previous, description }))} />
        <div className="activity-date-time-row">
          <DateField label="Date" name="dn-edit-entry-date" value={draft.date || activity.date}
            disabled={actions.busy} required onChange={(event) => setDraft((previous) => ({ ...previous, date: event.target.value }))} />
          <ActivityTimeField value={draft.time || ''} disabled={actions.busy}
            onChange={(time) => setDraft((previous) => ({ ...previous, time }))} />
        </div>
        <div className="dialog-actions">
          <button type="button" className="secondaryButton" disabled={actions.busy} onClick={() => setDraft(null)}>Cancel</button>
          <button type="submit" className="primaryButton" disabled={actions.busy || !draft.description.trim()}>Save entry</button>
        </div>
      </form>
    </ModalDialog> : null}
    {deleting ? <ConfirmDialog title="Delete entry?" message="Remove only this entry? The Activity, other entries, transactions and original attachment files remain."
      busy={actions.busy} onCancel={() => setDeleting(null)}
      onConfirm={() => actions.deleteEntry(target, deleting.id).then((changed) => { if (changed) setDeleting(null); }).catch(() => {})} /> : null}
  </section>;
}
