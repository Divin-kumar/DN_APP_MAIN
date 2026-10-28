import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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

test('v3 backup preserves independent Moment type Dashboard flags', () => {
  const backup = fixture();
  backup.codeLists.eventTypes = [{ value: 'Private', showInDashboardUpcoming: true, showActivitiesOnDashboard: false }];
  const restored = parseBackupDocument(JSON.parse(JSON.stringify(backup)));
  assert.equal(restored.codeLists.eventTypes[0].showInDashboardUpcoming, true);
  assert.equal(restored.codeLists.eventTypes[0].showActivitiesOnDashboard, false);
  assert.equal(restored.backupVersion, 3);
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

test('legacy numeric identity and nested-only expenses survive v2 conversion and repeat restore', () => {
  const converted = parseBackupDocument({ backupFormatVersion: 2, data: { collections: {
    eventGroups: [{ id: 10, name: 'Legacy Moment', firestoreCollection: 'events', activities: [
      { id: 20, expenses: [{ id: 30, amount: 1200, date: '2026-10-18' }] },
    ] }],
    expenses: [], incomes: [{ id: 40, name: 'Legacy income', amount: 18000 }],
  }, localStorage: { dn_favorite_event_ids_guest: '[10]' } } });
  assert.equal(converted.moments[0].id, '10');
  assert.equal(converted.activities[0].id, '20');
  assert.equal(converted.moments[0].firestoreCollection, undefined);
  assert.equal(converted.expenses.length, 1);
  assert.equal(converted.expenses[0].id, '30');
  assert.equal(converted.expenses[0].eventId, '10');
  assert.equal(converted.expenses[0].activityId, '20');
  assert.equal(converted.incomes[0].id, '40');
  assert.deepEqual(converted.dashboardConfiguration.favorites, ['10']);
  const restored = buildEventGroupsFromBackup(converted);
  assert.equal(restored[0].activities[0].expenses[0].amount, 1200);
  const repeated = mergeEventGroupsForRestore(restored, buildEventGroupsFromBackup(converted));
  assert.equal(repeated.eventGroups[0].activities[0].expenses.length, 1);
  assert.equal(repeated.counts.moments, 0);
});

test('backup canonical expenses take precedence over a nested copy with numeric identity', () => {
  const backup = createBackupDocument({
    moments: [{ id: 1, activities: [{ id: 2, expenses: [{ id: 3, amount: 10 }] }] }],
    expenses: [{ id: '3', amount: 25, eventId: '1', activityId: '2' }],
    incomes: [{ firestoreId: 'old-income-document', amount: 100 }], codeLists: DEFAULT_CODE_LISTS,
  });
  assert.equal(backup.expenses.length, 1);
  assert.equal(backup.expenses[0].amount, 25);
  assert.equal(backup.incomes[0].id, 'old-income-document');
  assert.equal(backup.incomes[0].firestoreId, undefined);
});

test('restore uses destination legacy expense values for a missing mirror and remains idempotent', () => {
  const imported = buildEventGroupsFromBackup(fixture());
  const current = [{ id: 'moment-1', name: 'Current trip', activities: [{ id: 'activity-1', title: 'Current activity', expenses: [] }] }];
  const expenses = [{
    id: 'expense-nested', firestoreId: 'legacy-expense-doc', firestoreCollection: 'transactions',
    name: 'Current expense', amount: 99, notes: 'Current notes', eventId: 'moment-1', activityId: 'activity-1',
  }];
  const before = JSON.stringify({ current, expenses, imported });
  const first = mergeEventGroupsForRestore(current, imported, expenses);
  const mirror = first.eventGroups[0].activities[0].expenses[0];
  assert.equal(mirror.amount, 99, 'the stale backup amount must not become a new mirror');
  assert.equal(mirror.name, 'Current expense');
  assert.equal(mirror.notes, 'Current notes');
  assert.equal(mirror.firestoreId, undefined);
  assert.equal(mirror.firestoreCollection, undefined);
  assert.equal(first.eventGroups[0].name, 'Current trip');
  assert.equal(JSON.stringify({ current, expenses, imported }), before, 'source records and imported backup remain unchanged');

  const repeated = mergeEventGroupsForRestore(first.eventGroups, imported, expenses);
  assert.equal(repeated.eventGroups[0].activities[0].expenses.length, 1);
  assert.equal(repeated.eventGroups[0].activities[0].expenses[0].amount, 99);
  assert.equal(repeated.counts.moments, 0);
  const backup = createBackupDocument({ moments: repeated.eventGroups, expenses, codeLists: DEFAULT_CODE_LISTS });
  assert.equal(backup.expenses.length, 1, 'exporting after restore preserves one authoritative financial record');
  assert.equal(backup.expenses[0].amount, 99);
  assert.equal(backup.expenses[0].firestoreCollection, undefined);
});

test('restore does not attach a destination expense to a backup activity when its current links differ or were cleared', () => {
  for (const links of [
    { eventId: null, activityId: null },
    { eventId: 'other-moment', activityId: 'other-activity' },
    { eventId: 'moment-1', activityId: 'other-activity' },
  ]) {
    const imported = buildEventGroupsFromBackup(fixture());
    const expenses = [{ id: 'expense-nested', amount: 99, ...links }];
    const first = mergeEventGroupsForRestore([], imported, expenses);
    assert.deepEqual(first.eventGroups[0].activities[0].expenses, []);
    assert.deepEqual(expenses[0], { id: 'expense-nested', amount: 99, ...links }, 'existing relationships remain authoritative');
    const repeated = mergeEventGroupsForRestore(first.eventGroups, imported, expenses);
    assert.deepEqual(repeated.eventGroups[0].activities[0].expenses, []);
    assert.equal(repeated.eventGroups.length, 1);
  }
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

const originalFile = () => {
  const bytes = Buffer.from('An original photograph');
  return { assetId: createHash('sha256').update(bytes).digest('hex'), type: 'image/jpeg', size: bytes.length, base64: bytes.toString('base64') };
};

const backupWithOriginal = () => {
  const file = originalFile();
  return createBackupDocument({
    moments: [{ id: 'moment-photo', activities: [{ id: 'activity-photo', title: 'A memory' }], attachments: [
      { id: 'photo-1', name: 'photo.jpg', assetId: file.assetId, storage: 'firebase', activityId: 'activity-photo' },
      { id: 'photo-2', name: 'same-original.jpg', assetId: file.assetId, storage: 'firebase' },
    ] }],
    attachmentFiles: [file],
    codeLists: DEFAULT_CODE_LISTS,
  });
};

test('original attachment payload is stored once while references and activity links round-trip', () => {
  const backup = backupWithOriginal();
  assert.equal(backup.attachmentFiles.length, 1);
  assert.equal(backup.attachments.length, 2);
  assert.equal(backup.metadata.attachmentDataIncluded, true);
  assert.equal(backup.metadata.attachmentLimitation, null);
  const parsed = parseBackupDocument(JSON.parse(JSON.stringify(backup)));
  const [moment] = buildEventGroupsFromBackup(parsed);
  assert.equal(moment.attachments[0].activityId, 'activity-photo');
  assert.equal(moment.attachments[0].assetId, originalFile().assetId);
  assert.equal(moment.attachments[1].assetId, moment.attachments[0].assetId);
  assert.equal(Buffer.from(parsed.attachmentFiles[0].base64, 'base64').toString(), 'An original photograph');
});

test('old v3 metadata-only backups remain accepted without the optional attachmentFiles collection', () => {
  const backup = fixture();
  delete backup.attachmentFiles;
  assert.equal(parseBackupDocument(backup), backup);
  assert.equal(buildEventGroupsFromBackup(backup)[0].attachments[0].name, 'sunset.jpg');
});

test('new exports and imports reject original references without their files', () => {
  const file = originalFile();
  assert.throws(() => createBackupDocument({
    moments: [{ id: 'moment', attachments: [{ id: 'photo', assetId: file.assetId }] }], codeLists: DEFAULT_CODE_LISTS,
  }), /missing the original file/);
  for (const attachmentFiles of [[], undefined]) {
    assert.throws(() => validateBackupDocument({ ...backupWithOriginal(), attachmentFiles }), /missing the original file/);
  }
});

test('original payload validation rejects duplicate assets, invalid IDs, shapes and oversized files', () => {
  const backup = backupWithOriginal();
  const file = originalFile();
  assert.throws(() => validateBackupDocument({ ...backup, attachmentFiles: [file, file] }), /duplicate original/);
  assert.throws(() => validateBackupDocument({ ...backup, attachmentFiles: {} }), /must be an array/);
  assert.throws(() => validateBackupDocument({ ...backup, attachments: [] }), /without an attachment reference/);
  for (const change of [
    { assetId: '../outside' }, { assetId: null }, { extra: 'unexpected' }, { type: '' }, { type: 'image/jpeg\nContent-Type: text/html' },
    { size: 0 }, { size: 1.5 }, { size: 10 * 1024 * 1024 + 1 },
  ]) {
    assert.throws(() => validateBackupDocument({ ...backup, attachmentFiles: [{ ...file, ...change }] }), /invalid|between/);
  }
});

test('original payload validation rejects malformed base64 and mismatched decoded byte sizes', () => {
  const backup = backupWithOriginal();
  const file = originalFile();
  for (const base64 of [null, '', 'YQ', 'Y===', '$bad', 'Y Q=', '====']) {
    assert.throws(() => validateBackupDocument({ ...backup, attachmentFiles: [{ ...file, base64 }] }), /valid base64|does not match/);
  }
  assert.throws(() => validateBackupDocument({ ...backup, attachmentFiles: [{ ...file, size: file.size + 1 }] }), /does not match/);
  assert.throws(() => validateBackupDocument({ ...backup, attachments: [{ ...backup.attachments[0], assetId: 'not-a-hash' }] }), /invalid original file reference/);
});

test('Phase 5 backup v3 round-trips Cash and Online without inventing historical methods', () => {
  const document = createBackupDocument({
    moments:[{ id:'m', name:'Project', activities:[{
      id:'a', title:'Delivery', expenses:[{id:'linked',amount:40,paymentMethod:'Cash'}],
    }] }],
    expenses:[{id:'linked',amount:40,eventId:'m',activityId:'a',paymentMethod:'Cash'},
      {id:'legacy',amount:60}],
    incomes:[{id:'inc',amount:200,paymentMethod:'Online'}],
    codeLists:DEFAULT_CODE_LISTS,
  });
  const restored=parseBackupDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(restored.expenses.find(x=>x.id==='linked').paymentMethod,'Cash');
  assert.equal(restored.incomes[0].paymentMethod,'Online');
  assert.equal(restored.expenses.find(x=>x.id==='legacy').paymentMethod,undefined);
  const [moment]=buildEventGroupsFromBackup(restored);
  assert.equal(moment.activities[0].expenses[0].paymentMethod,'Cash');
});
