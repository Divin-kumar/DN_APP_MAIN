import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyGroup } from './conditionEngine.js';
import { listStateKey, listStateMemory } from './listStateMemory.js';
import {
  LIST_DOMAINS, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES,
  systemConditionGroup, configuredConditionGroup, matchesListDefaults,
  resetSavedListDefaultsForScope,
} from './listViewDefaults.js';

const priorityHigh = {
  id: 'root', kind: 'group', join: 'AND',
  children: [{ id: 'high', kind: 'rule', field: 'activity.priority', operator: 'eq', value: 'high' }],
};

test('first-use defaults preserve each domain original eligibility rules', () => {
  assert.deepEqual(configuredConditionGroup('moments', LIST_CONDITION_DEFAULTS), systemConditionGroup('moments'));
  assert.deepEqual(configuredConditionGroup('activities', LIST_CONDITION_DEFAULTS), systemConditionGroup('activities'));
  assert.deepEqual(configuredConditionGroup('transactions', LIST_CONDITION_DEFAULTS), systemConditionGroup('transactions'));
});

test('saved condition defaults are not copied from a working list and IDs are not significant', () => {
  const configured = configuredConditionGroup('activities', { migrationVersion: 1, group: priorityHigh });
  const working = { ...priorityHigh, children: [{ ...priorityHigh.children[0], id: 'different-id' }] };
  const defaults = LIST_DOMAINS.activities.defaults;
  assert.equal(matchesListDefaults({ ...defaults }, defaults, working, configured), true);
  assert.equal(matchesListDefaults({ ...defaults, search: 'weekend' }, defaults, working, configured), false);
  assert.equal(matchesListDefaults(defaults, defaults, emptyGroup(), configured), false);
});

test('Reset all settings returns saved baselines to the built-ins without erasing current page choices', () => {
  const scope = 'test:defaults-reset-fixture';
  const liveKey = listStateKey(scope, 'activities');
  const settingsKey = listStateKey(scope, 'defaults:activities');
  const conditionsKey = listStateKey(scope, 'conditions:defaults:activities');
  const config = LIST_DOMAINS.activities;
  listStateMemory.update(liveKey, config.defaults, config.rules, { field: 'priority', direction: 'desc', search: 'keep-me' });
  listStateMemory.update(settingsKey, config.defaults, config.rules, { field: 'title', direction: 'desc' });
  listStateMemory.update(conditionsKey, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES, { group: priorityHigh, migrationVersion: 1 });
  assert.equal(listStateMemory.read(settingsKey, config.defaults, config.rules).field, 'title');
  resetSavedListDefaultsForScope(scope);
  assert.deepEqual(listStateMemory.read(settingsKey, config.defaults, config.rules), config.defaults);
  assert.deepEqual(configuredConditionGroup('activities',
    listStateMemory.read(conditionsKey, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES)), systemConditionGroup('activities'));
  assert.equal(listStateMemory.read(liveKey, config.defaults, config.rules).search, 'keep-me');
  assert.equal(listStateMemory.read(liveKey, config.defaults, config.rules).direction, 'desc');
});

test('saved list preferences are isolated by account/Guest scope', () => {
  const a = listStateKey('guest', 'defaults:moments');
  const b = listStateKey('account:test-user', 'defaults:moments');
  assert.notEqual(a, b);
  assert.notEqual(listStateKey('guest', 'moments'), a);
  assert.notEqual(listStateKey('guest', 'conditions:moments'), listStateKey('guest', 'conditions:defaults:moments'));
});
