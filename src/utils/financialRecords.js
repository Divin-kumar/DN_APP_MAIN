import { recordId } from './recordIdentity.js';
import { normalizePaymentMethod } from './paymentMethod.js';

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
  paymentMethod: normalizePaymentMethod(item.paymentMethod),
  ...(kind === 'income' ? { type: item.type || item.category || 'Other' } : { category: item.category || 'Other' }),
  description: String(item.description ?? item.notes ?? ''),
  notes: String(item.notes ?? item.description ?? ''),
  date: financialDate(item.date, financialDate(item.createdAt, financialDate(new Date()))),
  createdAt: financialTimestamp(item.createdAt),
  eventId: recordId(item.eventId) || null,
  activityId: recordId(item.activityId) || null,
  ...(kind === 'expense' ? { source: item.source || 'manual' } : {}),
});

// Runtime document provenance only. Collection names and document IDs are
// constrained before they can participate in an account mutation.
export const getFinancialRecordSources = (record, kind = 'expense', fallbackId = '') => {
  const typedCollection = kind === 'income' ? 'incomes' : 'expenses';
  const sources = new Map();
  const add = (collection, id) => {
    if (![typedCollection, 'transactions'].includes(collection)
      || typeof id !== 'string' || !id.trim() || id.includes('/')) return;
    sources.set(`${collection}/${id}`, { collection, id });
  };
  add(record.firestoreCollection === 'transactions' ? 'transactions' : typedCollection,
    record.firestoreId || fallbackId);
  for (const source of Array.isArray(record.firestoreSources) ? record.firestoreSources : []) {
    if (source && typeof source === 'object') add(source.collection, source.id);
  }
  return [...sources.values()];
};

export const mergeFinancialRecords = (records, kind = 'expense') => {
  const byId = new Map();
  for (const record of records) {
    const sources = getFinancialRecordSources(record, kind);
    const normalized = {
      ...normalizeFinancialRecord(record, kind),
      ...(record.firestoreId ? { firestoreId: record.firestoreId } : {}),
      ...(['transactions', kind === 'income' ? 'incomes' : 'expenses'].includes(record.firestoreCollection)
        ? { firestoreCollection: record.firestoreCollection } : {}),
      ...(sources.length ? { firestoreSources: sources } : {}),
    };
    if (!byId.has(normalized.id)) byId.set(normalized.id, normalized);
    else if (sources.length) {
      const current = byId.get(normalized.id);
      current.firestoreSources = getFinancialRecordSources({ ...current,
        firestoreSources: [...(current.firestoreSources || []), ...sources] }, kind);
    }
  }
  return [...byId.values()];
};

export const mergeFinancialExpenses = (records) => mergeFinancialRecords(records, 'expense');
