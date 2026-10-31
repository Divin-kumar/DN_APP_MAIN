import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyGroup } from './conditionEngine.js';
import { listStateKey, listStateMemory } from './listStateMemory.js';
import {
  LIST_DOMAINS, LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES,
  systemConditionGroup, configuredConditionGroup, matchesListDefaults,
  resetSavedListDefaultsForScope, exportSavedListDefaultsForScope,
  restoreSavedListDefaultsForScope, validateSavedListDefaultsDocument,
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

test('backup round-trip copies saved defaults, not active page filters, across scopes', () => {
  const source = 'test:backup-source';
  const destination = 'test:backup-destination';
  const config = LIST_DOMAINS.activities;
  const liveKey = listStateKey(source, 'activities');
  listStateMemory.update(liveKey, config.defaults, config.rules, { search: 'do-not-backup', direction: 'desc' });
  listStateMemory.update(listStateKey(source, 'defaults:activities'), config.defaults, config.rules, {
    field: 'priority', direction: 'desc', search: 'my-saved-default',
  });
  listStateMemory.update(listStateKey(source, 'conditions:defaults:activities'),
    LIST_CONDITION_DEFAULTS, LIST_CONDITION_RULES, { group: priorityHigh, migrationVersion: 1 });
  const portable = exportSavedListDefaultsForScope(source);
  assert.deepEqual(validateSavedListDefaultsDocument(portable), portable);
  assert.equal(portable.activities.filters.search, 'my-saved-default');
  assert.equal(portable.activities.filters.field, 'priority');
  assert.equal(portable.activities.group.children[0].value, 'high');
  assert.notEqual(portable.activities.filters.search, listStateMemory.read(liveKey, config.defaults, config.rules).search);

  const destinationLive = listStateKey(destination, 'activities');
  listStateMemory.update(destinationLive, config.defaults, config.rules, { search: 'keep-working' });
  assert.equal(restoreSavedListDefaultsForScope(destination, JSON.parse(JSON.stringify(portable))), true);
  assert.deepEqual(exportSavedListDefaultsForScope(destination), portable);
  assert.equal(listStateMemory.read(destinationLive, config.defaults, config.rules).search, 'keep-working');
});

test('older v3 backups without the optional saved defaults preserve current Settings', () => {
  const scope = 'test:backup-legacy';
  const config = LIST_DOMAINS.moments;
  listStateMemory.update(listStateKey(scope, 'defaults:moments'), config.defaults, config.rules,
    { field: 'name', direction: 'desc' });
  const before = exportSavedListDefaultsForScope(scope);
  assert.equal(restoreSavedListDefaultsForScope(scope, undefined), false);
  assert.deepEqual(exportSavedListDefaultsForScope(scope), before);
});

test('reject malformed saved defaults before any destination preference can change', () => {
  const scope = 'test:backup-malformed';
  const original = exportSavedListDefaultsForScope(scope);
  const invalidSort = structuredClone(original);
  invalidSort.transactions.filters.sort = 'not-a-valid-sort';
  assert.throws(() => restoreSavedListDefaultsForScope(scope, invalidSort), /invalid value/);
  const invalidRule = structuredClone(original);
  invalidRule.activities.group.children.push({
    id: 'bad', kind: 'rule', field: 'constructor', operator: 'eq', value: 'wrong',
  });
  assert.throws(() => restoreSavedListDefaultsForScope(scope, invalidRule), /invalid rules/);
  const missing = structuredClone(original);
  delete missing.moments;
  assert.throws(() => restoreSavedListDefaultsForScope(scope, missing), /incomplete or invalid/);
  assert.deepEqual(exportSavedListDefaultsForScope(scope), original);
});

test('a saved-default backup is not exported or restored without a workspace scope', () => {
  assert.equal(exportSavedListDefaultsForScope('signed-out'), null);
  assert.equal(restoreSavedListDefaultsForScope('signed-out', {}), false);
});
