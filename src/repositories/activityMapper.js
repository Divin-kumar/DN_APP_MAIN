import { DATABASE_TABLES } from '../database/tables.js';
import { VALID_ACTIVITY_SOURCES } from './activityRepository.validation.js';

const normalizeActivityDate = (value) => {
  const fallback = new Date().toISOString().slice(0, 10);
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
};

export const mapActivityRecord = (record = {}, userId = null) => {
  if (!record || typeof record !== 'object') return null;

  const now = new Date().toISOString();
  const id = String(record.id ?? record.firestoreId ?? crypto.randomUUID());
  const title = typeof record.title === 'string' ? record.title.trim() : String(record.title ?? '').trim();

  return {
    id,
    userId,
    momentId: record.momentId ?? record.eventId ?? null,
    title,
    date: normalizeActivityDate(record.date),
    description: typeof record.description === 'string' ? record.description : '',
    completed: Boolean(record.completed),
    cancelled: Boolean(record.cancelled),
    priority: typeof record.priority === 'string' && record.priority.trim().length > 0 ? record.priority.trim().toLowerCase() : 'medium',
    completedAt: record.completedAt || null,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    source: VALID_ACTIVITY_SOURCES.includes(record.source) ? record.source : 'legacy',
    firestoreId: record.firestoreId || null,
    table: DATABASE_TABLES.ACTIVITIES,
  };
};

export const mapActivityCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapActivityRecord(record, userId))
    .filter(Boolean);
