import { DN_STORAGE_PREFIX, LEGACY_STORAGE_PREFIX } from '../utils/storageMigration.js';
import { DEFAULT_CODE_LISTS, serializeCodeListEntries } from '../utils/codeLists.js';
import { recordId } from '../utils/recordIdentity.js';
import { financialDate } from '../utils/financialRecords.js';

export const CURRENT_BACKUP_VERSION = 3;
const REQUIRED_LIST_KEYS = ['eventTypes', 'incomeTypes', 'expenseCategories', 'activityPriorities', 'reminderPresets'];
const COLLECTION_KEYS = ['moments', 'activities', 'memories', 'attachments', 'expenses', 'incomes'];
const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const hasId = (item) => isRecord(item) && typeof item.id === 'string' && item.id.trim().length > 0;

// Canonicalize the original numeric IDs before validation; never invent backup IDs.
const portableRecord = ({ firestoreId, firestoreCollection, firestoreSources, ...item }) => ({
  ...item,
  id: recordId(item.id) || recordId(firestoreId),
  ...Object.fromEntries(['eventId', 'activityId', 'momentId'].filter((key) => item[key] != null)
    .map((key) => [key, recordId(item[key]) || null])),
  ...(item.date != null ? { date: financialDate(item.date, item.date) } : {}),
});

const portableMoments = (moments) => moments.map((raw) => {
  const moment = portableRecord(raw);
  return {
    ...moment,
    activities: (raw.activities || []).map((entry) => {
      const activity = portableRecord(entry);
      return { ...activity, eventId: activity.eventId || moment.id,
        expenses: (entry.expenses || []).map((expense) => ({
          ...portableRecord(expense), eventId: recordId(expense.eventId) || moment.id,
          activityId: recordId(expense.activityId) || activity.id,
        })) };
    }),
    memories: (raw.memories || []).map(portableRecord),
    attachments: (raw.attachments || []).map(portableRecord),
  };
});

const parseStoredValue = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const uniqueById = (items, label) => {
  const ids = new Set();
  items.forEach((item) => {
    if (!hasId(item)) throw new Error(`Backup ${label} contains a record without a valid ID.`);
    if (ids.has(item.id)) throw new Error(`Backup ${label} contains duplicate ID "${item.id}".`);
    ids.add(item.id);
  });
  return ids;
};

const flattenMoments = (moments) => {
  const normalizedMoments = [];
  const activities = [];
  const memories = [];
  const attachments = [];

  moments.forEach((moment) => {
    if (!hasId(moment)) throw new Error('Backup Moments must have stable IDs.');
    const { firestoreId: _firestoreId, activities: momentActivities = [], memories: momentMemories = [], attachments: momentAttachments = [], ...momentFields } = moment;
    normalizedMoments.push(momentFields);
    momentActivities.forEach((activity) => activities.push({ ...activity, momentId: activity.momentId || activity.eventId || moment.id }));
    momentMemories.forEach((memory) => memories.push({ ...memory, momentId: memory.momentId || moment.id }));
    momentAttachments.forEach((attachment) => attachments.push({ ...attachment, momentId: attachment.momentId || moment.id }));
  });

  return { moments: normalizedMoments, activities, memories, attachments };
};

export const createBackupDocument = ({
  moments = [],
  expenses = [],
  incomes = [],
  codeLists,
  codeListSchemaVersion = 1,
  preferences = {},
  dashboardConfiguration = {},
  settings = {},
  metadata = {},
  createdDate = new Date().toISOString(),
}) => {
  const normalizedMoments = portableMoments(moments);
  const flattened = flattenMoments(normalizedMoments);
  const normalizedExpenses = expenses.map(portableRecord);
  const expenseIds = new Set(normalizedExpenses.map((expense) => expense.id));
  for (const moment of normalizedMoments) {
    for (const activity of moment.activities) {
      for (const expense of activity.expenses) {
        if (!expenseIds.has(expense.id)) {
          normalizedExpenses.push(expense);
          expenseIds.add(expense.id);
        }
      }
    }
  }
  const document = {
    app: 'DN',
    backupVersion: CURRENT_BACKUP_VERSION,
    createdDate,
    moments: flattened.moments,
    activities: flattened.activities,
    memories: flattened.memories,
    attachments: flattened.attachments,
    expenses: normalizedExpenses,
    incomes: incomes.map(portableRecord),
    codeLists: codeLists || {},
    codeListSchemaVersion,
    settings,
    preferences,
    dashboardConfiguration: {
      ...dashboardConfiguration,
      ...Object.fromEntries(['favorites', 'recent'].filter((key) => Array.isArray(dashboardConfiguration[key]))
        .map((key) => [key, dashboardConfiguration[key].map(recordId).filter(Boolean)])),
    },
    metadata: {
      ...metadata,
      relationships: 'activities, memories and attachments reference moments by momentId',
      attachmentDataIncluded: false,
      attachmentLimitation: 'The current app stores attachment metadata only; original file bytes are not available to back up.',
    },
  };
  validateBackupDocument(document);
  return document;
};

export const validateBackupDocument = (backup) => {
  if (!isRecord(backup)) throw new Error('Backup root must be a JSON object.');
  if (backup.backupVersion !== CURRENT_BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(backup.backupVersion)}.`);
  }
  if (typeof backup.createdDate !== 'string' || Number.isNaN(Date.parse(backup.createdDate))) {
    throw new Error('Backup createdDate must be a valid ISO date string.');
  }
  COLLECTION_KEYS.forEach((key) => {
    if (!Array.isArray(backup[key])) throw new Error(`Backup ${key} must be an array.`);
  });
  ['settings', 'preferences', 'dashboardConfiguration', 'metadata', 'codeLists'].forEach((key) => {
    if (!isRecord(backup[key])) throw new Error(`Backup ${key} must be an object.`);
  });
  if (!Number.isInteger(backup.codeListSchemaVersion) || backup.codeListSchemaVersion < 1) {
    throw new Error('Backup Code List schema version is invalid.');
  }
  REQUIRED_LIST_KEYS.forEach((key) => {
    if (!Array.isArray(backup.codeLists[key])) throw new Error(`Backup Code Lists are missing ${key}.`);
    backup.codeLists[key].forEach((entry) => {
      const value = typeof entry === 'string' ? entry.trim() : String(entry?.value ?? entry?.id ?? '').trim();
      if (!value) throw new Error(`Backup Code List "${key}" contains an invalid entry.`);
    });
  });

  const momentIds = uniqueById(backup.moments, 'Moments');
  uniqueById(backup.activities, 'Activities');
  uniqueById(backup.memories, 'Memories');
  uniqueById(backup.attachments, 'Attachments');
  uniqueById(backup.expenses, 'Expenses');
  uniqueById(backup.incomes, 'Income');

  backup.activities.forEach((activity) => {
    if (!momentIds.has(activity.momentId)) throw new Error(`Activity "${activity.id}" references a missing Moment.`);
  });
  backup.memories.forEach((memory) => {
    if (!momentIds.has(memory.momentId)) throw new Error(`Memory "${memory.id}" references a missing Moment.`);
  });
  backup.attachments.forEach((attachment) => {
    if (!momentIds.has(attachment.momentId)) throw new Error(`Attachment "${attachment.id}" references a missing Moment.`);
  });
  return backup;
};

// Old backups may contain either storage-key generation; newer DN values win.
const backedUpValue = (record, suffix) => (
  record?.[DN_STORAGE_PREFIX + suffix] ?? record?.[LEGACY_STORAGE_PREFIX + suffix]
);

const normalizeV2Backup = (parsed) => {
  const collections = parsed.data?.collections;
  if (!isRecord(collections) || !Array.isArray(collections.eventGroups)
    || !Array.isArray(collections.expenses) || !Array.isArray(collections.incomes)) {
    throw new Error('Version 2 backup is missing one or more data collections.');
  }
  const localData = isRecord(parsed.data?.localStorage) ? parsed.data.localStorage : {};
  const localCodeLists = parseStoredValue(backedUpValue(localData, 'admin_values'));
  const codeLists = collections.codeLists || localCodeLists
    || Object.fromEntries(Object.entries(DEFAULT_CODE_LISTS).map(([key, values]) => [key, serializeCodeListEntries(values)]));
  const preferences = parseStoredValue(backedUpValue(localData, 'preferences')) || {};
  const dashboardConfiguration = {};
  Object.entries(localData).forEach(([key, value]) => {
    const favoriteMatch = key.match(new RegExp(`^(?:${DN_STORAGE_PREFIX}|${LEGACY_STORAGE_PREFIX})favorite_event_ids_(.+)$`));
    const recentMatch = key.match(new RegExp(`^(?:${DN_STORAGE_PREFIX}|${LEGACY_STORAGE_PREFIX})recent_event_ids_(.+)$`));
    if (favoriteMatch) dashboardConfiguration.favorites = parseStoredValue(value) || [];
    if (recentMatch) dashboardConfiguration.recent = parseStoredValue(value) || [];
  });

  return createBackupDocument({
    moments: collections.eventGroups,
    expenses: collections.expenses,
    incomes: collections.incomes,
    codeLists,
    codeListSchemaVersion: collections.codeListSchemaVersion || 1,
    preferences,
    dashboardConfiguration,
    settings: {
      themeChoiceEnabled: Boolean(backedUpValue(localData, 'theme_choice')),
      restoreCodeLists: Boolean(collections.codeLists || localCodeLists),
    },
    createdDate: parsed.exportedAt || new Date().toISOString(),
    metadata: { sourceFormatVersion: 2, source: parsed.dataSource || 'unknown', originalAccount: parsed.account || null },
  });
};

const normalizeLegacyBackup = (parsed) => {
  const legacyData = isRecord(parsed.data) ? parsed.data : parsed;
  const preferences = parseStoredValue(backedUpValue(legacyData, 'preferences')) || {};
  const localCodeLists = parseStoredValue(backedUpValue(legacyData, 'admin_values'));
  const codeLists = localCodeLists
    || Object.fromEntries(Object.entries(DEFAULT_CODE_LISTS).map(([key, values]) => [key, serializeCodeListEntries(values)]));
  return createBackupDocument({
    codeLists,
    preferences,
    settings: { themeChoiceEnabled: Boolean(backedUpValue(legacyData, 'theme_choice')), restoreCodeLists: Boolean(localCodeLists) },
    createdDate: parsed.exportedAt || new Date().toISOString(),
    metadata: { sourceFormatVersion: 1, legacySettingsOnly: true },
  });
};

export const parseBackupDocument = (parsed) => {
  if (!isRecord(parsed)) throw new Error('Backup root must be a JSON object.');
  if (parsed.backupVersion === CURRENT_BACKUP_VERSION) return validateBackupDocument(parsed);
  if (parsed.backupVersion !== undefined) {
    if (parsed.backupFormatVersion === 2 || parsed.backupVersion === 2) return normalizeV2Backup(parsed);
    throw new Error(`Unsupported backup version: ${String(parsed.backupVersion)}.`);
  }
  if (parsed.backupFormatVersion === 2) return normalizeV2Backup(parsed);
  if (parsed.backupFormatVersion !== undefined) {
    throw new Error(`Unsupported backup format version: ${String(parsed.backupFormatVersion)}.`);
  }
  return normalizeLegacyBackup(parsed);
};

export const buildEventGroupsFromBackup = (backup) => {
  validateBackupDocument(backup);
  const activitiesByMoment = new Map(backup.moments.map((moment) => [moment.id, []]));
  const memoriesByMoment = new Map(backup.moments.map((moment) => [moment.id, []]));
  const attachmentsByMoment = new Map(backup.moments.map((moment) => [moment.id, []]));
  const expensesByActivity = new Map();

  backup.activities.forEach((activity) => {
    const { momentId, ...activityFields } = activity;
    activitiesByMoment.get(momentId).push({ ...activityFields, eventId: activityFields.eventId || momentId, expenses: [] });
  });
  backup.memories.forEach((memory) => {
    const { momentId, ...memoryFields } = memory;
    memoriesByMoment.get(momentId).push(memoryFields);
  });
  backup.attachments.forEach((attachment) => {
    const { momentId, ...attachmentFields } = attachment;
    attachmentsByMoment.get(momentId).push(attachmentFields);
  });
  backup.expenses.forEach((expense) => {
    if (!expense.activityId) return;
    if (!expensesByActivity.has(expense.activityId)) expensesByActivity.set(expense.activityId, []);
    expensesByActivity.get(expense.activityId).push(expense);
  });

  return backup.moments.map((moment) => ({
    ...moment,
    activities: activitiesByMoment.get(moment.id).map((activity) => ({
      ...activity,
      expenses: expensesByActivity.get(activity.id) || [],
    })),
    memories: memoriesByMoment.get(moment.id),
    attachments: attachmentsByMoment.get(moment.id),
  }));
};

const mergeById = (currentItems = [], importedItems = []) => {
  const merged = [...currentItems];
  const ids = new Set(currentItems.map((item) => item.id).filter(Boolean));
  let added = 0;
  importedItems.forEach((item) => {
    if (!item?.id || ids.has(item.id)) return;
    ids.add(item.id);
    merged.push(item);
    added += 1;
  });
  return { items: merged, added };
};

const preferDestinationExpenseMirrors = (importedGroups, destinationExpenses) => {
  const byId = new Map();
  destinationExpenses.forEach((expense) => {
    const id = recordId(expense.id);
    if (id && !byId.has(id)) byId.set(id, expense);
  });
  return importedGroups.map((moment) => ({
    ...moment,
    activities: (moment.activities || []).map((activity) => ({
      ...activity,
      expenses: (activity.expenses || []).flatMap((expense) => {
        const existing = byId.get(recordId(expense.id));
        if (!existing) return [expense];
        // A backup must not relink an existing ledger record or copy its stale
        // values into a newly added activity mirror. Existing values win.
        const existingMomentId = recordId(existing.eventId) || recordId(existing.momentId);
        if (existingMomentId !== recordId(moment.id) || recordId(existing.activityId) !== recordId(activity.id)) return [];
        return [portableRecord(existing)];
      }),
    })),
  }));
};

export const mergeEventGroupsForRestore = (currentGroups, importedGroups, destinationExpenses = []) => {
  const merged = [...currentGroups];
  const byId = new Map(merged.map((moment, index) => [moment.id, index]));
  const counts = { moments: 0, activities: 0, memories: 0, attachments: 0, conflicts: 0 };

  preferDestinationExpenseMirrors(importedGroups, destinationExpenses).forEach((imported) => {
    const existingIndex = byId.get(imported.id);
    if (existingIndex === undefined) {
      merged.push(imported);
      byId.set(imported.id, merged.length - 1);
      counts.moments += 1;
      counts.activities += imported.activities?.length || 0;
      counts.memories += imported.memories?.length || 0;
      counts.attachments += imported.attachments?.length || 0;
      return;
    }

    const current = merged[existingIndex];
    const activityResult = mergeById(current.activities || [], imported.activities || []);
    const importedActivitiesById = new Map((imported.activities || []).map((activity) => [activity.id, activity]));
    const activities = activityResult.items.map((activity) => {
      const incoming = importedActivitiesById.get(activity.id);
      if (!incoming) return activity;
      const expenseResult = mergeById(activity.expenses || [], incoming.expenses || []);
      counts.conflicts += (incoming.expenses?.length || 0) - expenseResult.added;
      return expenseResult.added ? { ...activity, expenses: expenseResult.items } : activity;
    });
    const memoryResult = mergeById(current.memories || [], imported.memories || []);
    const attachmentResult = mergeById(current.attachments || [], imported.attachments || []);
    counts.activities += activityResult.added;
    counts.memories += memoryResult.added;
    counts.attachments += attachmentResult.added;
    counts.conflicts += (imported.activities?.length || 0) - activityResult.added
      + (imported.memories?.length || 0) - memoryResult.added
      + (imported.attachments?.length || 0) - attachmentResult.added;
    merged[existingIndex] = {
      ...current,
      activities,
      memories: memoryResult.items,
      attachments: attachmentResult.items,
    };
  });

  return { eventGroups: merged, counts };
};

export const mergeRecordsById = mergeById;

export const collectBackupReferenceWarnings = (backup) => {
  const momentIds = new Set(backup.moments.map((moment) => moment.id));
  const activityIds = new Set(backup.activities.map((activity) => activity.id));
  return backup.expenses.flatMap((expense) => {
    const warnings = [];
    const momentId = expense.momentId || expense.eventId;
    if (momentId && !momentIds.has(momentId)) warnings.push(`Expense "${expense.id}" references a Moment not included in this backup.`);
    if (expense.activityId && !activityIds.has(expense.activityId)) warnings.push(`Expense "${expense.id}" references an Activity not included in this backup.`);
    return warnings;
  });
};
