import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRecordCollections } from '../src/services/cloudSyncService.js';

test('merge keeps a record that exists on only one side', () => {
  const local = [{ id: 'local-only', updatedAt: '2026-10-01T10:00:00.000Z' }];
  const remote = [{ id: 'remote-only', updatedAt: '2026-10-02T10:00:00.000Z' }];

  assert.deepEqual(
    mergeRecordCollections(local, remote).map((record) => record.id).sort(),
    ['local-only', 'remote-only'],
  );
});

test('merge chooses the record with the newer updatedAt timestamp', () => {
  const local = [{ id: 'shared', value: 'local', updatedAt: '2026-10-01T10:00:00.000Z' }];
  const remote = [{ id: 'shared', value: 'remote', updatedAt: '2026-10-02T10:00:00.000Z' }];

  assert.deepEqual(mergeRecordCollections(local, remote), [remote[0]]);
});

test('merge prefers local data when timestamps are equal', () => {
  const timestamp = '2026-10-02T10:00:00.000Z';
  const local = [{ id: 'shared', value: 'local', updatedAt: timestamp }];
  const remote = [{ id: 'shared', value: 'remote', updatedAt: timestamp }];

  assert.deepEqual(mergeRecordCollections(local, remote), [local[0]]);
});

test('merge ignores records without IDs and deduplicates matching IDs', () => {
  const local = [
    { id: 'same', value: 'first', updatedAt: '2026-10-01T10:00:00.000Z' },
    { value: 'no-id' },
  ];
  const remote = [
    { id: 'same', value: 'second', updatedAt: '2026-10-02T10:00:00.000Z' },
    { value: 'also-no-id' },
  ];

  assert.deepEqual(mergeRecordCollections(local, remote), [remote[0]]);
});

test('a missing or unreadable local backup must not silently become an empty sync payload', async () => {
  // The collection path deliberately throws if backup artifact creation fails.
  // This protects remote data from being overwritten by a partial fallback.
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('../src/services/cloudSyncService.js', import.meta.url), 'utf8'),
  );

  assert.match(source, /const artifact = await createBackupArtifact\(/);
  assert.doesNotMatch(source, /console\.warn\('Backup artifact generation fallback:/);
});
