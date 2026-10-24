import ModalDialog from '../../../components/common/ModalDialog';
import DateField from '../../../components/common/DateField';
import DropdownSelect from '../../../components/common/DropdownSelect';
import RichTextEditor from '../../../components/common/RichTextEditor';
import { getActiveCodeListMeta } from '../../../utils/codeLists';
import './DashboardActivityEditor.css';

export default function DashboardActivityEditor({ draft, priorities, busy, error, onChange, onSubmit, onClose }) {
  const options = getActiveCodeListMeta('activityPriorities', priorities);
  return <ModalDialog title="Edit activity" className="event-activity-editor-modal dashboard-activity-editor-modal" onClose={onClose}>
    <form className="form-surface quick-create-activity-form dashboard-activity-editor" onSubmit={onSubmit} aria-busy={busy}>
      <p className="dashboard-activity-context">{draft.momentName || 'Moment'}</p>
      {error ? <p className="quick-create-error" role="alert">{error}</p> : null}
      <label htmlFor="dashboard-activity-title">Activity title</label>
      <input id="dashboard-activity-title" autoFocus required value={draft.title} disabled={busy}
        onChange={(event) => onChange({ title: event.target.value })} placeholder="Activity title" />
      <DateField label="Date" name="dashboard-activity-date" value={draft.date} required disabled={busy}
        onChange={(event) => onChange({ date: event.target.value })} />
      <label htmlFor="dashboard-activity-priority">Priority</label>
      <DropdownSelect id="dashboard-activity-priority" aria-label="Activity priority" value={draft.priority} disabled={busy}
        onChange={(event) => onChange({ priority: event.target.value })}>
        {!options.some((option) => option.value === draft.priority) ? <option value={draft.priority}>{draft.priority}</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </DropdownSelect>
      <RichTextEditor label="Activity notes" value={draft.description} disabled={busy}
        onChange={(description) => onChange({ description })} placeholder="Notes (optional)" />
      <div className="form-actions">
        <button type="submit" className="primaryButton" disabled={busy}>{busy ? 'Saving…' : 'Save activity'}</button>
        <button type="button" className="secondaryButton" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </form>
  </ModalDialog>;
}
