import test from 'node:test';
import assert from 'node:assert/strict';
import { createScopedRecordActions, isRecordScopeLoaded } from './scopedRecordActions.js';
import { activityCompletionPatch } from './activityDetail.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const setup = () => {
  const api = { session: { user: { uid: 'owner' }, isGuest: false }, sample: null, writes: [], persist: async () => {} };
  const first = { id: 'one', attachments: [{ id: 'photo', assetId: 'a'.repeat(64) }], activities: [
    { id: 'same', title: 'First', description: '**Keep original**\n', expenses: [{ id: 'e', amount: 2 }], custom: 42 },
    { id: 'sibling', title: 'Sibling', custom: { keep: true } },
  ] };
  const second = { id: 'two', activities: [{ id: 'same', title: 'Second' }] };
  api.state = { events: [first, second], loadedFor: 'user:owner', activeLoadKey: 'user:owner', scopeRevision: 1,
    updateEventItem: async (uid, guest, record) => { api.writes.push([uid, guest, record]); await api.persist(record);
      api.state.events = api.state.events.map((item) => item.id === record.id ? record : item); } };
  api.actions = createScopedRecordActions({ getSession: () => api.session, getEvents: () => api.state, getSample: () => api.sample });
  return api;
};

test('serialized parent writers resolve the latest siblings and preserve unrelated child/attachment fields', async () => {
  const h = setup(), context = h.actions.capture(), pending = deferred();
  const original = structuredClone(h.state.events);
  h.persist = async () => { if (h.writes.length === 1) await pending.promise; };
  const first = h.actions.mutateActivity(context, 'one', 'same', (activity, moment) => activityCompletionPatch(activity, moment, true));
  const sibling = h.actions.mutateActivity(context, 'one', 'sibling', () => ({ description: 'Added notes' }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.writes.length, 1);
  pending.resolve(); await Promise.all([first, sibling]);
  assert.equal(h.writes.length, 2);
  const saved = h.state.events[0];
  assert.equal(saved.activities[0].completed, true);
  assert.equal(saved.activities[0].description, original[0].activities[0].description);
  assert.deepEqual(saved.activities[0].expenses, original[0].activities[0].expenses);
  assert.equal(saved.activities[0].custom, 42);
  assert.equal(saved.activities[1].description, 'Added notes');
  assert.deepEqual(saved.activities[1].custom, { keep: true });
  assert.deepEqual(saved.attachments, original[0].attachments);
  assert.deepEqual(h.state.events[1], original[1]);
});

test('duplicate keyed mutations are ignored while pending; a failed write releases the queue for recovery', async () => {
  const h = setup(), context = h.actions.capture(), pending = deferred(); h.persist = () => pending.promise;
  const first = h.actions.mutateActivity(context, 'one', 'same', () => ({ completed: true }), 'complete');
  assert.equal(await h.actions.mutateActivity(context, 'one', 'same', () => ({ completed: true }), 'complete'), false);
  const rejection = assert.rejects(first, /offline/); pending.reject(new Error('offline')); await rejection;
  h.persist = async () => {};
  await h.actions.mutateActivity(context, 'one', 'same', () => ({ completed: true }), 'complete');
  assert.equal(h.writes.length, 2);
});

test('missing parents never open an identically named child elsewhere, and runtime context is not persisted', async () => {
  const h = setup(), context = h.actions.capture();
  assert.throws(() => h.actions.resolveActivity(context, 'missing', 'same'), /Moment is no longer available/);
  await h.actions.mutateActivity(context, 'two', 'same', () => ({ priority: 'high' }));
  const saved = h.writes[0][2];
  assert.equal(saved.id, 'two'); assert.equal(saved.activities[0].id, 'same');
  for (const field of ['scope', 'sample', 'revision', 'momentId']) assert.equal(field in saved.activities[0], false);
});

test('queued writes reject changed account, Guest/Sample and load revisions before persistence', async () => {
  for (const change of [
    (h) => { h.session = { user: { uid: 'other' }, isGuest: false }; },
    (h) => { h.session = { user: null, isGuest: true }; },
    (h) => { h.sample = 'sample'; },
    (h) => { h.state.scopeRevision += 1; },
    (h) => { h.state.activeLoadKey = 'user:other'; },
  ]) {
    const h = setup(), context = h.actions.capture();
    const operation = h.actions.mutateActivity(context, 'one', 'same', () => ({ completed: true }));
    change(h); await assert.rejects(operation, /session changed/);
    assert.equal(h.writes.length, 0);
  }
});

test('loaded data requires matching active/loaded scope and Sample ownership', () => {
  assert.equal(isRecordScopeLoaded({ loadedFor: 'guest:anonymous', activeLoadKey: 'guest:anonymous' }, 'guest:anonymous'), true);
  assert.equal(isRecordScopeLoaded({ loadedFor: 'guest:anonymous', activeLoadKey: 'user:A' }, 'guest:anonymous'), false);
  assert.equal(isRecordScopeLoaded({ loadedFor: 'guest:anonymous', activeLoadKey: 'guest:anonymous', loadedSample: 'first', activeSample: 'first' }, 'guest:anonymous', 'second'), false);
});

test('edits queued behind completion recheck the latest Activity and require an explicit reopen', async () => {
  const h = setup(), context = h.actions.capture(), pending = deferred();
  h.persist = async () => { if (h.writes.length === 1) await pending.promise; };
  const complete = h.actions.mutateActivity(context, 'one', 'same', (activity, moment) => activityCompletionPatch(activity, moment, true), 'complete');
  const edit = h.actions.mutateActivity(context, 'one', 'same', () => ({ title: 'Must not replace completed data' }), 'edit');
  const rejected = assert.rejects(edit, /Reopen this activity before editing/);
  pending.resolve(); await complete; await rejected;
  assert.equal(h.writes.length, 1); assert.equal(h.state.events[0].activities[0].title, 'First');
  await h.actions.mutateActivity(context, 'one', 'same', (activity, moment) => activityCompletionPatch(activity, moment, false), 'reopen');
  await h.actions.mutateActivity(context, 'one', 'same', () => ({ title: 'Now editable' }), 'edit');
  assert.equal(h.state.events[0].activities[0].title, 'Now editable');
  assert.deepEqual(h.state.events[0].activities[1], { id: 'sibling', title: 'Sibling', custom: { keep: true } });
});
