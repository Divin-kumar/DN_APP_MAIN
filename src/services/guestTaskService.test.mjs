import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestTaskRepository, GUEST_TASKS_KEY } from './guestTaskService.js';

const task = (id, details = {}) => ({
  id, title: 'Review photos', status: 'in-progress', priority: 'medium',
  momentId: 'moment-one', activityId: 'activity-one', dueDate: '2026-11-04', dueTime: '',
  ...details,
});
const fixture = () => {
  const records = new Map([['dn_guest_eventGroups', '[{"id":"old-moment"}]'], ['dn_guest_incomes', '[1]']]);
  const storage = {
    getItem: (key) => records.has(key) ? records.get(key) : null,
    setItem: (key, value) => records.set(key, value),
  };
  let guest = true;
  return { records, storage, setGuest: (active) => { guest = active; },
    repository: createGuestTaskRepository({ storage, assertGuest: () => guest, createId: () => 'generated-task' }) };
};

test('Guest Tasks are isolated from all existing DN collections and do not change Moments', () => {
  const ctx = fixture();
  const original = ctx.records.get('dn_guest_eventGroups');
  const created = ctx.repository.upsert(task('independent'));
  assert.equal(created.id, 'independent');
  assert.deepEqual(ctx.repository.list().map((item) => item.id), ['independent']);
  assert.equal(ctx.records.get('dn_guest_eventGroups'), original);
  assert.equal(ctx.records.get('dn_guest_incomes'), '[1]');
  assert.deepEqual(JSON.parse(ctx.records.get(GUEST_TASKS_KEY))[0].momentId, 'moment-one');
});

test('a Task partial edit keeps stable ID, existing links, notes and untimed due time', () => {
  const { repository } = fixture();
  repository.upsert(task('a', { notes: 'First version', dueTime: '' }));
  repository.upsert({ id: 'a', title: 'Edit the title' });
  const saved = repository.list()[0];
  assert.equal(saved.title, 'Edit the title');
  assert.equal(saved.notes, 'First version');
  assert.equal(saved.dueTime, '');
  assert.equal(saved.activityId, 'activity-one');
  assert.equal(repository.list().length, 1);
});

test('record identity is generated only during new creation, never during reads', () => {
  const { repository } = fixture();
  const saved = repository.upsert({ title: 'From the universal plus' });
  assert.equal(saved.id, 'generated-task');
  assert.deepEqual(repository.list().map((item) => item.id), ['generated-task']);
});

test('an invalid snapshot or duplicate ID fails closed without overwriting source', () => {
  const ctx = fixture();
  for (const raw of ['not-json', '{"a":1}', '[{"title":"no ID"}]', JSON.stringify([task('same'), task('same')])]) {
    ctx.records.set(GUEST_TASKS_KEY, raw);
    assert.throws(() => ctx.repository.upsert(task('new')), /unreadable|invalid|stable ID|duplicate ID/);
    assert.equal(ctx.records.get(GUEST_TASKS_KEY), raw);
  }
});
test('scope switches block reads, updates and parent unlink writes', () => {
  const ctx = fixture();
  ctx.repository.upsert(task('a'));
  const before = ctx.records.get(GUEST_TASKS_KEY);
  ctx.setGuest(false);
  assert.throws(() => ctx.repository.list(), /Guest session changed/);
  assert.throws(() => ctx.repository.upsert(task('new')), /Guest session changed/);
  assert.throws(() => ctx.repository.remove('a'), /Guest session changed/);
  assert.throws(() => ctx.repository.detachParent({ momentId: 'moment-one' }), /Guest session changed/);
  assert.equal(ctx.records.get(GUEST_TASKS_KEY), before);
});
test('removing a Task does not remove the linked Activity or any other Task', () => {
  const ctx = fixture();
  ctx.repository.upsert(task('a'));
  ctx.repository.upsert(task('b'));
  assert.equal(ctx.repository.remove('a'), 1);
  assert.equal(ctx.repository.remove('a'), 0);
  assert.deepEqual(ctx.repository.list().map((entry) => entry.id), ['b']);
  assert.ok(ctx.records.get('dn_guest_eventGroups').includes('old-moment'));
});
test('parent unlink keeps every independent Task and its status', () => {
  const ctx = fixture();
  ctx.repository.upsert(task('a', { status: 'completed', completedAt: '2026-11-03T14:00:00Z' }));
  ctx.repository.upsert(task('b', { momentId: '', activityId: '' }));
  const afterActivity = ctx.repository.detachParent({ momentId: 'moment-one', activityId: 'activity-one' });
  assert.equal(afterActivity.length, 2);
  assert.equal(afterActivity[0].activityId, '');
  assert.equal(afterActivity[0].momentId, 'moment-one');
  assert.equal(afterActivity[0].status, 'completed');
  const afterMoment = ctx.repository.detachParent({ momentId: 'moment-one' });
  assert.equal(afterMoment.length, 2);
  assert.equal(afterMoment[0].momentId, '');
  assert.equal(afterMoment[0].status, 'completed');
});
test('storage failure propagates and never reports a successful Task save', () => {
  const repository = createGuestTaskRepository({ storage: { getItem: () => null, setItem: () => { throw new Error('quota'); } },
    assertGuest: () => true });
  assert.throws(() => repository.upsert(task('a')), /quota/);
  assert.throws(() => createGuestTaskRepository({ storage: new Map() }), /explicit storage and session guard/);
});

test('backup merge preserves destination Tasks on identity conflict and is retry-safe', () => {
  const ctx = fixture();
  ctx.repository.upsert(task('a', { title: 'Private destination value', notes: 'Keep' }));
  const incoming = [task('a', { title: 'Stale backup value', notes: 'Discarded' }), task('b', { title: 'New backup Task', dueTime: '' })];
  const first = ctx.repository.merge(incoming);
  assert.deepEqual({ added: first.added, conflicts: first.conflicts }, { added: 1, conflicts: 1 });
  assert.deepEqual(ctx.repository.list().map((t) => t.title), ['Private destination value', 'New backup Task']);
  const before = ctx.records.get(GUEST_TASKS_KEY);
  const retry = ctx.repository.merge(incoming);
  assert.deepEqual({ added: retry.added, conflicts: retry.conflicts }, { added: 0, conflicts: 2 });
  assert.equal(ctx.records.get(GUEST_TASKS_KEY), before);
  assert.deepEqual(ctx.repository.merge([]), { items: ctx.repository.list(), added: 0, conflicts: 0 });
});
test('backup merge rejects corrupt Task imports without partial writes', () => {
  const ctx = fixture();
  ctx.repository.upsert(task('a'));
  const before = ctx.records.get(GUEST_TASKS_KEY);
  assert.throws(() => ctx.repository.merge([task('b'), task('b')]), /duplicate ID/);
  assert.throws(() => ctx.repository.merge([task('b'), task('bad', { dueDate: '2026-02-30' })]), /valid Task due date/);
  assert.equal(ctx.records.get(GUEST_TASKS_KEY), before);
});
