import { hasRequiredFields, isSerializable } from '../validators/base.js';

export const VALID_SETTINGS_KEYS = Object.freeze({
  THEME: 'theme',
  CURRENCY: 'currency',
  DASHBOARD_VIEW: 'dashboardView',
  DEFAULT_EVENT_TYPE: 'defaultEventType',
  DEFAULT_INCOME_TYPE: 'defaultIncomeType',
  DEFAULT_EXPENSE_CATEGORY: 'defaultExpenseCategory',
  NOTIFICATIONS: 'notifications',
  LIST_SORT: 'listSort',
});

export const validateSettingsKey = (key) => Boolean(key && Object.values(VALID_SETTINGS_KEYS).includes(key));

export const validateSettingsValue = (key, value) => {
  if (!validateSettingsKey(key)) return { valid: false, errors: ['Unsupported setting key.'] };
  if (!isSerializable(value)) return { valid: false, errors: ['Setting value must be serializable.'] };

  if (key === VALID_SETTINGS_KEYS.THEME) {
    return { valid: ['dark', 'light'].includes(String(value)), errors: [] };
  }

  if (key === VALID_SETTINGS_KEYS.CURRENCY) {
    return { valid: typeof value === 'string' && value.trim().length > 0, errors: [] };
  }

  if (key === VALID_SETTINGS_KEYS.NOTIFICATIONS) {
    return {
      valid: value && typeof value === 'object' && !Array.isArray(value),
      errors: value && typeof value === 'object' && !Array.isArray(value) ? [] : ['Notifications must be an object.'],
    };
  }

  return { valid: true, errors: [] };
};

export const validateSettingsRecord = (record = {}) => {
  const errors = [];
  if (!hasRequiredFields(record, ['id', 'userId', 'key', 'value', 'updatedAt'])) {
    errors.push('Settings record is missing required identifiers or values.');
  }

  if (!validateSettingsKey(record.key)) {
    errors.push('Settings key is not supported.');
  }

  if (!validateSettingsValue(record.key, record.value).valid) {
    errors.push(...validateSettingsValue(record.key, record.value).errors);
  }

  return { valid: errors.length === 0, errors };
};
