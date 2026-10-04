export const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

export const hasRequiredFields = (record = {}, fields = []) => {
  if (!record || typeof record !== 'object') return false;
  return fields.every((field) => {
    const value = record[field];
    return value !== undefined && value !== null && value !== '';
  });
};

export const isIsoDate = (value) => {
  if (typeof value !== 'string' || value.length === 0) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

export const isSerializable = (value) => {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
};

export const normalizeOptionalString = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim();
  return fallback;
};
