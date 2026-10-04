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

export const readLegacyGuestMoments = () => parseJsonArray('lifehub_guest_eventGroups', []);

export const readLegacyMomentRecords = () => readLegacyGuestMoments();

export const readLegacyMomentMeta = () => ({
  localStorageKeys: ['lifehub_guest_eventGroups'],
  isReadable: true,
  source: 'guest-local-storage',
});
