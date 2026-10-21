import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEventGroupsFromBackup,
  collectBackupReferenceWarnings,
  createBackupDocument,
  mergeEventGroupsForRestore,
  parseBackupDocument,
  validateBackupDocument,
} from './backupService.js';
import { DEFAULT_CODE_LISTS } from '../utils/codeLists.js';

const fixture = () => createBackupDocument({
  createdDate: '2026-10-19T12:00:00.000Z',
  moments: [{
    id: 'moment-1',
    firestoreId: 'source-firestore-id',
    name: 'Trip',
    activities: [{ id: 'activity-1', title: 'Book hotel', expenses: [{ id: 'expense-nested', amount: 25, date: '2026-10-19' }] }],
    memories: [{ id: 'memory-1', title: 'Sunset' }],
    attachments: [{ id: 'attachment-1', name: 'sunset.jpg', type: 'image/jpeg', size: 12 }],
  }],
  expenses: [
    { id: 'expense-nested', firestoreId: 'expense-doc', amount: 25, eventId: 'moment-1', activityId: 'activity-1' },
    { id: 'expense-standalone', amount: 50 },
  ],
  incomes: [{ id: 'income-1', firestoreId: 'income-doc', amount: 100 }],
  codeLists: Object.fromEntries(Object.entries(DEFAULT_CODE_LISTS).map(([key, value]) => [key, value])),
  preferences: { theme: 'light', currency: 'INR', listSort: { events: { field: 'date', direction: 'asc' } } },
  dashboardConfiguration: { favorites: ['moment-1'], recent: ['moment-1'] },
  settings: { themeChoiceEnabled: true },
  metadata: { source: 'firebase-account', attachmentDataIncluded: false },
});

test('v3 backup exports each visible child domain and excludes provider document IDs', () => {
  const backup = fixture();
  assert.equal(backup.backupVersion, 3);
  assert.equal(backup.moments[0].firestoreId, undefined);
  assert.equal(backup.activities[0].momentId, 'moment-1');
  assert.equal(backup.memories[0].momentId, 'moment-1');
  assert.equal(backup.attachments[0].momentId, 'moment-1');
  assert.equal(backup.expenses[0].firestoreId, undefined);
  assert.equal(backup.incomes[0].firestoreId, undefined);
  assert.equal(backup.metadata.attachmentDataIncluded, false);
});

test('v3 restore reconstructs embedded current Moment records and nested expenses', () => {
  const backup = fixture();
  const [moment] = buildEventGroupsFromBackup(backup);
  assert.equal(moment.id, 'moment-1');
  assert.equal(moment.activities[0].id, 'activity-1');
  assert.equal(moment.activities[0].expenses[0].id, 'expense-nested');
  assert.equal(moment.memories[0].id, 'memory-1');
  assert.equal(moment.attachments[0].id, 'attachment-1');
});

test('v3 validator rejects unsupported versions, duplicate IDs, and broken required relationships', () => {
  const backup = fixture();
  assert.throws(() => parseBackupDocument({ backupVersion: 4 }), /Unsupported backup version/);
  assert.throws(() => parseBackupDocument({ backupFormatVersion: 99 }), /Unsupported backup format version/);
  assert.throws(() => validateBackupDocument({ ...backup, activities: [...backup.activities, backup.activities[0]] }), /duplicate ID/);
  assert.throws(() => validateBackupDocument({ ...backup, memories: [{ id: 'orphan', momentId: 'missing' }] }), /references a missing Moment/);
  assert.throws(() => validateBackupDocument({ ...backup, codeLists: { ...backup.codeLists, eventTypes: [{}] } }), /invalid entry/);
});

test('legacy v2 backups are upgraded into the v3 restore envelope', () => {
  const upgraded = parseBackupDocument({
    app: 'DN',
    backupFormatVersion: 2,
    exportedAt: '2026-10-19T12:00:00.000Z',
    dataSource: 'firebase-account',
    account: { uid: 'old-account' },
    data: {
      localStorage: { lifehub_preferences: { theme: 'light' }, lifehub_admin_values: DEFAULT_CODE_LISTS },
      collections: {
        eventGroups: [{ id: 'moment-1', name: 'Trip', activities: [{ id: 'activity-1' }], memories: [], attachments: [] }],
        expenses: [],
        incomes: [],
        codeLists: DEFAULT_CODE_LISTS,
        codeListSchemaVersion: 1,
      },
    },
  });
  assert.equal(upgraded.backupVersion, 3);
  assert.equal(upgraded.metadata.sourceFormatVersion, 2);
  assert.equal(upgraded.preferences.theme, 'light');
  assert.equal(upgraded.activities[0].momentId, 'moment-1');
});

test('v2 backups accept DN-prefixed browser settings and dashboard identifiers', () => {
  const upgraded = parseBackupDocument({
    backupFormatVersion: 2,
    data: {
      localStorage: {
        dn_preferences: { theme: 'dark', currency: 'INR' },
        dn_admin_values: DEFAULT_CODE_LISTS,
        dn_theme_choice: '1',
        dn_favorite_event_ids_guest: '["moment-dn"]',
        dn_recent_event_ids_guest: '["moment-dn"]',
      },
      collections: {
        eventGroups: [{ id: 'moment-dn', name: 'DN milestone', activities: [], memories: [], attachments: [] }],
        expenses: [],
        incomes: [],
      },
    },
  });
  assert.equal(upgraded.preferences.theme, 'dark');
  assert.equal(upgraded.settings.themeChoiceEnabled, true);
  assert.deepEqual(upgraded.dashboardConfiguration.favorites, ['moment-dn']);
  assert.deepEqual(upgraded.dashboardConfiguration.recent, ['moment-dn']);
});

test('merge preserves existing Moment fields while adding missing child records idempotently', () => {
  const imported = buildEventGroupsFromBackup(fixture());
  const existing = [{
    id: 'moment-1',
    name: 'Locally edited title',
    activities: [{ id: 'activity-1', title: 'Existing activity', expenses: [] }],
    memories: [],
    attachments: [],
  }];
  const first = mergeEventGroupsForRestore(existing, imported);
  const second = mergeEventGroupsForRestore(first.eventGroups, imported);
  assert.equal(first.eventGroups[0].name, 'Locally edited title');
  assert.equal(first.eventGroups[0].activities[0].title, 'Existing activity');
  assert.equal(first.eventGroups[0].activities[0].expenses[0].id, 'expense-nested');
  assert.equal(first.counts.memories, 1);
  assert.equal(first.counts.attachments, 1);
  assert.equal(second.counts.memories, 0);
  assert.equal(second.counts.attachments, 0);
});

test('orphaned finance links are reported instead of dropping standalone transactions', () => {
  const backup = fixture();
  backup.expenses.push({ id: 'orphan-expense', amount: 1, eventId: 'deleted-moment' });
  const parsed = parseBackupDocument(backup);
  assert.deepEqual(collectBackupReferenceWarnings(parsed), ['Expense "orphan-expense" references a Moment not included in this backup.']);
});

test('acceptance volume round-trips all required record counts and relationships', () => {
  const moments = Array.from({ length: 50 }, (_, index) => ({
    id: `moment-${index}`,
    name: `Moment ${index}`,
    activities: Array.from({ length: 2 }, (_, childIndex) => ({ id: `activity-${index}-${childIndex}`, title: 'Activity' })),
    memories: Array.from({ length: 4 }, (_, childIndex) => ({ id: `memory-${index}-${childIndex}`, title: 'Memory' })),
    attachments: index < 20 ? [{ id: `attachment-${index}`, name: `attachment-${index}.jpg`, type: 'image/jpeg', size: 100 }] : [],
  }));
  const backup = createBackupDocument({
    moments,
    expenses: Array.from({ length: 500 }, (_, index) => ({ id: `expense-${index}`, amount: index + 1 })),
    incomes: Array.from({ length: 100 }, (_, index) => ({ id: `income-${index}`, amount: index + 1 })),
    codeLists: DEFAULT_CODE_LISTS,
    preferences: { theme: 'light', currency: 'INR' },
    dashboardConfiguration: { favorites: ['moment-0'], recent: ['moment-1'] },
  });
  const restoredMoments = buildEventGroupsFromBackup(parseBackupDocument(backup));

  assert.equal(backup.moments.length, 50);
  assert.equal(backup.activities.length, 100);
  assert.equal(backup.memories.length, 200);
  assert.equal(backup.attachments.length, 20);
  assert.equal(backup.expenses.length, 500);
  assert.equal(backup.incomes.length, 100);
  assert.equal(restoredMoments.length, 50);
  assert.equal(restoredMoments.flatMap((moment) => moment.activities).length, 100);
  assert.equal(restoredMoments.flatMap((moment) => moment.memories).length, 200);
  assert.equal(restoredMoments.flatMap((moment) => moment.attachments).length, 20);
});
