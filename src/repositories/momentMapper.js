import { DATABASE_TABLES } from '../database/tables.js';
import { VALID_MOMENT_SOURCES, VALID_MOMENT_STATUS_VALUES } from './momentRepository.validation.js';

const normalizeMomentDate = (value) => {
  const fallback = new Date().toISOString().slice(0, 10);
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
};

const normalizeMomentStatus = (status) => {
  const value = typeof status === 'string' ? status.toLowerCase() : '';
  if (value === 'in-progress') return 'active';
  return VALID_MOMENT_STATUS_VALUES.includes(value) ? value : 'active';
};

export const mapMomentRecord = (record = {}, userId = null) => {
  if (!record || typeof record !== 'object') return null;

  const now = new Date().toISOString();
  const id = String(record.id ?? record.firestoreId ?? crypto.randomUUID());
  const name = typeof record.name === 'string' ? record.name.trim() : String(record.name ?? 'Moment').trim() || 'Moment';
  const momentType = typeof record.type === 'string' && record.type.trim().length > 0 ? record.type.trim() : 'Personal';

  return {
    id,
    userId,
    name,
    date: normalizeMomentDate(record.date),
    type: momentType,
    customType: typeof record.customType === 'string' ? record.customType.trim() : '',
    recurrence: typeof record.recurrence === 'string' && record.recurrence.trim().length > 0 ? record.recurrence.trim().toLowerCase() : 'none',
    budget: Number.isFinite(Number(record.budget)) ? Number(record.budget) : 0,
    notes: typeof record.notes === 'string' ? record.notes : '',
    greetingCard: record.greetingCard && typeof record.greetingCard === 'object'
      ? {
          title: String(record.greetingCard.title ?? '').trim(),
          body: String(record.greetingCard.body ?? '').trim(),
          updatedAt: record.greetingCard.updatedAt || now,
        }
      : null,
    status: normalizeMomentStatus(record.status),
    archived: Boolean(record.archived),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    source: VALID_MOMENT_SOURCES.includes(record.source) ? record.source : 'legacy',
    firestoreId: record.firestoreId || null,
    table: DATABASE_TABLES.MOMENTS,
  };
};

export const mapMomentCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapMomentRecord(record, userId))
    .filter(Boolean);
