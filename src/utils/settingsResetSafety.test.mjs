import test from 'node:test';
import assert from 'node:assert/strict';
import {
  settingsResetContext, assertSettingsResetContext, assertSettingsResetRecords,
} from './settingsResetSafety.js';

const verified = (loadKey, scenario = null) => ({
  loadedFor: loadKey, activeLoadKey: loadKey,
  loadedSample: scenario, activeSample: scenario,
  loading: false, error: null, events: [],
});

test('Guest, signed-out and different account scopes cannot cross a pending reset', () => {
  const guest = settingsResetContext({ user: null, isGuest: true });
  assert.equal(guest.scope, 'guest');
  assert.equal(guest.loadKey, 'guest:anonymous');
  assert.doesNotThrow(() => assertSettingsResetContext(guest, { user: null, isGuest: true }));
  assert.throws(() => assertSettingsResetContext(guest, { user: { uid: 'alice' }, isGuest: false }), /session changed/);
  assert.throws(() => assertSettingsResetContext(guest, { user: null, isGuest: false }), /session changed/);
  const first = settingsResetContext({ user: { uid: 'alice' }, isGuest: false });
  assert.equal(first.loadKey, 'user:alice');
  assert.throws(() => assertSettingsResetContext(first, { user: { uid: 'bob' }, isGuest: false }), /session changed/);
  assert.throws(() => assertSettingsResetContext(settingsResetContext({ user: null, isGuest: false }),
    { user: null, isGuest: false }), /session changed/);
});

test('switching a Guest sample cannot apply the earlier sample reset', () => {
  const ctx = settingsResetContext({ user: null, isGuest: true }, 'tour');
  assert.doesNotThrow(() => assertSettingsResetContext(ctx, { user: null, isGuest: true }, 'tour'));
  assert.throws(() => assertSettingsResetContext(ctx, { user: null, isGuest: true }, null), /session changed/);
  assert.throws(() => assertSettingsResetContext(ctx, { user: null, isGuest: true }, 'another-tour'), /session changed/);
});

test('only fully loaded records in all three stores can back a settings reset', () => {
  const ctx = settingsResetContext({ user: { uid: 'alice' }, isGuest: false });
  const a = verified(ctx.loadKey);
  assert.doesNotThrow(() => assertSettingsResetRecords(ctx, a,
    { ...a, events: undefined, expenses: [] }, { ...a, events: undefined, incomes: [] }));
  assert.throws(() => assertSettingsResetRecords(ctx, a, a), /could not verify/);
  assert.throws(() => assertSettingsResetRecords(ctx, a, a, a), /could not verify/);
  assert.throws(() => assertSettingsResetRecords(ctx, a, { ...a, loadedFor: 'user:bob' }, a), /could not verify/);
  assert.throws(() => assertSettingsResetRecords(ctx, a, { ...a, loading: true }, a), /could not verify/);
  assert.throws(() => assertSettingsResetRecords(ctx, a, { ...a, error: 'network' }, a), /could not verify/);
  assert.throws(() => assertSettingsResetRecords(ctx, a, { ...a, activeLoadKey: 'user:bob' }, a), /could not verify/);
  assert.throws(() => assertSettingsResetRecords(ctx, a, { ...a, events: undefined, expenses: undefined, incomes: undefined }, a), /could not verify/);
});

test('sample and ordinary records cannot be accidentally mixed in reset preflight', () => {
  const ctx = settingsResetContext({ isGuest: true }, 'guided');
  const a = verified(ctx.loadKey, 'guided');
  assert.doesNotThrow(() => assertSettingsResetRecords(ctx, a,
    { ...a, events: undefined, expenses: [] }, { ...a, events: undefined, incomes: [] }));
  assert.throws(() => assertSettingsResetRecords(ctx, a, { ...a, loadedSample: null }, a), /could not verify/);
  assert.throws(() => assertSettingsResetRecords(ctx, a, a, { ...a, activeSample: 'regular' }), /could not verify/);
});
