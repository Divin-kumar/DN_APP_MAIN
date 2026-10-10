import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

import {
  getCloudSyncConfig,
  saveCloudSyncConfig,
  queueOfflineSync,
  mergeRecordCollections,
} from '../services/cloudSyncService.js';

test('cloud sync configuration persists and sanitizes values safely', () => {
  const initial = getCloudSyncConfig();
  assert.ok(initial.googleDrive);
  assert.ok(initial.iCloud);

  const testConfig = {
    googleDrive: {
      connected: true,
      userEmail: 'user@example.com',
      userName: 'Test User',
      lastSyncTime: '2026-10-10T08:00:00Z',
      syncStatus: 'success',
      syncError: null,
      autoSync: true,
      fileId: 'drive-file-123',
      // Access token must not be persisted
      secretToken: 'should-not-persist',
    },
    iCloud: {
      connected: true,
      appleId: 'apple@example.com',
      containerId: 'iCloud.com.lifehub.personal',
      lastSyncTime: '2026-10-10T08:05:00Z',
      syncStatus: 'idle',
      syncError: null,
      autoSync: false,
      mode: 'browser-cloudkit',
    },
  };

  saveCloudSyncConfig(testConfig);
  const reloaded = getCloudSyncConfig();

  assert.equal(reloaded.googleDrive.connected, true);
  assert.equal(reloaded.googleDrive.userEmail, 'user@example.com');
  assert.equal(reloaded.googleDrive.fileId, 'drive-file-123');
  assert.equal(reloaded.googleDrive.secretToken, undefined);

  assert.equal(reloaded.iCloud.connected, true);
  assert.equal(reloaded.iCloud.appleId, 'apple@example.com');
});

test('offline queue stores failed providers for auto-sync recovery', () => {
  queueOfflineSync('googleDrive');
  queueOfflineSync('iCloud');
  queueOfflineSync('googleDrive'); // duplicate should not be added twice

  const queue = JSON.parse(localStorage.getItem('lifehub_offline_sync_queue') || '[]');
  assert.equal(queue.length, 2);
  assert.ok(queue.includes('googleDrive'));
  assert.ok(queue.includes('iCloud'));
});

test('mergeRecordCollections resolves conflicts with Last-Write-Wins and prevents duplicates', () => {
  const localItems = [
    { id: 'act-1', title: 'Buy milk', completed: false, updatedAt: '2026-10-10T08:00:00Z' },
    { id: 'act-2', title: 'Call dentist', completed: false, updatedAt: '2026-10-10T09:00:00Z' },
    { id: 'act-local-only', title: 'Clean desk', completed: false, updatedAt: '2026-10-10T10:00:00Z' },
  ];

  const remoteItems = [
    // act-1: remote is newer (completed)
    { id: 'act-1', title: 'Buy milk', completed: true, updatedAt: '2026-10-10T08:30:00Z' },
    // act-2: local is newer (remote is older)
    { id: 'act-2', title: 'Call dentist old', completed: true, updatedAt: '2026-10-10T07:00:00Z' },
    // act-remote-only: brand new from another device
    { id: 'act-remote-only', title: 'Gym workout', completed: false, updatedAt: '2026-10-10T09:15:00Z' },
  ];

  const merged = mergeRecordCollections(localItems, remoteItems);

  // Exactly 4 items (no duplicates)
  assert.equal(merged.length, 4);

  const act1 = merged.find((i) => i.id === 'act-1');
  assert.equal(act1.completed, true, 'Remote newer record should win');

  const act2 = merged.find((i) => i.id === 'act-2');
  assert.equal(act2.title, 'Call dentist', 'Local newer record should be retained');
  assert.equal(act2.completed, false);

  const localOnly = merged.find((i) => i.id === 'act-local-only');
  assert.ok(localOnly, 'Local-only records must be preserved');

  const remoteOnly = merged.find((i) => i.id === 'act-remote-only');
  assert.ok(remoteOnly, 'Remote-only records must be imported');
});

test('settingsRepository supports both getAll and getSettings', async () => {
  const { settingsRepository } = await import('../repositories/settingsRepository.js');
  assert.equal(typeof settingsRepository.getAll, 'function');
  assert.equal(typeof settingsRepository.getSettings, 'function');

  const all = await settingsRepository.getAll('test-user');
  const settings = await settingsRepository.getSettings('test-user');
  assert.deepEqual(all, settings);
});

