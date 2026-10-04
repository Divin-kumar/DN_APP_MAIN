import { DATABASE_TABLES } from '../database/tables.js';
import { VALID_EXPENSE_SOURCES } from './expenseRepository.validation.js';

const normalizeExpenseDate = (value) => {
  const fallback = new Date().toISOString().slice(0, 10);
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
};

export const mapExpenseRecord = (record = {}, userId = null) => {
  if (!record || typeof record !== 'object') return null;

  const now = new Date().toISOString();
  const id = String(record.id ?? record.firestoreId ?? crypto.randomUUID());
  const amount = Number(record.amount ?? 0);
  const category = typeof record.category === 'string' && record.category.trim().length > 0
    ? record.category.trim()
    : 'Other';

  const normalized = {
    id,
    userId,
    name: typeof record.name === 'string' ? record.name.trim() : String(record.name ?? 'Expense').trim() || 'Expense',
    amount: Number.isFinite(amount) ? amount : 0,
    category,
    description: typeof record.description === 'string' ? record.description.trim() : '',
    date: normalizeExpenseDate(record.date),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    eventId: record.eventId ?? record.event_id ?? null,
    activityId: record.activityId ?? record.activity_id ?? null,
    momentId: record.momentId ?? record.eventId ?? null,
    source: VALID_EXPENSE_SOURCES.includes(record.source) ? record.source : 'legacy',
    firestoreId: record.firestoreId || null,
    table: DATABASE_TABLES.EXPENSES,
  };

  return normalized;
};

export const mapExpenseCollection = (records = [], userId = null) =>
  (Array.isArray(records) ? records : [])
    .map((record) => mapExpenseRecord(record, userId))
    .filter(Boolean);
