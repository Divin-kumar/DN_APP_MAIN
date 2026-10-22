import test from 'node:test';
import assert from 'node:assert/strict';
import { createListStateMemory, listStateKey, listStateScope, normalizeListState, readLegacyTransactionFilters } from './listStateMemory.js';

const defaults = Object.freeze({ search: '', filter: 'all', field: 'date', direction: 'asc' });
const rules = { filter: ['all', 'completed', 'high'], field: ['date', 'title'], direction: ['asc', 'desc'] };
const storageFixture = () => {
  const values = new Map();
  return { values, storage: { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)) } };
};

test('list choices survive remount/browser memory reconstruction until explicit reset', () => {
  const { storage } = storageFixture();
  let memory = createListStateMemory(() => storage);
  const key = listStateKey('account:owner-a', 'activities:moment-a');
  memory.update(key, defaults, rules, { search: 'scan', filter: 'completed', field: 'title', direction: 'desc' });
  memory = createListStateMemory(() => storage);
  assert.deepEqual(memory.read(key, defaults, rules), { search: 'scan', filter: 'completed', field: 'title', direction: 'desc' });
  // No result/data hydration is allowed to mutate this state; only a UI patch/reset does.
  assert.equal(memory.read(key, defaults, rules), memory.read(key, defaults, rules));
  memory.reset(key, defaults, rules);
  assert.deepEqual(createListStateMemory(() => storage).read(key, defaults, rules), defaults);
});

test('UID, guest, signed-out and each Moment have independent keys', () => {
  const { storage } = storageFixture();
  const memory = createListStateMemory(() => storage);
  const owner = listStateScope({ user: { uid: 'a' }, isGuest: false });
  const key = listStateKey(owner, 'activities:one');
  memory.update(key, defaults, rules, { filter: 'high', search: 'private query' });
  for (const [scope, list] of [['account:b', 'activities:one'], ['guest', 'activities:one'], ['signed-out', 'activities:one'], [owner, 'activities:two'], [owner, 'moments']]) {
    assert.deepEqual(memory.read(listStateKey(scope, list), defaults, rules), defaults);
  }
  assert.equal(listStateScope({ user: { uid: 'a' }, isGuest: true }), 'account:a');
  assert.notEqual(listStateKey('account:a', 'b:c'), listStateKey('account:a:b', 'c'));
});

test('invalid or malformed saved choices fall back only for invalid fields', () => {
  const { storage, values } = storageFixture();
  const key = listStateKey('guest', 'moments');
  values.set(key, '{broken');
  assert.deepEqual(createListStateMemory(() => storage).read(key, defaults, rules), defaults);
  assert.deepEqual(normalizeListState({ search: 'saved', filter: 'removed', direction: 'sideways', field: 13, unknown: 'ignored' }, defaults, rules), { ...defaults, search: 'saved' });
});

test('unavailable/quota-limited browser storage retains choices in memory without throwing', () => {
  for (const getStorage of [() => { throw new Error('disabled'); }, () => ({ getItem: () => null, setItem: () => { throw new Error('quota'); } })]) {
    const memory = createListStateMemory(getStorage);
    memory.update('test', defaults, rules, { filter: 'high' });
    assert.equal(memory.read('test', defaults, rules).filter, 'high');
    memory.update('test', defaults, rules, (current) => ({ direction: current.direction === 'asc' ? 'desc' : 'asc' }));
    assert.equal(memory.read('test', defaults, rules).direction, 'desc');
    assert.deepEqual(memory.reset('test', defaults, rules), defaults);
  }
});

test('subscribers receive changes and matching storage events, not other lists', () => {
  const { storage } = storageFixture();
  const memory = createListStateMemory(() => storage);
  memory.read('one', defaults, rules);
  let calls = 0;
  const unsubscribe = memory.subscribe('one', () => { calls += 1; });
  memory.update('one', defaults, rules, { search: 'a' });
  memory.receiveStorage('other', JSON.stringify({ search: 'b' }));
  memory.receiveStorage('one', JSON.stringify({ search: 'b', direction: 'desc' }));
  assert.equal(calls, 2);
  assert.equal(memory.read('one', defaults, rules).search, 'b');
  unsubscribe();
  memory.reset('one', defaults, rules);
  assert.equal(calls, 2);
});

test('transaction migration reads only the matching legacy owner and never overwrites new memory', (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const session = new Map([
    ['dn_transactions_filters_owner-a', JSON.stringify({ type: 'expense', month: '2026-10', search: 'blood' })],
    ['dn_transactions_filters_guest', JSON.stringify({ type: 'income', month: 'all', search: 'guest' })],
  ]);
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key) => session.get(key) ?? null } });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'sessionStorage', descriptor) : delete globalThis.sessionStorage);
  assert.equal(readLegacyTransactionFilters('account:owner-a').search, 'blood');
  assert.equal(readLegacyTransactionFilters('guest').search, 'guest');
  assert.equal(readLegacyTransactionFilters('account:other'), null);
  assert.equal(readLegacyTransactionFilters('signed-out'), null);
  const { storage } = storageFixture();
  const filters = { type: 'all', month: 'all', search: '' };
  const key = listStateKey('account:owner-a', 'transactions');
  let memory = createListStateMemory(() => storage);
  const legacy = () => readLegacyTransactionFilters('account:owner-a');
  assert.equal(memory.read(key, filters, {}, legacy).month, '2026-10');
  memory.reset(key, filters, {});
  memory = createListStateMemory(() => storage);
  assert.deepEqual(memory.read(key, filters, {}, legacy), filters);
});
