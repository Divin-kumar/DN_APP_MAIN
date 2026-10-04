import { hasRequiredFields, isIsoDate, isNonEmptyString } from './base.js';

export const validateMomentRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'userId', 'name', 'date', 'type', 'createdAt', 'updatedAt'])) {
    errors.push('Moment record is missing required fields.');
  }
  if (!isNonEmptyString(record.name)) errors.push('Moment name must be a non-empty string.');
  if (!isIsoDate(record.date)) errors.push('Moment date must be an ISO date string.');
  if (!isIsoDate(record.createdAt) || !isIsoDate(record.updatedAt)) errors.push('Moment timestamps must be valid ISO strings.');
  return { valid: errors.length === 0, errors };
};

export const validateActivityRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'momentId', 'title', 'date', 'createdAt', 'updatedAt'])) {
    errors.push('Activity record is missing required fields.');
  }
  if (!isNonEmptyString(record.title)) errors.push('Activity title must be a non-empty string.');
  if (!isIsoDate(record.date)) errors.push('Activity date must be an ISO date string.');
  if (record.completed && !record.completedAt) errors.push('Completed activities require a completedAt timestamp.');
  return { valid: errors.length === 0, errors };
};

export const validateMemoryRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'momentId', 'title', 'body', 'createdAt', 'updatedAt'])) {
    errors.push('Memory record is missing required fields.');
  }
  if (!isNonEmptyString(record.title)) errors.push('Memory title must be a non-empty string.');
  if (!isNonEmptyString(record.body)) errors.push('Memory body must be a non-empty string.');
  return { valid: errors.length === 0, errors };
};

export const validateAttachmentRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'momentId', 'name', 'type', 'size', 'createdAt', 'updatedAt'])) {
    errors.push('Attachment record is missing required fields.');
  }
  if (typeof record.size !== 'number' || record.size < 0) errors.push('Attachment size must be a non-negative number.');
  return { valid: errors.length === 0, errors };
};

export const validateExpenseRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'name', 'amount', 'category', 'date', 'createdAt', 'updatedAt'])) {
    errors.push('Expense record is missing required fields.');
  }
  if (typeof record.amount !== 'number' || Number(record.amount) < 0) errors.push('Expense amount must be a non-negative number.');
  return { valid: errors.length === 0, errors };
};

export const validateIncomeRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'name', 'type', 'amount', 'date', 'createdAt', 'updatedAt'])) {
    errors.push('Income record is missing required fields.');
  }
  if (typeof record.amount !== 'number' || Number(record.amount) < 0) errors.push('Income amount must be a non-negative number.');
  return { valid: errors.length === 0, errors };
};

export const validateSettingsRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'userId', 'key', 'createdAt', 'updatedAt'])) {
    errors.push('Settings record is missing required fields.');
  }
  if (!isNonEmptyString(record.key)) errors.push('Settings key must be a non-empty string.');
  return { valid: errors.length === 0, errors };
};

export const validateCodeListRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'userId', 'listKey', 'entryValue', 'label', 'createdAt', 'updatedAt'])) {
    errors.push('Code list record is missing required fields.');
  }
  if (!isNonEmptyString(record.listKey)) errors.push('Code list key must be a non-empty string.');
  if (!isNonEmptyString(record.entryValue)) errors.push('Code list entry value must be a non-empty string.');
  return { valid: errors.length === 0, errors };
};

export const validateMetadataRecord = (record = {}) => {
  const errors = [];
  if (!record || typeof record !== 'object') {
    errors.push('Metadata record must be an object.');
    return { valid: false, errors };
  }
  if (!record.key) errors.push('Metadata key is required.');
  if (!record.updatedAt) errors.push('Metadata updatedAt is required.');
  return { valid: errors.length === 0, errors };
};
