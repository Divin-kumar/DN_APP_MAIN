import { activityStatus } from './activityDetail.js';
import { recordId } from './recordIdentity.js';

const records = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
export const pdfContentKey = item => recordId(item?.id) || recordId(item?.firestoreId) || recordId(item?.assetId);
export const PDF_CONTENT_DEFAULTS = Object.freeze({ excludedActivities: [], excludedAttachments: [] });
const ids = value => Array.isArray(value) && value.every(id => typeof id === 'string');
export const PDF_CONTENT_RULES = Object.freeze({ excludedActivities: ids, excludedAttachments: ids });
export const normalizePdfContentSelection = (value = {}) => Object.fromEntries(
  Object.keys(PDF_CONTENT_DEFAULTS).map(key => [key, ids(value?.[key]) ? [...new Set(value[key])] : []]),
);
const aliases = item => [recordId(item.id), recordId(item.firestoreId)].filter(Boolean);

// Selection is a read-only projection; filtered parents cannot turn their files into keepsakes.
export const projectPdfContent = (moment = {}, selection = {}) => {
  const selected = normalizePdfContentSelection(selection);
  const activities = records(moment?.activities);
  const removed = activities.filter(item => activityStatus(item) === 'cancelled'
    || selected.excludedActivities.includes(pdfContentKey(item)));
  const removedIds = new Set(removed.flatMap(aliases));
  return { ...moment,
    activities: activities.filter(item => !removed.includes(item)),
    attachments: records(moment?.attachments).filter(item => !removedIds.has(recordId(item.activityId))
      && !selected.excludedAttachments.includes(pdfContentKey(item))),
  };
};

export const pdfContentInventory = (moment = {}) => {
  const eligible = projectPdfContent(moment);
  const owned = new Set();
  const activities = eligible.activities.map(activity => {
    const ownerIds = aliases(activity);
    const attachments = eligible.attachments.filter(file => ownerIds.includes(recordId(file.activityId)));
    attachments.forEach(file => owned.add(file));
    return { activity, attachments };
  });
  return { activities, attachments: eligible.attachments.filter(file => !owned.has(file)) };
};
