import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTaskResults } from './taskListFilters.js';

const tasks = [
  { id: 'overdue', title: 'Call a mechanic', notes: 'Bring papers', status: 'in-progress', priority: 'high', dueDate: '2026-11-01' },
  { id: 'today', title: 'Buy flowers', notes: '', status: 'in-progress', priority: 'medium', dueDate: '2026-11-03' },
  { id: 'next-week', title: 'Plan visit', notes: 'Bring documents', status: 'in-progress', priority: 'low', dueDate: '2026-11-10' },
  { id: 'later', title: 'Renew contract', notes: '', status: 'in-progress', priority: 'high', dueDate: '2026-11-11' },
  { id: 'done', title: 'Read book', notes: 'Old checklist', status: 'completed', priority: 'medium', dueDate: '2026-11-02' },
  { id: 'no-date', title: 'Write a note', notes: '', status: 'cancelled', priority: 'low', dueDate: '' },
];
const defaults = { search: '', status: 'all', priority: 'all', due: 'all' };
const select = (view) => filterTaskResults(tasks, { ...defaults, ...view }, '2026-11-03').map(task => task.id);

test('search matches title or notes without losing original Task objects', () => {
  assert.deepEqual(select({ search: 'BRING' }), ['overdue', 'next-week']);
  assert.deepEqual(select({ search: 'buy FLOWERS' }), ['today']);
  assert.equal(tasks.length, 6);
  assert.equal(tasks[0].title, 'Call a mechanic');
});
test('status and priority are combined with AND, not OR', () => {
  assert.deepEqual(select({ status: 'in-progress', priority: 'high' }), ['overdue', 'later']);
  assert.deepEqual(select({ status: 'completed', priority: 'high' }), []);
  assert.deepEqual(select({ status: 'cancelled' }), ['no-date']);
});
test('overdue respects local calendar days and excludes completed Tasks', () => {
  assert.deepEqual(select({ due: 'overdue' }), ['overdue']);
  assert.deepEqual(select({ due: 'overdue', status: 'completed' }), []);
});
test('next seven days include today and day seven, not day eight or cancelled', () => {
  assert.deepEqual(select({ due: 'next7' }), ['today', 'next-week']);
  assert.deepEqual(select({ due: 'next7', priority: 'high' }), []);
});
test('undated and all cases include appropriate items without inventing dates', () => {
  assert.deepEqual(select({ due: 'undated' }), ['no-date']);
  assert.deepEqual(select({ due: 'undated', status: 'in-progress' }), []);
  assert.deepEqual(select({}), tasks.map(task => task.id));
});
