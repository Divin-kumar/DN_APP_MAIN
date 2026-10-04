import test from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATION_STATE } from './migrationConstants.js';
import {
  assertMigrationTransition,
  canTransitionMigration,
  transitionMigrationRun,
} from './migrationStateMachine.js';
import { deterministicMigrationId } from './migrationIdentity.js';
import { detectMigrationDuplicates } from './migrationDeduplication.js';
import { buildMigrationDatasets } from './migrationDatasetBuilder.js';
import { validateMigrationDatasets } from './migrationValidator.js';

const principalId = 'user-test-1';

 test('state machine permits the approved path and rejects illegal transitions', () => {
  assert.equal(canTransitionMigration(MIGRATION_STATE.NOT_STARTED, MIGRATION_STATE.CHECKING_SOURCE), true);
  assert.equal(canTransitionMigration(MIGRATION_STATE.COMPLETED, MIGRATION_STATE.ROLLED_BACK), true);
  assert.equal(canTransitionMigration(MIGRATION_STATE.COMPLETED, MIGRATION_STATE.FAILED), false);
  assert.throws(() => assertMigrationTransition(MIGRATION_STATE.NOT_STARTED, MIGRATION_STATE.COMPLETED), /Invalid migration state transition/);

  const next = transitionMigrationRun({ id: 'run-1', state: MIGRATION_STATE.NOT_STARTED }, MIGRATION_STATE.CHECKING_SOURCE, { cause: 'test' }, '2026-10-04T00:00:00.000Z');
  assert.equal(next.state, MIGRATION_STATE.CHECKING_SOURCE);
  assert.equal(next.stateHistory.length, 1);
});

test('deterministic migration IDs remain stable for the same source identity', () => {
  const first = deterministicMigrationId('expense', 'users/u/expenses/e1', 'e1');
  const second = deterministicMigrationId('expense', 'users/u/expenses/e1', 'e1');
  const different = deterministicMigrationId('expense', 'users/u/expenses/e2', 'e2');
  assert.equal(first, second);
  assert.notEqual(first, different);
});

test('duplicate detection distinguishes exact duplicates from same-ID conflicts', async () => {
  const existing = [{
    id: 'expense-1', userId: principalId, momentId: null, activityId: null,
    date: '2026-09-01', amount: 12.5, name: 'Lunch', category: 'Food', description: '',
  }];
  const incoming = [
    { ...existing[0], source: 'firebase' },
    { ...existing[0], amount: 15, source: 'guest' },
  ];

  const result = await detectMigrationDuplicates('expenses', incoming, existing);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.kept.length, 0);
});

test('dataset builder flattens embedded event children and preserves parent links', () => {
  const sources = {
    firebase: {
      datasets: {
        eventGroups: [{
          id: 'moment-1', name: 'Trip', date: '2026-09-01', type: 'Personal', source: 'firebase', sourcePath: 'users/u/eventGroups/doc-1',
          activities: [{
            id: 'activity-1', title: 'Book tickets', date: '2026-08-20', eventId: 'moment-1',
            expenses: [{ id: 'expense-1', name: 'Tickets', amount: 10, date: '2026-08-20', category: 'Travel' }],
          }],
          memories: [{ id: 'memory-1', title: 'Great day', content: 'Trip note' }],
          attachments: [{ id: 'attachment-1', name: 'Photo', url: 'https://example.test/photo.jpg', type: 'image/jpeg' }],
        }],
        expenses: [], incomes: [],
      },
    },
  };

  const datasets = buildMigrationDatasets(sources, principalId);
  assert.equal(datasets.moments[0].record.id, 'moment-1');
  assert.equal(datasets.activities[0].record.momentId, 'moment-1');
  assert.equal(datasets.expenses[0].record.activityId, 'activity-1');
  assert.equal(datasets.memories[0].record.momentId, 'moment-1');
  assert.equal(datasets.attachments[0].record.momentId, 'moment-1');
  assert.equal(datasets.rawFindings.length, 0);
});

test('dataset builder supports guest financial records, settings, and stored code lists', () => {
  const sources = {
    guest: {
      datasets: {
        eventGroups: [],
        expenses: [{ id: 'guest-expense-1', name: 'Groceries', amount: 25, category: 'Food', date: '2026-09-03', source: 'guest-local-storage', sourcePath: 'lifehub_guest_expenses/0', originalId: 'guest-expense-1' }],
        incomes: [{ id: 'guest-income-1', name: 'Salary', type: 'Salary', amount: 100, date: '2026-09-01', source: 'guest-local-storage', sourcePath: 'lifehub_guest_incomes/0', originalId: 'guest-income-1' }],
      },
    },
    settings: {
      datasets: {
        preferences: { theme: 'dark', currency: 'USD' },
        adminValues: { eventTypes: ['Birthday'] },
      },
      keyPresence: { lifehub_preferences: true, lifehub_admin_values: true },
    },
  };

  const datasets = buildMigrationDatasets(sources, principalId);
  assert.equal(datasets.expenses.length, 1);
  assert.equal(datasets.incomes.length, 1);
  assert.deepEqual(datasets.settings.map((entry) => entry.record.key).sort(), ['currency', 'theme']);
  assert.equal(datasets.codeLists[0].record.listKey, 'eventTypes');
  assert.equal(datasets.codeLists[0].record.entryValue, 'Birthday');
  assert.equal(datasets.rawFindings.length, 0);
});

test('migration validator blocks orphan children and owner mismatches', () => {
  const result = validateMigrationDatasets({
    moments: [{ record: { id: 'moment-1', userId: principalId, name: 'Trip', date: '2026-09-01', type: 'Personal', recurrence: 'none', status: 'active' } }],
    activities: [{ record: { id: 'activity-1', userId: 'other-user', momentId: 'missing-moment', title: 'Task', date: '2026-09-01', priority: 'medium', completed: false, source: 'legacy' } }],
    expenses: [], incomes: [], settings: [], codeLists: [], memories: [], attachments: [],
  }, { principalId, version: 1 });

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((item) => item.ruleId === 'activities.owner.mismatch'));
  assert.ok(result.findings.some((item) => item.ruleId === 'activities.relationship.orphan'));
});
