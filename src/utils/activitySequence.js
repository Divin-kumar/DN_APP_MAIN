import { getActivityEntryKey } from './activityRecords.js';

// Navigation snapshots contain IDs only and live in history state, never in records/backups.
export function resolveActivitySequence(entries, filtered, snapshot, scope, momentId, activityId) {
  const live = new Map(entries.map((entry) => [entry.key, [entry.momentId, String(entry.activity.id)]]));
  const proposed = snapshot?.scope === scope && Array.isArray(snapshot.ids)
    ? snapshot.ids : filtered.map((entry) => [entry.momentId, String(entry.activity.id)]);
  const seen = new Set();
  const ids = proposed.flatMap((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) return [];
    const key = getActivityEntryKey(pair[0], pair[1]);
    if (!live.has(key) || seen.has(key)) return [];
    seen.add(key); return [live.get(key)];
  });
  const current = getActivityEntryKey(momentId, activityId);
  const index = ids.findIndex(([parent, child]) => getActivityEntryKey(parent, child) === current);
  return { ids, index, previous: index > 0 ? ids[index - 1] : null, next: index >= 0 ? ids[index + 1] || null : null };
}
