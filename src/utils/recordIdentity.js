// Older DN records use numeric IDs. Normalize identity, never replace a valid ID.
export const recordId = (value) => (
  typeof value === 'string' ? value.trim()
    : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
);

export const withRecordId = (item, fallback = '') => ({
  ...item,
  id: recordId(item?.id) || recordId(item?.firestoreId) || recordId(fallback),
});
