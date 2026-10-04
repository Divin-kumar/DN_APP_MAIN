import { hasRequiredFields, isIsoDate, isSerializable } from '../validators/base.js';

export const VALID_MOMENT_SOURCES = Object.freeze(['manual', 'firebase', 'guest', 'legacy', 'dexie']);
export const VALID_MOMENT_STATUS_VALUES = Object.freeze(['active', 'completed', 'archived', 'cancelled', 'upcoming', 'overdue', 'in-progress']);
export const VALID_RECURRING_VALUES = Object.freeze(['none', 'daily', 'weekly', 'monthly', 'yearly']);

export const normalizeMomentStatus = (status) => {
  const value = typeof status === 'string' ? status.toLowerCase() : '';
  if (value === 'in-progress') return 'active';
  return VALID_MOMENT_STATUS_VALUES.includes(value) ? value : 'active';
};

export const validateMomentRecord = (record = {}) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Moment record is required.'] };
  }

  if (!hasRequiredFields(record, ['id', 'userId', 'name', 'date', 'type'])) {
    errors.push('Moment record is missing required identifiers or values.');
  }

  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    errors.push('Moment name is required.');
  }

  if (!isIsoDate(String(record.date ?? ''))) {
    errors.push('Moment date must be a valid ISO date string.');
  }

  if (typeof record.type !== 'string' || record.type.trim().length === 0) {
    errors.push('Moment type is required.');
  }

  if (record.recurrence && !VALID_RECURRING_VALUES.includes(String(record.recurrence).toLowerCase())) {
    errors.push('Invalid recurrence value.');
  }

  if (record.status && !VALID_MOMENT_STATUS_VALUES.includes(String(record.status).toLowerCase()) && String(record.status).toLowerCase() !== 'in-progress') {
    errors.push('Unsupported moment status.');
  }

  if (record.source && !VALID_MOMENT_SOURCES.includes(record.source)) {
    errors.push('Unsupported moment source.');
  }

  if (!isSerializable(record)) {
    errors.push('Moment record must be serializable.');
  }

  return { valid: errors.length === 0, errors };
};
