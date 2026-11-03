import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TASK_GROUPS, detachIndependentTaskLinks, groupIndependentTasks,
  normalizeIndependentTask, resolveIndependentTaskParent, sortIndependentTasks, taskStatusPatch,
} from './independentTasks.js';

const raw = (overrides = {}) => ({
  id: 'task-1', title: '  Reserve tickets  ', dueDate: '2026-11-04',
  dueTime: '08:05', momentId: 'moment-one', activityId: 'activity-one',
  notes: 'Details', priority: 'high', status: 'in-progress', ...overrides,
});
const moment = { id: 'moment-one', name: 'Weekend away',
  activities: [{ id: 'activity-one', title: 'Make arrangements', mergedActivityIds: ['old-activity-id'] }] };

test('a new independent Task keeps explicit due time, stable ID and links without adding an Activity', () => {
  const original = raw();
  const saved = normalizeIndependentTask(original);
  assert.deepEqual({ id: saved.id, title: saved.title, dueDate: saved.dueDate, dueTime: saved.dueTime,
    momentId: saved.momentId, activityId: saved.activityId },
  { id: 'task-1', title: 'Reserve tickets', dueDate: '2026-11-04', dueTime: '08:05',
    momentId: 'moment-one', activityId: 'activity-one' });
  assert.equal(saved.completedAt, null);
  assert.deepEqual(original, raw(), 'validation and normalization do not mutate stored sources');
});

test('untimed and undated Tasks never inherit createdAt or completion timestamps as due time', () => {
  const saved = normalizeIndependentTask(raw({ dueDate: '', dueTime: '', createdAt: '2026-11-03T20:00:00Z', completedAt: null }));
  assert.equal(saved.dueTime, '');
  assert.equal(saved.dueDate, '');
  assert.equal(saved.createdAt, '2026-11-03T20:00:00Z');
});
test('rejects invalid dates, times, incomplete links and missing identity', () => {
  for (const extra of [
    { dueDate: '2026-02-30' }, { dueDate: 'yesterday' }, { dueDate: '', dueTime: '11:00' },
    { dueTime: '25:01' }, { momentId: '', activityId: 'activity-one' },
    { title: ' ' }, { id: '', firestoreId: '' },
  ]) assert.throws(() => normalizeIndependentTask(raw(extra)));
  assert.equal(normalizeIndependentTask(raw({ id: 123 })).id, '123');
  assert.equal(normalizeIndependentTask(raw({ id: '', firestoreId: '', title: 'Created' }), { createId: () => 'new-uuid' }).id, 'new-uuid');
});
test('Task status transitions never modify the Moment or Activity status', () => {
  const task = normalizeIndependentTask(raw());
  const before = JSON.stringify(moment);
  const at = new Date('2026-11-04T12:00:00.000Z');
  assert.deepEqual(taskStatusPatch(task, 'completed', at),
    { status: 'completed', completedAt: at.toISOString(), updatedAt: at.toISOString() });
  assert.equal(taskStatusPatch({ ...task, status: 'completed' }, 'completed', at), null);
  assert.deepEqual(taskStatusPatch({ ...task, status: 'completed' }, 'cancelled', at),
    { status: 'cancelled', completedAt: null, updatedAt: at.toISOString() });
  assert.throws(() => taskStatusPatch(task, 'unknown'));
  assert.equal(JSON.stringify(moment), before);
});
test('deleted Moment detaches both links without deleting Tasks; Activity deletion keeps Moment link', () => {
  const tasks = [raw(), raw({ id: 'task-2', activityId: '' }), raw({ id: 'task-3', momentId: 'another', activityId: '' })];
  const a = detachIndependentTaskLinks(tasks, { momentId: 'moment-one', activityId: 'activity-one' });
  assert.equal(a.length, 3);
  assert.deepEqual([a[0].momentId, a[0].activityId], ['moment-one', '']);
  assert.deepEqual([a[1].momentId, a[1].activityId], ['moment-one', '']);
  const b = detachIndependentTaskLinks(tasks, { momentId: 'moment-one' });
  assert.deepEqual([b[0].momentId, b[0].activityId], ['', '']);
  assert.deepEqual([b[1].momentId, b[1].activityId], ['', '']);
  assert.equal(b[2], tasks[2]);
  assert.equal(tasks[0].activityId, 'activity-one');
});
test('Activity links are resolved within their Moment and allow historical aliases', () => {
  assert.equal(resolveIndependentTaskParent(raw(), [moment]).kind, 'activity');
  assert.equal(resolveIndependentTaskParent(raw({ activityId: 'old-activity-id' }), [moment]).kind, 'activity');
  assert.equal(resolveIndependentTaskParent(raw({ momentId: 'missing' }), [moment]).kind, 'missing-moment');
  assert.equal(resolveIndependentTaskParent(raw({ activityId: 'missing' }), [moment]).kind, 'missing-activity');
  assert.equal(resolveIndependentTaskParent(raw({ momentId: '', activityId: '' }), [moment]).kind, 'standalone');
  const duplicate = { id: 'moment-two', activities: [{ id: 'activity-one' }] };
  assert.equal(resolveIndependentTaskParent(raw({ momentId: 'moment-two' }), [moment, duplicate]).moment.id, 'moment-two');
});
test('sort: undated last, time optional, direction only reverses dated order', () => {
  const input = [
    raw({ id: 'no-date', dueDate: '', dueTime: '' }),
    raw({ id: 'nine', dueTime: '09:00' }),
    raw({ id: 'eight', dueTime: '08:00' }),
    raw({ id: 'untimed', dueTime: '' }),
    raw({ id: 'older', dueDate: '2026-11-01', dueTime: '' }),
  ];
  assert.deepEqual(sortIndependentTasks(input).map(t => t.id), ['older', 'eight', 'nine', 'untimed', 'no-date']);
  assert.equal(sortIndependentTasks(input, 'desc').at(-1).id, 'no-date');
  assert.equal(input[0].id, 'no-date');
});
test('grouping is presentation-only and counts each Task once across supported grouping choices', () => {
  const tasks = [
    normalizeIndependentTask(raw()),
    normalizeIndependentTask(raw({ id: 'task-2', momentId: 'moment-one', activityId: '', dueDate: '', dueTime: '' })),
    normalizeIndependentTask(raw({ id: 'task-3', momentId: '', activityId: '', dueDate: '', dueTime: '', status: 'completed' })),
  ];
  for (const by of TASK_GROUPS) {
    const groups = groupIndependentTasks(tasks, { by, moments: [moment] });
    assert.equal(groups.reduce((sum, group) => sum + group.count, 0), 3);
    assert.deepEqual(new Set(groups.flatMap(group => group.tasks.map(task => task.id))).size, 3);
  }
  assert.deepEqual(groupIndependentTasks(tasks, { by: 'moment', moments: [moment] }).map(group => group.label),
    ['Weekend away', 'Standalone']);
  assert.deepEqual(groupIndependentTasks(tasks, { by: 'activity', moments: [moment] }).map(group => group.label),
    ['Make arrangements', 'Moment only', 'Standalone']);
  assert.equal(groupIndependentTasks(tasks, { by: 'dueDate' }).at(-1).label, 'No due date');
  assert.throws(() => groupIndependentTasks(tasks, { by: 'other' }));
});

test('optional title sorting is deterministic and does not mutate Task records', () => {
  const items = [raw({ id: 'z', title: 'Zulu' }), raw({ id: 'a', title: 'Alpha' })];
  assert.deepEqual(sortIndependentTasks(items, 'asc', 'title').map(item => item.id), ['a', 'z']);
  assert.deepEqual(sortIndependentTasks(items, 'desc', 'title').map(item => item.id), ['z', 'a']);
  assert.deepEqual(groupIndependentTasks(items, { by: 'status', sortBy: 'title' })[0].tasks.map(item => item.id), ['a', 'z']);
  assert.equal(items[0].id, 'z');
});
