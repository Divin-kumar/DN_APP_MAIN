import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CODE_LIST_SCHEMA_VERSION,
  DEFAULT_CODE_LISTS,
  getActivityPriorityLabel,
  getReminderPresetLabel,
  getCodeListItems,
  collectReferencedCodeListValues,
  getCodeListMeta,
  migrateStoredCodeLists,
  readGuestCodeListSettings,
  resolveCodeListSettings,
  resetCodeListsPreservingReferences,
  writeGuestCodeListSettings,
} from './codeLists.js';

test('default code lists include the required domains', () => {
  assert.ok(DEFAULT_CODE_LISTS.eventTypes.includes('Birthday'));
  assert.ok(DEFAULT_CODE_LISTS.expenseCategories.includes('Food'));
  assert.ok(DEFAULT_CODE_LISTS.incomeTypes.includes('Salary'));
  assert.ok(DEFAULT_CODE_LISTS.activityPriorities.some((item) => item.value === 'high'));
  assert.ok(DEFAULT_CODE_LISTS.reminderPresets.some((item) => item.value === '09:00'));
});

test('first install seeds defaults and records the current code-list schema version', () => {
  const result = migrateStoredCodeLists(null);
  assert.equal(result.version, CODE_LIST_SCHEMA_VERSION);
  assert.deepEqual(getCodeListItems('eventTypes', result.adminValues.eventTypes), DEFAULT_CODE_LISTS.eventTypes);
  assert.deepEqual(getCodeListItems('expenseCategories', result.adminValues.expenseCategories), DEFAULT_CODE_LISTS.expenseCategories);
});

test('legacy migration preserves custom values, edits, metadata, inactive values, and empty lists', () => {
  const result = migrateStoredCodeLists({
    eventTypes: [
      { value: 'Birthday', label: 'My birthday label', active: false, canGenerateGreetingCards: false, greetingTemplate: 'Keep this', customFlag: 'preserve me' },
      { value: 'Custom Moment', label: 'My custom moment' },
    ],
    expenseCategories: [],
    incomeTypes: [{ value: 'Consulting', label: 'Consulting income' }],
  });

  assert.equal(result.version, CODE_LIST_SCHEMA_VERSION);
  assert.deepEqual(result.adminValues.expenseCategories, []);
  assert.deepEqual(getCodeListItems('expenseCategories', result.adminValues.expenseCategories), []);
  assert.deepEqual(result.adminValues.eventTypes[0], {
    value: 'Birthday',
    label: 'My birthday label',
    active: false,
    isActive: false,
    canGenerateGreetingCards: false,
    greetingTemplate: 'Keep this',
    showInDashboardUpcoming: true,
    customFlag: 'preserve me',
  });
  assert.equal(result.adminValues.eventTypes.some((entry) => entry.value === 'Custom Moment'), true);
  assert.equal(result.adminValues.incomeTypes[0].value, 'Consulting');
});

test('versioned migrations append only explicitly added defaults without replacing existing values', () => {
  const migrations = {
    1: { additions: { eventTypes: [{ value: 'Birthday', label: 'Migration must not replace this' }, 'New Moment'] } },
    2: { additions: { expenseCategories: ['New Category'] } },
  };
  const initial = {
    eventTypes: [{ value: 'Birthday', label: 'User edited', canGenerateGreetingCards: false }, 'Custom Moment'],
    expenseCategories: [],
  };
  const migrated = migrateStoredCodeLists(initial, 0, migrations, 2);
  const migratedAgain = migrateStoredCodeLists(migrated.adminValues, migrated.version, migrations, 2);

  assert.equal(migrated.version, 2);
  assert.equal(migrated.adminValues.eventTypes[0].label, 'User edited');
  assert.equal(migrated.adminValues.eventTypes[0].canGenerateGreetingCards, false);
  assert.deepEqual(migrated.adminValues.eventTypes.map((entry) => entry.value), ['Birthday', 'Custom Moment', 'New Moment']);
  assert.deepEqual(migrated.adminValues.expenseCategories.map((entry) => entry.value), ['New Category']);
  assert.deepEqual(migratedAgain.adminValues, migrated.adminValues);
});

test('missing migration steps leave data intact and do not advance the schema version', () => {
  const result = migrateStoredCodeLists({ eventTypes: ['Custom Moment'] }, 0, {}, 2);
  assert.equal(result.version, 0);
  assert.equal(result.adminValues.eventTypes[0].value, 'Custom Moment');
});

test('code list helpers return readable labels', () => {
  assert.equal(getActivityPriorityLabel('medium'), 'Medium priority');
  assert.equal(getReminderPresetLabel('18:00'), 'Evening (6:00 PM)');
});

test('code list items are normalized for editing', () => {
  const items = getCodeListItems('eventTypes', ['Birthday', '  Anniversary  ', '']);
  assert.deepEqual(items, ['Birthday', 'Anniversary']);
});

test('isActive values control selectors while legacy active values stay compatible', () => {
  const items = getCodeListItems('expenseCategories', [
    { value: 'Food', label: 'Food', isActive: true },
    { value: 'Travel', label: 'Travel', isActive: false },
    { value: 'Medical', label: 'Medical', active: false },
  ]);
  assert.deepEqual(items, ['Food']);
  assert.equal(getCodeListMeta('expenseCategories', [
    { value: 'Travel', label: 'Travel', isActive: false },
  ])[0].active, false);
});

test('reset restores defaults and only retains referenced custom values as inactive', () => {
  const reset = resetCodeListsPreservingReferences({
    eventTypes: ['Birthday', 'Custom Event', 'Unused Event'],
  }, {
    eventTypes: ['Custom Event', 'Legacy Event'],
  });

  const entries = getCodeListMeta('eventTypes', reset.eventTypes);
  assert.equal(entries.find((entry) => entry.value === 'Birthday')?.active, true);
  assert.equal(entries.find((entry) => entry.value === 'Birthday')?.isActive, true);
  assert.equal(entries.find((entry) => entry.value === 'Custom Event')?.active, false);
  assert.equal(entries.find((entry) => entry.value === 'Custom Event')?.isActive, false);
  assert.equal(entries.find((entry) => entry.value === 'Legacy Event')?.active, false);
  assert.equal(entries.some((entry) => entry.value === 'Unused Event'), false);
  assert.deepEqual(getCodeListItems('eventTypes', reset.eventTypes).includes('Custom Event'), false);
});

test('record references are collected for configured data domains', () => {
  const references = collectReferencedCodeListValues({
    events: [{
      type: 'Custom Moment',
      customType: 'Legacy Moment',
      activities: [{ priority: 'urgent' }],
    }],
    expenses: [{ category: 'Custom Expense' }],
    incomes: [{ type: 'Custom Income' }],
  });

  assert.deepEqual(references.eventTypes.sort(), ['Custom Moment', 'Legacy Moment']);
  assert.deepEqual(references.activityPriorities, ['urgent']);
  assert.deepEqual(references.expenseCategories, ['Custom Expense']);
  assert.deepEqual(references.incomeTypes, ['Custom Income']);
});

test('moment-type metadata is preserved with legacy entries', () => {
  const meta = getCodeListMeta('eventTypes', [{ value: 'Birthday', label: 'Birthday', canGenerateGreetingCards: false, greetingTemplate: 'Custom', showInDashboardUpcoming: false }]);
  assert.equal(meta[0].canGenerateGreetingCards, false);
  assert.equal(meta[0].showInDashboardUpcoming, false);
  assert.equal(meta[0].greetingTemplate, 'Custom');
});

test('remote Code Lists are authoritative over legacy browser-local values', () => {
  const remote = {
    schemaVersion: CODE_LIST_SCHEMA_VERSION,
    adminValues: {
      ...DEFAULT_CODE_LISTS,
      eventTypes: [{ value: 'Learning', label: 'Learning', active: true }],
      expenseCategories: [],
    },
  };
  const legacy = {
    schemaVersion: CODE_LIST_SCHEMA_VERSION,
    adminValues: { ...DEFAULT_CODE_LISTS, eventTypes: ['Old local value'] },
  };

  const result = resolveCodeListSettings(remote, legacy);

  assert.equal(result.source, 'remote');
  assert.deepEqual(result.adminValues.eventTypes.map((item) => item.value), ['Learning']);
  assert.deepEqual(result.adminValues.expenseCategories, []);
});

test('first authenticated sync migrates legacy browser Code Lists when no remote document exists', () => {
  const legacy = {
    schemaVersion: CODE_LIST_SCHEMA_VERSION,
    adminValues: { ...DEFAULT_CODE_LISTS, eventTypes: ['Birthday', 'Learning'] },
  };

  const result = resolveCodeListSettings(null, legacy);

  assert.equal(result.source, 'legacy');
  assert.deepEqual(result.adminValues.eventTypes.map((item) => item.value), ['Birthday', 'Learning']);
});

test('new accounts receive defaults when neither remote nor legacy Code Lists exist', () => {
  const result = resolveCodeListSettings(null, null);

  assert.equal(result.source, 'defaults');
  assert.deepEqual(result.adminValues.eventTypes.map((item) => item.value), DEFAULT_CODE_LISTS.eventTypes);
  assert.deepEqual(result.adminValues.expenseCategories.map((item) => item.value), DEFAULT_CODE_LISTS.expenseCategories);
});

test('guest Code Lists use their own localStorage keys and retain legacy values on first use', () => {
  const values = new Map([['lifehub_admin_values', JSON.stringify({
    ...DEFAULT_CODE_LISTS,
    expenseCategories: ['Food', 'Investments'],
  })]]);
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  };

  const initial = readGuestCodeListSettings(storage);
  assert.equal(initial.source, 'legacy');
  assert.deepEqual(initial.adminValues.expenseCategories.map((item) => item.value), ['Food', 'Investments']);

  writeGuestCodeListSettings(initial.adminValues, storage);
  const reloaded = readGuestCodeListSettings(storage);
  assert.equal(reloaded.source, 'remote');
  assert.deepEqual(reloaded.adminValues.expenseCategories.map((item) => item.value), ['Food', 'Investments']);
});

test('existing remote empty lists are not repopulated from legacy values or defaults', () => {
  const result = resolveCodeListSettings({
    schemaVersion: CODE_LIST_SCHEMA_VERSION,
    adminValues: Object.fromEntries(Object.keys(DEFAULT_CODE_LISTS).map((key) => [key, []])),
  }, {
    schemaVersion: CODE_LIST_SCHEMA_VERSION,
    adminValues: DEFAULT_CODE_LISTS,
  });

  assert.equal(result.source, 'remote');
  Object.values(result.adminValues).forEach((values) => assert.deepEqual(values, []));
});
