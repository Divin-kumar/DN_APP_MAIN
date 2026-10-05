import { hasRequiredFields, isSerializable, isIsoDate, validateStringIdentifiers } from '../validators/base.js';

export const VALID_SETTINGS_KEYS = Object.freeze({
  THEME: 'theme',
  CURRENCY: 'currency',
  DASHBOARD_VIEW: 'dashboardView',
  DEFAULT_EVENT_TYPE: 'defaultEventType',
  DEFAULT_INCOME_TYPE: 'defaultIncomeType',
  DEFAULT_EXPENSE_CATEGORY: 'defaultExpenseCategory',
  NOTIFICATIONS: 'notifications',
  LIST_SORT: 'listSort',
  PROFILE: 'profile',
});

export const validateSettingsKey = (key) => Boolean(key && Object.values(VALID_SETTINGS_KEYS).includes(key));

export const validateSettingsValue = (key, value) => {
  if (!validateSettingsKey(key)) return { valid: false, errors: ['Unsupported setting key.'] };
  if (!isSerializable(value)) return { valid: false, errors: ['Setting value must be serializable.'] };

  if (key === VALID_SETTINGS_KEYS.THEME) {
    const valid = ['dark', 'light'].includes(String(value));
    return { valid, errors: valid ? [] : ['Theme must be dark or light.'] };
  }

  if (key === VALID_SETTINGS_KEYS.CURRENCY) {
    const valid = typeof value === 'string' && value.trim().length > 0;
    return { valid, errors: valid ? [] : ['Currency must be a non-empty string.'] };
  }

  if (key === VALID_SETTINGS_KEYS.NOTIFICATIONS) {
    return {
      valid: value && typeof value === 'object' && !Array.isArray(value),
      errors: value && typeof value === 'object' && !Array.isArray(value) ? [] : ['Notifications must be an object.'],
    };
  }

  if (key === VALID_SETTINGS_KEYS.PROFILE) {
    const valid = value && typeof value === 'object' && !Array.isArray(value)
      && ['displayName', 'nickname', 'description', 'photoDataUrl'].every((field) => typeof value[field] === 'string')
      && value.displayName.length <= 80
      && value.nickname.length <= 80
      && value.description.length <= 500
      && value.photoDataUrl.length <= 750_000
      && (!value.photoDataUrl || /^data:image\/(jpeg|png|webp);base64,/.test(value.photoDataUrl));
    return { valid, errors: valid ? [] : ['Profile must contain valid local profile text and an optional JPEG, PNG, or WebP image under 750 KB.'] };
  }

  return { valid: true, errors: [] };
};

export const validateSettingsRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'userId', 'key', 'value', 'updatedAt'])) {
    errors.push('Settings record is missing required identifiers or values.');
  }
  errors.push(...validateStringIdentifiers(record, ['id', 'userId', 'key']));
  if (!isIsoDate(String(record.updatedAt ?? ''))) errors.push('Settings updatedAt must be a valid ISO timestamp.');
  if (record.createdAt && !isIsoDate(String(record.createdAt))) errors.push('Settings createdAt must be a valid ISO timestamp.');

  if (!validateSettingsKey(record.key)) {
    errors.push('Settings key is not supported.');
  }

  if (!validateSettingsValue(record.key, record.value).valid) {
    errors.push(...validateSettingsValue(record.key, record.value).errors);
  }

  return { valid: errors.length === 0, errors };
};
