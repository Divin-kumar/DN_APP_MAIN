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
