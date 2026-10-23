import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivityEntryKey, projectActivities, selectActivityEntries } from './activityRecords.js';

const today = new Date(2026, 9, 23, 15);
const ids = (entries) => entries.map((entry) => `${entry.momentId}/${entry.activity.id}`);

test('projection keeps duplicate activity IDs separate by authoritative parent without changing source records', () => {
  const firstActivity = Object.freeze({ id: 'shared', eventId: 'wrong-parent', title: 'First' });
  const secondActivity = Object.freeze({ id: 'shared', title: 'Second' });
  const events = Object.freeze([
    Object.freeze({ id: 'first', name: 'First Moment', activities: Object.freeze([firstActivity]) }),
    Object.freeze({ id: 'second', name: 'Second Moment', archived: true, activities: Object.freeze([secondActivity]) }),
  ]);
  const entries = projectActivities(events);
  assert.deepEqual(entries.map((entry) => entry.key), ['["first","shared"]', '["second","shared"]']);
  assert.deepEqual(entries.map((entry) => entry.momentId), ['first', 'second']);
  assert.equal(entries[0].activity, firstActivity);
  assert.equal(entries[1].activity, secondActivity);
  assert.equal(entries[1].archived, true);
  assert.equal(firstActivity.eventId, 'wrong-parent');
});

test('projection normalizes numeric IDs, preserves provider parent fallback and skips unsafe identities', () => {
  const entries = projectActivities([
    { id: 7, activities: [{ id: 0 }, { title: 'No ID' }, null] },
    { firestoreId: 'provider-id', activities: [{ id: ' child ' }] },
    { activities: [{ id: 'orphan' }] }, null,
  ]);
  assert.deepEqual(ids(entries), ['7/0', 'provider-id/ child ']);
  assert.equal(entries[1].key, '["provider-id","child"]');
  assert.equal(entries[1].momentName, 'Untitled moment');
  assert.equal(getActivityEntryKey('a:b', 'c'), '["a:b","c"]');
  assert.notEqual(getActivityEntryKey('a:b', 'c'), getActivityEntryKey('a', 'b:c'));
  assert.equal(getActivityEntryKey('', 'child'), '');
  assert.equal(getActivityEntryKey('parent', undefined), '');
  assert.deepEqual(projectActivities(null), []);
});

test('global date sorting interleaves parents, reverses dated work and keeps missing dates last', () => {
  const entries = projectActivities([
    { id: 'a', activities: [{ id: 'later', date: '2026-10-25' }, { id: 'first', date: '2026-10-21' }] },
    { id: 'b', activities: [{ id: 'middle', date: '2026-10-23' }, { id: 'unknown', date: 'invalid' }] },
  ]);
  const original = [...entries];
  assert.deepEqual(ids(selectActivityEntries(entries)), ['a/first', 'b/middle', 'a/later', 'b/unknown']);
  assert.deepEqual(ids(selectActivityEntries(entries, { direction: 'desc' })), ['a/later', 'b/middle', 'a/first', 'b/unknown']);
  assert.deepEqual(entries, original, 'sorting never mutates the projection');
});

test('legacy timestamp dates and invalid timestamp objects sort safely', () => {
  const noon = new Date(2026, 9, 23, 12);
  const entries = projectActivities([{ id: 'm', activities: [
    { id: 'serialized', date: { _seconds: noon.getTime() / 1000 } },
    { id: 'date', date: '2026-10-22' },
    { id: 'firestore', date: { toDate: () => new Date(2026, 9, 24) } },
    { id: 'broken', date: { toDate: () => { throw new Error('invalid timestamp'); } } },
  ] }]);
  assert.deepEqual(ids(selectActivityEntries(entries)), ['m/date', 'm/serialized', 'm/firestore', 'm/broken']);
});

test('title and priority sorts use date then deterministic identity ties', () => {
  const entries = projectActivities([
    { id: 'z', activities: [{ id: 'same', title: 'Alpha', date: '2026-10-23', priority: 'high' }] },
    { id: 'a', activities: [
      { id: 'same', title: 'alpha', date: '2026-10-23', priority: 'high' },
      { id: 'early', title: 'Alpha', date: '2026-10-22', priority: 'high' },
      { id: 'beta', title: 'Beta', date: '2026-10-21', priority: 'low' },
      { id: 'default', title: 'Default', date: '2026-10-20' },
    ] },
  ]);
  assert.deepEqual(ids(selectActivityEntries(entries, { field: 'title' })), ['a/early', 'a/same', 'z/same', 'a/beta', 'a/default']);
  assert.deepEqual(ids(selectActivityEntries(entries, { field: 'title', direction: 'desc' })), ['a/default', 'a/beta', 'z/same', 'a/same', 'a/early']);
  assert.deepEqual(ids(selectActivityEntries(entries, { field: 'priority' })), ['a/beta', 'a/default', 'a/early', 'a/same', 'z/same']);
});

test('status ordering retains workspace date, completion and cancellation semantics', () => {
  const entries = projectActivities([{ id: 'm', activities: [
    { id: 'future', date: '2026-10-24' },
    { id: 'completed', completed: true, date: '2026-10-20' },
    { id: 'today', date: '2026-10-23' },
    { id: 'past', date: '2026-10-21' },
    { id: 'no-date' },
    { id: 'cancelled', status: 'cancelled', date: '2026-10-19' },
  ] }]);
  assert.deepEqual(ids(selectActivityEntries(entries, { field: 'status' }, today)), ['m/past', 'm/today', 'm/no-date', 'm/future', 'm/completed']);
  assert.deepEqual(ids(selectActivityEntries(entries, { field: 'status', direction: 'desc' }, today)), ['m/completed', 'm/future', 'm/today', 'm/past', 'm/no-date']);
});

test('timestamp activities on the reference calendar day retain the current status rank', () => {
  const entries = projectActivities([{ id: 'm', activities: [
    { id: 'tomorrow', date: '2026-10-24' },
    { id: 'timestamp-today', date: { toDate: () => new Date(2026, 9, 23, 12) } },
    { id: 'no-date' },
    { id: 'complete', date: '2026-10-21', completed: true },
  ] }]);
  assert.deepEqual(ids(selectActivityEntries(entries, { field: 'status' }, today)), ['m/timestamp-today', 'm/no-date', 'm/tomorrow', 'm/complete']);
  assert.equal(today.getHours(), 15, 'selection does not change the caller reference date');
});

test('Moment and archived scopes filter independently without omitting historical choices from projection', () => {
  const entries = projectActivities([
    { id: 'active', activities: [{ id: 'one' }] },
    { id: 'archived', archived: true, activities: [{ id: 'two' }] },
  ]);
  assert.deepEqual(ids(selectActivityEntries(entries)), ['active/one']);
  assert.deepEqual(ids(selectActivityEntries(entries, { parentScope: 'archived' })), ['archived/two']);
  assert.equal(selectActivityEntries(entries, { parentScope: 'all' }).length, 2);
  assert.deepEqual(ids(selectActivityEntries(entries, { parentScope: 'all', momentId: 'archived' })), ['archived/two']);
  assert.deepEqual(selectActivityEntries(entries, { momentId: 'missing' }), []);
});

test('search reaches activity title, notes and parent name; status and priority exclude cancelled work', () => {
  const entries = projectActivities([
    { id: 'birthday', name: 'Family Birthdays', activities: [
      { id: 'cake', title: 'Order cake', description: 'Ask the bakery', priority: 'high' },
      { id: 'gift', title: 'Buy gift', completed: true, priority: 'low' },
      { id: 'cancel', title: 'Cancelled cake', cancelled: true, priority: 'high' },
      { id: 'legacy-cancel', title: 'Old cake', status: 'cancelled' },
    ] },
    { id: 'home', name: 'Home', activities: [{ id: 'call', title: 'Call electrician' }] },
  ]);
  assert.deepEqual(ids(selectActivityEntries(entries, { search: '  BAKERY ' })), ['birthday/cake']);
  assert.deepEqual(ids(selectActivityEntries(entries, { search: 'birthdays' })), ['birthday/cake', 'birthday/gift']);
  assert.deepEqual(ids(selectActivityEntries(entries, { search: 'electrician' })), ['home/call']);
  assert.deepEqual(ids(selectActivityEntries(entries, { filter: 'high' })), ['birthday/cake']);
  assert.deepEqual(ids(selectActivityEntries(entries, { filter: 'medium' })), ['home/call']);
  assert.deepEqual(ids(selectActivityEntries(entries, { filter: 'completed' })), ['birthday/gift']);
  assert.deepEqual(ids(selectActivityEntries(entries, { filter: 'in-progress' })), ['birthday/cake', 'home/call']);
  assert.deepEqual(ids(selectActivityEntries(entries, { filter: 'cancelled', search: 'cake' })), ['birthday/cancel', 'birthday/legacy-cancel']);
});
