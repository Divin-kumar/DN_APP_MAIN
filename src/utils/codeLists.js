export const DEFAULT_CODE_LISTS = Object.freeze({
  eventTypes: ['Birthday', 'Anniversary', 'Festival', 'Function', 'Personal'],
  incomeTypes: ['Salary', 'Freelance', 'Bonus'],
  expenseCategories: ['Food', 'Hospital', 'Shopping', 'Travel', 'Entertainment'],
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
export const CODE_LIST_SCHEMA_VERSION = 1;
export const CODE_LIST_MIGRATIONS = Object.freeze({
  1: Object.freeze({ additions: Object.freeze({}) }),
});

export const normalizeCodeListIdentityValue = (value) => String(value ?? '')
  .trim()
  .toLocaleLowerCase()
  .replace(/\s+/g, ' ');

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

    version = nextVersion;
  }

  return { adminValues, version };
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
    } : null;
  }

  if (item && typeof item === 'object') {
    const value = String(item.value ?? item.id ?? '').trim();
    const label = String(item.label ?? item.name ?? item.value ?? '').trim();
    if (!value) return null;
    const active = item.isActive !== false && item.active !== false;
    return {
      ...item,
      id: typeof item.id === 'string' && item.id ? item.id : `legacy:${value}`,
      value,
      label: label || value,
      active,
      isActive: active,
      canGenerateGreetingCards: item.canGenerateGreetingCards ?? item.generateGreetingCards ?? true,
      greetingTemplate: typeof item.greetingTemplate === 'string' ? item.greetingTemplate : (typeof item.template === 'string' ? item.template : ''),
      showInDashboardUpcoming: item.showInDashboardUpcoming ?? item.showInDashboard ?? true,
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
        return value ? { value, label: value, active: true, isActive: true, canGenerateGreetingCards: true, greetingTemplate: '', showInDashboardUpcoming: true } : null;
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
  expenses.forEach((expense) => add('expenseCategories', expense.category));
  incomes.forEach((income) => add('incomeTypes', income.type));

  return Object.fromEntries(Object.entries(references).map(([listKey, values]) => [listKey, [...values]]));
};
