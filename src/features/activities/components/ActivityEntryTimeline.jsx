import { useState } from 'react';
import { Check, Pencil, RotateCcw, XCircle } from 'lucide-react';
import ModalDialog, { ConfirmDialog } from '../../../components/common/ModalDialog';
import RichText from '../../../components/common/RichText';
import SwipeActionCard from '../../../components/common/SwipeActionCard';
import ActivityFormFields from '../../../components/events/ActivityFormFields';
import useAppStore from '../../../store/useAppStore';
import { activityStatus, activityStatusLabel } from '../../../utils/activityDetail';
import { isActivityEditable } from '../../../utils/scopedRecordActions';
import { orderedActivityEntries, ENTRY_MODES } from '../../../utils/activityEntries';

// Entry edits never change the owning Activity ID, attachments or linked costs.
export default function ActivityEntryTimeline({ activity, actions, target }) {
  const priorities = useAppStore((state) => state.adminValues.activityPriorities);
  const [draft, setDraft] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const entries = orderedActivityEntries(activity);
  if (!entries.length) return null;
  const isDaily = activity.entryMode === ENTRY_MODES.DAILY;
  const save = async (event) => {
    event.preventDefault();
    if (!draft?.title?.trim()) return;
    try {
      await actions.saveEntry(target, draft.id, {
        title: draft.title.trim(), description: draft.description || '',
        date: isDaily ? activity.date : draft.date,
        time: draft.time, priority: draft.priority,
      });
      setDraft(null);
    } catch { /* Scoped Activity Detail displays the failure. */ }
  };
  const editEntry = (entry) => setDraft({
    ...entry, date: isDaily ? activity.date : entry.date || activity.date,
    time: entry.time || '', priority: entry.priority || activity.priority || 'medium',
  });
  return <section className={`dn-activity-entry-timeline activity-detail-section${isDaily ? '' : ' dn-journal-continuation-detail'}`} aria-label={isDaily ? 'Daily diary entries' : 'Journal entries'}>
    {isDaily ? <div className="dn-activity-entry-heading">
      <h2>Entries for this day</h2>
      <span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
    </div> : <h2 className="sr-only">Journal continuation</h2>}
    <div className="dn-activity-entry-items">
      {entries.map((entry) => {
        const status = activityStatus(entry);
        const menuActions = [
          ...(isActivityEditable(entry) ? [{ label: 'Edit', icon: Pencil, onClick: () => editEntry(entry) }] : []),
          status === 'cancelled'
            ? { label: 'Restore', icon: RotateCcw, onClick: () => actions.setEntryStatus(target, entry.id, 'in-progress') }
            : { label: status === 'completed' ? 'Reopen' : 'Complete',
                icon: status === 'completed' ? RotateCcw : Check,
                onClick: () => actions.setEntryStatus(target, entry.id, status === 'completed' ? 'in-progress' : 'completed') },
          ...(status !== 'cancelled' ? [{ label: 'Cancel', icon: XCircle,
            onClick: () => actions.setEntryStatus(target, entry.id, 'cancelled') }] : []),
        ];
        return <SwipeActionCard as="article" key={entry.id} className="dn-activity-entry-item"
          label={entry.title || 'Untitled entry'} menuButton menuLabel={`Entry options: ${entry.title || 'Untitled entry'}`}
          swipeEnabled={false} disabled={actions.busy} otherActions={menuActions}
          onDelete={() => setDeleting(entry)}>
          <div className="dn-activity-entry-top">
            <time dateTime={entry.date}>{entry.time || 'No time'}</time>
            <span className={`dn-activity-entry-status status-${status}`}>{activityStatusLabel(entry)}</span>
          </div>
          <strong>{entry.title || 'Untitled entry'}</strong>
          {!isDaily && entry.date && entry.date !== activity.date ? <small>{entry.date}</small> : null}
          {entry.description ? <RichText value={entry.description} className="free-text-content" /> : null}
        </SwipeActionCard>;
      })}
    </div>
    {draft ? <ModalDialog title="Edit entry" onClose={() => { if (!actions.busy) setDraft(null); }}>
      <form className="form-surface quick-create-activity-form dn-activity-entry-editor" onSubmit={save} aria-busy={actions.busy}>
        <p className="dashboard-activity-context">{isDaily ? 'Diary · ' + activity.date : 'Journal · ' + (activity.title || 'Memory')}</p>
        <ActivityFormFields namePrefix="dn-entry" mode={isDaily ? ENTRY_MODES.DAILY : ENTRY_MODES.JOURNAL}
          value={draft} priorities={priorities} dateLocked={isDaily} disabled={actions.busy}
          notesLabel="Entry notes"
          onChange={(patch) => setDraft((previous) => ({ ...previous, ...patch }))} />
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
