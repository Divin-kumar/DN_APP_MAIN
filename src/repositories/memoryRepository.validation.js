import { hasRequiredFields, isSerializable } from '../validators/base.js';

export const VALID_MEMORY_SOURCES = Object.freeze(['manual', 'firebase', 'guest', 'legacy', 'dexie']);

export const validateMemoryRecord = (record = {}) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Memory record is required.'] };
  }

  if (!hasRequiredFields(record, ['id', 'userId', 'momentId'])) {
    errors.push('Memory record is missing required identifiers.');
  }

  if (typeof record.title !== 'string' || record.title.trim().length === 0) {
    if (typeof record.content !== 'string' || record.content.trim().length === 0) {
      errors.push('Memory title or content is required.');
    }
  }

  if (record.source && !VALID_MEMORY_SOURCES.includes(record.source)) {
    errors.push('Unsupported memory source.');
  }

  if (!isSerializable(record)) {
    errors.push('Memory record must be serializable.');
  }

  return { valid: errors.length === 0, errors };
};
