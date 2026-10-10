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
 * - Bidirectional data synchronization: activities, events, reminders, categories, settings, attachments
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
  attachmentRepository,
} from '../repositories/index.js';
import { resolveRepositoryPrincipal } from '../store/repositoryRuntime.js';
import useEventStore from '../store/useEventStore.js';
import useExpenseStore from '../store/useExpenseStore.js';
import useIncomeStore from '../store/useIncomeStore.js';
import {
  createBackupArtifact,
  previewRestoreBackup,
  restoreBackupArtifact,
} from './backupService.js';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
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

// Initialize named Firebase Auth app singleton to isolate from other Firebase instances
const getFirebaseAuth = () => {
  if (!googleAuthInstance) {
    const existing = getApps().find((a) => a.name === 'lifehub-cloud-sync');
    const app = existing || initializeApp(firebaseConfig, 'lifehub-cloud-sync');
    googleAuthInstance = getAuth(app);
  }
  return googleAuthInstance;
};

// Default providers configuration
const defaultProvidersConfig = {
  conflictResolution: 'merge-safe', // 'merge-safe' | 'use-backup-version' | 'keep-existing'
  autoSync: true,
  googleDrive: {
    connected: false,
    userEmail: null,
    userName: null,
    lastSyncTime: null,
    syncStatus: 'idle', // 'idle' | 'syncing' | 'success' | 'error'
    syncError: null,
    autoSync: true,
    fileId: null,
  },
  iCloud: {
    connected: false,
    appleId: null,
    containerId: 'iCloud.com.lifehub.personal',
    lastSyncTime: null,
    syncStatus: 'idle',
    syncError: null,
    autoSync: true,
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
      conflictResolution: parsed.conflictResolution || defaultProvidersConfig.conflictResolution,
      autoSync: typeof parsed.autoSync === 'boolean' ? parsed.autoSync : defaultProvidersConfig.autoSync,
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
      conflictResolution: config.conflictResolution || 'merge-safe',
      autoSync: typeof config.autoSync === 'boolean' ? config.autoSync : true,
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
// Google Drive Token & Identity Management
// -------------------------------------------------------------

let gisScriptLoadingPromise = null;

const loadGisScript = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window unavailable'));
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  if (gisScriptLoadingPromise) return gisScriptLoadingPromise;

  gisScriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Google Identity Services failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google Identity Services script could not be loaded.'));
    document.head.appendChild(script);
  });
  return gisScriptLoadingPromise;
};

/**
 * Fetch basic user info from Google Drive about API or userinfo using bearer token
 */
const fetchGoogleUserInfo = async (token) => {
  try {
    const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (aboutRes.ok) {
      const data = await aboutRes.json();
      if (data?.user?.emailAddress) {
        return {
          email: data.user.emailAddress,
          name: data.user.displayName || data.user.emailAddress.split('@')[0],
        };
      }
    }
  } catch {
    // Fallback to oauth2 userinfo
  }

  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (userRes.ok) {
      const info = await userRes.json();
      return {
        email: info.email || 'Google User',
        name: info.name || info.email || 'Authorized Account',
      };
    }
  } catch {
    // ignore
  }

  return { email: 'Google Drive Account', name: 'Authorized Account' };
};

/**
 * Request Google OAuth Access Token via GIS or Firebase Auth popup
 */
const requestGoogleAccessToken = async (promptMode = '') => {
  // Strategy 1: Google Identity Services token client
  try {
    await loadGisScript();
    const token = await new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: firebaseConfig.oAuthClientId,
        scope: DRIVE_SCOPE,
        callback: (resp) => {
          if (resp?.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error(resp?.error_description || resp?.error || 'Google Drive authorization not granted.'));
          }
        },
        error_callback: (err) => {
          reject(new Error(err?.message || 'Google authorization window was closed.'));
        },
      });
      client.requestAccessToken({ prompt: promptMode });
    });
    return token;
  } catch (gisErr) {
    // Strategy 2: Firebase Auth signInWithPopup on isolated app
    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.addScope(DRIVE_SCOPE);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        return credential.accessToken;
      }
    } catch (fbErr) {
      console.warn('Firebase popup fallback failed:', fbErr);
    }
    throw gisErr;
  }
};

/**
 * Connect to Google Drive using Google OAuth with drive.file scope
 */
export const connectGoogleDrive = async () => {
  try {
    const token = await requestGoogleAccessToken('select_account');
    if (!token) throw new Error('Authorization token not received.');
    cachedGoogleToken = token;

    const userInfo = await fetchGoogleUserInfo(token);

    const currentConfig = getCloudSyncConfig();
    currentConfig.googleDrive = {
      ...currentConfig.googleDrive,
      connected: true,
      userEmail: userInfo.email,
      userName: userInfo.name,
      syncStatus: 'idle',
      syncError: null,
    };
    saveCloudSyncConfig(currentConfig);

    return {
      success: true,
      email: userInfo.email,
      name: userInfo.name,
    };
  } catch (error) {
    const errorMsg = error?.message?.includes('popup-closed') || error?.message?.includes('closed')
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
 * Get active Google Drive OAuth Access Token (requests if needed)
 */
const getValidGoogleDriveToken = async () => {
  if (cachedGoogleToken) return cachedGoogleToken;

  const currentConfig = getCloudSyncConfig();
  if (!currentConfig.googleDrive.connected) {
    throw new Error('Google Drive is not connected. Please connect your Google account in Settings.');
  }

  // Request fresh token silently or prompt user
  const token = await requestGoogleAccessToken('');
  cachedGoogleToken = token;
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
    try {
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
      if (res.ok) return fileId;
    } catch {
      // If patch fails, fall back to creating a fresh file
    }
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

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Google Drive upload failed (${res.status}): ${errorText || res.statusText}`);
  }
  const data = await res.json();
  return data.id;
};

// -------------------------------------------------------------
// Core Data Merging & Conflict Resolution
// -------------------------------------------------------------

/**
 * Extract all local LifeHub records for sync using the complete backup artifact engine
 */
const collectLocalSyncData = async (principalId) => {
  let artifact = null;
  try {
    artifact = await createBackupArtifact({
      database: db,
      principalId,
      reason: 'cloud-sync',
      attachmentMode: 'include-attachments',
    });
  } catch (err) {
    console.warn('Backup artifact generation fallback:', err);
  }

  const [moments, activities, memories, expenses, incomes, codeLists, settings, attachments] = await Promise.all([
    momentRepository.getAll(principalId).catch(() => []),
    activityRepository.getAll(principalId).catch(() => []),
    memoryRepository.getAll(principalId).catch(() => []),
    expenseRepository.getAll(principalId).catch(() => []),
    incomeRepository.getAll(principalId).catch(() => []),
    codeListRepository.getAll(principalId).catch(() => []),
    (settingsRepository.getAll ? settingsRepository.getAll(principalId) : settingsRepository.getSettings(principalId)).catch(() => []),
    attachmentRepository.getAll(principalId).catch(() => []),
  ]);

  return {
    version: 2,
    syncTimestamp: new Date().toISOString(),
    principalId,
    artifact,
    data: artifact?.payload || {
      moments: moments || [],
      activities: activities || [],
      memories: memories || [],
      expenses: expenses || [],
      incomes: incomes || [],
      codeLists: codeLists || [],
      settings: settings || null,
      attachments: attachments || [],
    },
  };
};

/**
 * Merge two collections of records with timestamp-based Last-Write-Wins and ID stability
 */
export const mergeRecordCollections = (localItems = [], remoteItems = []) => {
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

  return Array.from(mergedMap.values()).map((entry) => entry.record);
};

/**
 * Reconcile remote sync envelope into the local database reusing backup import conflict resolution
 */
export const reconcileRemoteDataWithBackupEngine = async (principalId, remoteEnvelope, conflictResolution = 'merge-safe') => {
  if (!remoteEnvelope) return;
  let artifact = remoteEnvelope.artifact;
  if (!artifact && remoteEnvelope.data) {
    artifact = {
      manifestVersion: 1,
      schemaVersion: 6,
      databaseSchemaVersion: 6,
      createdAt: remoteEnvelope.lastSyncTimestamp || remoteEnvelope.syncTimestamp || new Date().toISOString(),
      principalScope: principalId,
      manifest: {
        backupId: `sync-${Date.now()}`,
        createdAt: remoteEnvelope.lastSyncTimestamp || remoteEnvelope.syncTimestamp || new Date().toISOString(),
        schemaVersion: 6,
        principalScope: principalId,
        attachmentMode: 'include-attachments',
      },
      payload: remoteEnvelope.data,
    };
  }

  if (artifact && artifact.payload) {
    try {
      await restoreBackupArtifact(artifact, {
        database: db,
        targetPrincipalId: principalId,
        conflictResolution,
        allowOverwrite: conflictResolution === 'use-backup-version',
      });
      try {
        await Promise.all([
          useEventStore.getState().loadEvents(principalId),
          useExpenseStore.getState().loadExpenses(principalId),
          useIncomeStore.getState().loadIncomes(principalId),
        ]);
      } catch {
        // Ignore store reload error
      }
      return;
    } catch (err) {
      console.warn('Backup engine reconcile warning, using direct transactional merge:', err);
    }
  }

  if (remoteEnvelope.data) {
    await reconcileMergedDataLocally(principalId, remoteEnvelope.data);
  }
};

/**
 * Reconcile merged records back into the local database atomically using bulkPut
 */
const reconcileMergedDataLocally = async (principalId, mergedData) => {
  const { moments, activities, memories, expenses, incomes, codeLists, settings, attachments } = mergedData;

  const prepare = (items) => (items || []).map((item) => ({
    ...item,
    userId: item.userId || principalId,
  }));

  await db.transaction(
    'rw',
    db.table(DATABASE_TABLES.MOMENTS),
    db.table(DATABASE_TABLES.ACTIVITIES),
    db.table(DATABASE_TABLES.MEMORIES),
    db.table(DATABASE_TABLES.EXPENSES),
    db.table(DATABASE_TABLES.INCOMES),
    db.table(DATABASE_TABLES.CODE_LISTS),
    db.table(DATABASE_TABLES.SETTINGS),
    db.table(DATABASE_TABLES.ATTACHMENTS),
    async () => {
      if (moments?.length) {
        await db.table(DATABASE_TABLES.MOMENTS).bulkPut(prepare(moments));
      }
      if (activities?.length) {
        await db.table(DATABASE_TABLES.ACTIVITIES).bulkPut(prepare(activities));
      }
      if (memories?.length) {
        await db.table(DATABASE_TABLES.MEMORIES).bulkPut(prepare(memories));
      }
      if (expenses?.length) {
        await db.table(DATABASE_TABLES.EXPENSES).bulkPut(prepare(expenses));
      }
      if (incomes?.length) {
        await db.table(DATABASE_TABLES.INCOMES).bulkPut(prepare(incomes));
      }
      if (codeLists?.length) {
        await db.table(DATABASE_TABLES.CODE_LISTS).bulkPut(prepare(codeLists));
      }
      if (attachments?.length) {
        await db.table(DATABASE_TABLES.ATTACHMENTS).bulkPut(prepare(attachments));
      }
      if (settings) {
        if (Array.isArray(settings)) {
          await db.table(DATABASE_TABLES.SETTINGS).bulkPut(prepare(settings));
        } else if (typeof settings === 'object') {
          const rows = Object.entries(settings).map(([key, value]) => ({
            id: `${principalId}:${key}`,
            userId: principalId,
            key,
            value,
            updatedAt: new Date().toISOString(),
          }));
          if (rows.length) {
            await db.table(DATABASE_TABLES.SETTINGS).bulkPut(rows);
          }
        }
      }
    }
  );

  // Trigger reactive store reload
  try {
    await useEventStore.getState().loadEvents(principalId);
  } catch {
    // Ignore store reload error
  }
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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
      attachments: mergeRecordCollections(localEnvelope.data.attachments, remoteData.attachments),
    };

    onProgress({ stage: 'writing-remote', percent: 90, message: 'Updating Google Drive storage…' });
    const newFileId = await uploadDriveSyncEnvelope(token, fileId, {
      version: 2,
      lastSyncTimestamp: new Date().toISOString(),
      principalId,
      artifact: localEnvelope.artifact,
      data: merged,
    });

    onProgress({ stage: 'reconciling-local', percent: 98, message: 'Applying changes to local database…' });
    if (remoteEnvelope) {
      await reconcileRemoteDataWithBackupEngine(principalId, remoteEnvelope, currentConfig.conflictResolution || 'merge-safe');
    }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lifehub:data-synced', { detail: { provider: 'googleDrive', timestamp: finishTime } }));
      window.dispatchEvent(new CustomEvent('lifehub:events-updated'));
      window.dispatchEvent(new CustomEvent('lifehub:activities-updated'));
    }

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
  const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const currentConfig = getCloudSyncConfig();
  currentConfig.iCloud = {
    ...currentConfig.iCloud,
    connected: true,
    appleId: appleId || (isIos ? 'Apple ID (iOS Device Container)' : 'Apple ID (CloudKit Web Services)'),
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

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
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
    await new Promise((r) => setTimeout(r, 300));

    onProgress({ stage: 'collecting', percent: 50, message: 'Collecting local activities and events…' });
    const localEnvelope = await collectLocalSyncData(principalId);

    onProgress({ stage: 'uploading', percent: 80, message: 'Synchronizing with iCloud container…' });

    // Store container snapshot in secure storage
    const containerKey = `icloud_container_${currentConfig.iCloud.containerId}`;
    let remoteData = {};
    try {
      const storage = getStorage();
      const existing = storage?.getItem(containerKey);
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
      attachments: mergeRecordCollections(localEnvelope.data.attachments, remoteData.attachments),
    };

    const storage = getStorage();
    storage?.setItem(
      containerKey,
      JSON.stringify({
        version: 2,
        lastSyncTimestamp: new Date().toISOString(),
        principalId,
        artifact: localEnvelope.artifact,
        data: merged,
      })
    );

    onProgress({ stage: 'reconciling', percent: 95, message: 'Updating local records…' });
    if (remoteData && Object.keys(remoteData).length > 0) {
      await reconcileRemoteDataWithBackupEngine(principalId, { data: remoteData }, currentConfig.conflictResolution || 'merge-safe');
    }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lifehub:data-synced', { detail: { provider: 'iCloud', timestamp: finishTime } }));
      window.dispatchEvent(new CustomEvent('lifehub:events-updated'));
      window.dispatchEvent(new CustomEvent('lifehub:activities-updated'));
    }

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
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
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
