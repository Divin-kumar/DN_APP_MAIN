import { DATABASE_TABLES } from '../database/tables.js';

export const mapSettingsRecord = (record = {}, userId = null) => {
  const now = new Date().toISOString();
  const key = typeof record.key === 'string' ? record.key : null;
  if (!key) return null;

  return {
    id: record.id || crypto.randomUUID(),
    userId,
    key,
    value: record.value ?? null,
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    source: record.source || 'legacy',
    table: DATABASE_TABLES.SETTINGS,
  };
};

export const mapSettingsCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapSettingsRecord(record, userId))
    .filter(Boolean);
