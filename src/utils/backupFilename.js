const pad = (value) => String(value).padStart(2, '0');

export const sanitizeDeviceName = (value) => {
  const normalized = String(value || 'Device')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  return normalized.slice(0, 48) || 'Device';
};

export const buildBackupFilename = (date = new Date(), deviceName = 'Device') => {
  const localDate = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const localTime = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `DN_Backup_${localDate}_${sanitizeDeviceName(deviceName)}_${localTime}.json`;
};
