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

export const readLegacyGuestMemories = () => {
  const events = parseJsonArray('lifehub_guest_eventGroups', []);
  return events.flatMap((event) => (event.memories || []).map((memory) => ({
    ...memory,
    momentId: memory.momentId || memory.eventId || event.id,
    eventId: memory.eventId || event.id,
    source: 'guest',
  })));
};

export const readLegacyMemoryRecords = () => readLegacyGuestMemories();

export const readLegacyMemoryMeta = () => ({
  localStorageKeys: ['lifehub_guest_eventGroups'],
  isReadable: true,
  source: 'guest-local-storage',
});
