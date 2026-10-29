import test from 'node:test';
import assert from 'node:assert/strict';
import { collectReferencedCodeListValues, DEFAULT_CODE_LISTS, getCodeListItems, getCodeListMeta, migrateStoredCodeLists, resetCodeListsPreservingReferences } from './codeLists.js';
import { getUserFilterFields } from './userFilterSchema.js';
import { testCondition } from './conditionEngine.js';
import { filterEditorOperators } from './conditionEditor.js';
import { createBackupDocument, parseBackupDocument, validateBackupDocument } from '../services/backupService.js';

test('payment list upgrade seeds only a missing list and never repopulates an empty or edited list', () => {
  assert.deepEqual(DEFAULT_CODE_LISTS.paymentMethods, ['Cash', 'Online']);
  const old = { eventTypes: ['My type'], expenseCategories: [], incomeTypes: ['Consulting'] };
  const seeded = migrateStoredCodeLists(old, 1);
  assert.deepEqual(getCodeListItems('paymentMethods', seeded.adminValues.paymentMethods), ['Cash', 'Online']);
  assert.deepEqual(seeded.adminValues.expenseCategories, []);
  assert.deepEqual(old, { eventTypes: ['My type'], expenseCategories: [], incomeTypes: ['Consulting'] });
  for (const entries of [[], ['UPI'], [{ value: 'Cash', label: 'Retired cash', active: false }]]) {
    const upgraded = migrateStoredCodeLists({ ...old, paymentMethods: entries }, 1);
    assert.deepEqual(upgraded.adminValues.paymentMethods, getCodeListMeta('paymentMethods', entries));
    assert.deepEqual(migrateStoredCodeLists(upgraded.adminValues, upgraded.version), upgraded);
  }
});

test('payment method reset retains referenced custom values inactive across both ledgers and nested history', () => {
  const references = collectReferencedCodeListValues({ incomes: [{ paymentMethod: 'UPI' }],
    expenses: [{ paymentMethod: 'Cheque' }], events: [{ activities: [{ expenses: [{ paymentMethod: 'Bank transfer' }] }] }] });
  assert.deepEqual(references.paymentMethods, ['Cheque', 'UPI', 'Bank transfer']);
  const result = resetCodeListsPreservingReferences({ paymentMethods: ['UPI', 'Unused'] }, references);
  assert.deepEqual(getCodeListItems('paymentMethods', result.paymentMethods), ['Cash', 'Online']);
  for (const name of references.paymentMethods) assert.equal(result.paymentMethods.find((entry) => entry.value === name).active, false);
  assert.equal(result.paymentMethods.some((entry) => entry.value === 'Unused'), false);
});

test('scoped configured choices join historical values across every editable filter domain', () => {
  const settings = { eventTypes: ['Learning'], incomeTypes: ['Consulting'], expenseCategories: ['Supplies'],
    activityPriorities: [{ value: 'urgent', label: 'Urgent' }], paymentMethods: ['UPI', { value: 'Cheque', active: false }] };
  const records = [{ transactionKind: 'income', type: 'Old income', paymentMethod: 'Cheque' },
    { transactionKind: 'expense', category: 'Old category', paymentMethod: 'Retired method' }];
  const rule = (field, value, operator = 'eq') => ({ kind: 'rule', id: 'rule', field, value, operator });
  for (const scope of ['transactions', 'moment-transactions:a:all']) {
    const fields = getUserFilterFields(scope, records, [], settings);
    assert.deepEqual(fields.find((field) => field.path === 'category').values, ['Consulting', 'Old category', 'Old income', 'Supplies']);
    assert.deepEqual(fields.find((field) => field.path === 'paymentMethod').values, ['Cheque', 'Retired method', 'UPI']);
    assert.equal(testCondition(records[0], rule('paymentMethod', 'Cheque'), fields), true);
    assert.equal(testCondition({}, rule('paymentMethod', '', 'empty'), fields), true);
  }
  const emptyMethods = getUserFilterFields('transactions', [], [], { ...settings, paymentMethods: [] });
  assert.deepEqual(emptyMethods.find((field) => field.path === 'paymentMethod').values, []);
  assert.deepEqual(getUserFilterFields('moments', [], [], settings).find((field) => field.path === 'type').values, ['Learning']);
  for (const scope of ['activities', 'moment-activities:a']) {
    const priority = getUserFilterFields(scope, [], [], settings).find((field) => field.label === 'Priority');
    assert.deepEqual(priority.options, [{ value: 'urgent', label: 'Urgent' }]);
  }
  assert.equal(getUserFilterFields('activities', [], [], settings).find((field) => field.label === 'Moment type').values[0], 'Learning');
});

test('payment method offers missing-value comparisons without a synthetic saved method', () => {
  assert.deepEqual(filterEditorOperators({ type: 'dropdown', allowEmpty: true }),
    [['eq', 'Is'], ['ne', 'Is not'], ['empty', 'Not specified'], ['not_empty', 'Specified']]);
});

test('v3 backups retain custom payment choices and methods while older v3 without the list still validates', () => {
  const backup = createBackupDocument({ moments: [], incomes: [{ id: 'income', amount: 100, paymentMethod: 'Bank transfer' }],
    expenses: [{ id: 'expense', amount: 50, paymentMethod: 'UPI' }],
    codeLists: { ...DEFAULT_CODE_LISTS, paymentMethods: [{ value: 'UPI', label: 'UPI', active: false }] } });
  const restored = parseBackupDocument(JSON.parse(JSON.stringify(backup)));
  assert.equal(restored.backupVersion, 3);
  assert.deepEqual(restored.codeLists.paymentMethods, backup.codeLists.paymentMethods);
  assert.equal(restored.expenses[0].paymentMethod, 'UPI');
  assert.equal(restored.incomes[0].paymentMethod, 'Bank transfer');
  delete restored.codeLists.paymentMethods;
  assert.doesNotThrow(() => validateBackupDocument(restored));
  restored.codeLists.paymentMethods = 'UPI';
  assert.throws(() => validateBackupDocument(restored), /paymentMethods/);
  restored.codeLists.paymentMethods = [{}];
  assert.throws(() => validateBackupDocument(restored), /invalid entry/);
});
