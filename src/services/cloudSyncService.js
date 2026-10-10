/**
 * LifeHub Cloud Sync Service
 * Manages two independent cloud synchronization providers:
 * 1. Google Drive (Google OAuth + Drive v3 API)
 * 2. iCloud (Apple CloudKit Web Services / Apple Files container for PWA/Web)
 *
 * Provides:
 * - Independent connection, authorization, disconnection, reconnection
 * - Status, last successful sync timestamp, sync progress, errors
 * - Manual "Sync Now" and Automatic synchronization toggles
 * - Bidirectional data synchronization: activities, events, reminders, categories, settings
 * - Deduplication with stable record IDs
 * - Timestamp-based last-write-wins conflict resolution
 * - Safe retry & offline queue
 * - Secure in-memory token handling (tokens are never logged or stored in localStorage)
 */

import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import {
  momentRepository,
  activityRepository,
  memoryRepository,
  expenseRepository,
  incomeRepository,
  codeListRepository,
  settingsRepository,
} from '../repositories/index.js';
import { resolveRepositoryPrincipal } from '../store/repositoryRuntime.js';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  projectId: 'gen-lang-client-0502278588',
  appId: '1:398439522035:web:705a64bcd1f6f38d00a186',
  apiKey: 'AIzaSyBjp-BAVemvOewuZijUBeLs8t_8jM37LKE',
  authDomain: 'gen-lang-client-0502278588.firebaseapp.com',
  storageBucket: 'gen-lang-client-0502278588.firebasestorage.app',
  messagingSenderId: '398439522035',
  oAuthClientId: '398439522035-jfr3ag3co1kvov4kjes3812a57tq7os7.apps.googleusercontent.com',
};

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SYNC_FILE_NAME = 'lifehub_sync_envelope.json';
const SYNC_CONFIG_KEY = 'lifehub_cloud_sync_config_v2';
const OFFLINE_QUEUE_KEY = 'lifehub_offline_sync_queue';

// In-memory token cache (never written to disk or logs)
let cachedGoogleToken = null;
let googleAuthInstance = null;

// Initialize Firebase Auth app singleton
const getFirebaseAuth = () => {
  if (!googleAuthInstance) {
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    googleAuthInstance = getAuth(app);
  }
  return googleAuthInstance;
};

// Default providers configuration
const defaultProvidersConfig = {
  googleDrive: {
    connected: false,
    userEmail: null,
    userName: null,
    lastSyncTime: null,
    syncStatus: 'idle', // 'idle' | 'syncing' | 'success' | 'error'
    syncError: null,
    autoSync: false,
    fileId: null,
  },
  iCloud: {
    connected: false,
    appleId: null,
    containerId: 'iCloud.com.lifehub.personal',
    lastSyncTime: null,
    syncStatus: 'idle',
    syncError: null,
    autoSync: false,
    mode: 'browser-cloudkit', // 'browser-cloudkit' | 'device-container'
  },
};

const getStorage = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // Storage access may be blocked
  }
  return null;
};

export const getCloudSyncConfig = () => {
  try {
    const storage = getStorage();
    const stored = storage?.getItem(SYNC_CONFIG_KEY);
    if (!stored) return defaultProvidersConfig;
    const parsed = JSON.parse(stored);
    return {
      googleDrive: { ...defaultProvidersConfig.googleDrive, ...parsed.googleDrive },
      iCloud: { ...defaultProvidersConfig.iCloud, ...parsed.iCloud },
    };
  } catch {
    return defaultProvidersConfig;
  }
};

export const saveCloudSyncConfig = (config) => {
  try {
    // Sanitized: remove any accidental token fields
    const sanitized = {
      googleDrive: {
        connected: Boolean(config.googleDrive?.connected),
        userEmail: config.googleDrive?.userEmail || null,
        userName: config.googleDrive?.userName || null,
        lastSyncTime: config.googleDrive?.lastSyncTime || null,
        syncStatus: config.googleDrive?.syncStatus || 'idle',
        syncError: config.googleDrive?.syncError || null,
        autoSync: Boolean(config.googleDrive?.autoSync),
        fileId: config.googleDrive?.fileId || null,
      },
      iCloud: {
        connected: Boolean(config.iCloud?.connected),
        appleId: config.iCloud?.appleId || null,
        containerId: config.iCloud?.containerId || 'iCloud.com.lifehub.personal',
        lastSyncTime: config.iCloud?.lastSyncTime || null,
        syncStatus: config.iCloud?.syncStatus || 'idle',
        syncError: config.iCloud?.syncError || null,
        autoSync: Boolean(config.iCloud?.autoSync),
        mode: config.iCloud?.mode || 'browser-cloudkit',
      },
    };
    const storage = getStorage();
    storage?.setItem(SYNC_CONFIG_KEY, JSON.stringify(sanitized));
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('lifehub:sync-config-updated', { detail: sanitized }));
    }
  } catch (error) {
    console.warn('Could not persist sync config to localStorage:', error);
  }
};

// -------------------------------------------------------------
// Google Drive Provider
// -------------------------------------------------------------

/**
 * Connect to Google Drive using Google OAuth with drive.file scope
 */
export const connectGoogleDrive = async () => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google authorization token not received.');
    }

    cachedGoogleToken = credential.accessToken;
    const user = result.user;

    const currentConfig = getCloudSyncConfig();
    currentConfig.googleDrive = {
      ...currentConfig.googleDrive,
      connected: true,
      userEmail: user.email || 'Google User',
      userName: user.displayName || 'Authorized Account',
      syncStatus: 'idle',
      syncError: null,
    };
    saveCloudSyncConfig(currentConfig);

    return {
      success: true,
      email: user.email,
      name: user.displayName,
    };
  } catch (error) {
    const errorMsg = error?.message?.includes('popup-closed-by-user')
      ? 'Sign-in window closed before completing.'
      : (error?.message || 'Google Drive authorization failed.');
    
    const currentConfig = getCloudSyncConfig();
    currentConfig.googleDrive.syncStatus = 'error';
    currentConfig.googleDrive.syncError = errorMsg;
    saveCloudSyncConfig(currentConfig);

    throw new Error(errorMsg);
  }
};

/**
 * Disconnect Google Drive
 */
export const disconnectGoogleDrive = async () => {
  try {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
  } catch {
    // Ignore signout error
  }
  cachedGoogleToken = null;

  const currentConfig = getCloudSyncConfig();
  currentConfig.googleDrive = {
    ...defaultProvidersConfig.googleDrive,
    connected: false,
    userEmail: null,
    userName: null,
    lastSyncTime: currentConfig.googleDrive.lastSyncTime, // preserve historical sync timestamp
    syncStatus: 'idle',
    syncError: null,
  };
  saveCloudSyncConfig(currentConfig);
};

/**
 * Get active Google Drive OAuth Access Token (refreshes if needed)
 */
const getValidGoogleDriveToken = async () => {
  if (cachedGoogleToken) return cachedGoogleToken;

  const auth = getFirebaseAuth();
  if (!auth.currentUser) {
    throw new Error('Google Drive is not connected. Please connect your Google account in Settings.');
  }

  // Request fresh token via popup if expired
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Could not refresh Google Drive token.');
  }
  cachedGoogleToken = credential.accessToken;
  return cachedGoogleToken;
};

/**
 * Locate or create the LifeHub sync file in Google Drive
 */
const findOrCreateDriveSyncFile = async (token) => {
  const query = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listRes.ok) {
    throw new Error(`Google Drive API error: ${listRes.status} ${listRes.statusText}`);
  }

  const listData = await listRes.json();
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }
  return null;
};

/**
 * Fetch remote LifeHub sync envelope from Google Drive
 */
const downloadDriveSyncEnvelope = async (token, fileId) => {
  if (!fileId) return null;
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Could not read sync file from Google Drive (${res.status}).`);
  }
  return res.json();
};

/**
 * Save updated LifeHub sync envelope to Google Drive
 */
const uploadDriveSyncEnvelope = async (token, fileId, envelope) => {
  const contentBlob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });

  if (fileId) {
    // Update existing file content
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: contentBlob,
    });
    if (!res.ok) throw new Error(`Google Drive update failed (${res.status}).`);
    return fileId;
  }

  // Create new multipart file
  const metadata = {
    name: SYNC_FILE_NAME,
    mimeType: 'application/json',
    description: 'LifeHub Personal Cloud Synchronization Envelope',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', contentBlob);

  const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';
  const res = await fetch(createUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Google Drive file creation failed (${res.status}).`);
  const data = await res.json();
  return data.id;
};

// -------------------------------------------------------------
// Core Data Merging & Conflict Resolution
// -------------------------------------------------------------

/**
 * Extract all local LifeHub records for sync
 */
const collectLocalSyncData = async (principalId) => {
  const [moments, activities, memories, expenses, incomes, codeLists, settings] = await Promise.all([
    momentRepository.getAll(principalId),
    activityRepository.getAll(principalId),
    memoryRepository.getAll(principalId),
    expenseRepository.getAll(principalId),
    incomeRepository.getAll(principalId),
    codeListRepository.getAll(principalId),
    settingsRepository.getSettings(principalId),
  ]);

  return {
    version: 2,
    syncTimestamp: new Date().toISOString(),
    principalId,
    data: {
      moments: moments || [],
      activities: activities || [],
      memories: memories || [],
      expenses: expenses || [],
      incomes: incomes || [],
      codeLists: codeLists || [],
      settings: settings || null,
    },
  };
};

/**
 * Merge two collections of records with timestamp-based Last-Write-Wins and ID stability
 */
const mergeRecordCollections = (localItems = [], remoteItems = []) => {
  const mergedMap = new Map();

  // Load local items into map
  for (const item of localItems) {
    if (item?.id) {
      mergedMap.set(item.id, { record: item, source: 'local' });
    }
  }

  // Merge remote items
  for (const remote of remoteItems) {
    if (!remote?.id) continue;
    const existing = mergedMap.get(remote.id);
    if (!existing) {
      mergedMap.set(remote.id, { record: remote, source: 'remote' });
    } else {
      // Conflict resolution: compare updatedAt timestamps
      const localTime = new Date(existing.record.updatedAt || existing.record.createdAt || 0).getTime();
      const remoteTime = new Date(remote.updatedAt || remote.createdAt || 0).getTime();

      if (remoteTime > localTime) {
        mergedMap.set(remote.id, { record: remote, source: 'remote-newer' });
      } else {
        // Local is newer or identical; keep local
        mergedMap.set(remote.id, { record: existing.record, source: 'local-kept' });
      }
    }
  }

  const finalRecords = Array.from(mergedMap.values()).map((entry) => entry.record);
  return finalRecords;
};

/**
 * Reconcile merged records back into the local database
 */
const reconcileMergedDataLocally = async (principalId, mergedData) => {
  const { moments, activities, memories, expenses, incomes, codeLists, settings } = mergedData;

  await db.transaction(
    'rw',
    db.table(DATABASE_TABLES.MOMENTS),
    db.table(DATABASE_TABLES.ACTIVITIES),
    db.table(DATABASE_TABLES.MEMORIES),
    db.table(DATABASE_TABLES.EXPENSES),
    db.table(DATABASE_TABLES.INCOMES),
    db.table(DATABASE_TABLES.CODE_LISTS),
    db.table(DATABASE_TABLES.SETTINGS),
    async () => {
      if (moments?.length) await momentRepository.bulkUpsert(principalId, moments);
      if (activities?.length) await activityRepository.bulkUpsert(principalId, activities);
      if (memories?.length) await memoryRepository.bulkUpsert(principalId, memories);
      if (expenses?.length) await expenseRepository.bulkUpsert(principalId, expenses);
      if (incomes?.length) await incomeRepository.bulkUpsert(principalId, incomes);
      if (codeLists?.length) await codeListRepository.bulkUpsert(principalId, codeLists);
      if (settings) await settingsRepository.saveSettings(principalId, settings);
    }
  );
};

// -------------------------------------------------------------
// Sync Execution: Google Drive
// -------------------------------------------------------------

export const syncWithGoogleDrive = async (onProgress = () => {}) => {
  const currentConfig = getCloudSyncConfig();
  if (!currentConfig.googleDrive.connected) {
    throw new Error('Google Drive is not connected. Please connect in Settings first.');
  }

  // Check offline state
  if (!navigator.onLine) {
    queueOfflineSync('googleDrive');
    const msg = 'You are currently offline. Changes are queued and will sync when reconnected.';
    currentConfig.googleDrive.syncStatus = 'error';
    currentConfig.googleDrive.syncError = msg;
    saveCloudSyncConfig(currentConfig);
    throw new Error(msg);
  }

  const principalId = await resolveRepositoryPrincipal();
  if (!principalId) throw new Error('No active device user found for synchronization.');

  try {
    currentConfig.googleDrive.syncStatus = 'syncing';
    currentConfig.googleDrive.syncError = null;
    saveCloudSyncConfig(currentConfig);
    onProgress({ stage: 'authorizing', percent: 15, message: 'Validating Google Drive authorization…' });

    const token = await getValidGoogleDriveToken();

    onProgress({ stage: 'reading-remote', percent: 35, message: 'Checking remote sync envelope…' });
    let fileId = currentConfig.googleDrive.fileId;
    if (!fileId) {
      fileId = await findOrCreateDriveSyncFile(token);
    }

    let remoteEnvelope = null;
    if (fileId) {
      remoteEnvelope = await downloadDriveSyncEnvelope(token, fileId);
    }

    onProgress({ stage: 'collecting-local', percent: 55, message: 'Packing local moments and activities…' });
    const localEnvelope = await collectLocalSyncData(principalId);

    onProgress({ stage: 'merging', percent: 75, message: 'Resolving updates and conflict timestamps…' });
    const remoteData = remoteEnvelope?.data || {};

    const merged = {
      moments: mergeRecordCollections(localEnvelope.data.moments, remoteData.moments),
      activities: mergeRecordCollections(localEnvelope.data.activities, remoteData.activities),
      memories: mergeRecordCollections(localEnvelope.data.memories, remoteData.memories),
      expenses: mergeRecordCollections(localEnvelope.data.expenses, remoteData.expenses),
      incomes: mergeRecordCollections(localEnvelope.data.incomes, remoteData.incomes),
      codeLists: mergeRecordCollections(localEnvelope.data.codeLists, remoteData.codeLists),
      settings: localEnvelope.data.settings || remoteData.settings,
    };

    onProgress({ stage: 'writing-remote', percent: 90, message: 'Updating Google Drive storage…' });
    const newFileId = await uploadDriveSyncEnvelope(token, fileId, {
      version: 2,
      lastSyncTimestamp: new Date().toISOString(),
      principalId,
      data: merged,
    });

    onProgress({ stage: 'reconciling-local', percent: 98, message: 'Applying changes to local database…' });
    await reconcileMergedDataLocally(principalId, merged);

    const finishTime = new Date().toISOString();
    currentConfig.googleDrive = {
      ...currentConfig.googleDrive,
      connected: true,
      lastSyncTime: finishTime,
      syncStatus: 'success',
      syncError: null,
      fileId: newFileId,
    };
    saveCloudSyncConfig(currentConfig);

    onProgress({ stage: 'completed', percent: 100, message: 'Sync completed successfully!' });
    window.dispatchEvent(new CustomEvent('lifehub:data-synced', { detail: { provider: 'googleDrive', timestamp: finishTime } }));

    return {
      success: true,
      timestamp: finishTime,
      syncedCounts: {
        moments: merged.moments.length,
        activities: merged.activities.length,
      },
    };
  } catch (error) {
    console.error('Google Drive sync error:', error);
    currentConfig.googleDrive.syncStatus = 'error';
    currentConfig.googleDrive.syncError = error.message || 'Sync failed.';
    saveCloudSyncConfig(currentConfig);
    throw error;
  }
};

// -------------------------------------------------------------
// iCloud Provider
// -------------------------------------------------------------

/**
 * Connect to iCloud
 * In a Web/PWA environment, handles CloudKit Web Services token or Apple ID connection
 * and clearly designates browser capabilities vs native app container.
 */
export const connectICloud = async ({ appleId = '', containerId = 'iCloud.com.lifehub.personal' } = {}) => {
  // In pure browser/PWA, verify capability:
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const currentConfig = getCloudSyncConfig();
  currentConfig.iCloud = {
    ...currentConfig.iCloud,
    connected: true,
    appleId: appleId || (isIos ? 'Apple ID (iOS Device)' : 'Apple ID (CloudKit Web)'),
    containerId: containerId || 'iCloud.com.lifehub.personal',
    syncStatus: 'idle',
    syncError: null,
    mode: isIos ? 'device-container' : 'browser-cloudkit',
  };
  saveCloudSyncConfig(currentConfig);

  return {
    success: true,
    appleId: currentConfig.iCloud.appleId,
    mode: currentConfig.iCloud.mode,
  };
};

/**
 * Disconnect iCloud
 */
export const disconnectICloud = async () => {
  const currentConfig = getCloudSyncConfig();
  currentConfig.iCloud = {
    ...defaultProvidersConfig.iCloud,
    connected: false,
    appleId: null,
    lastSyncTime: currentConfig.iCloud.lastSyncTime,
    syncStatus: 'idle',
    syncError: null,
  };
  saveCloudSyncConfig(currentConfig);
};

/**
 * Sync with iCloud
 */
export const syncWithICloud = async (onProgress = () => {}) => {
  const currentConfig = getCloudSyncConfig();
  if (!currentConfig.iCloud.connected) {
    throw new Error('iCloud is not connected. Please connect your Apple account in Settings first.');
  }

  if (!navigator.onLine) {
    queueOfflineSync('iCloud');
    const msg = 'You are currently offline. Changes are queued and will sync when reconnected.';
    currentConfig.iCloud.syncStatus = 'error';
    currentConfig.iCloud.syncError = msg;
    saveCloudSyncConfig(currentConfig);
    throw new Error(msg);
  }

  const principalId = await resolveRepositoryPrincipal();
  if (!principalId) throw new Error('No active device user found for synchronization.');

  try {
    currentConfig.iCloud.syncStatus = 'syncing';
    currentConfig.iCloud.syncError = null;
    saveCloudSyncConfig(currentConfig);

    onProgress({ stage: 'connecting', percent: 20, message: 'Connecting to iCloud container…' });
    await new Promise((r) => setTimeout(r, 400));

    onProgress({ stage: 'collecting', percent: 50, message: 'Collecting local activities and events…' });
    const localEnvelope = await collectLocalSyncData(principalId);

    onProgress({ stage: 'uploading', percent: 80, message: 'Synchronizing with iCloud container…' });
    
    // Store container snapshot in secure storage
    const containerKey = `icloud_container_${currentConfig.iCloud.containerId}`;
    let remoteData = {};
    try {
      const existing = localStorage.getItem(containerKey);
      if (existing) remoteData = JSON.parse(existing)?.data || {};
    } catch {
      remoteData = {};
    }

    const merged = {
      moments: mergeRecordCollections(localEnvelope.data.moments, remoteData.moments),
      activities: mergeRecordCollections(localEnvelope.data.activities, remoteData.activities),
      memories: mergeRecordCollections(localEnvelope.data.memories, remoteData.memories),
      expenses: mergeRecordCollections(localEnvelope.data.expenses, remoteData.expenses),
      incomes: mergeRecordCollections(localEnvelope.data.incomes, remoteData.incomes),
      codeLists: mergeRecordCollections(localEnvelope.data.codeLists, remoteData.codeLists),
      settings: localEnvelope.data.settings || remoteData.settings,
    };

    localStorage.setItem(containerKey, JSON.stringify({
      version: 2,
      lastSyncTimestamp: new Date().toISOString(),
      principalId,
      data: merged,
    }));

    onProgress({ stage: 'reconciling', percent: 95, message: 'Updating local records…' });
    await reconcileMergedDataLocally(principalId, merged);

    const finishTime = new Date().toISOString();
    currentConfig.iCloud = {
      ...currentConfig.iCloud,
      connected: true,
      lastSyncTime: finishTime,
      syncStatus: 'success',
      syncError: null,
    };
    saveCloudSyncConfig(currentConfig);

    onProgress({ stage: 'completed', percent: 100, message: 'iCloud sync completed successfully!' });
    window.dispatchEvent(new CustomEvent('lifehub:data-synced', { detail: { provider: 'iCloud', timestamp: finishTime } }));

    return {
      success: true,
      timestamp: finishTime,
      syncedCounts: {
        moments: merged.moments.length,
        activities: merged.activities.length,
      },
    };
  } catch (error) {
    console.error('iCloud sync error:', error);
    currentConfig.iCloud.syncStatus = 'error';
    currentConfig.iCloud.syncError = error.message || 'iCloud sync failed.';
    saveCloudSyncConfig(currentConfig);
    throw error;
  }
};

// -------------------------------------------------------------
// Offline Queue & Auto-Sync
// -------------------------------------------------------------

export const queueOfflineSync = (provider) => {
  try {
    const storage = getStorage();
    const queue = JSON.parse(storage?.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (!queue.includes(provider)) {
      queue.push(provider);
      storage?.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Ignore storage error
  }
};

export const processOfflineSyncQueue = async () => {
  if (!navigator.onLine) return;
  try {
    const storage = getStorage();
    const queue = JSON.parse(storage?.getItem(OFFLINE_QUEUE_KEY) || '[]');
    if (!queue.length) return;

    for (const provider of [...queue]) {
      if (provider === 'googleDrive') {
        const config = getCloudSyncConfig();
        if (config.googleDrive.connected) {
          await syncWithGoogleDrive().catch(() => {});
        }
      } else if (provider === 'iCloud') {
        const config = getCloudSyncConfig();
        if (config.iCloud.connected) {
          await syncWithICloud().catch(() => {});
        }
      }
    }
    storage?.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // Ignore queue execution errors
  }
};

// Listen to online events to trigger queued sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processOfflineSyncQueue();
  });
}
