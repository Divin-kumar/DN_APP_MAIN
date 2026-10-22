import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyStorage, clearDnLocalData } from './storageMigration.js';

const makeStorage = (values = {}) => {
  const store = new Map(Object.entries(values));
  return {
    get length() { return store.size; },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
};

test('brand migration preserves legacy guest records, preferences and dynamic dashboard keys', () => {
  const storage = makeStorage({
    lifehub_guest_mode: 'true',
    lifehub_guest_eventGroups: '[{"id":"moment-old"}]',
    lifehub_preferences: '{"theme":"light"}',
    lifehub_favorite_event_ids_guest: '["moment-old"]',
    unrelated_site_data: 'keep',
  });
  const result = migrateLegacyStorage(storage);
  assert.equal(result.failed.length, 0);
  assert.equal(storage.getItem('dn_guest_mode'), 'true');
  assert.equal(storage.getItem('dn_guest_eventGroups'), '[{"id":"moment-old"}]');
  assert.equal(storage.getItem('dn_preferences'), '{"theme":"light"}');
  assert.equal(storage.getItem('dn_favorite_event_ids_guest'), '["moment-old"]');
  assert.equal(storage.getItem('lifehub_guest_eventGroups'), '[{"id":"moment-old"}]');
  assert.equal(storage.getItem('unrelated_site_data'), 'keep');
});

test('migration is idempotent and newer DN values always win', () => {
  const storage = makeStorage({ lifehub_preferences: '{"theme":"dark"}', dn_preferences: '{"theme":"light"}' });
  migrateLegacyStorage(storage);
  migrateLegacyStorage(storage);
  assert.equal(storage.getItem('dn_preferences'), '{"theme":"light"}');
});

test('clear local data removes legacy and DN app values without deleting unrelated data', (t) => {
  const storage = makeStorage({
    lifehub_guest_mode: 'true',
    dn_guest_mode: 'true',
    lifehub_recent_event_ids_guest: '["old"]',
    dn_recent_event_ids_guest: '["new"]',
    'dn_list_state_account%3Aowner_moments': '{"search":"private"}',
    unrelated_site_data: 'keep',
  });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const session = makeStorage({ dn_transactions_filters_owner: '{"search":"old"}', unrelated_session: 'keep' });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'sessionStorage', descriptor) : delete globalThis.sessionStorage);
  clearDnLocalData(storage);
  assert.equal(storage.getItem('lifehub_guest_mode'), null);
  assert.equal(storage.getItem('dn_guest_mode'), null);
  assert.equal(storage.getItem('lifehub_recent_event_ids_guest'), null);
  assert.equal(storage.getItem('dn_recent_event_ids_guest'), null);
  assert.equal(storage.getItem('dn_list_state_account%3Aowner_moments'), null);
  assert.equal(session.getItem('dn_transactions_filters_owner'), null);
  assert.equal(session.getItem('unrelated_session'), 'keep');
  assert.equal(storage.getItem('unrelated_site_data'), 'keep');
});

test('migration supports minimal storage fakes with no key enumeration', () => {
  const values = new Map([['lifehub_admin_values', '{"eventTypes":[]}']]);
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };
  const result = migrateLegacyStorage(storage);
  assert.deepEqual(result.failed, []);
  assert.equal(values.get('dn_admin_values'), '{"eventTypes":[]}');
});
