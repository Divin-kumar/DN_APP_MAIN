import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { createBackupArtifact, validateBackupArtifact, previewRestoreBackup, restoreBackupArtifact, verifyBackupArtifactIntegrity } from './backupService.js';
import { codeListRepository, settingsRepository } from '../repositories/index.js';
import { DEFAULT_CODE_LISTS } from '../utils/codeLists.js';
import { buildBackupFilename, sanitizeDeviceName } from '../utils/backupFilename.js';

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(String(key), String(value)); },
    removeItem(key) { store.delete(String(key)); },
    clear() { store.clear(); },
    key(index) { return Array.from(store.keys())[index] ?? null; },
    get length() { return store.size; },
  };
}

const seedLocalData = async (principalId = 'backup-user') => {
  await db.delete();
  await initializeDatabase();

  await db.table(DATABASE_TABLES.MOMENTS).add({
    id: 'moment-a',
    userId: principalId,
    name: 'Launch day',
    date: '2026-10-05',
    type: 'Personal',
    status: 'active',
    metadata: {},
    source: 'manual',
    createdAt: '2026-10-05T08:00:00.000Z',
    updatedAt: '2026-10-05T08:00:00.000Z',
  });

  await db.table(DATABASE_TABLES.ACTIVITIES).add({
    id: 'activity-a',
    userId: principalId,
    momentId: 'moment-a',
    title: 'Write release note',
    date: '2026-10-05',
    completed: false,
    cancelled: false,
    priority: 'medium',
    createdAt: '2026-10-05T08:00:00.000Z',
    updatedAt: '2026-10-05T08:00:00.000Z',
    source: 'manual',
  });

  await db.table(DATABASE_TABLES.SETTINGS).add({
    id: 'setting-theme',
    userId: principalId,
    key: 'theme',
    value: 'dark',
    updatedAt: '2026-10-05T08:00:00.000Z',
    createdAt: '2026-10-05T08:00:00.000Z',
  });

  await db.table(DATABASE_TABLES.CODE_LISTS).add({
    id: 'code-list-1',
    userId: principalId,
    listKey: 'eventTypes',
    entryValue: 'Personal',
    active: true,
    label: 'Personal',
    updatedAt: '2026-10-05T08:00:00.000Z',
    createdAt: '2026-10-05T08:00:00.000Z',
  });

  return principalId;
};

test('backup artifact is generated with manifest and checksum', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  assert.ok(artifact);
  assert.equal(artifact.appName, 'LifeHub');
  assert.ok(artifact.manifest);
  assert.ok(artifact.checksum);
  assert.equal(artifact.manifest.principalScope, principalId);
  assert.ok(artifact.payload[DATABASE_TABLES.MOMENTS]);
  assert.equal(artifact.payload[DATABASE_TABLES.MOMENTS].length, 1);

  const validation = await validateBackupArtifact(artifact);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);

  await db.delete();
});

test('backup filename follows the local date, sanitized device name, and local time format', () => {
  const date = new Date(2026, 9, 5, 9, 2, 4);
  assert.equal(buildBackupFilename(date, 'José’s Laptop!'), 'DN_Backup_20261005_Joses_Laptop_090204.json');
  assert.equal(sanitizeDeviceName('   '), 'Device');
});

test('restore maps legacy owned rows to the current Device Principal', async () => {
  const legacyPrincipalId = await seedLocalData('legacy-firebase-uid');
  const artifact = await createBackupArtifact({ database: db, principalId: legacyPrincipalId });
  await db.delete();
  await initializeDatabase();

  const targetPrincipalId = 'device-restore-target';
  const preview = await previewRestoreBackup(artifact, { database: db, targetPrincipalId });
  assert.equal(preview.canRestore, true);
  assert.deepEqual(preview.principalMapping, { from: legacyPrincipalId, to: targetPrincipalId });

  await restoreBackupArtifact(artifact, { database: db, targetPrincipalId });
  assert.equal((await db.table(DATABASE_TABLES.MOMENTS).get('moment-a')).userId, targetPrincipalId);
  assert.equal((await settingsRepository.getPreferences(targetPrincipalId)).theme, 'dark');
  assert.ok((await codeListRepository.getList(targetPrincipalId, 'eventTypes')).length > 0);
  await db.delete();
});

test('restore conflict resolution keeps current records or applies the backup version', async () => {
  const principalId = await seedLocalData('conflict-resolution-user');
  const artifact = await createBackupArtifact({ database: db, principalId });
  await db.table(DATABASE_TABLES.MOMENTS).put({ ...artifact.payload[DATABASE_TABLES.MOMENTS][0], name: 'Current version' });

  const friendlyPreview = await previewRestoreBackup(artifact, { database: db });
  assert.equal(friendlyPreview.canRestore, false);
  assert.ok(friendlyPreview.conflicts.every((conflict) => !/moment-a|[0-9a-f]{8}-[0-9a-f]{4}/i.test(conflict.message)));

  await restoreBackupArtifact(artifact, { database: db, principalId, conflictResolution: 'keep-existing' });
  assert.equal((await db.table(DATABASE_TABLES.MOMENTS).get('moment-a')).name, 'Current version');

  await restoreBackupArtifact(artifact, { database: db, principalId, conflictResolution: 'use-backup-version' });
  assert.equal((await db.table(DATABASE_TABLES.MOMENTS).get('moment-a')).name, 'Launch day');
  await db.delete();
});

test('backup export includes repository-backed domains and migration metadata', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  const requiredDomains = [
    DATABASE_TABLES.MOMENTS,
    DATABASE_TABLES.ACTIVITIES,
    DATABASE_TABLES.MEMORIES,
    DATABASE_TABLES.ATTACHMENTS,
    DATABASE_TABLES.EXPENSES,
    DATABASE_TABLES.INCOMES,
    DATABASE_TABLES.SETTINGS,
    DATABASE_TABLES.CODE_LISTS,
    'metadata',
    'migrationAudit',
  ];

  for (const domain of requiredDomains) {
    assert.ok(artifact.payload[domain] !== undefined, `Missing domain export: ${domain}`);
  }

  const exportTableNames = Object.keys(artifact.payload);
  assert.ok(exportTableNames.includes(DATABASE_TABLES.MOMENTS));
  assert.ok(exportTableNames.includes(DATABASE_TABLES.MIGRATION_AUDIT));

  await db.delete();
});

test('default configuration is materialized into Dexie and included in backup export', async () => {
  await db.delete();
  await initializeDatabase();

  const principalId = 'default-config-user';
  await settingsRepository.ensureDefaults(principalId, {
    theme: 'dark',
    currency: 'INR',
    dashboardView: 'overview',
    defaultEventType: 'Personal',
    defaultIncomeType: 'Salary',
    defaultExpenseCategory: 'Food',
    notifications: { eventReminders: true, monthlySummary: true, budgetAlerts: true, reminderTime: '09:00' },
    listSort: {},
  });
  await codeListRepository.ensureDefaults(principalId);

  const artifact = await createBackupArtifact({ database: db, principalId });
  const codeListRows = artifact.payload[DATABASE_TABLES.CODE_LISTS] || [];
  const settingsRows = artifact.payload[DATABASE_TABLES.SETTINGS] || [];

  assert.ok(codeListRows.some((row) => row.listKey === 'eventTypes' && row.entryValue === 'Birthday'));
  assert.ok(codeListRows.some((row) => row.listKey === 'activityPriorities' && row.entryValue === 'low'));
  assert.ok(codeListRows.some((row) => row.listKey === 'reminderPresets' && row.entryValue === '09:00'));
  assert.ok(settingsRows.some((row) => row.key === 'theme' && row.value === 'dark'));

  await db.delete();
});

test('restore normalizes duplicate code list entries by logical key', async () => {
  await db.delete();
  await initializeDatabase();

  const principalId = 'restore-dedupe-user';
  await codeListRepository.ensureDefaults(principalId);
  const artifact = await createBackupArtifact({ database: db, principalId });

  const duplicateArtifact = {
    ...artifact,
    payload: {
      ...artifact.payload,
      [DATABASE_TABLES.CODE_LISTS]: [
        ...(artifact.payload[DATABASE_TABLES.CODE_LISTS] || []).filter((row) => row.listKey === 'eventTypes'),
        {
          id: 'event-duplicate-1',
          userId: principalId,
          listKey: 'eventTypes',
          entryValue: 'Family Celebration',
          label: 'Family Day',
          active: true,
          isActive: true,
          createdAt: '2026-10-05T00:00:00.000Z',
          updatedAt: '2026-10-05T00:00:00.000Z',
          source: 'restore',
        },
        {
          id: 'event-duplicate-2',
          userId: principalId,
          listKey: 'eventTypes',
          entryValue: ' family   celebration ',
          label: 'Family Day',
          active: true,
          isActive: true,
          createdAt: '2026-10-05T00:00:00.000Z',
          updatedAt: '2026-10-05T00:00:00.000Z',
          source: 'restore',
        },
      ],
    },
  };

  const duplicateText = JSON.stringify({ manifest: duplicateArtifact.manifest, payload: duplicateArtifact.payload });
  const duplicateBytes = new TextEncoder().encode(duplicateText);
  const duplicateDigest = await crypto.subtle.digest('SHA-256', duplicateBytes);
  duplicateArtifact.checksum = [...new Uint8Array(duplicateDigest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

  await db.delete();
  await initializeDatabase();
  await restoreBackupArtifact(duplicateArtifact, { database: db, allowOverwrite: true, force: true });

  const restoredRows = await db.table(DATABASE_TABLES.CODE_LISTS)
    .where('[userId+listKey]').equals([principalId, 'eventTypes'])
    .toArray();
  const familyRows = restoredRows.filter((row) => row.entryValue.toLocaleLowerCase().replace(/\s+/g, ' ').trim() === 'family celebration');
  assert.equal(familyRows.length, 1);
  assert.equal(familyRows[0].entryValue, 'Family Celebration');

  await db.delete();
});

test('backup checksum validation rejects tampered payload', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  artifact.payload[DATABASE_TABLES.MOMENTS][0].name = 'tampered';

  const validation = await validateBackupArtifact(artifact);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('checksum')));

  await db.delete();
});

test('restore writes to Dexie and not localStorage', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  const legacyKey = 'legacy-backup-compatibility-marker';
  localStorage.setItem(legacyKey, 'should-remain-untouched');

  await db.table(DATABASE_TABLES.MOMENTS).clear();
  await db.table(DATABASE_TABLES.ACTIVITIES).clear();
  await db.table(DATABASE_TABLES.SETTINGS).clear();
  await db.table(DATABASE_TABLES.CODE_LISTS).clear();

  const restoreResult = await restoreBackupArtifact(artifact, { database: db, allowOverwrite: true, force: true });
  assert.equal(restoreResult.success, true);
  assert.equal(await db.table(DATABASE_TABLES.MOMENTS).count(), 1);
  assert.equal(await db.table(DATABASE_TABLES.ACTIVITIES).count(), 1);
  assert.equal(await db.table(DATABASE_TABLES.SETTINGS).count(), 1);
  assert.equal(await db.table(DATABASE_TABLES.CODE_LISTS).count(), 1);
  assert.equal(localStorage.getItem(legacyKey), 'should-remain-untouched');

  localStorage.removeItem(legacyKey);
  await db.delete();
});

test('local profile settings survive backup and restore without adding cloud identity', async () => {
  await db.delete();
  await initializeDatabase();
  const sourcePrincipalId = 'profile-backup-source';
  const profile = { displayName: 'Alex', nickname: 'Lex', description: 'Local profile', photoDataUrl: '' };
  await settingsRepository.setOne(sourcePrincipalId, 'profile', profile);
  const artifact = await createBackupArtifact({ database: db, principalId: sourcePrincipalId });
  assert.equal(artifact.payload[DATABASE_TABLES.SETTINGS].find((row) => row.key === 'profile')?.value.displayName, 'Alex');

  await db.delete();
  await initializeDatabase();
  const targetPrincipalId = 'profile-backup-target';
  await restoreBackupArtifact(artifact, { database: db, targetPrincipalId });
  const restored = await settingsRepository.getByKey(targetPrincipalId, 'profile');
  assert.deepEqual(restored.value, profile);
  assert.equal(artifact.payload[DATABASE_TABLES.METADATA].some((row) => String(row.key).toLowerCase().includes('google')), false);
  await db.delete();
});

test('restore preview reports valid restore and conflict blocks', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  const preview = await previewRestoreBackup(artifact, { database: db });
  assert.equal(preview.canRestore, true);
  assert.equal(preview.summary.inserted, 0);

  await db.table(DATABASE_TABLES.MOMENTS).put({
    ...artifact.payload[DATABASE_TABLES.MOMENTS][0],
    id: 'moment-a',
    name: 'Different value',
  });

  const conflictedPreview = await previewRestoreBackup(artifact, { database: db });
  assert.equal(conflictedPreview.canRestore, false);
  assert.ok(conflictedPreview.conflicts.length > 0);

  await db.delete();
});

test('restore validation rejects schema-mismatched archive', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });
  artifact.databaseSchemaVersion = 999;

  const validation = await validateBackupArtifact(artifact);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('schema')));

  await db.delete();
});

test('restore applies backup and rollback restores database on failure', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  await db.table(DATABASE_TABLES.MOMENTS).put({
    id: 'moment-a',
    userId: principalId,
    name: 'Conflicting duplicate record',
    date: '2026-10-05',
    type: 'Personal',
    status: 'active',
    metadata: {},
    source: 'manual',
    createdAt: '2026-10-05T08:00:00.000Z',
    updatedAt: '2026-10-05T09:00:00.000Z',
  });

  const preview = await previewRestoreBackup(artifact, { database: db });
  assert.equal(preview.canRestore, false);

  const before = await db.table(DATABASE_TABLES.MOMENTS).toArray();
  const restoreResult = await restoreBackupArtifact(artifact, { database: db, allowOverwrite: false, force: false }).catch((error) => error);
  assert.ok(restoreResult instanceof Error || restoreResult?.errors);
  const afterRestore = await db.table(DATABASE_TABLES.MOMENTS).toArray();
  assert.deepEqual(before.map((row) => row.id).sort(), afterRestore.map((row) => row.id).sort());

  await db.delete();
});

test('verifyBackupArtifactIntegrity returns valid info for a clean archive', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  const verification = await verifyBackupArtifactIntegrity(artifact);
  assert.equal(verification.valid, true);
  assert.ok(verification.recordCount >= 4);

  await db.delete();
});
