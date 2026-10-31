import { recordId } from './recordIdentity.js';

// Dashboard shortcuts are optional in historical backups. Absence is different
// from an explicitly exported empty list, which intentionally clears it.
const FIELDS = Object.freeze(['favorites', 'recent']);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const validateBackupDashboardConfiguration = (configuration) => {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new Error('Backup dashboard configuration must be an object.');
  }
  for (const key of FIELDS) {
    if (!owns(configuration, key)) continue;
    const values = configuration[key];
    if (!Array.isArray(values) || values.some((value) => !recordId(value))) {
      throw new Error(`Backup dashboard ${key} must be an array of valid Moment IDs.`);
    }
  }
  return configuration;
};

export const dashboardConfigurationRestorePatch = (configuration, validMomentIds) => {
  validateBackupDashboardConfiguration(configuration);
  // Restored Moments may still use pre-v3 numeric IDs; compare their
  // normalized identities with portable dashboard shortcut IDs.
  const knownIds = new Set(Array.from(validMomentIds, recordId).filter(Boolean));
  const result = {};
  for (const key of FIELDS) {
    if (!owns(configuration, key)) continue;
    const ids = configuration[key].map(recordId).filter((id) => knownIds.has(id));
    const distinct = [...new Set(ids)];
    result[key] = key === 'recent' ? distinct.slice(0, 8) : distinct;
  }
  return result;
};
