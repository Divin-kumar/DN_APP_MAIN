import { buildMomentStory } from './momentStory.js';
import { activityStatus } from './activityDetail.js';
import { recordId } from './recordIdentity.js';

// Filter only the PDF projection. Keep cancelled records and originals in storage.
export const buildMomentPdfStory = (moment = {}, context = {}) => {
  const activities = Array.isArray(moment.activities) ? moment.activities.filter(Boolean) : [];
  const cancelledIds = new Set(activities.filter(item => activityStatus(item) === 'cancelled')
    .flatMap(item => [recordId(item.id), recordId(item.firestoreId)]).filter(Boolean));
  return buildMomentStory({
    ...moment,
    activities: activities.filter(item => activityStatus(item) !== 'cancelled'),
    // Otherwise removed parents would make their files appear as orphan keepsakes.
    attachments: Array.isArray(moment.attachments) ? moment.attachments.filter(item =>
      item && !cancelledIds.has(recordId(item.activityId))) : [],
  }, context);
};
