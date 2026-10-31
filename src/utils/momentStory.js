import { activityTime } from './activityTime.js';
import { activityStatus } from './activityDetail.js';
import { resolveMomentEntryMode } from './momentEntryMode.js';
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

const asRecords = (items) => Array.isArray(items)
  ? items.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];

const calendarKey = (value) => {
  try { return formatMomentDate(parseMomentDate(value)) || null; }
  catch { return null; }
};

// The same mandatory mode governs creating Activities and rendering Story/PDF.
// The independent resolver avoids a cycle through Activity Detail.
export const resolveMomentStoryPresentation = resolveMomentEntryMode;

const makeActivityEntry = (moment, activity, subEntry = null, isFirst = false) => {
  const parentId = recordId(activity.id) || recordId(activity.firestoreId);
  const id = subEntry?.id || parentId;
  const linked = parentId ? summaryAttachmentsFor(moment, parentId) : [];
  return {
    kind: 'activity',
    id,
    activityId: parentId,
    title: subEntry?.title ?? activity.title ?? '',
    description: subEntry?.description ?? activity.description ?? '',
    date: calendarKey(subEntry?.date || activity.date),
    displayTime: subEntry ? activityTime(subEntry) : activityTime(activity),
    status: subEntry?.status || activityStatus(activity),
    activity,
    // Journal appends remain part of their owning memory, with independent
    // timestamps and editable entry IDs. Diary children become day chapters.
    subEntries: !subEntry && Array.isArray(activity.entries)
      ? [...activity.entries].sort((a, b) =>
        (a.date || '').localeCompare(b.date || '')
          || (activityTime(a) || '99:99').localeCompare(activityTime(b) || '99:99')
          || String(a.id || '').localeCompare(String(b.id || '')))
      : [],
    attachments: subEntry ? linked.filter((file) => file.entryId === id || (isFirst && !file.entryId)) : linked,
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

  const entries = sortedSummaryActivities(asRecords(source.activities)).flatMap((activity) => {
    if (activity.entryMode !== 'diary' || !Array.isArray(activity.entries) || !activity.entries.length) {
      return [makeActivityEntry(source, activity)];
    }
    return [...activity.entries].sort((a, b) => (activityTime(a) || '99:99').localeCompare(activityTime(b) || '99:99'))
      .map((item, index) => makeActivityEntry(source, activity, item, index === 0));
  }).sort((a, b) => (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31')
    || (a.displayTime || '99:99').localeCompare(b.displayTime || '99:99'));
  for (const entry of entries) {
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
    momentTime: activityTime(source),
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


const TASK_STATUS_ORDER = Object.freeze(['in-progress', 'completed', 'cancelled']);

// The Activity date is the secondary sort. Use a saved clock time only when
// the record actually contains one. Never derive it from createdAt/completedAt.
const taskTime = (entry) => activityTime(entry.activity || {});

// Task view uses status as the primary sort, followed by recorded date/time
// ascending. All entries are taken from the original read-only Story projection
// including upcoming and undated entries. This does not mutate stored order.
export const groupMomentStoryTasks = (story = {}) => {
  const timeline = (story.timeline || []).flatMap((month) => month.days.flatMap((day) => day.entries));
  const all = [...timeline, ...(story.upcoming || []), ...(story.undated || [])];
  return TASK_STATUS_ORDER.map((status) => ({
    status,
    entries: all.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.status === status)
      .sort((a, b) => {
        const dayA = a.entry.date || '9999-12-31', dayB = b.entry.date || '9999-12-31';
        return dayA.localeCompare(dayB)
          || (taskTime(a.entry) || '99:99').localeCompare(taskTime(b.entry) || '99:99')
          || a.index - b.index;
      })
      .map(({ entry }) => ({ ...entry, displayTime: taskTime(entry) })),
  }));
};
