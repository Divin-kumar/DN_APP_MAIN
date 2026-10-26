import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverConditionFields, emptyGroup, matchesConditionGroup, mapConditions, removeCondition, conditionCount } from './conditionEngine.js';

const records = [
  { title: 'First journey', completed: false, price: 125, date: '2026-02-10', type: 'Personal', meta: { person: 'Alice' } },
  { title: 'Second journey', completed: true, price: 250, date: '2026-09-10', type: 'Family', meta: { person: 'Bob' } },
];
test('Discovers fields and typed values from actual data, including nested records', () => {
  const fields = discoverConditionFields(records);
  assert.equal(fields.find((f) => f.path === 'price').type, 'number');
  assert.equal(fields.find((f) => f.path === 'date').type, 'date');
  assert.equal(fields.find((f) => f.path === 'completed').type, 'boolean');
  assert.deepEqual(fields.find((f) => f.path === 'type').values, ['Personal', 'Family']);
  assert.ok(fields.some((f) => f.path === 'meta.person'));
});
test('Nested AND/OR conditions are evaluated reliably', () => {
  const schema = discoverConditionFields(records);
  const group = { id: 'root', kind: 'group', join: 'AND', children: [
    { id: 'r1', kind: 'rule', field: 'price', operator: 'gt', value: '100' },
    { id: 'g2', kind: 'group', join: 'OR', children: [
      { id: 'r2', kind: 'rule', field: 'title', operator: 'contains', value: 'First' },
      { id: 'r3', kind: 'rule', field: 'completed', operator: 'eq', value: 'true' },
    ] },
  ] };
  assert.deepEqual(records.map((r) => matchesConditionGroup(r, group, schema)), [true, true]);
  const greater = mapConditions(group, 'r1', (rule) => ({ ...rule, value: '200' }));
  assert.deepEqual(records.map((r) => matchesConditionGroup(r, greater, schema)), [false, true]);
  assert.equal(conditionCount(group), 3);
  assert.equal(conditionCount(removeCondition(group, 'r1')), 2);
  assert.deepEqual(emptyGroup().children, []);
});
test('Empty values and invalid comparisons do not pass numeric filters', () => {
  const schema = discoverConditionFields(records);
  const rule = { id: 'r', kind: 'rule', field: 'price', operator: 'gt', value: '1' };
  assert.equal(matchesConditionGroup({ price: null }, { kind: 'group', join: 'AND', children: [rule] }, schema), false);
  assert.equal(matchesConditionGroup({ price: 5 }, { kind: 'group', join: 'AND', children: [rule] }, schema), true);
});
