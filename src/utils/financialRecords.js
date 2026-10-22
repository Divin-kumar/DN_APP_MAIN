import { recordId } from './recordIdentity.js';

const pad = (value) => String(value).padStart(2, '0');

export const financialTimestamp = (value) => {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  let parsed;
  try {
    if (value instanceof Date) parsed = value;
    else if (value && typeof value.toDate === 'function') parsed = value.toDate();
    else if (value && typeof value === 'object' && Number.isFinite(value.seconds ?? value._seconds)) {
      parsed = new Date((value.seconds ?? value._seconds) * 1000
        + (value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6);
    }
  } catch { /* Invalid legacy metadata gets a current creation fallback. */ }
  return parsed instanceof Date && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};

// Preserve calendar-only strings; accept Firestore Timestamp and JSON backups of it.
export const financialDate = (value, fallback = '') => {
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
    if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  }
  let parsed;
  try {
    if (value instanceof Date) parsed = value;
    else if (value && typeof value.toDate === 'function') parsed = value.toDate();
    else if (value && typeof value === 'object' && Number.isFinite(value.seconds ?? value._seconds)) {
      parsed = new Date((value.seconds ?? value._seconds) * 1000);
    } else if (value !== null && value !== undefined && value !== '') parsed = new Date(value);
  } catch { /* Fall through to the explicit default. */ }
  if (!(parsed instanceof Date) || !Number.isFinite(parsed.getTime())) return fallback;
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

export const normalizeFinancialRecord = (item = {}, kind = 'expense', fallbackId = '') => ({
  id: recordId(item.id) || recordId(item.firestoreId) || recordId(fallbackId) || crypto.randomUUID(),
  name: String(item.name ?? item.title ?? '').trim(),
  amount: Number(item.amount ?? 0),
  ...(kind === 'income' ? { type: item.type || item.category || 'Other' } : { category: item.category || 'Other' }),
  description: String(item.description ?? item.notes ?? '').trim(),
  notes: String(item.notes ?? item.description ?? '').trim(),
  date: financialDate(item.date, financialDate(item.createdAt, financialDate(new Date()))),
  createdAt: financialTimestamp(item.createdAt),
  eventId: recordId(item.eventId) || null,
  activityId: recordId(item.activityId) || null,
  ...(kind === 'expense' ? { source: item.source || 'manual' } : {}),
});

export const mergeFinancialExpenses = (records) => {
  const byId = new Map();
  for (const record of records) {
    const normalized = {
      ...normalizeFinancialRecord(record),
      ...(record.firestoreId ? { firestoreId: record.firestoreId } : {}),
    };
    if (!byId.has(normalized.id)) byId.set(normalized.id, normalized);
  }
  return [...byId.values()];
};
