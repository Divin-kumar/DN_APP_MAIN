const parseJsonArray = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const readLegacyGuestExpenses = () => {
  const direct = parseJsonArray('lifehub_guest_expenses', []);
  const eventData = parseJsonArray('lifehub_guest_eventGroups', []);

  const nested = eventData.flatMap((event) => (event.activities || []).flatMap((activity) =>
    (activity.expenses || []).map((expense) => ({
      ...expense,
      eventId: expense.eventId || event.id,
      activityId: expense.activityId || activity.id,
      source: 'guest',
    }))
  ));

  return [...direct, ...nested].map((entry) => ({
    ...entry,
    source: entry.source || 'guest',
  }));
};

export const readLegacyExpenseRecords = () => readLegacyGuestExpenses();

export const readLegacyExpenseMeta = () => ({
  localStorageKeys: ['lifehub_guest_expenses', 'lifehub_guest_eventGroups'],
  isReadable: true,
  source: 'guest-local-storage',
});
