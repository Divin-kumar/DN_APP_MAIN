import { recordId } from './recordIdentity.js';
import { ENTRY_MODES, getMomentEntryMode, journalAppendCandidates } from './activityEntries.js';

// The opened Activity, not a shared Activity ID or previous picker choice,
// determines the parent for Detail-origin universal + creation.
export const detailQuickActivityContext = (moments, params, momentTypes = []) => {
  const parentId = recordId(params?.eventId);
  const childId = recordId(params?.activityId);
  if (!parentId || !childId) return null;
  const moment = (moments || []).find((item) =>
    (recordId(item?.id) || recordId(item?.firestoreId)) === parentId);
  const activity = moment?.activities?.find((item) => recordId(item.id) === childId);
  if (!activity) return null;
  const mode = getMomentEntryMode(moment, momentTypes);
  // Only active Journal Activities can receive new nested entries. Cancelled
  // entries keep the existing explicit New/Append picker and safety rules.
  const appendJournal = mode === ENTRY_MODES.JOURNAL
    && journalAppendCandidates(moment).some((item) => recordId(item.id) === childId);
  return {
    moment, activity, mode,
    choice: appendJournal ? 'append' : 'new',
    targetId: appendJournal ? childId : '',
    // For Diary, the date is the identity of the daily container. Reusing its
    // calendar day ensures the standard Daily mode appends to that same day.
    date: mode === ENTRY_MODES.DAILY ? activity.date || '' : '',
  };
};
