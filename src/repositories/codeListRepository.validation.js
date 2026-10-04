import { isSerializable } from '../validators/base.js';

export const VALID_CODELIST_KEYS = Object.freeze({
  EVENT_TYPES: 'eventTypes',
  INCOME_TYPES: 'incomeTypes',
  EXPENSE_CATEGORIES: 'expenseCategories',
  ACTIVITY_PRIORITIES: 'activityPriorities',
  REMINDER_PRESETS: 'reminderPresets',
});

export const validateCodeListKey = (key) => Boolean(key && Object.values(VALID_CODELIST_KEYS).includes(key));

export const validateCodeListRecord = (record = {}) => {
  const errors = [];
  if (!record || typeof record !== 'object') {
    errors.push('Code list record must be an object.');
    return { valid: false, errors };
  }

  if (!record.listKey || !validateCodeListKey(record.listKey)) {
    errors.push('Code list key is invalid or unsupported.');
  }

  if (!record.entryValue || typeof record.entryValue !== 'string') {
    errors.push('Code list entryValue is required.');
  }

  if (!record.label || typeof record.label !== 'string') {
    errors.push('Code list label is required.');
  }

  if (!isSerializable(record)) {
    errors.push('Code list record must be serializable.');
  }

  return { valid: errors.length === 0, errors };
};
