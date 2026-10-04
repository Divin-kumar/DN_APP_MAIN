export const SETTINGS_LEGACY_KEYS = Object.freeze({
  PREFERENCES: 'lifehub_preferences',
  THEME: 'lifehub_theme_choice',
  ADMIN_VALUES: 'lifehub_admin_values',
  ADMIN_VALUES_VERSION: 'lifehub_admin_values_schema_version',
});

export const readLegacySettings = () => {
  const snapshot = {};

  for (const [key, valueKey] of Object.entries(SETTINGS_LEGACY_KEYS)) {
    const value = localStorage.getItem(valueKey);
    snapshot[key] = value === null ? null : value;
  }

  try {
    const preferences = JSON.parse(localStorage.getItem(SETTINGS_LEGACY_KEYS.PREFERENCES) || '{}');
    snapshot.preferences = preferences;
  } catch {
    snapshot.preferences = {};
  }

  try {
    const adminValues = JSON.parse(localStorage.getItem(SETTINGS_LEGACY_KEYS.ADMIN_VALUES) || '{}');
    snapshot.adminValues = adminValues;
  } catch {
    snapshot.adminValues = {};
  }

  return snapshot;
};

export const readLegacySettingsAsMap = () => {
  const legacy = readLegacySettings();
  return {
    theme: legacy.THEME,
    preferences: legacy.preferences || {},
    adminValues: legacy.adminValues || {},
    version: legacy.ADMIN_VALUES_VERSION,
  };
};
