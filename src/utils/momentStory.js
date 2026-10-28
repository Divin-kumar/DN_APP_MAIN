import { activityStatus } from './activityDetail.js';
import { getCodeListMeta } from './codeLists.js';
import { getEventStatus } from './eventStatus.js';
import { formatMomentDate, parseMomentDate } from './momentDates.js';
import { recordId } from './recordIdentity.js';
import { sortedSummaryActivities, summaryAttachmentsFor } from './summaryAttachments.js';

// Internal, read-only DN 2.0 Story projection. No record writes, original-file
// reads, list preference changes, navigation changes or backup migration.
export const STORY_PRESENTATIONS = Object.freeze({
  JOURNEY: 'journey',
  DIARY: 'diary',
  CHRONICLE: 'chronicle',
});

const VALID_PRESENTATIONS = Object.freeze(Object.values(STORY_PRESENTATIONS));
const PROJECT_TYPES = new Set(['application and youtube', 'career', 'iqvia', 'project', 'work']);

const asRecords = (items) => Array.isArray(items)
  ? items.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];

const calendarKey = (value) => {
  try { return formatMomentDate(parseMomentDate(value)) || null; }
  catch { return null; }
};

const defaultPresentation = (name) => {
  const key = String(name || '').trim().toLocaleLowerCase();
  if (key === 'diary' || key === 'journal') return STORY_PRESENTATIONS.DIARY;
  if (PROJECT_TYPES.has(key)) return STORY_PRESENTATIONS.CHRONICLE;
  return STORY_PRESENTATIONS.JOURNEY;
};

// The optional storyPresentation property already round-trips through DN's
// Moment Type Code Lists. Unknown/inactive legacy types remain readable.
export const resolveMomentStoryPresentation = (moment = {}, momentTypes = []) => {
  const rawType = String(moment?.type || '').trim();
  const customType = String(moment?.customType || '').trim();
  const typeName = rawType.toLocaleLowerCase() === 'other' && customType ? customType : rawType;
  const entries = getCodeListMeta('eventTypes', momentTypes);
  const findType = (name) => entries.find((entry) => (
    entry.value.toLocaleLowerCase() === name.toLocaleLowerCase()
    || entry.label.toLocaleLowerCase() === name.toLocaleLowerCase()
  ));
  const configured = findType(typeName) || (rawType.toLocaleLowerCase() === 'other' ? findType('Other') : null);
  const selected = configured?.storyPresentation;
  return VALID_PRESENTATIONS.includes(selected) ? selected : defaultPresentation(configured?.value || typeName);
};

const makeActivityEntry = (moment, activity) => {
  const id = recordId(activity.id) || recordId(activity.firestoreId);
  return {
    kind: 'activity',
    id,
    title: activity.title || '',
    description: activity.description || '',
    date: calendarKey(activity.date),
    status: activityStatus(activity),
    // Keep the actual underlying record available for Activity Detail / PDF
    // consumers without manufacturing a second saved Activity.
    activity,
    attachments: id ? summaryAttachmentsFor(moment, id) : [],
  };
};

// Only recorded Activity dates determine chronological chapters. Creation
// timestamps, Moment dates and Memory timestamps never substitute for them.
// Future unfinished Activities are separate from the already-recorded story.
// Photos use the same ownership helper as existing summaries; an assetId is
// NOT proof that an original exists on this device.
export const buildMomentStory = (moment = {}, { momentTypes = [], now = new Date() } = {}) => {
  const source = moment && typeof moment === 'object' && !Array.isArray(moment) ? moment : {};
  const today = calendarKey(now) || calendarKey(new Date());
  const months = [];
  const upcoming = [];
  const undated = [];
  let activeMonth = null;
  let activeDay = null;

  for (const activity of sortedSummaryActivities(asRecords(source.activities))) {
    const entry = makeActivityEntry(source, activity);
    if (!entry.date) {
      undated.push(entry);
      continue;
    }
    if (entry.status === 'in-progress' && entry.date > today) {
      upcoming.push(entry);
      continue;
    }

    const monthKey = entry.date.slice(0, 7);
    if (activeMonth?.key !== monthKey) {
      activeMonth = { key: monthKey, days: [] };
      months.push(activeMonth);
      activeDay = null;
    }
    if (activeDay?.date !== entry.date) {
      activeDay = { date: entry.date, entries: [] };
      activeMonth.days.push(activeDay);
    }
    activeDay.entries.push(entry);
  }

  return {
    momentId: recordId(source.id) || recordId(source.firestoreId),
    name: source.name || '',
    type: source.type || '',
    momentDate: calendarKey(source.date),
    status: getEventStatus(source),
    presentation: resolveMomentStoryPresentation(source, momentTypes),
    introduction: source.notes || '',
    timeline: months,
    upcoming,
    undated,
    // Retain old Memories as reflections, outside dated Activity chapters.
    // createdAt is metadata, not an assumed occurrence date.
    reflections: asRecords(source.memories).map((memory) => ({
      kind: 'legacy-memory',
      id: recordId(memory.id) || recordId(memory.firestoreId),
      title: memory.title || '',
      body: memory.body || '',
      createdAt: memory.createdAt || null,
      memory,
    })),
    // Includes Moment-level files and legacy links to missing Activities.
    // Callers must still verify the original in the current browser scope.
    keepsakes: summaryAttachmentsFor(source),
  };
};
