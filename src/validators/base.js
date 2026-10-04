export const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

export const validateStringIdentifiers = (record, fields = []) => fields
  .filter((field) => !isNonEmptyString(record?.[field]))
  .map((field) => `${field} must be a non-empty string.`);

export const hasRequiredFields = (record = {}, fields = []) => {
  if (!record || typeof record !== 'object') return false;
  return fields.every((field) => {
    const value = record[field];
    return value !== undefined && value !== null && value !== '';
  });
};

export const isIsoDate = (value) => {
  if (typeof value !== 'string' || value.length === 0) return false;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return parsedDate.getUTCFullYear() === Number(year)
      && parsedDate.getUTCMonth() === Number(month) - 1
      && parsedDate.getUTCDate() === Number(day);
  }
  const timestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!timestamp) return false;
  const [, year, month, day, hour, minute, second] = timestamp;
  const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendarDate.getUTCFullYear() !== Number(year)
    || calendarDate.getUTCMonth() !== Number(month) - 1
    || calendarDate.getUTCDate() !== Number(day)
    || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return false;
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
