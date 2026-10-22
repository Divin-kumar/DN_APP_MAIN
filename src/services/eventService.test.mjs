import test from 'node:test';
import assert from 'node:assert/strict';

import { getEventStatus } from '../utils/eventStatus.js';
import { createServer } from 'vite';

test('events with incomplete or no activities are in progress', () => {
  assert.equal(getEventStatus({ activities: [] }), 'in-progress');
  assert.equal(getEventStatus({ activities: [{ completed: true }, { completed: false }] }), 'in-progress');
});

test('events are completed when every linked activity is completed', () => {
  assert.equal(getEventStatus({ activities: [{ completed: true }, { completed: true }] }), 'completed');
});

test('cancelled activities do not block completion of active activities', () => {
  assert.equal(getEventStatus({
    activities: [
      { completed: true },
      { completed: false, cancelled: true },
    ],
  }), 'completed');
});

test('events with only cancelled activities remain in progress', () => {
  assert.equal(getEventStatus({ activities: [{ completed: true, cancelled: true }] }), 'in-progress');
});

test('manual cancellation takes precedence over activity status', () => {
  const event = {
    status: 'cancelled',
    activities: [{ id: 'activity-1', title: 'Plan', completed: false }],
    memories: [{ id: 'memory-1', title: 'Memory' }],
    attachments: [{ id: 'attachment-1', name: 'Photo' }],
  };

  assert.equal(getEventStatus(event), 'cancelled');
  assert.equal(event.activities[0].id, 'activity-1');
  assert.equal(event.memories[0].id, 'memory-1');
  assert.equal(event.attachments[0].id, 'attachment-1');
});

test('event service normalizes old dates/IDs and preserves legacy account collection through CRUD', async (t) => {
  const records = new Map();
  const calls = [];
  const fixtureKey = `__dnEventServiceTest${Date.now()}`;
  const api = {
    collection: (_db, ...parts) => parts.join('/'),
    doc: (_db, ...parts) => parts.join('/'),
    getDocs: async (path) => {
      calls.push(['read', path]);
      const items = records.get(path);
      if (items instanceof Error) throw items;
      return { empty: !items?.length, docs: (items || []).map(([id, data]) => ({ id, data: () => data })) };
    },
    addDoc: async (path, data) => { calls.push(['create', path, data]); return { id: 'new-document' }; },
    updateDoc: async (path, data) => { calls.push(['update', path, data]); },
    deleteDoc: async (path) => { calls.push(['delete', path]); },
  };
  globalThis[fixtureKey] = api;
  const server = await createServer({
    configFile: false,
    envFile: false,
    ssr: { noExternal: ['firebase'] },
    server: { middlewareMode: true, watch: null },
    plugins: [{
      name: 'isolated-event-persistence',
      enforce: 'pre',
      resolveId(source, importer) {
        if (!importer?.replaceAll('\\', '/').endsWith('/src/services/eventService.js')) return null;
        if (source === 'firebase/firestore') return '\0dn-test-firestore';
        if (source === '../firebase/config') return '\0dn-test-db';
        return null;
      },
      load(id) {
        if (id === '\0dn-test-db') return 'export const db = {};';
        if (id === '\0dn-test-firestore') return `export const { ${Object.keys(api).join(', ')} } = globalThis[${JSON.stringify(fixtureKey)}];`;
        return null;
      },
    }],
  });
  t.after(async () => { await server.close(); delete globalThis[fixtureKey]; });
  const service = await server.ssrLoadModule('/src/services/eventService.js');
  const old = {
    id: 1728990000000,
    name: 'Birthday',
    startDate: '1990-11-02',
    isRecurring: true,
    activities: [{ id: 1728990000001, title: 'Gift', date: { seconds: new Date(2026, 10, 1, 12).getTime() / 1000 }, expenses: [{ id: 1728990000002, amount: 10 }] }],
    memories: [{ id: 1728990000003, title: 'Remembered' }],
    attachments: [{ id: 1728990000004, name: 'Photo' }, { firestoreId: 'old-file-document', name: 'Old file' }],
  };
  const normalized = service.normalizeEvent(old);
  assert.equal(normalized.id, '1728990000000');
  assert.equal(normalized.date, '1990-11-02');
  assert.equal(normalized.recurrence, 'yearly');
  assert.equal(normalized.activities[0].id, '1728990000001');
  assert.equal(normalized.activities[0].eventId, normalized.id);
  assert.equal(normalized.activities[0].date, '2026-11-01');
  assert.equal(normalized.activities[0].expenses[0].activityId, '1728990000001');
  assert.equal(normalized.activities[0].expenses[0].id, '1728990000002');
  assert.equal(normalized.memories[0].id, '1728990000003');
  assert.equal(normalized.attachments[0].id, '1728990000004');
  assert.equal(normalized.attachments[1].id, 'old-file-document');
  assert.equal(old.memories[0].id, 1728990000003, 'reading leaves original numeric source objects unchanged');
  const normalizedAgain = service.normalizeEvent(normalized);
  assert.deepEqual(normalizedAgain.memories, normalized.memories);
  assert.deepEqual(normalizedAgain.attachments, normalized.attachments, 'stable child identity survives export/reload normalization');

  records.set('users/A/events', [['legacy-document', old]]);
  const legacy = await service.getEventsForUser('A');
  assert.equal(legacy[0].firestoreCollection, 'events');
  assert.equal(legacy[0].firestoreId, 'legacy-document');
  assert.deepEqual(calls.slice(-2).map((call) => call[1]), ['users/A/eventGroups', 'users/A/events']);

  await service.updateEvent('A', { ...legacy[0], notes: 'Edited' });
  assert.equal(calls.at(-1)[1], 'users/A/events/legacy-document');
  assert.equal(calls.at(-1)[2].notes, 'Edited');
  assert.equal(Object.hasOwn(calls.at(-1)[2], 'firestoreCollection'), false);
  await service.deleteEvent('A', legacy[0]);
  assert.deepEqual(calls.at(-1), ['delete', 'users/A/events/legacy-document']);
  const created = await service.createEvent('A', { ...normalized, firestoreCollection: 'events' });
  assert.equal(created.firestoreCollection, 'events');
  assert.equal(calls.at(-1)[1], 'users/A/events');

  records.set('users/B/eventGroups', [['stable-document', { name: 'Current', date: '2026-11-01' }]]);
  const current = await service.getEventsForUser('B');
  assert.equal(current[0].id, 'stable-document', 'missing application IDs consistently fall back to provider IDs');
  assert.equal(calls.at(-1)[1], 'users/B/eventGroups', 'canonical data does not query an unrelated legacy collection');
  await service.createEvent('B', { ...normalized, firestoreCollection: '../other' });
  assert.equal(calls.at(-1)[1], 'users/B/eventGroups', 'source collection accepts only known historical names');

  const denied = Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
  records.set('users/C/events', denied);
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    assert.deepEqual(await service.getEventsForUser('C'), [], 'a denied optional legacy collection does not fail readable current data');
  } finally {
    console.warn = warn;
  }
  assert.match(warnings[0], /Legacy Moments are unavailable/);

  records.set('users/D/eventGroups', denied);
  await assert.rejects(() => service.getEventsForUser('D'), /permission-denied/, 'canonical read denial still fails visibly');
  records.set('users/E/events', Object.assign(new Error('unavailable'), { code: 'unavailable' }));
  await assert.rejects(() => service.getEventsForUser('E'), /unavailable/, 'non-permission legacy failures still propagate');

  const originalError = console.error;
  const loadErrors = [];
  let store;
  console.error = (...args) => loadErrors.push(args);
  try {
    ({ default: store } = await server.ssrLoadModule('/src/store/useEventStore.js'));
  } finally {
    console.error = originalError;
  }
  store.getState().setEvents([]);
  const callsBeforeCreate = calls.length;
  const quickCreated = await store.getState().addEvent('A', false, { name: 'Quick-created', date: '2026-11-03' });
  assert.equal(quickCreated.firestoreCollection, 'events');
  assert.deepEqual(calls.slice(callsBeforeCreate).map((call) => [call[0], call[1]]), [
    ['read', 'users/A/eventGroups'],
    ['read', 'users/A/events'],
    ['create', 'users/A/events'],
  ], 'Quick Create resolves an unloaded account before choosing its collection');

  store.getState().setEvents([]);
  const callsBeforeDenied = calls.length;
  await assert.rejects(() => store.getState().addEvent('D', false, { name: 'Must not save', date: '2026-11-03' }), /Unable to load/);
  assert.deepEqual(calls.slice(callsBeforeDenied).map((call) => call[0]), ['read'], 'an unreadable canonical source never creates a new collection');
  assert.equal(loadErrors.length, 1);
});
