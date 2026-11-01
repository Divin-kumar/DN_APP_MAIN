import DropdownSelect from '../common/DropdownSelect';
import { ENTRY_MODES, journalAppendCandidates, findDailyActivity, getMomentEntryMode } from '../../utils/activityEntries';
import { recordId } from '../../utils/recordIdentity';

// Shared by the universal + and Moment workspace Activity composers.
// A Journal append is a user-selected destination, never an implicit merge.
export default function ActivityEntryModeFields({ moment, momentTypes = [], date, choice = 'new',
  targetId = '', onChoiceChange, onTargetChange, disabled = false,
  excludeActivityId = '', namePrefix = 'dn', editing = false, continuation = false }) {
  if (!moment) return null;
  const mode = getMomentEntryMode(moment, momentTypes);
  if (mode === ENTRY_MODES.TASKS) return <p className="dn-entry-mode-help">Every Task is a separate Activity with its own status and priority.</p>;
  if (mode === ENTRY_MODES.DAILY) {
    const existing = findDailyActivity(moment, date);
    return <p className="dn-entry-mode-help" role="status">
      {existing ? 'This entry will be added to the existing daily Activity.' : 'A single daily Activity will be created for this date.'}
    </p>;
  }
  const candidates = journalAppendCandidates(moment).filter((item) => recordId(item.id) !== recordId(excludeActivityId));
  const choiceId = `${namePrefix}-journal-entry-choice`;
  const targetFieldId = `${namePrefix}-journal-append-target`;
  return <div className="dn-entry-mode-picker">
    <label htmlFor={choiceId}>Journal entry</label>
    <DropdownSelect id={choiceId} value={choice} disabled={disabled} aria-label="Journal entry action"
      onChange={(event) => { onChoiceChange(event.target.value); onTargetChange(''); }}>
      <option value="new">New entry · Separate memory</option>
      <option value="append" disabled={!candidates.length}>Append to existing entry</option>
    </DropdownSelect>
    {choice === 'append' ? <>
      <label htmlFor={targetFieldId}>Append to</label>
      <DropdownSelect id={targetFieldId} value={targetId} disabled={disabled} aria-label="Journal append destination"
        onChange={(event) => onTargetChange(event.target.value)}>
        <option value="">Choose an existing memory</option>
        {[...candidates].sort((a, b) => (a.date === date ? -1 : 0) - (b.date === date ? -1 : 0))
          .map((activity) => <option key={activity.id} value={activity.id}>
            {activity.title || 'Untitled memory'} · {activity.date || 'No date'}
          </option>)}
      </DropdownSelect>
    </> : null}
    <small className="dn-entry-mode-help">
      {editing ? (continuation
        ? choice === 'append' ? 'Keep this writing within the selected memory. Photos belonging to this entry follow it if moved; parent transactions stay with their original memory.' : 'Make this continuation a separate Journal memory. Only photos belonging to this entry move; parent transactions stay where they are.'
        : choice === 'append' ? 'Move this memory and its continuations into the selected entry. Existing photo and transaction links are preserved.' : 'Keep this memory separate. Your current writing, photos and transactions stay intact.')
        : choice === 'append' ? 'Continue the selected memory. Your writing will appear directly below its existing text and remain editable.' : 'Start a separate memory with its own photos and transactions.'}
    </small>
  </div>;
}
