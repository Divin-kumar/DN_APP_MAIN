import { collection, getDocs } from 'firebase/firestore';
import { db as firebaseDb } from '../firebase/config.js';

const readStorageRaw = (key) => {
  if (typeof localStorage === 'undefined') {
    throw new Error(`localStorage is unavailable while reading ${key}.`);
  }
  const raw = localStorage.getItem(key);
  return { present: raw !== null, raw };
};

const parseJson = (key, fallback, expectedShape) => {
  const stored = readStorageRaw(key);
  if (!stored.present) return { present: false, value: fallback, raw: null };
  let value;
  try {
    value = JSON.parse(stored.raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${key}: ${error.message}`);
  }
  if (!expectedShape(value)) throw new Error(`Unexpected data shape in ${key}.`);
  return { present: true, value, raw: stored.raw };
};

const tagRecords = (records, source, path) => records.map((record, index) => ({
  ...record,
  source,
  sourcePath: `${path}/${index}`,
  originalId: record.id ?? record.firestoreId ?? null,
}));

export const readFirebaseMigrationSources = async (userId, firestore = firebaseDb) => {
  if (!userId) throw new Error('A Firebase user ID is required to read account migration sources.');
  const names = ['eventGroups', 'expenses', 'incomes'];
  const collections = await Promise.all(names.map(async (name) => {
    const snapshot = await getDocs(collection(firestore, 'users', userId, name));
    return [name, snapshot.docs.map((item) => ({
      ...item.data(),
      firestoreId: item.id,
      source: 'firebase',
      sourcePath: `users/${userId}/${name}/${item.id}`,
      originalId: item.data().id ?? item.id,
    }))];
  }));
  const byName = Object.fromEntries(collections);
  return {
    source: 'firebase',
    complete: true,
    datasets: {
      eventGroups: byName.eventGroups,
      expenses: byName.expenses,
      incomes: byName.incomes,
    },
  };
};

export const readGuestMigrationSources = () => {
  const events = parseJson('lifehub_guest_eventGroups', [], Array.isArray);
  const expenses = parseJson('lifehub_guest_expenses', [], Array.isArray);
  const incomes = parseJson('lifehub_guest_incomes', [], Array.isArray);
  return {
    source: 'guest-local-storage',
    complete: true,
    keyPresence: {
      lifehub_guest_eventGroups: events.present,
      lifehub_guest_expenses: expenses.present,
      lifehub_guest_incomes: incomes.present,
    },
    datasets: {
      eventGroups: tagRecords(events.value, 'guest-local-storage', 'lifehub_guest_eventGroups'),
      expenses: tagRecords(expenses.value, 'guest-local-storage', 'lifehub_guest_expenses'),
      incomes: tagRecords(incomes.value, 'guest-local-storage', 'lifehub_guest_incomes'),
    },
    raw: {
      lifehub_guest_eventGroups: events.raw,
      lifehub_guest_expenses: expenses.raw,
      lifehub_guest_incomes: incomes.raw,
    },
  };
};

export const readSettingsMigrationSource = () => {
  const preferences = parseJson('lifehub_preferences', {}, (value) => value && typeof value === 'object' && !Array.isArray(value));
  const adminValues = parseJson('lifehub_admin_values', {}, (value) => value && typeof value === 'object' && !Array.isArray(value));
  const themeChoice = readStorageRaw('lifehub_theme_choice');
  const adminVersion = readStorageRaw('lifehub_admin_values_schema_version');

  let parsedAdminVersion = 0;
  if (adminVersion.present) {
    parsedAdminVersion = Number(adminVersion.raw);
    if (!Number.isInteger(parsedAdminVersion) || parsedAdminVersion < 0) {
      throw new Error('Invalid lifehub_admin_values_schema_version.');
    }
  }

  return {
    source: 'settings-local-storage',
    complete: true,
    datasets: {
      preferences: preferences.value,
      adminValues: adminValues.value,
      adminValuesVersion: parsedAdminVersion,
      themeChoice: themeChoice.raw,
    },
    keyPresence: {
      lifehub_preferences: preferences.present,
      lifehub_theme_choice: themeChoice.present,
      lifehub_admin_values: adminValues.present,
      lifehub_admin_values_schema_version: adminVersion.present,
    },
    raw: {
      lifehub_preferences: preferences.raw,
      lifehub_theme_choice: themeChoice.raw,
      lifehub_admin_values: adminValues.raw,
      lifehub_admin_values_schema_version: adminVersion.raw,
    },
  };
};
