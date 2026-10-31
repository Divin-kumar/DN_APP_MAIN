import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import ActivityTimeField from '../../../components/common/ActivityTimeField';
import DateField from '../../../components/common/DateField';
import RichText from '../../../components/common/RichText';
import RichTextEditor from '../../../components/common/RichTextEditor';
import { activityEntries, orderedActivityEntries, ENTRY_MODES } from '../../../utils/activityEntries';

// One Activity can contain distinct timed journal/diary notes. Only child
// records are edited here; Activity ID, attached originals and costs stay put.
export default function ActivityEntryTimeline({ activity, actions, target }) {
  const [draft, setDraft] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const entries = orderedActivityEntries(activity);
  if (!entries.length) return null;
  const isDaily = activity.entryMode === ENTRY_MODES.DAILY;
  const save = async (event) => {
    event.preventDefault();
    if (!draft?.title?.trim()) return;
    try {
      await actions.saveEntry(target, draft.id, { title: draft.title.trim(),
        description: draft.description || '', date: isDaily ? activity.date : draft.date,
        time: draft.time });
      setDraft(null);
    } catch { /* The scoped writer shows the error in Activity Detail. */ }
  };
  return <section className="dn-activity-entry-timeline activity-detail-section" aria-label={isDaily ? 'Daily diary entries' : 'Appended Journal entries'}>
    <div className="dn-activity-entry-heading">
      <h2>{isDaily ? 'Entries for this day' : 'Appended entries'}</h2>
      <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
    </div>
    <div className="dn-activity-entry-items">
      {entries.map((entry) => <article key={entry.id} className="dn-activity-entry-item" id={`entry-${entry.id}`}>
        <div className="dn-activity-entry-top">
          <time>{entry.time || 'No time'}</time>
          <div className="dn-activity-entry-actions">
            <button type="button" aria-label={`Edit entry ${entry.title || ''}`} disabled={actions.busy}
              onClick={() => setDraft({ ...entry, date: entry.date || activity.date, time: entry.time || '' })}><Pencil size={15} /></button>
            <button type="button" aria-label={`Delete entry ${entry.title || ''}`} disabled={actions.busy}
              onClick={() => setDeleting(entry)}><Trash2 size={15} /></button>
          </div>
        </div>
        <strong>{entry.title || 'Untitled entry'}</strong>
        {!isDaily && entry.date && entry.date !== activity.date ? <small>{entry.date}</small> : null}
        {entry.description ? <RichText value={entry.description} className="free-text-content" /> : null}
      </article>)}
    </div>
    {draft ? <ModalDialog title="Edit entry" onClose={() => { if (!actions.busy) setDraft(null); }}>
      <form className="dn-activity-entry-editor" onSubmit={save}>
        <label htmlFor="dn-entry-title">Entry title</label>
        <input id="dn-entry-title" value={draft.title} required disabled={actions.busy}
          onChange={(e) => setDraft((old) => ({ ...old, title: e.target.value }))} />
        {!isDaily ? <DateField label="Date" name="entry-date" value={draft.date}
          disabled={actions.busy} onChange={(e) => setDraft((old) => ({ ...old, date: e.target.value }))} /> : null}
        <ActivityTimeField value={draft.time || ''} disabled={actions.busy}
          onChange={(time) => setDraft((old) => ({ ...old, time }))} />
        <RichTextEditor label="Entry notes" value={draft.description} disabled={actions.busy}
          onChange={(description) => setDraft((old) => ({ ...old, description }))} />
        <div className="dialog-actions">
          <button type="button" className="secondaryButton" disabled={actions.busy} onClick={() => setDraft(null)}>Cancel</button>
          <button type="submit" className="primaryButton" disabled={actions.busy || !draft.title.trim()}>Save entry</button>
        </div>
      </form>
    </ModalDialog> : null}
    {deleting ? <ConfirmDialog title="Remove entry?" message={`Remove “${deleting.title || 'Untitled entry'}” from this Activity? Other entries, photos, transactions and original files remain.`}
      busy={actions.busy} onCancel={() => setDeleting(null)}
      onConfirm={() => actions.deleteEntry(target, deleting.id).then(() => setDeleting(null)).catch(() => {})} /> : null}
  </section>;
}
