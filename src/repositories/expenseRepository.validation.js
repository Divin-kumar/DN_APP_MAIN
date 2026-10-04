import { hasRequiredFields, isIsoDate, isSerializable, validateStringIdentifiers } from '../validators/base.js';

export const VALID_EXPENSE_SOURCES = Object.freeze(['manual', 'firebase', 'guest', 'legacy', 'dexie']);

export const validateExpenseRecord = (record = {}) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Expense record is required.'] };
  }

  if (!hasRequiredFields(record, ['id', 'userId', 'name', 'date', 'category'])) {
    errors.push('Expense record is missing required identifiers or required fields.');
  }
  errors.push(...validateStringIdentifiers(record, ['id', 'userId']));
  for (const field of ['momentId', 'eventId', 'activityId']) {
    if (record[field] !== null && record[field] !== undefined) errors.push(...validateStringIdentifiers(record, [field]));
  }

  const amount = Number(record.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    errors.push('Expense amount must be a finite number greater than or equal to zero.');
  }

  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    errors.push('Expense name is required.');
  }

  if (typeof record.category !== 'string' || record.category.trim().length === 0) {
    errors.push('Expense category is required.');
  }

  if (!isIsoDate(String(record.date ?? ''))) {
    errors.push('Expense date must be a valid ISO date string.');
  }

  if (record.source && !VALID_EXPENSE_SOURCES.includes(record.source)) {
    errors.push('Unsupported expense source.');
  }

  if (record.activityId && !record.eventId) {
    errors.push('An activity-linked expense requires an eventId.');
  }

  if (!isSerializable(record)) {
    errors.push('Expense record must be serializable.');
  }

  return { valid: errors.length === 0, errors };
};
