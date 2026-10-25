import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

// Load the real Zustand actions and scoped loader. Only their persistence edges
// are replaced, so this fixture cannot initialize Firebase or write account data.
const openStore = async (t) => {
  const fixtureKey = `__dnEventStoreTest${Date.now()}${Math.random().toString(36).slice(2)}`;
  const records = new Map();
  const calls = [];
  const pending = [];
  const unexpected = () => { throw new Error('Unexpected persistence operation'); };
  const api = {
    createEvent: unexpected,
    deleteEvent: unexpected,
    getEventsForUser: async (uid) => { calls.push(['read', uid]); return records.get(uid) || []; },
    getGuestEvents: unexpected,
    removeGuestEvent: unexpected,
    saveGuestEvent: unexpected,
    updateEvent: (uid, event) => {
      calls.push(['update', uid, event]);
      return new Promise((resolve, reject) => pending.push({ resolve, reject, event }));
    },
    getActiveSampleData: () => null,
    saveActiveSampleData: unexpected,
  };
  globalThis[fixtureKey] = api;
  const server = await createServer({
    configFile: false,
    envFile: false,
    ssr: { external: ['zustand', 'react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{
      name: 'isolated-event-store', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer?.replaceAll('\\', '/').endsWith('/src/store/useEventStore.js')) return null;
        if (source === '../services/eventService') return '\0event-store-service';
        if (source === '../dev/sampleData') return '\0event-store-samples';
        return null;
      },
      load(id) {
        const fixture = `globalThis[${JSON.stringify(fixtureKey)}]`;
        if (id === '\0event-store-service') return `export const {createEvent,deleteEvent,getEventsForUser,getGuestEvents,removeGuestEvent,saveGuestEvent,updateEvent}=${fixture};`;
        if (id === '\0event-store-samples') return `export const {getActiveSampleData,saveActiveSampleData}=${fixture}; export const requireActiveSampleData=getActiveSampleData;`;
        return null;
      },
    }],
  });
  t.after(async () => { await server.close(); delete globalThis[fixtureKey]; });
  const { default: store } = await server.ssrLoadModule('/src/store/useEventStore.js');
  const original = { id: 'shared-moment', firestoreId: 'account-a-document', firestoreCollection: 'eventGroups',
    name: 'Account A original', activities: [{ id: 'shared-activity', title: 'Original task', completed: false }] };
  const other = { id: 'shared-moment', firestoreId: 'account-b-document', firestoreCollection: 'eventGroups',
    name: 'Account B private record', activities: [{ id: 'shared-activity', title: 'Account B task', completed: true }] };
  records.set('owner-a', [original]);
  records.set('owner-b', [other]);
  await store.getState().loadEvents('owner-a', false);
  return { store, calls, pending, original, other };
};

test('an account-A update completing after switching to B cannot replace a same-ID B record', async (t) => {
  const { store, calls, pending, original, other } = await openStore(t);
  const operation = store.getState().updateEventItem('owner-a', false, { ...original, name: 'Account A edited' });
  assert.equal(store.getState().events[0].name, 'Account A edited', 'the active account receives its optimistic edit');
  assert.equal(calls.at(-1)[1], 'owner-a');
  await store.getState().loadEvents('owner-b', false);
  const accountB = store.getState();
  assert.equal(accountB.activeLoadKey, 'user:owner-b');
  assert.equal(accountB.events[0], other);
  const saved = { ...pending[0].event, name: 'Account A remotely confirmed' };
  pending[0].resolve(saved);
  assert.equal(await operation, saved, 'the original caller still receives the saved result');
  assert.equal(store.getState(), accountB, 'completion makes no state change in the newly selected account');
  assert.equal(store.getState().events[0].name, 'Account B private record');
});

test('an account-A update failing after switching to B cannot roll back or set errors in B', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { store, pending, original, other } = await openStore(t);
  const operation = store.getState().updateEventItem('owner-a', false, { ...original, name: 'Account A edited' });
  await store.getState().loadEvents('owner-b', false);
  store.setState({ error: 'Account B existing status' });
  const accountB = store.getState();
  assert.equal(accountB.events[0], other);
  const failure = new Error('Synthetic account A write failure');
  const rejection = assert.rejects(operation, (error) => error === failure);
  pending[0].reject(failure);
  await rejection;
  assert.equal(store.getState(), accountB, 'failure cannot change the new account records, scope or status');
  assert.equal(store.getState().error, 'Account B existing status');
});

test('a failed update in the same account restores its original record and reports the save error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { store, pending, original } = await openStore(t);
  const operation = store.getState().updateEventItem('owner-a', false, { ...original,
    activities: [{ ...original.activities[0], completed: true }], name: 'Pending edit' });
  assert.equal(store.getState().events[0].name, 'Pending edit');
  assert.equal(store.getState().events[0].status, 'completed');
  const failure = new Error('Synthetic same-account write failure');
  const rejection = assert.rejects(operation, (error) => error === failure);
  pending[0].reject(failure);
  await rejection;
  assert.equal(store.getState().events[0], original, 'rollback restores all original fields and child records');
  assert.equal(store.getState().activeLoadKey, 'user:owner-a');
  assert.equal(store.getState().loadedFor, 'user:owner-a');
  assert.equal(store.getState().error, 'Unable to save the event. Your changes were restored.');
});

test('a successful update in the same account keeps the service result and provider identity', async (t) => {
  const { store, pending, original } = await openStore(t);
  const operation = store.getState().updateEventItem('owner-a', false, { ...original, name: 'Edited title' });
  const saved = { id: original.id, name: 'Confirmed title', activities: original.activities, status: 'in-progress' };
  pending[0].resolve(saved);
  assert.equal(await operation, saved);
  assert.equal(store.getState().events[0].name, 'Confirmed title');
  assert.equal(store.getState().events[0].firestoreId, 'account-a-document');
  assert.equal(store.getState().events[0].firestoreCollection, 'eventGroups');
  assert.equal(store.getState().error, null);
});

test('A → B → A invalidates old completion and rollback even when the account and application IDs match again', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const fails of [false, true]) {
    const { store, pending, original } = await openStore(t);
    const operation = store.getState().updateEventItem('owner-a', false, { ...original, name: 'Old pending edit' });
    await store.getState().loadEvents('owner-b', false);
    await store.getState().loadEvents('owner-a', false);
    store.setState({ events: [{ ...original, name: 'Newly loaded A record' }] });
    const selected = store.getState();
    if (fails) {
      const rejection = assert.rejects(operation, /Old write rejected/);
      pending[0].reject(new Error('Old write rejected')); await rejection;
    } else { pending[0].resolve({ ...original, name: 'Old service result' }); await operation; }
    assert.equal(store.getState(), selected);
    assert.equal(store.getState().events[0].name, 'Newly loaded A record');
  }
});
