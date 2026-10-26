import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverConditionFields, emptyGroup, matchesConditionGroup, mapConditions, removeCondition, conditionCount, testCondition, compileConditionGroup, normalizeConditionGroup, conditionChipEntries } from './conditionEngine.js';

const records = [
  { title: 'First journey', completed: false, price: 125, date: '2026-02-10', type: 'Personal', meta: { person: 'Alice' } },
  { title: 'Second journey', completed: true, price: 250, date: '2026-09-10', type: 'Family', meta: { person: 'Bob' } },
];
test('Discovers fields and typed values from actual data, including nested records', () => {
  const fields = discoverConditionFields(records);
  assert.equal(fields.find((f) => f.path === 'price').type, 'number');
  assert.equal(fields.find((f) => f.path === 'date').type, 'date');
  assert.equal(fields.find((f) => f.path === 'completed').type, 'boolean');
  assert.deepEqual(fields.find((f) => f.path === 'type').values, ['Family', 'Personal']);
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

test('Schema hints and future deeply nested/array fields combine with all actual values', () => {
  const records = Array.from({ length: 150 }, (_, index) => ({ meta: { context: { owner: `Person ${index}` } }, tags: ['travel', `tag-${index}`], attachments: [{ size: index }] }));
  const fields = discoverConditionFields(records, { properties: { status: { type: 'string', enum: ['Open', 'Closed'], title: 'Current status' }, future: { type: 'object', properties: { score: { type: 'integer' } } } } });
  assert.equal(fields.find((field) => field.path === 'meta.context.owner').values.length, 150);
  assert.equal(fields.find((field) => field.path === 'status').type, 'dropdown');
  assert.equal(fields.find((field) => field.path === 'status').label, 'Current status');
  assert.deepEqual(fields.find((field) => field.path === 'status').values, ['Closed', 'Open']);
  assert.equal(fields.find((field) => field.path === 'future.score').type, 'number');
  assert.equal(fields.find((field) => field.path === 'attachments[].size').type, 'number');
  assert.ok(fields.some((field) => field.path === 'tags[]'));
});

test('Scalar dates and Firestore timestamps stay date fields rather than exposing internals', () => {
  const fields = discoverConditionFields([{ stamp: new Date('2026-10-26T00:00:00Z'), meta: { due: { seconds: 1792972800, nanoseconds: 0 } } }]);
  assert.equal(fields.find((field) => field.path === 'stamp').type, 'date');
  assert.equal(fields.find((field) => field.path === 'meta.due').type, 'date');
  assert.equal(fields.some((field) => field.path.includes('seconds')), false);
  const legacy = discoverConditionFields([{ date: { _seconds: 1792972800, _nanoseconds: 0 } }]);
  assert.equal(legacy[0].type, 'date');
  assert.equal(testCondition({ date: new Date(2026, 9, 26, 12).getTime() }, { field: 'date', operator: 'eq', value: '2026-10-26' }, [{ path: 'date', type: 'date' }]), true);
});

test('Arrays use any member for positive comparisons and every member for exclusions', () => {
  const data = [{ tags: ['work', 'travel'] }, { tags: ['family'] }, { tags: [] }, {}];
  const fields = discoverConditionFields(data);
  const rule = (operator, value) => ({ kind: 'group', join: 'AND', children: [{ id: 'r', kind: 'rule', field: 'tags[]', operator, value }] });
  assert.deepEqual(data.map((record) => matchesConditionGroup(record, rule('any_of', ['travel', 'family']), fields)), [true, true, false, false]);
  assert.deepEqual(data.map((record) => matchesConditionGroup(record, rule('none_of', ['travel']), fields)), [false, true, false, false]);
  assert.deepEqual(data.map((record) => matchesConditionGroup(record, rule('empty', ''), fields)), [false, false, true, true]);
  assert.equal(testCondition({ matrix: [['one'], ['two']] }, { field: 'matrix[][]', operator: 'eq', value: 'two' }, [{ path: 'matrix[][]', type: 'text' }]), true);
});

test('Incomplete rules and empty nested OR groups do not broaden active comparisons', () => {
  const group = { id: 'root', kind: 'group', join: 'OR', children: [
    { id: 'a', kind: 'rule', field: 'price', operator: 'gt', value: 200 },
    { id: 'b', kind: 'rule', field: 'title', operator: 'contains', value: '' },
    { id: 'g', kind: 'group', join: 'AND', children: [] },
  ] };
  assert.deepEqual(records.map((record) => matchesConditionGroup(record, group, discoverConditionFields(records))), [false, true]);
  assert.equal(conditionCount(group), 1);
});

test('Missing booleans do not become false and empty numeric operands never become zero', () => {
  const boolSchema = [{ path: 'completed', type: 'boolean' }];
  assert.equal(testCondition({}, { field: 'completed', operator: 'is_false' }, boolSchema), false);
  assert.equal(testCondition({ completed: false }, { field: 'completed', operator: 'is_false' }, boolSchema), true);
  assert.equal(testCondition({ completed: 'false' }, { field: 'completed', operator: 'is_false' }, boolSchema), true);
  assert.equal(testCondition({ price: 5 }, { field: 'price', operator: 'between', value: [1, 5] }, [{ path: 'price', type: 'number' }]), true);
  assert.equal(testCondition({ price: 6 }, { field: 'price', operator: 'between', value: [1, 5] }, [{ path: 'price', type: 'number' }]), false);
});

test('Relative and custom date ranges include boundary days and reject invalid dates', () => {
  const fields = [{ path: 'date', type: 'date' }];
  const match = (operator, value) => compileConditionGroup({ kind: 'group', children: [{ field: 'date', operator, value }] }, fields, new Date(2026, 9, 26));
  assert.equal(match('today')({ date: '2026-10-26T20:15:00Z' }), true);
  assert.equal(match('today')({ date: '2026-10-25' }), false);
  assert.equal(match('this_week')({ date: '2026-11-01' }), true);
  assert.equal(match('this_week')({ date: '2026-11-02' }), false);
  assert.equal(match('this_month')({ date: '2026-10-31' }), true);
  assert.equal(match('this_year')({ date: '2026-12-31' }), true);
  assert.equal(match('between', ['2026-01-01', '2026-10-26'])({ date: '2026-10-26' }), true);
  assert.equal(match('this_year')({ date: '2026-02-30' }), false);
});

test('Malformed stored trees normalize safely with bounded depth and unique editable IDs', () => {
  const root = { id: 'same', kind: 'group', join: 'garbage', children: [null, { id: 'same', kind: 'rule', field: 'title', operator: 'eq', value: { invalid: true } }, { id: 'same', kind: 'rule', field: '__proto__.secret', operator: 'eq', value: 'x' }] };
  root.children.push(root);
  const normalized = normalizeConditionGroup(root);
  const ids = new Set(); let depth = 0;
  const visit = (node, level = 0) => { assert.ok(!ids.has(node.id)); ids.add(node.id); depth = Math.max(depth, level); if (node.kind === 'group') node.children.forEach((child) => visit(child, level + 1)); };
  visit(normalized);
  assert.ok(depth <= 12);
  assert.equal(normalized.join, 'AND');
  assert.equal(normalized.children[0].value, '');
  assert.equal(normalized.children.some((node) => node.field === '__proto__.secret'), false);
});

test('Discovered cyclic records and hidden/function metadata cannot break discovery', () => {
  const record = { title: 'Safe', _runtime: 'hidden', method() {} }; record.circular = record;
  assert.deepEqual(discoverConditionFields([record]).map((field) => field.path), ['title']);
});

test('Active chips expose OR grouping and identify individual removable rules', () => {
  const chips = conditionChipEntries({ id: 'root', kind: 'group', join: 'AND', children: [{ id: 'or', kind: 'group', join: 'OR', children: [{ id: 'one', kind: 'rule', field: 'title', operator: 'eq', value: 'First' }] }] }, discoverConditionFields(records));
  assert.equal(chips[0].id, 'one');
  assert.match(chips[0].label, /AND › OR/);
});

test('Representative discovery samples retain mixed types while ignoring empty observations', () => {
  const fields = discoverConditionFields([
    { number: '', mixed: '', generic: '2026-10-26', invalid: 1, bool: null, date: null, tags: [null, 1] },
    { number: 2, mixed: 2, generic: 'other', invalid: Infinity, bool: false, date: '', tags: [2, 'other'] },
    { number: null, mixed: 'other', generic: '2026-10-27', invalid: 3, bool: true, date: '2026-10-26', tags: [] },
  ]);
  const types = Object.fromEntries(fields.map((field) => [field.path, field.type]));
  assert.deepEqual(types, { bool: 'boolean', date: 'date', generic: 'text', invalid: 'text', mixed: 'text', number: 'number', 'tags[]': 'text' });
  assert.deepEqual(fields.find((field) => field.path === 'mixed').values, ['2', 'other']);
  assert.equal(fields.some((field) => 'sampleSignatures' in field), false);
});
