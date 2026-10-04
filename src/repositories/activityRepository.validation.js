import { hasRequiredFields, isIsoDate, isSerializable, validateStringIdentifiers } from '../validators/base.js';

export const VALID_ACTIVITY_SOURCES = Object.freeze(['manual', 'firebase', 'guest', 'legacy', 'dexie']);
export const VALID_ACTIVITY_PRIORITIES = Object.freeze(['low', 'medium', 'high']);

export const validateActivityRecord = (record = {}) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Activity record is required.'] };
  }

  if (!hasRequiredFields(record, ['id', 'userId', 'momentId', 'title', 'date'])) {
    errors.push('Activity record is missing required identifiers or values.');
  }
  errors.push(...validateStringIdentifiers(record, ['id', 'userId', 'momentId']));

  if (typeof record.title !== 'string' || record.title.trim().length === 0) {
    errors.push('Activity title is required.');
  }

  if (!isIsoDate(String(record.date ?? ''))) {
    errors.push('Activity date must be a valid ISO date string.');
  }

  if (record.priority && !VALID_ACTIVITY_PRIORITIES.includes(String(record.priority).toLowerCase())) {
    errors.push('Unsupported activity priority.');
  }

  if (record.completed && !record.completedAt) {
    errors.push('Completed activities must include a completion timestamp.');
  }

  if (record.source && !VALID_ACTIVITY_SOURCES.includes(record.source)) {
    errors.push('Unsupported activity source.');
  }

  if (!isSerializable(record)) {
    errors.push('Activity record must be serializable.');
  }

  return { valid: errors.length === 0, errors };
};
