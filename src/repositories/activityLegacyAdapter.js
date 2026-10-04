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

export const readLegacyGuestActivities = () => {
  const events = parseJsonArray('lifehub_guest_eventGroups', []);
  return events.flatMap((event) => (event.activities || []).map((activity) => ({
    ...activity,
    momentId: activity.momentId || activity.eventId || event.id,
    eventId: activity.eventId || event.id,
    source: 'guest',
  })));
};

export const readLegacyActivityRecords = () => readLegacyGuestActivities();

export const readLegacyActivityMeta = () => ({
  localStorageKeys: ['lifehub_guest_eventGroups'],
  isReadable: true,
  source: 'guest-local-storage',
});
