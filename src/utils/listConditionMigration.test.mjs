import test from 'node:test';
import assert from 'node:assert/strict';
import { activityConditions, activityEntryConditionRecord, momentConditions, momentConditionRecord, transactionConditions } from './listConditionMigration.js';
import { discoverConditionFields, matchesConditionGroup } from './conditionEngine.js';

test('legacy Moment category and archive choices become removable conditions', () => {
  const records = [{ id: 'a', type: 'Travel' }, { id: 'b', type: 'Food' }, { id: 'c', type: 'Travel', archived: true }].map(momentConditionRecord);
  const schema = discoverConditionFields(records);
  assert.deepEqual(records.filter((item) => matchesConditionGroup(item, momentConditions({ category: 'Travel' }), schema)).map((item) => item.id), ['a']);
  assert.deepEqual(records.filter((item) => matchesConditionGroup(item, momentConditions({ category: 'Archived' }), schema)).map((item) => item.id), ['c']);
});

test('Activity migration preserves parent, custom type and normalized legacy completion', () => {
  const record = activityEntryConditionRecord({ archived: false, momentId: 'm', momentType: 'Family', activity: { status: 'completed' } });
  assert.equal(record.activity.completed, true);
  assert.equal(matchesConditionGroup(record, activityConditions({ momentId: 'm', momentType: 'Family', filter: 'completed', parentScope: 'active' }), discoverConditionFields([record])), true);
  assert.equal(matchesConditionGroup(record, activityConditions({ momentId: 'missing' }), discoverConditionFields([record])), false);
});

test('legacy transaction month and type migrate together with inclusive local-calendar month bounds', () => {
  const group = transactionConditions({ type: 'expense', month: '2024-02' });
  assert.deepEqual(group.children.find((item) => item.field === 'date').value, ['2024-02-01', '2024-02-29']);
  const records = [{ date: '2024-02-29', transactionKind: 'income', amount: 100 },
    { date: '2024-03-01', transactionKind: 'expense', amount: 10 },
    { date: '2024-02-29', transactionKind: 'expense', amount: 40 }];
  const schema = discoverConditionFields(records);
  assert.equal(matchesConditionGroup(records[0], group, schema), false);
  assert.equal(matchesConditionGroup(records[1], group, schema), false);
  assert.equal(matchesConditionGroup(records[2], group, schema), true);
});
