import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFilterRule, filterEditorOperators } from './conditionEditor.js';
import { compileConditionGroup, normalizeConditionGroup } from './conditionEngine.js';

test('new comparison menus contain only the short product choices', () => {
  const labels = (type) => filterEditorOperators({ type }).map(([, label]) => label);
  assert.deepEqual(labels('text'), ['Contains', 'Is', 'Is not']);
  assert.deepEqual(labels('dropdown'), ['Is', 'Is not']);
  assert.deepEqual(labels('number'), ['Equals', 'More than', 'Less than', 'Between']);
  assert.deepEqual(labels('date'), ['On', 'Before', 'After', 'Custom range', 'Today', 'This week', 'This month']);
  for (const type of ['text', 'dropdown', 'number', 'date']) {
    assert.equal(filterEditorOperators({ type }).some(([operator]) => ['empty', 'not_empty', 'any_of', 'none_of'].includes(operator)), false);
  }
});

test('existing comparisons remain identifiable without adding all legacy options', () => {
  assert.deepEqual(filterEditorOperators({ type: 'number' }, 'gte').at(-1), ['gte', 'At least (previous filter)']);
  assert.deepEqual(filterEditorOperators({ type: 'dropdown' }, 'any_of'), [['eq', 'Is'], ['ne', 'Is not'], ['any_of', 'Any of (previous filter)']]);
  assert.deepEqual(filterEditorOperators({ type: 'dropdown', legacyTextComparisons: true }, 'contains').at(-1), ['contains', 'Contains (previous filter)']);
  assert.deepEqual(filterEditorOperators({ type: 'date' }, 'empty').at(-1), ['empty', 'Is empty (previous filter)']);
  assert.equal(filterEditorOperators({ type: 'date' }, 'unknown').some(([operator]) => operator === 'unknown'), false);
});

test('new filters form a flat conjunction and adding to a previous OR preserves its meaning', () => {
  const rule = (id, field, operator, value) => ({ id, kind: 'rule', field, operator, value });
  const first = rule('first', 'name', 'contains', 'trip');
  const second = rule('second', 'amount', 'gt', 20);
  const flat = appendFilterRule({ id: 'root', kind: 'group', join: 'AND', children: [first] }, second);
  assert.deepEqual(flat.children, [first, second]);
  const previous = { id: 'root', kind: 'group', join: 'OR', children: [first, rule('third', 'name', 'eq', 'Party')] };
  const next = normalizeConditionGroup(appendFilterRule(previous, second));
  assert.equal(next.join, 'AND');
  assert.equal(next.children[0].join, 'OR');
  assert.equal(previous.join, 'OR', 'existing UI state is not mutated');
  const matches = compileConditionGroup(next, [{ path: 'name', type: 'text' }, { path: 'amount', type: 'number' }]);
  assert.equal(matches({ name: 'Trip plan', amount: 30 }), true);
  assert.equal(matches({ name: 'Party', amount: 30 }), true);
  assert.equal(matches({ name: 'Party', amount: 10 }), false);
  assert.equal(matches({ name: 'Other', amount: 30 }), false);
});
