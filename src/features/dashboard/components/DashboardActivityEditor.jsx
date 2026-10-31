import ModalDialog from '../../../components/common/ModalDialog';
import ActivityFormFields from '../../../components/events/ActivityFormFields';
import './DashboardActivityEditor.css';

// Detail and Dashboard use the same Activity fields as the Moment composer.
export default function DashboardActivityEditor({ draft, priorities, busy, error, onChange, onSubmit, onClose }) {
  return <ModalDialog title="Edit activity" className="event-activity-editor-modal dashboard-activity-editor-modal" onClose={onClose}>
    <form className="form-surface quick-create-activity-form dashboard-activity-editor" onSubmit={onSubmit} aria-busy={busy}>
      <p className="dashboard-activity-context">{draft.momentName || 'Moment'}</p>
      {error ? <p className="quick-create-error" role="alert">{error}</p> : null}
      <ActivityFormFields value={draft} priorities={priorities} disabled={busy} onChange={onChange}
        namePrefix="dashboard-activity" />
      <div className="form-actions">
        <button type="submit" className="primaryButton" disabled={busy}>{busy ? 'Saving…' : 'Save activity'}</button>
        <button type="button" className="secondaryButton" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </form>
  </ModalDialog>;
}
