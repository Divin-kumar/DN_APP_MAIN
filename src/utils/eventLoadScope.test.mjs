import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventLoader } from './eventLoadScope.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const setup = (readEvents, initial = {}) => {
  let state = { events: [], loadedFor: null, activeLoadKey: null, ...initial };
  const get = () => state;
  const set = (patch) => { state = { ...state, ...patch }; };
  return { get, load: createEventLoader({ get, set, readEvents, onError: () => {} }) };
};

test('event loads clear stale account Moments immediately and replace them with selected account records', async () => {
  const request = deferred();
  const { get, load } = setup(() => request.promise, { events: [{ id: 'private-A' }], loadedFor: 'user:A', activeLoadKey: 'user:A' });
  const loading = load('B', false);
  assert.deepEqual(get().events, []);
  assert.equal(get().loadedFor, null);
  assert.equal(get().activeLoadKey, 'user:B');
  request.resolve([{ id: 'B' }]);
  await loading;
  assert.deepEqual(get().events, [{ id: 'B' }]);
  assert.equal(get().loadedFor, 'user:B');
});

test('rapid A → B → A joins A request, reactivates ownership and ignores inactive B result', async () => {
  const a = deferred();
  const b = deferred();
  const calls = [];
  const { get, load } = setup((uid) => { calls.push(uid); return uid === 'A' ? a.promise : b.promise; });
  const firstA = load('A', false);
  const onB = load('B', false);
  const secondA = load('A', false);
  b.resolve([{ id: 'private-B' }]);
  await onB;
  assert.deepEqual(get().events, []);
  assert.equal(get().activeLoadKey, 'user:A');
  a.resolve([{ id: 'A' }]);
  await Promise.all([firstA, secondA]);
  assert.deepEqual(get().events, [{ id: 'A' }]);
  assert.deepEqual(calls, ['A', 'B']);
  await load('A', false);
  assert.deepEqual(calls, ['A', 'B'], 'active scope is cached after successful load');
});

test('guest/account transitions keep records isolated and failed reads can retry', async () => {
  let attempts = 0;
  const { get, load } = setup(async (uid, isGuest) => {
    attempts += 1;
    if (attempts === 1) throw new Error('denied');
    return [{ id: isGuest ? 'guest' : uid }];
  }, { events: [{ id: 'account' }], loadedFor: 'user:A', activeLoadKey: 'user:A' });
  await load(undefined, true);
  assert.deepEqual(get().events, []);
  assert.equal(get().error, 'Unable to load events.');
  await load(undefined, true);
  assert.deepEqual(get().events, [{ id: 'guest' }]);
  assert.equal(get().error, null);
  await load('B', false);
  assert.deepEqual(get().events, [{ id: 'B' }]);
});

test('Sample and Guest reads have independent ownership despite using the same Guest route scope', async () => {
  let sample = null, state = { events: [], activeLoadKey: null, loadedFor: null };
  const pending = deferred();
  const load = createEventLoader({ get: () => state, set: (patch) => { state = { ...state, ...patch }; },
    getSample: () => sample, readEvents: () => sample ? [{ id: 'sample-only' }] : pending.promise });
  const guest = load(null, true);
  await Promise.resolve();
  sample = 'regular'; await load(null, true);
  assert.deepEqual(state.events, [{ id: 'sample-only' }]);
  pending.resolve([{ id: 'guest-only' }]); await guest;
  assert.deepEqual(state.events, [{ id: 'sample-only' }]);
  assert.equal(state.loadedSample, 'regular');
  sample = null; await load(null, true);
  assert.deepEqual(state.events, [{ id: 'guest-only' }]);
  assert.equal(state.loadedSample, null);
});
