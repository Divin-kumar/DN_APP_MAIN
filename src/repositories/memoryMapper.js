import { DATABASE_TABLES } from '../database/tables.js';
import { VALID_MEMORY_SOURCES } from './memoryRepository.validation.js';

const normalizeMemoryDate = (value) => {
  const fallback = new Date().toISOString();
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
};

export const mapMemoryRecord = (record = {}, userId = null) => {
  if (!record || typeof record !== 'object') return null;

  const now = new Date().toISOString();
  const id = String(record.id ?? record.firestoreId ?? crypto.randomUUID());
  return {
    id,
    userId,
    momentId: record.momentId ?? record.eventId ?? null,
    title: typeof record.title === 'string' ? record.title.trim() : String(record.title ?? '').trim() || 'Memory',
    content: typeof record.content === 'string' ? record.content : String(record.content ?? '').trim(),
    kind: typeof record.kind === 'string' ? record.kind.trim() : 'note',
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    source: VALID_MEMORY_SOURCES.includes(record.source) ? record.source : 'legacy',
    firestoreId: record.firestoreId || null,
    table: DATABASE_TABLES.MEMORIES,
  };
};

export const mapMemoryCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapMemoryRecord(record, userId))
    .filter(Boolean);
