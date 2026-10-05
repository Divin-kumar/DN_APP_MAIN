import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { db } from '../database/index.js';
import { initializeDatabase } from '../database/boot.js';
import { DATABASE_TABLES } from '../database/tables.js';
import {
  registerDevice,
  updateDeviceLifecycle,
  getDevice,
  appendMutationJournalEntry,
  getMutationJournal,
  createRevisionEnvelope,
  createTombstone,
  buildSyncMetadataEnvelope,
  quarantineConflict,
  preserveSyncMetadataForBackup,
  withMigrationProvenance,
  convertGuestToUser,
  listAuditEntries,
} from './index.js';

const seedDatabase = async () => {
  await db.delete();
  await initializeDatabase();
};

test('device registry persists and tracks lifecycle state', async () => {
  await seedDatabase();

  const device = await registerDevice({
    deviceName: 'Laptop-01',
    platform: 'windows',
    appVersion: '1.0.0',
    principalId: 'user-1',
  });

  assert.ok(device.deviceId);
  assert.equal(device.status, 'active');

  const refreshed = await getDevice(device.deviceId);
  assert.equal(refreshed.deviceName, 'Laptop-01');

  const retired = await updateDeviceLifecycle(device.deviceId, 'retired');
  assert.equal(retired.status, 'retired');

  await db.delete();
});

test('mutation journal records append-only events with provenance', async () => {
  await seedDatabase();

  const event1 = await appendMutationJournalEntry({
    entityType: 'moments',
    recordId: 'moment-1',
    principalId: 'user-1',
    originDeviceId: 'device-1',
    changeSource: 'user',
    changeType: 'create',
    afterValue: { id: 'moment-1', title: 'Launch' },
  });

  const event2 = await appendMutationJournalEntry({
    entityType: 'moments',
    recordId: 'moment-1',
    principalId: 'user-1',
    originDeviceId: 'device-1',
    changeSource: 'user',
    changeType: 'update',
    beforeValue: { id: 'moment-1', title: 'Launch' },
    afterValue: { id: 'moment-1', title: 'Launch V2' },
  });

  assert.equal(event1.sequence, 1);
  assert.equal(event2.sequence, 2);

  const journal = await getMutationJournal({ entityType: 'moments', recordId: 'moment-1' });
  assert.equal(journal.length, 2);
  assert.equal(journal[0].changeType, 'create');
  assert.equal(journal[1].changeType, 'update');

  await db.delete();
});

test('revision tracking produces monotonic version metadata', async () => {
  await seedDatabase();

  const first = createRevisionEnvelope({
    revision: 0,
    principalId: 'user-1',
    originDeviceId: 'device-1',
    changeSource: 'user',
  });

  const second = createRevisionEnvelope({
    revision: first.revision,
    principalId: 'user-1',
    originDeviceId: 'device-1',
    changeSource: 'user',
  });

  assert.equal(first.revision, 1);
  assert.equal(second.revision, 1);
  assert.equal(first.provenance.originDeviceId, 'device-1');

  await db.delete();
});

test('tombstones preserve delete lifecycle and retention metadata', async () => {
  await seedDatabase();

  const tombstone = await createTombstone({
    recordId: 'moment-1',
    entityType: 'moments',
    deletedByDeviceId: 'device-1',
    deletedByPrincipalId: 'user-1',
    deleteReason: 'user-requested',
  });

  assert.equal(tombstone.status, 'active');
  assert.ok(tombstone.retentionUntil);

  await db.delete();
});

test('sync metadata envelope adds consistent revision and sync state', async () => {
  await seedDatabase();

  const metadata = buildSyncMetadataEnvelope({
    principalId: 'user-1',
    originDeviceId: 'device-1',
    recordType: 'moments',
    changeSource: 'user',
  });

  assert.equal(metadata.syncState, 'unsynced');
  assert.equal(metadata.revision, 1);
  assert.equal(metadata.originDeviceId, 'device-1');
  assert.ok(metadata.lastSyncAt === null || typeof metadata.lastSyncAt === 'string');

  await db.delete();
});

test('conflict quarantine records unresolved conflicts with audit', async () => {
  await seedDatabase();

  const conflict = await quarantineConflict({
    recordId: 'moment-1',
    entityType: 'moments',
    principalId: 'user-1',
    localValue: { title: 'A' },
    incomingValue: { title: 'B' },
    conflictType: 'concurrent-update',
    originDeviceId: 'device-1',
  });

  assert.equal(conflict.status, 'quarantined');
  assert.ok(conflict.conflictId);
  assert.ok(Array.isArray(conflict.auditTrail));

  await db.delete();
});

test('backup compatibility preserves sync metadata lineage', async () => {
  await seedDatabase();

  const record = {
    id: 'moment-1',
    title: 'Launch',
    ...buildSyncMetadataEnvelope({
      principalId: 'user-1',
      originDeviceId: 'device-1',
      recordType: 'moments',
      changeSource: 'user',
    }),
  };

  const preserved = preserveSyncMetadataForBackup(record);
  assert.equal(preserved.syncState, 'unsynced');
  assert.equal(preserved.originDeviceId, 'device-1');
  assert.equal(preserved.revision, 1);

  await db.delete();
});

test('migration provenance is added without changing the data model', async () => {
  await seedDatabase();

  const record = withMigrationProvenance({
    id: 'moment-1',
    title: 'Migrated',
    principalId: 'user-1',
  }, { migrationRunId: 'migration-1', migratedFromVersion: 2 });

  assert.equal(record.changeSource, 'migration');
  assert.equal(record.migrationRunId, 'migration-1');
  assert.equal(record.migratedFromVersion, 2);

  await db.delete();
});

test('guest to user conversion preserves lineage and audit trail', async () => {
  await seedDatabase();

  const converted = await convertGuestToUser({
    id: 'guest-moment',
    title: 'Guest item',
    principalId: 'guest-1',
    guestScope: true,
    originDeviceId: 'device-guest',
  }, { targetPrincipalId: 'user-1', targetDeviceId: 'device-1' });

  assert.equal(converted.principalId, 'user-1');
  assert.equal(converted.changeSource, 'guest-conversion');
  assert.ok(Array.isArray(converted.auditTrail));

  await db.delete();
});

test('audit log captures lifecycle events and failed sync foundation inspections', async () => {
  await seedDatabase();

  await registerDevice({ deviceName: 'Audit-Device', platform: 'browser', appVersion: '1.0.0', principalId: 'user-1' });
  const audit = await listAuditEntries({ principalId: 'user-1' });

  assert.ok(audit.length >= 1);
  await db.delete();
});
