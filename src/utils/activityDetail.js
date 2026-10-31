import { parseMomentDate } from './momentDates.js';
import { recordId } from './recordIdentity.js';
import { momentRecordId } from './scopedRecordActions.js';
import { activityOwnsLinkedId } from './activityEntries.js';

export const activityDetailPath = (eventId, activityId) => `/events/${encodeURIComponent(recordId(eventId))}/activities/${encodeURIComponent(recordId(activityId))}`;
export const resolveActivityDetail = (events, eventId, activityId) => {
  const moment = events.find((item) => momentRecordId(item) === recordId(eventId));
  const activity = moment?.activities?.find((item) => activityOwnsLinkedId(item, activityId));
  return moment && activity ? { moment, activity } : null;
};
export const activityStatus = (activity) => activity.cancelled || activity.status === 'cancelled' ? 'cancelled'
  : activity.completed || activity.status === 'completed' ? 'completed' : 'in-progress';
export const activityStatusLabel = (activity) => ({ 'in-progress': 'In progress', completed: 'Completed', cancelled: 'Cancelled' })[activityStatus(activity)];
export const activityCancellationPatch = (activity, cancelled) => {
  const completed = Boolean(activity.completed || activity.status === 'completed');
  return { cancelled, ...(completed ? { completed: true } : {}), status: cancelled ? 'cancelled' : completed ? 'completed' : 'in-progress' };
};
export const activityCompletionPatch = (activity, moment, completed) => {
  if (activityStatus(activity) === 'cancelled') throw new Error('Restore this activity explicitly before changing its completion.');
  if (completed && (moment.archived || ['archived', 'cancelled'].includes(moment.status))) throw new Error('Restore this Moment before completing its activity.');
  if ((activityStatus(activity) === 'completed') === completed) return undefined;
  return { completed, completedAt: completed ? new Date().toISOString() : null, status: completed ? 'completed' : 'in-progress' };
};
// Explicit status-picker transitions use the same completion/cancellation
// guards as Activity Detail. A chosen target always wins over legacy flags.
export const activityStatusTransitionPatch = (activity, moment, targetStatus) => {
  const previous = activityStatus(activity);
  if (targetStatus === previous) return undefined;
  if (!['in-progress', 'completed', 'cancelled'].includes(targetStatus)) {
    throw new Error('Choose a valid activity status.');
  }
  if (targetStatus === 'cancelled') return activityCancellationPatch(activity, true);
  if (targetStatus === 'in-progress') {
    if (previous === 'cancelled') return { ...activityCancellationPatch(activity, false), cancelled: false,
      completed: false, completedAt: null, status: 'in-progress' };
    return { ...activityCompletionPatch(activity, moment, false), cancelled: false };
  }
  // Explicitly restoring a cancelled Activity must not accidentally preserve
  // a legacy completed flag; pass the restored state through existing guards.
  const active = previous === 'cancelled'
    ? { ...activity, ...activityCancellationPatch(activity, false), cancelled: false,
      completed: false, completedAt: null, status: 'in-progress' } : activity;
  const patch = activityCompletionPatch(active, moment, true);
  return { ...(previous === 'cancelled' ? { cancelled: false } : {}), ...patch };
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
export const activityCoverImages = (moment, activityId) => activityAttachments(moment, activityId)
  .filter((item) => isAttachmentImage(item.type) && (/^[a-f0-9]{64}$/.test(item.assetId || '') || legacyAttachmentImage(item)));
export const coverImageKey = (image) => image ? JSON.stringify([recordId(image.id), image.assetId || legacyAttachmentImage(image)]) : '';
export const selectActivityCover = (moment, activityId) => activityCoverImages(moment, activityId)[0] || null;
export const activityCoverRatio = (width, height) => Number(width) > 0 && Number(height) > 0
  && Number.isFinite(Number(width) / Number(height)) ? Math.max(16 / 9, Math.min(2.4, Number(width) / Number(height))) : 16 / 9;
