import { mapActivityRecord } from '../repositories/activityMapper.js';
import { mapAttachmentRecord } from '../repositories/attachmentMapper.js';
import { mapCodeListEntry } from '../repositories/codeListMapper.js';
import { mapExpenseRecord } from '../repositories/expenseMapper.js';
import { mapIncomeRecord } from '../repositories/incomeMapper.js';
import { mapMemoryRecord } from '../repositories/memoryMapper.js';
import { mapMomentRecord } from '../repositories/momentMapper.js';
import { mapSettingsRecord } from '../repositories/settingsMapper.js';
import { MIGRATION_DOMAIN, MIGRATION_SOURCE } from './migrationConstants.js';
import { deterministicMigrationId, stableStringify } from './migrationIdentity.js';

const isValidDate = (value) => typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
const rawFinding = (domain, raw, path, message) => ({
  severity: 'error',
  ruleId: `${domain}.source.invalid`,
  domain,
  recordId: raw?.id || raw?.firestoreId || null,
  sourcePath: raw?.sourcePath || path,
  source: raw?.source || 'legacy',
  message,
});

const idFor = (domain, raw, fallbackPath) => {
  const source = raw.source || MIGRATION_SOURCE.GUEST;
  const sourcePath = raw.sourcePath || fallbackPath;
  const originalId = raw.originalId ?? raw.id ?? raw.firestoreId ?? null;
  return {
    id: originalId ? String(raw.id || raw.firestoreId || originalId) : deterministicMigrationId(domain, sourcePath, null, stableStringify(raw)),
    originalId,
    source,
    sourcePath,
  };
};

const makeLineage = (domain, raw, fallbackPath, record) => {
  const identity = idFor(domain, raw, fallbackPath);
  return {
    record,
    lineage: {
      source: identity.source,
      sourcePath: identity.sourcePath,
      originalId: identity.originalId,
      migrationVersion: 1,
      domain,
    },
  };
};

const toEventCollection = (sources) => [
  ...(sources.firebase?.datasets.eventGroups || []),
  ...(sources.guest?.datasets.eventGroups || []),
];

export const buildMigrationDatasets = (sources, principalId) => {
  if (!principalId) throw new Error('A target principal ID is required to build migration datasets.');
  const eventGroups = toEventCollection(sources);
  const datasets = Object.fromEntries(Object.values(MIGRATION_DOMAIN).map((domain) => [domain, []]));
  const rawFindings = [];
  const momentIdByAlias = new Map();

  eventGroups.forEach((raw, index) => {
    const path = raw.sourcePath || `eventGroups/${index}`;
    if (!isValidDate(raw.date)) rawFindings.push(rawFinding(MIGRATION_DOMAIN.MOMENTS, raw, path, 'Moment source date is missing or invalid.'));
    if (!String(raw.name ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.MOMENTS, raw, path, 'Moment source name is missing.'));
    if (!String(raw.type ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.MOMENTS, raw, path, 'Moment source type is missing.'));
    const identity = idFor(MIGRATION_DOMAIN.MOMENTS, raw, path);
    const momentId = identity.id;
    for (const alias of [raw.id, raw.firestoreId, raw.originalId].filter(Boolean)) {
      momentIdByAlias.set(`${identity.source}:${alias}`, momentId);
      momentIdByAlias.set(`*:${alias}`, momentId);
    }

    const moment = mapMomentRecord({ ...raw, id: momentId, userId: principalId, source: raw.source === 'firebase' ? 'firebase' : 'guest' }, principalId);
    datasets.moments.push(makeLineage(MIGRATION_DOMAIN.MOMENTS, raw, path, moment));

    (Array.isArray(raw.activities) ? raw.activities : []).forEach((activity, activityIndex) => {
      const activityPath = `${path}/activities/${activityIndex}`;
      if (!isValidDate(activity.date)) rawFindings.push(rawFinding(MIGRATION_DOMAIN.ACTIVITIES, activity, activityPath, 'Activity source date is missing or invalid.'));
      if (!String(activity.title ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.ACTIVITIES, activity, activityPath, 'Activity source title is missing.'));
      const activityIdentity = idFor(MIGRATION_DOMAIN.ACTIVITIES, {
        ...activity,
        source: raw.source,
        sourcePath: activity.sourcePath || activityPath,
        originalId: activity.originalId ?? activity.id,
      }, activityPath);
      const mappedActivity = mapActivityRecord({
        ...activity,
        id: activityIdentity.id,
        eventId: momentId,
        momentId,
        userId: principalId,
        source: raw.source === 'firebase' ? 'firebase' : 'guest',
      }, principalId);
      datasets.activities.push(makeLineage(MIGRATION_DOMAIN.ACTIVITIES, { ...activity, ...activityIdentity, sourcePath: activity.sourcePath || activityPath }, activityPath, mappedActivity));

      (Array.isArray(activity.expenses) ? activity.expenses : []).forEach((expense, expenseIndex) => {
        const expensePath = `${activityPath}/expenses/${expenseIndex}`;
        if (!isValidDate(expense.date)) rawFindings.push(rawFinding(MIGRATION_DOMAIN.EXPENSES, expense, expensePath, 'Expense source date is missing or invalid.'));
        if (!Number.isFinite(Number(expense.amount)) || Number(expense.amount) < 0) rawFindings.push(rawFinding(MIGRATION_DOMAIN.EXPENSES, expense, expensePath, 'Expense source amount is invalid.'));
        if (!String(expense.name ?? expense.description ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.EXPENSES, expense, expensePath, 'Expense source name and description are both missing.'));
        const expenseIdentity = idFor(MIGRATION_DOMAIN.EXPENSES, {
          ...expense,
          name: expense.name ?? expense.description ?? '',
          source: raw.source,
          sourcePath: expense.sourcePath || expensePath,
          originalId: expense.originalId ?? expense.id,
        }, expensePath);
        const mappedExpense = mapExpenseRecord({
          ...expense,
          id: expenseIdentity.id,
          eventId: momentId,
          momentId,
          activityId: activityIdentity.id,
          userId: principalId,
          source: raw.source === 'firebase' ? 'firebase' : 'guest',
        }, principalId);
        datasets.expenses.push(makeLineage(MIGRATION_DOMAIN.EXPENSES, { ...expense, ...expenseIdentity, sourcePath: expense.sourcePath || expensePath }, expensePath, mappedExpense));
      });
    });

    (Array.isArray(raw.memories) ? raw.memories : []).forEach((memory, childIndex) => {
      const pathForMemory = `${path}/memories/${childIndex}`;
      if (!String(memory.title ?? '').trim() && !String(memory.content ?? memory.note ?? memory.description ?? '').trim()) {
        rawFindings.push(rawFinding(MIGRATION_DOMAIN.MEMORIES, memory, pathForMemory, 'Memory source has no title or content.'));
      }
      const identityForMemory = idFor(MIGRATION_DOMAIN.MEMORIES, memory, memory.sourcePath || pathForMemory);
      const mappedMemory = mapMemoryRecord({
        ...memory,
        content: memory.content ?? memory.note ?? memory.description ?? '',
        id: identityForMemory.id,
        eventId: momentId,
        momentId,
        userId: principalId,
        source: raw.source === 'firebase' ? 'firebase' : 'guest',
      }, principalId);
      datasets.memories.push(makeLineage(MIGRATION_DOMAIN.MEMORIES, { ...memory, ...identityForMemory, sourcePath: memory.sourcePath || pathForMemory }, pathForMemory, mappedMemory));
    });

    (Array.isArray(raw.attachments) ? raw.attachments : []).forEach((attachment, childIndex) => {
      const pathForAttachment = `${path}/attachments/${childIndex}`;
      if (!String(attachment.name ?? attachment.fileName ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.ATTACHMENTS, attachment, pathForAttachment, 'Attachment source name is missing.'));
      const identityForAttachment = idFor(MIGRATION_DOMAIN.ATTACHMENTS, attachment, attachment.sourcePath || pathForAttachment);
      const mappedAttachment = mapAttachmentRecord({
        ...attachment,
        name: attachment.name ?? attachment.fileName ?? '',
        id: identityForAttachment.id,
        eventId: momentId,
        momentId,
        userId: principalId,
        source: raw.source === 'firebase' ? 'firebase' : 'guest',
      }, principalId);
      datasets.attachments.push(makeLineage(MIGRATION_DOMAIN.ATTACHMENTS, { ...attachment, ...identityForAttachment, sourcePath: attachment.sourcePath || pathForAttachment }, pathForAttachment, mappedAttachment));
    });
  });

  const lookupMomentId = (raw, source) => {
    const alias = raw.momentId || raw.eventId || raw.event_id;
    return alias ? (momentIdByAlias.get(`${source}:${alias}`) || momentIdByAlias.get(`*:${alias}`) || alias) : null;
  };

  const directExpenses = [
    ...(sources.firebase?.datasets.expenses || []),
    ...(sources.guest?.datasets.expenses || []),
  ];
  directExpenses.forEach((raw, index) => {
    const path = raw.sourcePath || `expenses/${index}`;
    if (!isValidDate(raw.date)) rawFindings.push(rawFinding(MIGRATION_DOMAIN.EXPENSES, raw, path, 'Expense source date is missing or invalid.'));
    if (!Number.isFinite(Number(raw.amount)) || Number(raw.amount) < 0) rawFindings.push(rawFinding(MIGRATION_DOMAIN.EXPENSES, raw, path, 'Expense source amount is invalid.'));
    if (!String(raw.name ?? raw.description ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.EXPENSES, raw, path, 'Expense source name and description are both missing.'));
    const identity = idFor(MIGRATION_DOMAIN.EXPENSES, raw, path);
    const mapped = mapExpenseRecord({
      ...raw,
      name: raw.name ?? raw.description ?? '',
      id: identity.id,
      userId: principalId,
      eventId: lookupMomentId(raw, raw.source),
      momentId: lookupMomentId(raw, raw.source),
      source: raw.source === 'firebase' ? 'firebase' : 'guest',
    }, principalId);
    datasets.expenses.push(makeLineage(MIGRATION_DOMAIN.EXPENSES, { ...raw, ...identity }, path, mapped));
  });

  const incomes = [
    ...(sources.firebase?.datasets.incomes || []),
    ...(sources.guest?.datasets.incomes || []),
  ];
  incomes.forEach((raw, index) => {
    const path = raw.sourcePath || `incomes/${index}`;
    if (!isValidDate(raw.date)) rawFindings.push(rawFinding(MIGRATION_DOMAIN.INCOMES, raw, path, 'Income source date is missing or invalid.'));
    if (!Number.isFinite(Number(raw.amount)) || Number(raw.amount) < 0) rawFindings.push(rawFinding(MIGRATION_DOMAIN.INCOMES, raw, path, 'Income source amount is invalid.'));
    if (!String(raw.name ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.INCOMES, raw, path, 'Income source name is missing.'));
    if (!String(raw.type ?? '').trim()) rawFindings.push(rawFinding(MIGRATION_DOMAIN.INCOMES, raw, path, 'Income source type is missing.'));
    const identity = idFor(MIGRATION_DOMAIN.INCOMES, raw, path);
    const mapped = mapIncomeRecord({ ...raw, id: identity.id, userId: principalId, source: raw.source === 'firebase' ? 'firebase' : 'guest' }, principalId);
    datasets.incomes.push(makeLineage(MIGRATION_DOMAIN.INCOMES, { ...raw, ...identity }, path, mapped));
  });

  const settings = sources.settings?.datasets;
  if (settings && sources.settings.keyPresence?.lifehub_preferences) {
    Object.entries(settings.preferences || {}).forEach(([key, value]) => {
      const raw = { key, value, source: 'legacy', sourcePath: `lifehub_preferences/${key}`, originalId: key };
      const id = deterministicMigrationId('settings', raw.sourcePath, key);
      datasets.settings.push(makeLineage(MIGRATION_DOMAIN.SETTINGS, raw, raw.sourcePath, mapSettingsRecord({ ...raw, id, userId: principalId }, principalId)));
    });
  }

  const adminValues = settings?.adminValues;
  if (adminValues && sources.settings.keyPresence?.lifehub_admin_values) {
    Object.entries(adminValues).forEach(([listKey, entries]) => {
      if (!Array.isArray(entries)) {
        rawFindings.push(rawFinding(MIGRATION_DOMAIN.CODE_LISTS, { id: listKey, sourcePath: `lifehub_admin_values/${listKey}` }, `lifehub_admin_values/${listKey}`, 'Code list source value must be an array.'));
        return;
      }
      entries.forEach((entry, index) => {
        const value = typeof entry === 'string' ? entry : String(entry?.entryValue ?? entry?.value ?? '').trim();
        if (!value) {
          rawFindings.push(rawFinding(MIGRATION_DOMAIN.CODE_LISTS, { id: `${listKey}:${index}` }, `lifehub_admin_values/${listKey}/${index}`, 'Code list entry has no value.'));
          return;
        }
        const raw = typeof entry === 'string' ? { value, label: value } : entry;
        const path = `lifehub_admin_values/${listKey}/${index}`;
        const id = deterministicMigrationId('code-list', path, raw.entryValue || raw.value || value);
        const mapped = mapCodeListEntry({
          ...raw,
          id,
          listKey,
          entryValue: raw.entryValue ?? raw.value ?? value,
          label: raw.label ?? raw.value ?? value,
          source: 'legacy',
        }, principalId);
        datasets.codeLists.push(makeLineage(MIGRATION_DOMAIN.CODE_LISTS, { ...raw, source: 'settings-local-storage', sourcePath: path, originalId: raw.id ?? value }, path, mapped));
      });
    });
  }

  datasets.rawFindings = rawFindings;
  return datasets;
};
