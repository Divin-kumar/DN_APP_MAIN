import { DATABASE_TABLES } from '../database/tables.js';
import { VALID_INCOME_SOURCES } from './incomeRepository.validation.js';

const normalizeIncomeDate = (value) => {
  const fallback = new Date().toISOString().slice(0, 10);
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
};

export const mapIncomeRecord = (record = {}, userId = null) => {
  if (!record || typeof record !== 'object') return null;

  const now = new Date().toISOString();
  const id = String(record.id ?? record.firestoreId ?? crypto.randomUUID());
  const amount = Number(record.amount ?? 0);
  const type = typeof record.type === 'string' && record.type.trim().length > 0
    ? record.type.trim()
    : 'Other';

  return {
    id,
    userId,
    name: typeof record.name === 'string' ? record.name.trim() : String(record.name ?? 'Income').trim() || 'Income',
    type,
    amount: Number.isFinite(amount) ? amount : 0,
    date: normalizeIncomeDate(record.date),
    description: typeof record.description === 'string' ? record.description.trim() : '',
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    source: VALID_INCOME_SOURCES.includes(record.source) ? record.source : 'legacy',
    firestoreId: record.firestoreId || null,
    table: DATABASE_TABLES.INCOMES,
  };
};

export const mapIncomeCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapIncomeRecord(record, userId))
    .filter(Boolean);
