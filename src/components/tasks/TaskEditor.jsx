import { useLayoutEffect, useRef, useState } from 'react';
import DateField from '../common/DateField';
import ActivityTimeField from '../common/ActivityTimeField';
import FormDisclosure from '../common/FormDisclosure';
import RepeatField from '../common/RepeatField';
import { formatMomentDate } from '../../utils/momentDates.js';
import DropdownSelect from '../common/DropdownSelect';
import { recordId } from '../../utils/recordIdentity.js';
import { resolveIndependentTaskParent } from '../../utils/independentTasks.js';
import { REPEAT_OPTIONS } from '../../utils/repeatSchedule.js';

// Keep drafts local until Save. An absent parent is never silently unlinked.
export default function TaskEditor({ task, moments = [], onSave, onClose, onTaskAction, busy = false, error = '' }) {
  const [pendingAction, setPendingAction] = useState(null);
  const confirmationRef = useRef(null);
  const actionGroupRef = useRef(null);
  const previousActionRef = useRef(null);
  useLayoutEffect(() => {
    if (pendingAction) confirmationRef.current?.focus();
    else if (previousActionRef.current) actionGroupRef.current?.querySelector(`[data-task-action="${previousActionRef.current}"]`)?.focus();
    previousActionRef.current = pendingAction;
  }, [pendingAction]);
  const [title, setTitle] = useState(task?.title || '');
  const [notes, setNotes] = useState(task?.notes || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.id ? (task.dueDate || '') : (task?.dueDate || formatMomentDate(new Date())));
  const [dueTime, setDueTime] = useState(task?.dueTime || '');
  const [repeatFrequency, setRepeatFrequency] = useState(task?.repeat?.frequency || '');
  const [momentId, setMomentId] = useState(recordId(task?.momentId));
  const [activityId, setActivityId] = useState(recordId(task?.activityId));
  const unresolved = resolveIndependentTaskParent({ momentId, activityId }, moments);
  const parent = unresolved.moment;
  const momentAlias = parent && (recordId(parent.id) || recordId(parent.firestoreId)) !== momentId;
  const savedAlias = Boolean(activityId && !(parent?.activities || []).some((item) => recordId(item.id) === activityId));
  const save = (event) => {
    event.preventDefault();
    if (!busy && title.trim()) onSave({ ...task, title: title.trim(), notes, priority, dueDate, dueTime, momentId, activityId, repeatFrequency });
  };

  if (pendingAction) return <div className="dn-task-editor dn-task-action-confirm">
    <h4 ref={confirmationRef} tabIndex={-1}>{pendingAction === 'delete' ? 'Delete Task?' : pendingAction === 'restore' ? 'Restore Task?' : 'Cancel Task?'}</h4>
    <p>{pendingAction === 'delete'
      ? `Remove “${task.title}”? Its Moment and Activities will not be changed.`
      : pendingAction === 'restore' ? `Move “${task.title}” back to In progress?`
        : `Mark “${task.title}” as cancelled? You can restore it later.`}</p>
    {task.repeat && pendingAction !== 'restore' ? <p>{pendingAction === 'delete'
      ? 'This will end the repeat schedule.' : 'The repeat schedule pauses until you restore this Task.'}</p> : null}
    <p>Unsaved edits will not be saved.</p>
    {error ? <p className="dn-task-feedback" role="alert">{error}</p> : null}
    <div className="dn-task-form-actions">
      <button type="button" className="secondaryButton" disabled={busy} onClick={() => setPendingAction(null)}>Keep editing</button>
      <button type="button" className={pendingAction === 'restore' ? 'primaryButton' : 'modal-danger-button'} disabled={busy} onClick={() => onTaskAction(pendingAction)}>
        {pendingAction === 'delete' ? 'Delete Task' : pendingAction === 'restore' ? 'Restore Task' : 'Cancel Task'}
      </button>
    </div>
  </div>;

  return <form className="dn-task-editor" onSubmit={save} aria-busy={busy}>
    <label className="dn-task-field">Task title
      <input disabled={busy} required maxLength={500} autoComplete="off" value={title}
        onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" />
    </label>
    <div className="dn-task-date-row activity-date-time-row" role="group" aria-label="Task due date and time">
      <DateField label="Due date" name="dn-task-date" value={dueDate} disabled={busy} required={Boolean(repeatFrequency)}
        onChange={(event) => { setDueDate(event.target.value); if (!event.target.value) setDueTime(''); }} />
      <ActivityTimeField value={dueTime} onChange={setDueTime} subject="Task" disabled={busy || !dueDate} />
    </div>
    {!dueDate ? <p className="dn-task-time-hint">Choose a due date to set a time.</p> : null}
    <FormDisclosure label="More options" hint={repeatFrequency ? `Repeats ${REPEAT_OPTIONS[repeatFrequency].toLowerCase()}`
      : momentId ? "Linked Moment · priority and notes" : "Priority, links and notes"}>
    {task?.status !== 'completed' ? <RepeatField className="dn-task-field" value={repeatFrequency}
      onChange={setRepeatFrequency} disabled={busy}>
      Done or Skip schedules the next Task. Each new occurrence starts without links.
    </RepeatField> : null}
    <div className="dn-task-fields-row">
      <div className="dn-task-field"><label htmlFor="dn-task-priority">Priority</label>
        <DropdownSelect disabled={busy} id="dn-task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </DropdownSelect>
      </div>
      <div className="dn-task-field"><label htmlFor="dn-task-moment">Moment (optional)</label>
        <DropdownSelect disabled={busy} id="dn-task-moment" value={momentId} onChange={(event) => { setMomentId(event.target.value); setActivityId(''); }}>
          <option value="">Standalone Task</option>
          {moments.map((item) => <option key={recordId(item.id) || recordId(item.firestoreId)}
            value={recordId(item.id) || recordId(item.firestoreId)}>{item.name || 'Untitled Moment'}</option>)}
          {momentAlias ? <option value={momentId}>{parent.name || 'Untitled Moment'}</option> : null}
          {momentId && !parent ? <option value={momentId}>Unavailable Moment (preserve link)</option> : null}
        </DropdownSelect>
      </div>
    </div>
    {momentId ? <div className="dn-task-field"><label htmlFor="dn-task-activity">Activity (optional)</label>
      <DropdownSelect disabled={busy} id="dn-task-activity" value={activityId} onChange={(event) => setActivityId(event.target.value)}>
        <option value="">Only link to Moment</option>
        {(parent?.activities || []).map((item) => <option key={recordId(item.id)} value={recordId(item.id)}>{item.title || 'Untitled Activity'}</option>)}
        {savedAlias ? <option value={activityId}>{unresolved?.kind === 'activity'
          ? 'Historical Activity link (preserved)' : 'Unavailable Activity (preserve link)'}</option> : null}
      </DropdownSelect>
    </div> : null}
    <label className="dn-task-field">Notes (optional)
      <textarea disabled={busy} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)}
        placeholder="Helpful details" />
    </label>
    </FormDisclosure>
    {task?.id && onTaskAction ? <div ref={actionGroupRef} className="dn-task-editor-actions" role="group" aria-label="Task actions">
      {task.status === 'cancelled'
        ? <button type="button" disabled={busy} data-task-action="restore" onClick={() => setPendingAction('restore')}>Restore Task…</button>
        : <button type="button" disabled={busy} data-task-action="cancel" onClick={() => setPendingAction('cancel')}>Cancel Task…</button>}
      <button type="button" disabled={busy} data-task-action="delete" className="is-destructive" onClick={() => setPendingAction('delete')}>Delete Task…</button>
    </div> : null}
    {error ? <p className="dn-task-feedback" role="alert">{error}</p> : null}
    <div className="form-actions dn-task-form-actions">
      <button type="button" className="secondaryButton" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="submit" className="primaryButton" disabled={busy || !title.trim()}>{busy ? 'Saving…' : task?.id ? 'Save Task' : 'Create Task'}</button>
    </div>
  </form>;
}
