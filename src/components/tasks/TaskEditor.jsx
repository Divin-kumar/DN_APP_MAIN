import { useState } from 'react';
import DateField from '../common/DateField';
import ActivityTimeField from '../common/ActivityTimeField';
import DropdownSelect from '../common/DropdownSelect';
import { recordId } from '../../utils/recordIdentity.js';
import { resolveIndependentTaskParent } from '../../utils/independentTasks.js';

// Keep drafts local until Save. An absent parent is never silently unlinked.
export default function TaskEditor({ task, moments = [], onSave, onClose, error = '' }) {
  const [title, setTitle] = useState(task?.title || '');
  const [notes, setNotes] = useState(task?.notes || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [dueTime, setDueTime] = useState(task?.dueTime || '');
  const [momentId, setMomentId] = useState(task?.momentId || '');
  const [activityId, setActivityId] = useState(task?.activityId || '');
  const parent = moments.find((item) => (recordId(item.id) || recordId(item.firestoreId)) === momentId);
  const unresolved = task && resolveIndependentTaskParent({ ...task, momentId, activityId }, moments);
  const savedAlias = Boolean(activityId && !(parent?.activities || []).some((item) => recordId(item.id) === activityId));
  const save = (event) => {
    event.preventDefault();
    if (title.trim()) onSave({ ...task, title: title.trim(), notes, priority, dueDate, dueTime, momentId, activityId });
  };

  return <form className="dn-task-editor" onSubmit={save}>
    <label className="dn-task-field">Task title
      <input required maxLength={500} autoComplete="off" value={title}
        onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" />
    </label>
    <label className="dn-task-field">Notes (optional)
      <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)}
        placeholder="Helpful details" />
    </label>
    <div className="dn-task-date-row">
      <DateField label="Due date (optional)" name="dn-task-date" value={dueDate}
        onChange={(event) => { setDueDate(event.target.value); if (!event.target.value) setDueTime(''); }} />
      <ActivityTimeField value={dueTime} onChange={setDueTime} subject="Task" disabled={!dueDate} />
    </div>
    <div className="dn-task-fields-row">
      <div className="dn-task-field"><label htmlFor="dn-task-priority">Priority</label>
        <DropdownSelect id="dn-task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </DropdownSelect>
      </div>
      <div className="dn-task-field"><label htmlFor="dn-task-moment">Moment (optional)</label>
        <DropdownSelect id="dn-task-moment" value={momentId} onChange={(event) => { setMomentId(event.target.value); setActivityId(''); }}>
          <option value="">Standalone Task</option>
          {moments.map((item) => <option key={recordId(item.id) || recordId(item.firestoreId)}
            value={recordId(item.id) || recordId(item.firestoreId)}>{item.name || 'Untitled Moment'}</option>)}
          {momentId && !parent ? <option value={momentId}>Unavailable Moment (preserve link)</option> : null}
        </DropdownSelect>
      </div>
    </div>
    {momentId ? <div className="dn-task-field"><label htmlFor="dn-task-activity">Activity (optional)</label>
      <DropdownSelect id="dn-task-activity" value={activityId} onChange={(event) => setActivityId(event.target.value)}>
        <option value="">Only link to Moment</option>
        {(parent?.activities || []).map((item) => <option key={recordId(item.id)} value={recordId(item.id)}>{item.title || 'Untitled Activity'}</option>)}
        {savedAlias ? <option value={activityId}>{unresolved?.kind === 'activity'
          ? 'Historical Activity link (preserved)' : 'Unavailable Activity (preserve link)'}</option> : null}
      </DropdownSelect>
    </div> : null}
    {error ? <p className="dn-task-feedback" role="alert">{error}</p> : null}
    <div className="form-actions dn-task-form-actions">
      <button type="button" className="secondaryButton" onClick={onClose}>Cancel</button>
      <button type="submit" className="primaryButton" disabled={!title.trim()}>{task?.id ? 'Save Task' : 'Create Task'}</button>
    </div>
  </form>;
}
