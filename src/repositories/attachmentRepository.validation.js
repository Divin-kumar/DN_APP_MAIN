import { hasRequiredFields, isSerializable, isIsoDate, validateStringIdentifiers } from '../validators/base.js';

export const VALID_ATTACHMENT_SOURCES = Object.freeze(['manual', 'firebase', 'guest', 'legacy', 'dexie']);

export const validateAttachmentRecord = (record = {}) => {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Attachment record is required.'] };
  }

  if (!hasRequiredFields(record, ['id', 'userId', 'name'])) {
    errors.push('Attachment record is missing required identifiers or values.');
  }
  errors.push(...validateStringIdentifiers(record, ['id', 'userId', ...(record.momentId ? ['momentId'] : [])]));

  if (typeof record.name !== 'string' || record.name.trim().length === 0) {
    errors.push('Attachment name is required.');
  }

  if (record.size !== undefined && (!Number.isFinite(Number(record.size)) || Number(record.size) < 0)) {
    errors.push('Attachment size must be a finite number zero or greater.');
  }

  if (record.source && !VALID_ATTACHMENT_SOURCES.includes(record.source)) {
    errors.push('Unsupported attachment source.');
  }

  for (const field of ['createdAt', 'updatedAt']) {
    if (record[field] && !isIsoDate(String(record[field]))) errors.push(`Attachment ${field} must be a valid ISO timestamp.`);
  }

  if (!isSerializable(record)) {
    errors.push('Attachment record must be serializable.');
  }

  return { valid: errors.length === 0, errors };
};
