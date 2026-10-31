import { recordId } from './recordIdentity.js';
import { resolveMomentStoryPresentation, STORY_PRESENTATIONS } from './momentStory.js';

// A Detail URL is not itself proof that the selected Activity still belongs
// to this Moment. Check both IDs in the loaded, account-scoped record set.
export const resolveQuickCreateMoment = (moments, detailParams, workspaceMoment = null) => {
  if (!detailParams) return workspaceMoment || null;
  const parentId = recordId(detailParams.eventId);
  const activityId = recordId(detailParams.activityId);
  if (!parentId || !activityId) return null;
  return (moments || []).find((moment) => (
    (recordId(moment?.id) || recordId(moment?.firestoreId)) === parentId
    && moment?.activities?.some((activity) => recordId(activity.id) === activityId)
  )) || null;
};

// Journal/Diary chapters are stored as ordinary Activities under their parent
// Moment. Only the form language changes; Tasks remain task-style Activities.
export const quickActivityEntryKind = (moment, momentTypes = []) => {
  if (!moment) return 'activity';
  const presentation = resolveMomentStoryPresentation(moment, momentTypes);
  if (presentation === STORY_PRESENTATIONS.DIARY) return 'diary entry';
  if (presentation === STORY_PRESENTATIONS.JOURNEY) return 'journal entry';
  return 'activity';
};
