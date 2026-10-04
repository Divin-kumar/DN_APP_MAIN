import { canonicalFingerprint, stableStringify } from './migrationIdentity.js';

const normalizeText = (value) => String(value ?? '').trim().toLocaleLowerCase();
const minorUnits = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : null;

const fingerprintFields = Object.freeze({
  moments: (row) => ({
    userId: row.userId, name: normalizeText(row.name), date: row.date,
    type: normalizeText(row.type), customType: normalizeText(row.customType),
    recurrence: normalizeText(row.recurrence), status: normalizeText(row.status),
    budget: Number(row.budget || 0), notes: normalizeText(row.notes), greetingCard: row.greetingCard || null,
  }),
  activities: (row) => ({
    userId: row.userId, momentId: row.momentId, title: normalizeText(row.title), date: row.date,
    description: normalizeText(row.description), completed: Boolean(row.completed), cancelled: Boolean(row.cancelled),
    priority: normalizeText(row.priority), completedAt: row.completedAt || null,
  }),
  memories: (row) => ({
    userId: row.userId, momentId: row.momentId, title: normalizeText(row.title),
    content: normalizeText(row.content), createdAt: row.createdAt || null,
  }),
  attachments: (row) => ({
    userId: row.userId, momentId: row.momentId, name: normalizeText(row.name),
    type: normalizeText(row.type), mimeType: normalizeText(row.mimeType), size: Number(row.size || 0), url: row.url || '',
  }),
  expenses: (row) => ({
    userId: row.userId, momentId: row.momentId || row.eventId || null, activityId: row.activityId || null,
    date: row.date, amountMinorUnits: minorUnits(row.amount), name: normalizeText(row.name),
    category: normalizeText(row.category), description: normalizeText(row.description),
  }),
  incomes: (row) => ({
    userId: row.userId, date: row.date, amountMinorUnits: minorUnits(row.amount),
    name: normalizeText(row.name), type: normalizeText(row.type), description: normalizeText(row.description),
  }),
  settings: (row) => ({ userId: row.userId, key: row.key, value: row.value }),
  codeLists: (row) => ({
    userId: row.userId, listKey: row.listKey, entryValue: normalizeText(row.entryValue),
    label: normalizeText(row.label), active: row.active, isActive: row.isActive,
    canGenerateGreetingCards: row.canGenerateGreetingCards,
    greetingTemplate: row.greetingTemplate, showInDashboardUpcoming: row.showInDashboardUpcoming,
  }),
});

const naturalIdentity = (domain, row) => {
  const keys = {
    moments: [row.userId, normalizeText(row.name), row.date, normalizeText(row.type), normalizeText(row.recurrence)],
    activities: [row.userId, row.momentId, normalizeText(row.title), row.date],
    memories: [row.userId, row.momentId, normalizeText(row.title), row.createdAt || null],
    attachments: [row.userId, row.momentId, row.url || '', normalizeText(row.name), normalizeText(row.type), Number(row.size || 0)],
    expenses: [row.userId, row.momentId || row.eventId || null, row.activityId || null, row.date, minorUnits(row.amount), normalizeText(row.name), normalizeText(row.category)],
    incomes: [row.userId, row.date, minorUnits(row.amount), normalizeText(row.name), normalizeText(row.type)],
    settings: [row.userId, row.key],
    codeLists: [row.userId, row.listKey, normalizeText(row.entryValue)],
  }[domain];
  return keys ? stableStringify(keys) : null;
};

const recordIdentities = (row) => [row.id, row.firestoreId, row.originalId]
  .filter((value) => value !== undefined && value !== null && value !== '')
  .map(String);

export const getMigrationRecordFingerprint = async (domain, row) => {
  const selector = fingerprintFields[domain];
  if (!selector) throw new Error(`No duplicate fingerprint is registered for ${domain}.`);
  return canonicalFingerprint(selector(row));
};

export const detectMigrationDuplicates = async (domain, incoming = [], existing = []) => {
  const kept = [];
  const duplicates = [];
  const conflicts = [];
  const identityIndex = new Map();
  const fingerprintIndex = new Map();
  const naturalIndex = new Map();

  const indexRecord = async (row, origin) => {
    const fingerprint = await getMigrationRecordFingerprint(domain, row);
    for (const identity of recordIdentities(row)) {
      const indexed = identityIndex.get(identity);
      if (indexed) {
        if (indexed.fingerprint === fingerprint) {
          return { kind: 'duplicate', matched: indexed.row, rule: 'identity-and-content' };
        }
        return { kind: 'conflict', matched: indexed.row, rule: 'identity-content-conflict' };
      }
    }

    const natural = naturalIdentity(domain, row);
    const naturalMatch = natural ? naturalIndex.get(natural) : null;
    if (naturalMatch) {
      if (naturalMatch.fingerprint === fingerprint) return { kind: 'duplicate', matched: naturalMatch.row, rule: 'natural-identity-and-content' };
      return { kind: 'conflict', matched: naturalMatch.row, rule: 'natural-identity-content-conflict' };
    }

    const sameFingerprint = fingerprintIndex.get(fingerprint);
    if (sameFingerprint) return { kind: 'duplicate', matched: sameFingerprint.row, rule: 'canonical-content-fingerprint' };

    const indexed = { row, fingerprint, origin };
    for (const identity of recordIdentities(row)) identityIndex.set(identity, indexed);
    fingerprintIndex.set(fingerprint, indexed);
    if (natural) naturalIndex.set(natural, indexed);
    return { kind: 'new' };
  };

  for (const row of existing) await indexRecord(row, 'dexie');
  for (const row of incoming) {
    const result = await indexRecord(row, row.source || 'legacy');
    if (result.kind === 'duplicate') duplicates.push({ row, matched: result.matched, rule: result.rule });
    else if (result.kind === 'conflict') conflicts.push({ row, matched: result.matched, rule: result.rule });
    else kept.push(row);
  }

  return { kept, duplicates, conflicts };
};
