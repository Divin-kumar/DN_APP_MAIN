import { parseMomentDate } from './momentDates.js';
import { recordId } from './recordIdentity.js';
import { momentRecordId } from './scopedRecordActions.js';

export const activityDetailPath = (eventId, activityId) => `/events/${encodeURIComponent(recordId(eventId))}/activities/${encodeURIComponent(recordId(activityId))}`;
export const resolveActivityDetail = (events, eventId, activityId) => {
  const moment = events.find((item) => momentRecordId(item) === recordId(eventId));
  const activity = moment?.activities?.find((item) => recordId(item.id) === recordId(activityId));
  return moment && activity ? { moment, activity } : null;
};
export const activityStatus = (activity) => activity.cancelled || activity.status === 'cancelled' ? 'cancelled'
  : activity.completed || activity.status === 'completed' ? 'completed' : 'in-progress';
export const activityStatusLabel = (activity) => ({ 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled' })[activityStatus(activity)];
export const activityCompletionPatch = (activity, moment, completed) => {
  if (activityStatus(activity) === 'cancelled') throw new Error('Restore this activity explicitly before changing its completion.');
  if (completed && (moment.archived || ['archived', 'cancelled'].includes(moment.status))) throw new Error('Restore this Moment before completing its activity.');
  if ((activityStatus(activity) === 'completed') === completed) return undefined;
  return { completed, completedAt: completed ? new Date().toISOString() : null, status: completed ? 'completed' : 'in-progress' };
};
export const activityDateLabel = (value, fallback = 'Date to be decided') => {
  let date;
  try { date = parseMomentDate(value); } catch { /* Unreadable legacy timestamps have no date. */ }
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : fallback;
};
export const isAttachmentImage = (type) => /^image\/(jpeg|png|webp|gif|avif|bmp)$/i.test(type || '');
export const legacyAttachmentImage = (attachment) => {
  const url = attachment?.url || attachment?.downloadURL || attachment?.src;
  return isAttachmentImage(attachment?.type) && typeof url === 'string' && /^https:\/\//i.test(url) ? url : '';
};
export const activityAttachments = (moment, activityId) => (moment?.attachments || [])
  .filter((item) => recordId(item.activityId) === recordId(activityId));
export const selectActivityCover = (moment, activityId) => activityAttachments(moment, activityId)
  .find((item) => isAttachmentImage(item.type) && (/^[a-f0-9]{64}$/.test(item.assetId || '') || legacyAttachmentImage(item))) || null;
export const activityCoverRatio = (width, height) => Number(width) > 0 && Number(height) > 0
  && Number.isFinite(Number(width) / Number(height)) ? Math.max(16 / 9, Math.min(2.4, Number(width) / Number(height))) : 16 / 9;
