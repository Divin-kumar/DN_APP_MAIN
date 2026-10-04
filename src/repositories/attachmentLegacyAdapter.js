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

export const readLegacyGuestAttachments = () => {
  const events = parseJsonArray('lifehub_guest_eventGroups', []);
  return events.flatMap((event) => (event.attachments || []).map((attachment) => ({
    ...attachment,
    momentId: attachment.momentId || attachment.eventId || event.id,
    eventId: attachment.eventId || event.id,
    source: 'guest',
  })));
};

export const readLegacyAttachmentRecords = () => readLegacyGuestAttachments();

export const readLegacyAttachmentMeta = () => ({
  localStorageKeys: ['lifehub_guest_eventGroups'],
  isReadable: true,
  source: 'guest-local-storage',
});
