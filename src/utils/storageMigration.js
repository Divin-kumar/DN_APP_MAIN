// One-time compatibility bridge: never discard browser data when DN replaces a former storage prefix.
// The obsolete prefix is an on-disk format identifier ONLY, not a product name.
export const DN_STORAGE_PREFIX = 'dn_';
export const LEGACY_STORAGE_PREFIX = 'lifehub_';

const FIXED_SUFFIXES = Object.freeze([
  'admin_values',
  'admin_values_schema_version',
  'guest_admin_values',
  'guest_admin_values_schema_version',
  'preferences',
  'theme_choice',
  'guest_eventGroups',
  'guest_expenses',
  'guest_incomes',
  'guest_mode',
  'session_backup',
  'dev_fixture_scenario',
  'dev_fixture_data',
]);
const DYNAMIC_SUFFIXES = Object.freeze(['favorite_event_ids_', 'recent_event_ids_']);

const isDnKey = (key, prefix) => {
  if (!key.startsWith(prefix)) return false;
  const suffix = key.slice(prefix.length);
  return FIXED_SUFFIXES.includes(suffix) || DYNAMIC_SUFFIXES.some((value) => suffix.startsWith(value));
};

const getStorageKeys = (storage) => {
  const fixed = FIXED_SUFFIXES.map((suffix) => LEGACY_STORAGE_PREFIX + suffix);
  if (typeof storage.length !== 'number' || typeof storage.key !== 'function') return fixed;
  const keys = [...fixed];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string') keys.push(key);
  }
  return [...new Set(keys)];
};

// Copy only absent DN keys and retain the originals for recovery/downgrade.
// A newer DN value ALWAYS wins. Running this repeatedly never overwrites saved DN data.
export const migrateLegacyStorage = (storage = globalThis.localStorage) => {
  const copied = [];
  const failed = [];
  if (!storage) return { copied, failed };
  let keys;
  try {
    keys = getStorageKeys(storage);
  } catch {
    return { copied, failed: ['storage-access'] };
  }
  for (const key of keys) {
    if (!isDnKey(key, LEGACY_STORAGE_PREFIX)) continue;
    const modernKey = DN_STORAGE_PREFIX + key.slice(LEGACY_STORAGE_PREFIX.length);
    try {
      const oldValue = storage.getItem(key);
      if (oldValue !== null && storage.getItem(modernKey) === null) {
        storage.setItem(modernKey, oldValue);
        copied.push(modernKey);
      }
    } catch {
      failed.push(modernKey);
    }
  }
  return { copied, failed };
};

// Explicit "clear local app data" must remove BOTH prefixes, or old values
// could silently return on the next load after another migration pass.
export const clearDnLocalData = (storage = globalThis.localStorage) => {
  if (!storage) return;
  const candidates = [...FIXED_SUFFIXES.flatMap((suffix) => [
    DN_STORAGE_PREFIX + suffix,
    LEGACY_STORAGE_PREFIX + suffix,
  ])];
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (typeof key === 'string' && (
        isDnKey(key, DN_STORAGE_PREFIX) || isDnKey(key, LEGACY_STORAGE_PREFIX)
      )) candidates.push(key);
    }
  }
  [...new Set(candidates)].forEach((key) => storage.removeItem(key));
};
