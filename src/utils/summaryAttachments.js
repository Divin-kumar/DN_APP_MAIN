import { compareActivityDateTime } from './activityTime.js';
import { recordId as identity } from './recordIdentity.js';

const records = (value) => Array.isArray(value) ? value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];

// Photos remain in their owning Moment or Activity story, never in a detached footer.
// Missing/legacy Activity references remain visible on the Moment card.
export const summaryAttachmentsFor = (moment, activityId = null) => {
  const activities = new Set(records(moment?.activities).map((activity) => identity(activity.id)).filter(Boolean));
  const requestedId = activityId === null ? null : identity(activityId);
  if (requestedId !== null && !activities.has(requestedId)) return [];
  return records(moment?.attachments).filter((attachment) => {
    const linkedId = identity(attachment.activityId);
    if (requestedId !== null) return Boolean(requestedId) && linkedId === requestedId;
    return !linkedId || !activities.has(linkedId);
  });
};

// A story follows its recorded calendar date. Missing/invalid dates stay last;
// same-day entries use explicit clock times, with unknown times last and stable ties.
export const sortedSummaryActivities = (activities) => records(activities).slice().sort(compareActivityDateTime);
