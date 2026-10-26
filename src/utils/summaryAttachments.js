import { parseMomentDate } from './momentDates.js';
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
// equal dates keep their stable input order without borrowing creation times.
export const sortedSummaryActivities = (activities) => records(activities).map((activity) => {
  let date;
  try { date = parseMomentDate(activity.date); } catch { /* Invalid legacy date. */ }
  return { activity, time: date?.getTime() ?? Infinity };
}).sort((left, right) => left.time - right.time).map(({ activity }) => activity);
