import DropdownSelect from '../common/DropdownSelect';
import { ENTRY_MODES, journalAppendCandidates, findDailyActivity, getMomentEntryMode } from '../../utils/activityEntries';

// Shared by the universal + and Moment workspace Activity composers.
// A Journal append is a user-selected destination, never an implicit merge.
export default function ActivityEntryModeFields({ moment, momentTypes = [], date, choice = 'new',
  targetId = '', onChoiceChange, onTargetChange, disabled = false }) {
  if (!moment) return null;
  const mode = getMomentEntryMode(moment, momentTypes);
  if (mode === ENTRY_MODES.TASKS) return <p className="dn-entry-mode-help">Every Task is a separate Activity with its own status and priority.</p>;
  if (mode === ENTRY_MODES.DAILY) {
    const existing = findDailyActivity(moment, date);
    return <p className="dn-entry-mode-help" role="status">
      {existing ? 'This entry will be added to the existing daily Activity.' : 'A single daily Activity will be created for this date.'}
    </p>;
  }
  const candidates = journalAppendCandidates(moment);
  return <div className="dn-entry-mode-picker">
    <label htmlFor="dn-journal-entry-choice">Journal entry</label>
    <DropdownSelect id="dn-journal-entry-choice" value={choice} disabled={disabled} aria-label="Journal entry action"
      onChange={(event) => { onChoiceChange(event.target.value); onTargetChange(''); }}>
      <option value="new">New entry · Separate memory</option>
      <option value="append" disabled={!candidates.length}>Append to existing entry</option>
    </DropdownSelect>
    {choice === 'append' ? <>
      <label htmlFor="dn-journal-append-target">Append to</label>
      <DropdownSelect id="dn-journal-append-target" value={targetId} disabled={disabled} aria-label="Journal append destination"
        onChange={(event) => onTargetChange(event.target.value)}>
        <option value="">Choose an existing memory</option>
        {[...candidates].sort((a, b) => (a.date === date ? -1 : 0) - (b.date === date ? -1 : 0))
          .map((activity) => <option key={activity.id} value={activity.id}>
            {activity.title || 'Untitled memory'} · {activity.date || 'No date'}
          </option>)}
      </DropdownSelect>
    </> : null}
    <small className="dn-entry-mode-help">
      {choice === 'append' ? 'Continue the selected memory. Your writing will appear directly below its existing text and remain editable.' : 'Start a separate memory with its own photos and transactions.'}
    </small>
  </div>;
}
