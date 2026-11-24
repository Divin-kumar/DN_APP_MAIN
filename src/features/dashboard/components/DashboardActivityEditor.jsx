import ModalDialog, { DialogFormActions } from '../../../components/common/ModalDialog';
import { useId } from 'react';
import ActivityFormFields from '../../../components/events/ActivityFormFields';
import './DashboardActivityEditor.css';

// Detail and Dashboard use the same Activity fields as the Moment composer.
export default function DashboardActivityEditor({ draft, priorities, busy, error, fallbackFocusRef, onChange, onSubmit, onClose }) {
  const activityFormId = useId();
  return <ModalDialog title="Edit activity" className="event-activity-editor-modal dashboard-activity-editor-modal" formFooter closeDisabled={busy} fallbackFocusRef={fallbackFocusRef} onClose={onClose}>
    <form id={activityFormId} className="form-surface quick-create-activity-form dashboard-activity-editor" onSubmit={onSubmit} aria-busy={busy}>
      <p className="dashboard-activity-context">{draft.momentName || 'Moment'}</p>
      <ActivityFormFields value={draft} priorities={priorities} disabled={busy} onChange={onChange}
        titleLabel="Activity title" namePrefix="dashboard-activity"
        dateLocked={false} />
      <DialogFormActions>
        {error ? <p className="quick-create-error" role="alert">{error}</p> : null}
        <div className="form-actions">
          <button type="button" className="secondaryButton" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" form={activityFormId} className="primaryButton" disabled={busy}>{busy ? 'Saving…' : 'Save activity'}</button>
        </div>
      </DialogFormActions>
    </form>
  </ModalDialog>;
}
