import { hasRequiredFields, isIsoDate, isSerializable, validateStringIdentifiers } from '../validators/base.js';

export const VALID_INCOME_SOURCES = Object.freeze(['manual', 'firebase', 'guest', 'legacy', 'dexie']);

export const validateIncomeRecord = (record = {}) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Income record is required.'] };
  }

  if (!hasRequiredFields(record, ['id', 'userId', 'name', 'date', 'type'])) {
    errors.push('Income record is missing required identifiers or required fields.');
  }
  errors.push(...validateStringIdentifiers(record, ['id', 'userId']));

  const amount = Number(record.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    errors.push('Income amount must be a finite number greater than or equal to zero.');
  }

  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    errors.push('Income name is required.');
  }

  if (typeof record.type !== 'string' || record.type.trim().length === 0) {
    errors.push('Income type is required.');
  }

  if (!isIsoDate(String(record.date ?? ''))) {
    errors.push('Income date must be a valid ISO date string.');
  }

  if (record.source && !VALID_INCOME_SOURCES.includes(record.source)) {
    errors.push('Unsupported income source.');
  }

  if (!isSerializable(record)) {
    errors.push('Income record must be serializable.');
  }

  return { valid: errors.length === 0, errors };
};
