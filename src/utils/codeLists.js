import { migrateLegacyStorage } from './storageMigration.js';

export const DEFAULT_CODE_LISTS = Object.freeze({
  eventTypes: ['Birthday', 'Anniversary', 'Festival', 'Function', 'Personal'],
  incomeTypes: ['Salary', 'Freelance', 'Bonus'],
  expenseCategories: ['Food', 'Hospital', 'Shopping', 'Travel', 'Entertainment'],
  paymentMethods: ['Cash', 'Online'],
  activityPriorities: [
    { value: 'low', label: 'Low priority', active: true },
    { value: 'medium', label: 'Medium priority', active: true },
    { value: 'high', label: 'High priority', active: true },
  ],
  reminderPresets: [
    { value: '09:00', label: 'Morning (9:00 AM)', active: true },
    { value: '12:00', label: 'Midday (12:00 PM)', active: true },
    { value: '18:00', label: 'Evening (6:00 PM)', active: true },
  ],
});

// Keep this version independent from the app/PWA build version. For future default additions,
// increment the schema version and list only the new entries in that version's `additions` map.
// Never copy or replace an existing entry during a migration.
export const CODE_LIST_SCHEMA_VERSION = 2;
export const CODE_LIST_MIGRATIONS = Object.freeze({
  1: Object.freeze({ additions: Object.freeze({}) }),
  2: Object.freeze({ missingLists: Object.freeze({ paymentMethods: DEFAULT_CODE_LISTS.paymentMethods }) }),
});

export const LEGACY_CODE_LISTS_STORAGE_KEY = 'dn_admin_values';
export const LEGACY_CODE_LISTS_VERSION_KEY = 'dn_admin_values_schema_version';
export const GUEST_CODE_LISTS_STORAGE_KEY = 'dn_guest_admin_values';
export const GUEST_CODE_LISTS_VERSION_KEY = 'dn_guest_admin_values_schema_version';

const isCodeListRecord = (value) => Boolean(
  value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(DEFAULT_CODE_LISTS).some((key) => Array.isArray(value[key])),
);

export const resolveCodeListSettings = (remoteSettings, legacySettings) => {
  const remoteValues = remoteSettings?.adminValues;
  const legacyValues = legacySettings?.adminValues;
  const source = isCodeListRecord(remoteValues)
    ? 'remote'
    : isCodeListRecord(legacyValues) ? 'legacy' : 'defaults';
  const selectedSettings = source === 'remote' ? remoteSettings : legacySettings;
  const storedValues = source === 'defaults' ? null : selectedSettings.adminValues;
  const storedVersion = source === 'defaults' ? 0 : selectedSettings.schemaVersion || 0;
  const migrated = migrateStoredCodeLists(storedValues, storedVersion);

  return {
    adminValues: migrated.adminValues,
    schemaVersion: migrated.version,
    source,
  };
};

export const readLegacyCodeListSettings = (storage) => {
  try {
    const targetStorage = storage || globalThis.localStorage;
    migrateLegacyStorage(targetStorage);
    const raw = targetStorage?.getItem(LEGACY_CODE_LISTS_STORAGE_KEY);
    if (raw === null || raw === undefined) return null;
    const adminValues = JSON.parse(raw);
    if (!isCodeListRecord(adminValues)) return null;
    return {
      adminValues,
      schemaVersion: Number.parseInt(targetStorage.getItem(LEGACY_CODE_LISTS_VERSION_KEY) || '0', 10) || 0,
    };
  } catch {
    return null;
  }
};

export const readGuestCodeListSettings = (storage) => {
  try {
    const targetStorage = storage || globalThis.localStorage;
    migrateLegacyStorage(targetStorage);
    const raw = targetStorage?.getItem(GUEST_CODE_LISTS_STORAGE_KEY);
    if (raw !== null && raw !== undefined) {
      const adminValues = JSON.parse(raw);
      if (isCodeListRecord(adminValues)) {
        return resolveCodeListSettings({ adminValues, schemaVersion: targetStorage.getItem(GUEST_CODE_LISTS_VERSION_KEY) || 0 }, null);
      }
    }
  } catch {
    // A malformed guest setting falls back to the legacy value or current defaults.
  }

  return resolveCodeListSettings(null, readLegacyCodeListSettings(storage));
};

export const writeGuestCodeListSettings = (adminValues, storage) => {
  const targetStorage = storage || globalThis.localStorage;
    migrateLegacyStorage(targetStorage);
  const migrated = migrateStoredCodeLists(adminValues, CODE_LIST_SCHEMA_VERSION);
  targetStorage.setItem(GUEST_CODE_LISTS_STORAGE_KEY, JSON.stringify(migrated.adminValues));
  targetStorage.setItem(GUEST_CODE_LISTS_VERSION_KEY, String(migrated.version));
  return migrated.adminValues;
};

export const migrateStoredCodeLists = (
  storedValues,
  storedVersion = 0,
  migrations = CODE_LIST_MIGRATIONS,
  targetVersion = CODE_LIST_SCHEMA_VERSION,
) => {
  const hasStoredValues = storedValues && typeof storedValues === 'object' && !Array.isArray(storedValues);
  if (!hasStoredValues) {
    return {
      adminValues: Object.fromEntries(Object.entries(DEFAULT_CODE_LISTS).map(([key, values]) => [key, serializeCodeListEntries(values)])),
      version: targetVersion,
    };
  }

  const adminValues = { ...storedValues };
  Object.keys(DEFAULT_CODE_LISTS).forEach((listKey) => {
    adminValues[listKey] = Array.isArray(storedValues[listKey])
      ? serializeCodeListEntries(storedValues[listKey])
      : [];
  });

  const parsedVersion = Number.parseInt(storedVersion, 10);
  let version = Number.isInteger(parsedVersion) && parsedVersion >= 0 ? parsedVersion : 0;
  while (version < targetVersion) {
    const nextVersion = version + 1;
    const migration = migrations[nextVersion];
    if (!migration) return { adminValues, version };

    Object.entries(migration.additions || {}).forEach(([listKey, additions]) => {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_CODE_LISTS, listKey)) return;
      const currentEntries = adminValues[listKey] || [];
      const existingValues = new Set(currentEntries.map((entry) => entry.value));
      const newEntries = serializeCodeListEntries(additions).filter((entry) => !existingValues.has(entry.value));
      adminValues[listKey] = [...currentEntries, ...newEntries];
    });

    // New list domains seed only when absent. An intentionally empty, renamed
    // or disabled payment list remains authoritative, including on first upgrade.
    Object.entries(migration.missingLists || {}).forEach(([listKey, defaults]) => {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_CODE_LISTS, listKey)
        && !Array.isArray(storedValues[listKey])) {
        adminValues[listKey] = serializeCodeListEntries(defaults);
      }
    });

    version = nextVersion;
  }

  return { adminValues, version };
};

// Legacy types are normalized to one explicit mode without deleting any
// configured type. The editor requires a conscious choice for every new type.
const explicitEntryMode = (value, name) => {
  if (['journey', 'diary', 'chronicle'].includes(value)) return value;
  const key = String(name || '').trim().toLocaleLowerCase();
  if (key === 'diary') return 'diary';
  if (['application and youtube', 'career', 'iqvia', 'project', 'work', 'task', 'tasks', 'to-do', 'todo'].includes(key)) return 'chronicle';
  return 'journey';
};
const normalizeMetaEntry = (item) => {
  if (typeof item === 'string') {
    const value = item.trim();
    return value ? {
      value,
      label: value,
      active: true,
      isActive: true,
      canGenerateGreetingCards: true,
      greetingTemplate: '',
      showInDashboardUpcoming: true,
      showActivitiesOnDashboard: true,
      storyPresentation: explicitEntryMode(null, value),
    } : null;
  }

  if (item && typeof item === 'object') {
    const value = String(item.value ?? item.id ?? '').trim();
    const label = String(item.label ?? item.name ?? item.value ?? '').trim();
    if (!value) return null;
    const active = item.isActive !== false && item.active !== false;
    return {
      ...item,
      value,
      label: label || value,
      active,
      isActive: active,
      canGenerateGreetingCards: item.canGenerateGreetingCards ?? item.generateGreetingCards ?? true,
      greetingTemplate: typeof item.greetingTemplate === 'string' ? item.greetingTemplate : (typeof item.template === 'string' ? item.template : ''),
      showInDashboardUpcoming: item.showInDashboardUpcoming ?? item.showInDashboard ?? true,
      showActivitiesOnDashboard: item.showActivitiesOnDashboard ?? true,
      storyPresentation: explicitEntryMode(item.storyPresentation, value),
    };
  }

  return null;
};

export const getCodeListMeta = (listKey, customValues) => {
  const fallback = DEFAULT_CODE_LISTS[listKey] ?? [];
  const source = Array.isArray(customValues) ? customValues : fallback;

  return source
    .map((item) => normalizeMetaEntry(item))
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const current = accumulator.find((entry) => entry.value === item.value);
      if (current) return accumulator;
      return [...accumulator, item];
    }, []);
};

export const getActiveCodeListMeta = (listKey, customValues = DEFAULT_CODE_LISTS[listKey] ?? []) => getCodeListMeta(listKey, customValues).filter((item) => item.active !== false && item.isActive !== false);

export const getCodeListItems = (listKey, customValues) => getActiveCodeListMeta(listKey, customValues).map((item) => item.value);

export const getCodeListLabel = (listKey, value, customValues) => {
  const entry = getCodeListMeta(listKey, customValues).find((item) => item.value === value);
  return entry?.label || value || 'Unknown';
};

export const getActivityPriorityLabel = (value) => {
  const entry = getCodeListMeta('activityPriorities').find((item) => item.value === value);
  return entry?.label || 'Medium priority';
};

export const getReminderPresetLabel = (value) => {
  const entry = getCodeListMeta('reminderPresets').find((item) => item.value === value);
  if (entry?.label) return entry.label;

  const time = typeof value === 'string' ? value : '09:00';
  const [hours, minutes] = time.split(':').map(Number);
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const date = new Date();
  date.setHours(hours || 9, safeMinutes || 0, 0, 0);
  const meridiem = date.getHours() >= 12 ? 'PM' : 'AM';
  const normalizedHour = date.getHours() % 12 || 12;
  return `Reminder (${normalizedHour}:${String(safeMinutes).padStart(2, '0')} ${meridiem})`;
};

export const normalizeCodeListValue = (listKey, value) => {
  const items = getCodeListMeta(listKey, DEFAULT_CODE_LISTS[listKey]);
  const match = items.find((item) => item.value === value);
  return match ? match.value : value;
};

export const serializeCodeListEntries = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') {
        const value = item.trim();
        return value ? { value, label: value, active: true, isActive: true, canGenerateGreetingCards: true, greetingTemplate: '', showInDashboardUpcoming: true, showActivitiesOnDashboard: true, storyPresentation: explicitEntryMode(null, value) } : null;
      }
      if (item && typeof item === 'object') {
        const value = String(item.value ?? item.id ?? '').trim();
        if (!value) return null;
        const active = item.isActive !== false && item.active !== false;
        return {
          ...item,
          value,
          label: String(item.label ?? item.name ?? value).trim() || value,
          active,
          isActive: active,
          canGenerateGreetingCards: item.canGenerateGreetingCards ?? item.generateGreetingCards ?? true,
          greetingTemplate: typeof item.greetingTemplate === 'string' ? item.greetingTemplate : (typeof item.template === 'string' ? item.template : ''),
          showInDashboardUpcoming: item.showInDashboardUpcoming ?? item.showInDashboard ?? true,
          showActivitiesOnDashboard: item.showActivitiesOnDashboard ?? true,
          storyPresentation: explicitEntryMode(item.storyPresentation, value),
        };
      }
      return null;
    })
    .filter(Boolean);
};

export const resetCodeListsPreservingReferences = (currentValues = {}, referencedValues = {}) => (
  Object.fromEntries(Object.keys(DEFAULT_CODE_LISTS).map((listKey) => {
    const defaults = serializeCodeListEntries(DEFAULT_CODE_LISTS[listKey]);
    const current = serializeCodeListEntries(currentValues[listKey] || []);
    const referenced = new Set(referencedValues[listKey] || []);
    const defaultValues = new Set(defaults.map((entry) => entry.value));
    const resetEntries = defaults.map((entry) => ({ ...entry, active: true, isActive: true }));
    const knownValues = new Set(defaultValues);

    current.forEach((entry) => {
      if (!referenced.has(entry.value) || knownValues.has(entry.value)) return;
      resetEntries.push({ ...entry, active: false, isActive: false });
      knownValues.add(entry.value);
    });

    referenced.forEach((value) => {
      if (knownValues.has(value)) return;
      resetEntries.push({ value, label: value, active: false, isActive: false });
      knownValues.add(value);
    });

    return [listKey, resetEntries];
  }))
);

export const collectReferencedCodeListValues = ({ events = [], expenses = [], incomes = [] } = {}) => {
  const references = Object.fromEntries(Object.keys(DEFAULT_CODE_LISTS).map((listKey) => [listKey, new Set()]));
  const add = (listKey, value) => {
    if (typeof value === 'string' && value.trim()) references[listKey].add(value.trim());
  };

  events.forEach((event) => {
    add('eventTypes', event.type);
    add('eventTypes', event.customType);
    (event.activities || []).forEach((activity) => add('activityPriorities', activity.priority));
  });
  expenses.forEach((expense) => { add('expenseCategories', expense.category); add('paymentMethods', expense.paymentMethod); });
  incomes.forEach((income) => { add('incomeTypes', income.type); add('paymentMethods', income.paymentMethod); });
  events.forEach((event) => (event.activities || []).forEach((activity) =>
    (activity.expenses || []).forEach((expense) => add('paymentMethods', expense.paymentMethod))));

  return Object.fromEntries(Object.entries(references).map(([listKey, values]) => [listKey, [...values]]));
};
