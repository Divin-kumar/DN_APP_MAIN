import { recordId } from './recordIdentity.js';
import { getMomentEntryMode } from './activityEntries.js';

// Route ID and parent Moment ID jointly identify the opened Activity.
// No Diary date consolidation or Journal append target selection is permitted.
export const detailQuickActivityContext = (moments, params, momentTypes = []) => {
  const parentId = recordId(params?.eventId);
  const activityId = recordId(params?.activityId);
  if (!parentId || !activityId) return null;
  const moment = (moments || []).find((item) =>
    (recordId(item?.id) || recordId(item?.firestoreId)) === parentId);
  const activity = moment?.activities?.find((item) => recordId(item.id) === activityId);
  if (!activity) return null;
  return { moment, activity, mode: getMomentEntryMode(moment, momentTypes) };
};
