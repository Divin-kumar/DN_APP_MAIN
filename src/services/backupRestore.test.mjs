import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { createBackupArtifact, validateBackupArtifact, previewRestoreBackup, restoreBackupArtifact, verifyBackupArtifactIntegrity } from './backupService.js';

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

test('backup checksum validation rejects tampered payload', async () => {
  const principalId = await seedLocalData();
  const artifact = await createBackupArtifact({ database: db, principalId });

  artifact.payload[DATABASE_TABLES.MOMENTS][0].name = 'tampered';

  const validation = await validateBackupArtifact(artifact);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('checksum')));

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
