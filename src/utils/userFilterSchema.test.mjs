import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserFilterFields, normalizeUserFilterGroup } from './userFilterSchema.js';
import { conditionChipEntries, matchesConditionGroup, operatorsFor, operatorsForField, testCondition } from './conditionEngine.js';
import { projectActivities } from './activityRecords.js';

const moments = () => [
  { id: 'private-moment-a', name: 'Family trip', type: 'Other', customType: 'Road trip', date: '2026-10-20',
    metadata: { rawTable: { privateKey: 'internal value' } }, firestoreId: 'provider-document-a',
    activities: [{ id: 'shared-private-child', title: 'Book the train', priority: 'high', date: '2026-10-19' }] },
  { id: 'private-moment-b', name: 'Birthday', type: 'Birthday', date: '2026-10-22', archived: true,
    activities: [{ id: 'shared-private-child', title: 'Buy the cake', completed: true, date: '2026-10-21' }] },
  { id: 'private-moment-c', name: 'Other plans', type: 'Other', activities: [] },
];
const transactions = () => [
  { id: 'private-expense-a', eventId: 'private-moment-a', activityId: 'shared-private-child', name: 'Train tickets',
    transactionKind: 'expense', category: 'Travel', amount: 100, date: '2026-10-19', metadata: { rawTable: { secret: 'hidden' } } },
  { id: 'private-expense-b', eventId: 'private-moment-b', activityId: 'shared-private-child', name: 'Cake',
    transactionKind: 'expense', category: 'Food', amount: 50, date: '2026-10-21' },
  { id: 'private-income', eventId: 'private-moment-a', name: 'Trip fund', transactionKind: 'income',
    type: 'Salary', category: 'Obsolete imported category', amount: 500, date: '2026-10-18' },
];
const rule = (field, value, operator = 'eq') => ({ id: 'chosen-filter', kind: 'rule', field, operator, value });
const chips = (schema, ...rules) => conditionChipEntries({ id: 'root', kind: 'group', join: 'AND', children: rules }, schema)
  .map((chip) => chip.label);

test('all five user-facing lists offer only their product filter catalogue, even when records contain extra fields', () => {
  const parents = moments();
  const cases = [
    ['moments', parents, ['Moment name', 'Moment type', 'Event date', 'Status', 'Visibility']],
    ['activities', projectActivities(parents), ['Activity name', 'Date', 'Time', 'Status', 'Priority', 'Moment', 'Moment type', 'Moment visibility']],
    ['moment-activities:private-moment-a', parents[0].activities, ['Activity name', 'Date', 'Time', 'Status', 'Priority']],
    ['transactions', transactions(), ['Title', 'Type', 'Category', 'Payment method', 'Amount', 'Date', 'Moment', 'Activity']],
    ['moment-transactions:private-moment-a:all', transactions(), ['Title', 'Type', 'Category', 'Payment method', 'Amount', 'Date', 'Activity']],
  ];
  for (const [scope, records, expected] of cases) {
    const schema = getUserFilterFields(scope, records, parents);
    assert.deepEqual(schema.map((field) => field.label), expected, scope);
    assert.equal(schema.some((field) => /metadata|rawTable|firestore|createdAt/.test(field.path)), false, scope);
    assert.equal(schema.some((field) => /\bid\b|\[\]| · /i.test(field.label)), false, scope);
    assert.deepEqual(getUserFilterFields(scope).map((field) => field.label), expected, `${scope} is useful before records load`);
  }
  assert.equal(getUserFilterFields('unrecognized-list'), null);
});

test('linked Moment and Activity choices and chips show names while keeping stable identities internally', () => {
  const parents = moments();
  const records = transactions();
  const before = structuredClone({ parents, records });
  const schema = getUserFilterFields('transactions', records, parents);
  const parent = schema.find((field) => field.path === 'eventId');
  const activity = schema.find((field) => field.path === 'activityId');
  assert.deepEqual(parent.options, [
    { value: 'private-moment-b', label: 'Birthday' }, { value: 'private-moment-a', label: 'Family trip' },
  ]);
  assert.deepEqual(activity.options, [
    { value: '["private-moment-a","shared-private-child"]', label: 'Book the train' },
    { value: '["private-moment-b","shared-private-child"]', label: 'Buy the cake' },
  ]);
  assert.deepEqual(chips(schema, rule('eventId', 'private-moment-a'),
    rule('activityId', '["private-moment-b","shared-private-child"]')), ['Moment Is Family trip', 'Activity Is Buy the cake']);
  const activitySchema = getUserFilterFields('activities', projectActivities(parents), parents);
  assert.deepEqual(chips(activitySchema, rule('momentId', 'private-moment-a')), ['Moment Is Family trip']);
  assert.deepEqual({ parents, records }, before, 'building choices and descriptions does not rewrite records');
});

test('missing links and unavailable saved fields remain readable without exposing stored IDs or metadata paths', () => {
  const records = [...transactions(), { id: 'private-orphan', transactionKind: 'expense', eventId: 'private-deleted-moment',
    activityId: 'private-deleted-child', name: 'Old expense', amount: 5 }];
  const schema = getUserFilterFields('transactions', records, moments());
  assert.equal(schema.find((field) => field.path === 'eventId').options
    .find((option) => option.value === 'private-deleted-moment').label, 'Unavailable Moment');
  assert.equal(schema.find((field) => field.path === 'activityId').options
    .find((option) => option.value === '["private-deleted-moment","private-deleted-child"]').label, 'Unavailable Activity');
  const labels = chips(schema, rule('eventId', 'private-no-longer-listed'),
    rule('activityId', '["private-absent-parent","private-absent-child"]'), rule('metadata.rawTable.secret', 'private-secret-value'));
  assert.deepEqual(labels, ['Moment Is Unavailable Moment', 'Activity Is Unavailable Activity', 'Unavailable filter']);
  assert.doesNotMatch(labels.join(' '), /private-|metadata|rawTable/);
});

test('income Category reads the existing income type while transaction Type keeps Income and Expense canonical', () => {
  const records = transactions();
  const schema = getUserFilterFields('transactions', records, moments());
  assert.deepEqual(schema.find((field) => field.path === 'transactionKind').options,
    [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]);
  assert.deepEqual(schema.find((field) => field.path === 'category').values, ['Food', 'Salary', 'Travel']);
  assert.deepEqual(records.filter((record) => testCondition(record, rule('category', 'Salary'), schema)).map((record) => record.id), ['private-income']);
  assert.equal(testCondition(records[2], rule('category', 'Obsolete imported category'), schema), false);
  assert.deepEqual(records.filter((record) => testCondition(record, rule('transactionKind', 'expense'), schema)).map((record) => record.id), ['private-expense-a', 'private-expense-b']);
  assert.deepEqual(chips(schema, rule('transactionKind', 'income'), rule('category', 'Salary')), ['Type Is Income', 'Category Is Salary']);
  assert.equal(records[2].transactionKind, 'income');
  assert.equal(records[2].type, 'Salary');
});

test('effective custom Other types can be chosen by name while saved generic Other filters keep their previous coverage', () => {
  const parents = moments();
  const schema = getUserFilterFields('moments', parents);
  const type = schema.find((field) => field.path === 'type');
  assert.deepEqual(type.options, [{ value: 'Birthday', label: 'Birthday' }, { value: 'Other', label: 'Other' },
    { value: 'Road trip', label: 'Road trip' }]);
  assert.deepEqual(parents.filter((parent) => testCondition(parent, rule('type', 'Road trip'), schema)).map((parent) => parent.name), ['Family trip']);
  assert.deepEqual(parents.filter((parent) => testCondition(parent, rule('type', 'Other'), schema)).map((parent) => parent.name), ['Family trip', 'Other plans']);
  assert.deepEqual(parents.filter((parent) => testCondition(parent, rule('type', ['Other', 'Birthday'], 'any_of'), schema)).map((parent) => parent.name), ['Family trip', 'Birthday', 'Other plans']);
  assert.deepEqual(chips(schema, rule('type', 'Road trip')), ['Moment type Is Road trip']);
});

test('new linked Activity choices distinguish reused child IDs by both parents while old saved child-ID rules retain their coverage', () => {
  const records = transactions();
  const schema = getUserFilterFields('transactions', records, moments());
  const namedChoice = schema.find((field) => field.path === 'activityId').options.find((option) => option.label === 'Buy the cake');
  assert.equal(namedChoice.value, '["private-moment-b","shared-private-child"]');
  assert.deepEqual(records.filter((record) => testCondition(record, rule('activityId', namedChoice.value), schema)).map((record) => record.name), ['Cake']);
  assert.deepEqual(records.filter((record) => testCondition(record, rule('activityId', [namedChoice.value], 'any_of'), schema)).map((record) => record.name), ['Cake']);
  assert.deepEqual(records.filter((record) => testCondition(record, rule('activityId', 'shared-private-child'), schema)).map((record) => record.name), ['Train tickets', 'Cake']);
  assert.deepEqual(chips(schema, rule('activityId', 'shared-private-child')), ['Activity Is Book the train']);
});

test('status, priority and visibility choices use familiar labels with the existing stored values', () => {
  const parents = moments();
  const activities = projectActivities(parents);
  const schema = getUserFilterFields('activities', activities, parents);
  assert.deepEqual(schema.find((field) => field.path === 'activity.status').options,
    [{ value: 'completed', label: 'Completed' }, { value: 'in-progress', label: 'In progress' }]);
  assert.deepEqual(schema.find((field) => field.path === 'activity.priority').options,
    [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }]);
  assert.deepEqual(schema.find((field) => field.path === 'archived').options,
    [{ value: 'false', label: 'Active' }, { value: 'true', label: 'Archived' }]);
  assert.deepEqual(chips(schema, rule('activity.status', 'in-progress'), rule('activity.priority', 'high'), rule('archived', 'false')),
    ['Status Is In progress', 'Priority Is High', 'Moment visibility Is Active']);
  assert.deepEqual(activities.filter((activity) => testCondition(activity, rule('archived', 'true'), schema)).map((activity) => activity.momentName), ['Birthday']);
});

test('saved boolean archive rules become friendly visibility choices without changing group identities, logic or input', () => {
  const original = { id: 'existing-root', kind: 'group', join: 'OR', children: [
    { id: 'archived-branch', kind: 'group', join: 'AND', children: [
      { id: 'archived-rule', kind: 'rule', field: 'archived', operator: 'is_true', value: '' },
      { id: 'birthday-rule', kind: 'rule', field: 'name', operator: 'contains', value: 'Birthday' },
    ] },
    { id: 'active-branch', kind: 'group', join: 'AND', children: [
      { id: 'active-rule', kind: 'rule', field: 'archived', operator: 'is_false', value: '' },
      { id: 'trip-rule', kind: 'rule', field: 'name', operator: 'contains', value: 'Family' },
    ] },
  ] };
  const snapshot = structuredClone(original);
  const normalized = normalizeUserFilterGroup('moments', original);
  const expected = structuredClone(original);
  Object.assign(expected.children[0].children[0], { operator: 'eq', value: 'true' });
  Object.assign(expected.children[1].children[0], { operator: 'eq', value: 'false' });
  assert.deepEqual(normalized, expected);
  assert.deepEqual(original, snapshot);
  assert.equal(normalizeUserFilterGroup('moments', normalized), normalized, 'repeated rendering requires no further adaptation');
  const parents = moments();
  const schema = getUserFilterFields('moments', parents);
  assert.deepEqual(parents.filter((parent) => matchesConditionGroup(parent, normalized, schema)).map((parent) => parent.name), ['Family trip', 'Birthday']);
  assert.deepEqual(conditionChipEntries(normalized, schema).map((chip) => chip.label), [
    'OR › AND · Visibility Is Archived', 'OR › AND · Moment name Contains Birthday',
    'OR › AND · Visibility Is Active', 'OR › AND · Moment name Contains Family',
  ]);
});

test('legacy Activity parent-visibility booleans preserve their match and display after normalization', () => {
  const records = projectActivities(moments());
  const schema = getUserFilterFields('activities', records);
  for (const [operator, value, label, expected] of [
    ['is_true', 'true', 'Archived', ['Birthday']], ['is_false', 'false', 'Active', ['Family trip']],
  ]) {
    const group = { id: 'remembered-root', kind: 'group', join: 'AND', children: [rule('archived', '', operator)] };
    const normalized = normalizeUserFilterGroup('activities', group);
    assert.equal(normalized.children[0].id, 'chosen-filter');
    assert.equal(normalized.children[0].operator, 'eq');
    assert.equal(normalized.children[0].value, value);
    assert.deepEqual(records.filter((record) => matchesConditionGroup(record, normalized, schema)).map((record) => record.momentName), expected);
    assert.deepEqual(conditionChipEntries(normalized, schema).map((chip) => chip.label), [`Moment visibility Is ${label}`]);
  }
});

test('archive compatibility does not change generic boolean fields, other lists or existing visibility comparisons', () => {
  const group = { id: 'root', kind: 'group', join: 'AND', children: [
    rule('activity.completed', '', 'is_true'), rule('archived', 'false'),
  ] };
  assert.equal(normalizeUserFilterGroup('moments', group), group);
  const legacy = { id: 'root', kind: 'group', join: 'AND', children: [rule('archived', '', 'is_false')] };
  for (const scope of ['transactions', 'moment-transactions:a:all', 'moment-activities:a', 'generic-list']) {
    assert.equal(normalizeUserFilterGroup(scope, legacy), legacy, scope);
  }
});

test('saved string comparisons keep their canonical matching and readable comparison without expanding new dropdown menus', () => {
  const parents = moments();
  const records = projectActivities(parents);
  const schema = getUserFilterFields('activities', records, parents);
  const status = schema.find((field) => field.path === 'activity.status');
  for (const [operator, value, expected] of [
    ['contains', 'progress', ['Family trip']], ['not_contains', 'progress', ['Birthday']],
    ['starts', 'in-', ['Family trip']], ['ends', 'pleted', ['Birthday']],
  ]) {
    assert.deepEqual(records.filter((record) => testCondition(record, rule('activity.status', value, operator), schema)).map((record) => record.momentName), expected);
  }
  assert.deepEqual(operatorsForField(status), operatorsFor('dropdown'), 'new choices stay concise');
  assert.deepEqual(operatorsForField(status, 'contains').at(-1), ['contains', 'Contains']);
  assert.deepEqual(chips(schema, rule('activity.status', 'progress', 'contains')), ['Status Contains progress']);
  assert.equal(testCondition(records[0], rule('archived', 'false', 'contains'), schema), false, 'boolean visibility does not gain text comparisons');
  assert.equal(testCondition({ status: 'in-progress' }, rule('status', 'progress', 'contains'), [{ path: 'status', type: 'dropdown' }]), false, 'generic dropdown semantics stay unchanged');

  const momentSchema = getUserFilterFields('moments', parents);
  assert.deepEqual(parents.filter((parent) => testCondition(parent, rule('type', 'Other', 'contains'), momentSchema)).map((parent) => parent.name), ['Family trip', 'Other plans']);
  const financeSchema = getUserFilterFields('transactions', transactions(), parents);
  assert.deepEqual(transactions().filter((record) => testCondition(record, rule('category', 'Trav', 'starts'), financeSchema)).map((record) => record.name), ['Train tickets']);
  assert.deepEqual(chips(financeSchema, rule('eventId', 'private-moment-a', 'contains')), ['Moment Contains Family trip']);
  assert.equal(financeSchema.find((field) => field.path === 'eventId').hideRawValues, true);
});

test('adding a composite Activity choice to an old multi-selection preserves both selected cohorts', () => {
  const parents = [...moments(), { id: 'private-moment-d', name: 'Work plan', activities: [{ id: 'different-child', title: 'Prepare slides' }] }];
  const records = [...transactions(), { id: 'private-expense-d', eventId: 'private-moment-d', activityId: 'different-child', name: 'Work supplies', transactionKind: 'expense' }];
  const schema = getUserFilterFields('transactions', records, parents);
  const values = ['shared-private-child', '["private-moment-d","different-child"]'];
  assert.deepEqual(records.filter((record) => testCondition(record, rule('activityId', values, 'any_of'), schema)).map((record) => record.name), ['Train tickets', 'Cake', 'Work supplies']);
  assert.deepEqual(records.filter((record) => testCondition(record, rule('activityId', values, 'none_of'), schema)).map((record) => record.name), []);
  assert.deepEqual(chips(schema, rule('activityId', values, 'any_of')), ['Activity Any of Book the train, Prepare slides']);
});

test('scoped linked labels prefer known names and retain first legacy child-name fallback', () => {
  const records = [
    { eventId: 'private-parent-a', activityId: 'private-child', eventTitle: 'First Moment fallback', activityTitle: 'First Activity fallback' },
    { eventId: 'private-parent-a', activityId: 'private-child', eventTitle: 'Later Moment fallback', activityTitle: 'Later Activity fallback' },
    { eventId: 'private-parent-b', activityId: 'private-child', eventTitle: 'Another Moment', activityTitle: 'Another Activity' },
  ];
  const schema = getUserFilterFields('transactions', records);
  assert.deepEqual(schema.find((field) => field.path === 'eventId').options, [
    { value: 'private-parent-b', label: 'Another Moment' }, { value: 'private-parent-a', label: 'First Moment fallback' },
  ]);
  assert.deepEqual(chips(schema, rule('activityId', 'private-child')), ['Activity Is First Activity fallback']);
  assert.deepEqual(chips(schema, rule('activityId', '["private-parent-b","private-child"]')), ['Activity Is Another Activity']);
});
