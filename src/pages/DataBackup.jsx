import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ModalDialog from '../components/common/ModalDialog';
import DropdownSelect from '../components/common/DropdownSelect';
import { Activity, Archive, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert, Cloud, Database, Download, FileCheck2, HardDrive, Heart, Layers3, RefreshCw, ShieldCheck, Smartphone, Upload, WalletCards, X } from 'lucide-react';
import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { getDatabaseVersionInfo } from '../database/versioning.js';
import { createBackupArtifact, previewRestoreBackup, restoreBackupArtifact, validateBackupArtifact, verifyBackupArtifactIntegrity } from '../services/backupService.js';
import {
  getCloudSyncConfig,
  saveCloudSyncConfig,
  connectGoogleDrive,
  disconnectGoogleDrive,
  syncWithGoogleDrive,
  connectICloud,
  disconnectICloud,
  syncWithICloud,
} from '../services/cloudSyncService.js';
import useAppStore from '../store/useAppStore.js';
import { buildBackupFilename } from '../utils/backupFilename.js';
import { downloadBlob } from '../utils/download.js';
import { isGoogleDriveConfigured, pickBackupFromGoogleDrive, primeGoogleDrive, saveBackupToFiles, uploadBackupToGoogleDrive } from '../services/googleDriveBackup.js';
import './data-backup.css';

const BACKUP_STATUS_KEY = 'lifehub_last_backup_status';
const readSavedBackupStatus = () => {
  try { return JSON.parse(localStorage.getItem(BACKUP_STATUS_KEY) || 'null'); } catch { return null; }
};
const writeSavedBackupStatus = (value) => {
  try { localStorage.setItem(BACKUP_STATUS_KEY, JSON.stringify(value)); } catch { /* Status is optional; backup files remain authoritative. */ }
};
const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return 'Unavailable';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let amount = bytes / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) { amount /= 1024; unit = units[index]; }
  return `${amount.toFixed(1)} ${unit}`;
};
const prettyDate = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'No backup created yet';
const readArtifact = async (file) => JSON.parse(await file.text());
const getFilenameDeviceName = (filename = '') => {
  const match = filename.match(/^DN_Backup_\d{8}_(.+)_\d{6}\.json$/i);
  return match ? match[1].replace(/_/g, ' ') : null;
};
const DOMAIN_LABELS = {
  [DATABASE_TABLES.MOMENTS]: 'Moments',
  [DATABASE_TABLES.ACTIVITIES]: 'Activities',
  [DATABASE_TABLES.MEMORIES]: 'Memories',
  [DATABASE_TABLES.ATTACHMENTS]: 'Keepsakes',
  [DATABASE_TABLES.EXPENSES]: 'Expenses',
  [DATABASE_TABLES.INCOMES]: 'Income',
  [DATABASE_TABLES.SETTINGS]: 'Preferences',
  [DATABASE_TABLES.CODE_LISTS]: 'Categories & lists',
  [DATABASE_TABLES.METADATA]: 'App metadata',
  [DATABASE_TABLES.SYNC_JOURNAL]: 'Sync Journal',
  [DATABASE_TABLES.SYNC_TOMBSTONES]: 'Sync Tombstones',
  [DATABASE_TABLES.SYNC_CONFLICTS]: 'Sync Conflicts',
  [DATABASE_TABLES.MIGRATION_AUDIT]: 'Migration Audit',
  [DATABASE_TABLES.GUEST_LINEAGE]: 'Guest Lineage',
};
const DATA_ITEMS = [
  { key: 'moments', label: 'Moments', icon: CalendarDays },
  { key: 'activities', label: 'Activities', icon: Activity },
  { key: 'memories', label: 'Memories', icon: Heart },
  { key: 'expenses', label: 'Expenses', icon: WalletCards },
  { key: 'incomes', label: 'Income', icon: Archive },
];
const CONFIG_ITEMS = [
  ['eventTypes', 'Event Types'],
  ['expenseCategories', 'Expense Categories'],
  ['incomeTypes', 'Income Types'],
  ['activityPriorities', 'Activity Priorities'],
  ['reminderPresets', 'Reminder Presets'],
  ['settings', 'Settings'],
];
const DIAGNOSTIC_TABLES = [
  [DATABASE_TABLES.METADATA, 'Metadata'],
  [DATABASE_TABLES.SYNC_JOURNAL, 'Sync Journal'],
  [DATABASE_TABLES.SYNC_TOMBSTONES, 'Sync Tombstones'],
  [DATABASE_TABLES.SYNC_CONFLICTS, 'Sync Conflicts'],
  [DATABASE_TABLES.MIGRATION_AUDIT, 'Migration Audit'],
  [DATABASE_TABLES.GUEST_LINEAGE, 'Guest Lineage'],
];
const PERSONAL_BACKUP_DOMAINS = new Set([
  DATABASE_TABLES.MOMENTS,
  DATABASE_TABLES.ACTIVITIES,
  DATABASE_TABLES.MEMORIES,
  DATABASE_TABLES.ATTACHMENTS,
  DATABASE_TABLES.EXPENSES,
  DATABASE_TABLES.INCOMES,
  DATABASE_TABLES.SETTINGS,
  DATABASE_TABLES.CODE_LISTS,
]);
const summarizeConflicts = (conflicts = []) => Object.entries(conflicts.reduce((groups, conflict) => {
  const label = DOMAIN_LABELS[conflict.domain] || 'Other records';
  groups[label] = (groups[label] || 0) + 1;
  return groups;
}, {})).map(([domain, count]) => ({ domain, count }));

export default function DataBackup() {
  const principal = useAppStore((state) => state.principal);
  const principalId = useAppStore((state) => state.principalId);
  const persistentReady = useAppStore((state) => state.persistentReady);
  const updateDeviceName = useAppStore((state) => state.updateDeviceName);
  const showToast = useAppStore((state) => state.showToast);
  const [health, setHealth] = useState({ loading: true, counts: {}, error: '' });
  const [storage, setStorage] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceName, setDeviceName] = useState(principal?.deviceName || '');
  const [verificationStatus, setVerificationStatus] = useState(() => Boolean(readSavedBackupStatus()?.verified));
  const [lastVerified, setLastVerified] = useState(() => readSavedBackupStatus()?.verifiedAt || null);
  const [protectionBackup, setProtectionBackup] = useState(() => readSavedBackupStatus());
  const [restoreCandidate, setRestoreCandidate] = useState(null);
  const [restoreFilename, setRestoreFilename] = useState('');
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoreResolution, setRestoreResolution] = useState('keep-existing');
  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get('section');
  const [activeSection, setActiveSection] = useState(() => requestedSection || 'overview');

  useEffect(() => {
    if (requestedSection) {
      setActiveSection(requestedSection);
    }
  }, [requestedSection]);

  const [syncConfig, setSyncConfig] = useState(() => getCloudSyncConfig());
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleProgress, setGoogleProgress] = useState(null);
  const [iCloudSyncing, setICloudSyncing] = useState(false);
  const [iCloudProgress, setICloudProgress] = useState(null);
  const [iCloudModalOpen, setICloudModalOpen] = useState(false);
  const [appleIdDraft, setAppleIdDraft] = useState('');

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) setSyncConfig(e.detail);
    };
    window.addEventListener('lifehub:sync-config-updated', handleUpdate);
    return () => window.removeEventListener('lifehub:sync-config-updated', handleUpdate);
  }, []);

  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
  const [restoreSourceDialogOpen, setRestoreSourceDialogOpen] = useState(false);
  const [pendingBackup, setPendingBackup] = useState(null);
  const [attachmentMode, setAttachmentMode] = useState('metadata-only');
  const restoreFileInput = useRef(null);

  useEffect(() => setDeviceName(principal?.deviceName || ''), [principal?.deviceName]);

  const refreshHealth = useCallback(async () => {
    setHealth((current) => ({ ...current, loading: true, error: '' }));
    try {
      if (!db.isOpen()) await db.open();
      const [moments, activities, memories, expenses, incomes, codeListRows, settingsCount, ...diagnosticCounts] = await Promise.all([
        db.table(DATABASE_TABLES.MOMENTS).where('userId').equals(principalId).count(),
        db.table(DATABASE_TABLES.ACTIVITIES).where('userId').equals(principalId).count(),
        db.table(DATABASE_TABLES.MEMORIES).where('userId').equals(principalId).count(),
        db.table(DATABASE_TABLES.EXPENSES).where('userId').equals(principalId).count(),
        db.table(DATABASE_TABLES.INCOMES).where('userId').equals(principalId).count(),
        db.table(DATABASE_TABLES.CODE_LISTS).where('userId').equals(principalId).toArray(),
        db.table(DATABASE_TABLES.SETTINGS).where('userId').equals(principalId).count(),
        ...DIAGNOSTIC_TABLES.map(([table]) => db.table(table).count()),
      ]);
      const codeLists = Object.fromEntries(CONFIG_ITEMS.map(([listKey, label]) => [label, listKey === 'settings' ? settingsCount : codeListRows.filter((row) => row.listKey === listKey).length]));
      const diagnostics = Object.fromEntries(DIAGNOSTIC_TABLES.map(([, label], index) => [label, diagnosticCounts[index]]));
      setHealth({ loading: false, error: '', counts: { moments, activities, memories, expenses, incomes }, codeLists, diagnostics });
      setStorage(navigator.storage?.estimate ? await navigator.storage.estimate() : null);
    } catch (error) {
      setHealth({ loading: false, counts: {}, codeLists: {}, diagnostics: {}, error: error?.message || 'Your local data could not be checked.' });
    }
  }, [principalId]);

  useEffect(() => { if (persistentReady && principalId) void refreshHealth(); }, [persistentReady, principalId, refreshHealth]);

  const prepareBackup = async () => {
    if (!principalId) return;
    setBusy(true);
    setStatus('');
    try {
      const artifact = await createBackupArtifact({ database: db, principalId, reason: 'manual-local-backup', attachmentMode });
      const filename = buildBackupFilename(new Date(), principal?.deviceName);
      const integrity = await verifyBackupArtifactIntegrity(artifact);
      if (!integrity.valid) throw new Error('The backup could not be verified, so it was not downloaded.');
      const personalRecordCount = [...PERSONAL_BACKUP_DOMAINS].reduce((count, domain) => count + (artifact.payload[domain]?.length || 0), 0);
      const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: 'application/json' });
      const info = { filename, createdAt: artifact.createdAt, deviceName: principal?.deviceName || getFilenameDeviceName(filename), recordCount: personalRecordCount, verified: true, verifiedAt: new Date().toISOString() };
      setPendingBackup({ blob, filename, info, attachmentMode });
      setDestinationDialogOpen(true);
    } catch (error) {
      setStatus(error?.message || 'Backup creation failed.');
      showToast('Backup creation failed', 'danger');
    } finally { setBusy(false); }
  };

  const savePreparedBackup = async (destination) => {
    if (!pendingBackup) return;
    setBusy(true);
    let destinationMessage = '';
    try {
      if (destination === 'device') {
        downloadBlob(pendingBackup.blob, pendingBackup.filename);
      } else if (destination === 'icloud') {
        const result = await saveBackupToFiles(pendingBackup);
        if (result === 'unsupported') {
          downloadBlob(pendingBackup.blob, pendingBackup.filename);
          destinationMessage = 'Backup downloaded. Move it to iCloud Drive using Files.';
        }
      } else if (destination === 'google') {
        await uploadBackupToGoogleDrive(pendingBackup);
      }
      const info = pendingBackup.info;
      setProtectionBackup(info);
      setVerificationStatus(true);
      setLastVerified(info.verifiedAt);
      writeSavedBackupStatus(info);
      setDestinationDialogOpen(false);
      setPendingBackup(null);
      if (destination === 'google') showToast('Backup saved to Google Drive', 'success');
      else if (destination === 'icloud') showToast(destinationMessage || 'Choose Save to Files, then iCloud Drive.', 'success', { duration: 4000 });
      else showToast('Backup downloaded to this device', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      showToast(error?.message || 'Backup destination failed.', 'danger');
    } finally { setBusy(false); }
  };

  const cancelBackupDestination = () => {
    setDestinationDialogOpen(false);
    setPendingBackup(null);
  };

  const verifyFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const artifact = await readArtifact(file);
      const [validation, integrity] = await Promise.all([validateBackupArtifact(artifact), verifyBackupArtifactIntegrity(artifact)]);
      const isVerified = Boolean(validation.valid && integrity.valid);
      if (isVerified) {
        const verifiedAt = new Date().toISOString();
        const backupRecordCount = [...PERSONAL_BACKUP_DOMAINS].reduce((count, domain) => count + (artifact.payload?.[domain]?.length || 0), 0);
        const verifiedBackup = {
          filename: file.name,
          createdAt: artifact.createdAt || artifact.manifest?.createdAt || null,
          deviceName: artifact.manifest?.deviceName || artifact.deviceName || getFilenameDeviceName(file.name) || 'DN device',
          recordCount: backupRecordCount,
          attachmentMode: artifact.manifest?.attachmentMode || 'metadata-only',
          verified: true,
          verifiedAt,
        };
        setVerificationStatus(true);
        setLastVerified(verifiedAt);
        setProtectionBackup(verifiedBackup);
        writeSavedBackupStatus(verifiedBackup);
        showToast('Backup verified', 'success', { duration: 3500 });
      } else {
        showToast('Backup verification needs attention', 'danger');
      }
    } catch (error) {
      showToast(error?.message || 'This file could not be verified.', 'danger');
    } finally { setBusy(false); }
  };

  const prepareRestore = async (file) => {
    setRestoreCandidate(null);
    setRestoreFilename('');
    setRestorePreview(null);
    setRestoreResolution('keep-existing');
    if (!file) return;
    setBusy(true);
    setStatus('');
    try {
      const artifact = await readArtifact(file);
      const validation = await validateBackupArtifact(artifact);
      if (!validation.valid) throw new Error('This backup could not be validated. Choose a verified DN backup file.');
      const preview = await previewRestoreBackup(artifact, { database: db, targetPrincipalId: principalId });
      setRestoreCandidate(artifact);
      setRestoreFilename(file.name);
      setRestorePreview(preview);
      setStatus('');
    } catch (error) {
      setStatus(error?.message || 'Could not prepare this backup for restore.');
    } finally { setBusy(false); }
  };

  const restoreBackup = async () => {
    if (!restoreCandidate || !restorePreview || !principalId) return;
    const approved = window.confirm('Restore the selected backup to this device?');
    if (!approved) return;
    setBusy(true);
    try {
      await restoreBackupArtifact(restoreCandidate, {
        database: db,
        targetPrincipalId: principalId,
        conflictResolution: restoreResolution,
        ...(restoreResolution === 'use-backup-version' ? { allowOverwrite: true } : {}),
      });
      setStatus('Your backup has been restored. Reloading your local data…');
      showToast('Backup restored', 'success');
      window.location.reload();
    } catch (error) {
      console.error('Backup restore failed:', error);
      setStatus('We couldn’t complete the restore. Your existing data is still available. Review your choices and try again.');
      showToast('Backup restore failed', 'danger');
    } finally { setBusy(false); }
  };

  const saveDeviceName = async () => {
    try { await updateDeviceName(deviceName); showToast('Device name saved', 'success'); }
    catch (error) { setStatus(error?.message || 'Device name could not be saved.'); }
  };

  const handleConnectGoogle = async () => {
    try {
      setGoogleProgress({ message: 'Authorizing with Google…' });
      await connectGoogleDrive();
      setSyncConfig(getCloudSyncConfig());
      showToast('Connected to Google Drive', 'success');
      await handleSyncGoogle();
    } catch (err) {
      showToast(err.message || 'Google Drive connection failed', 'danger');
    } finally {
      setGoogleProgress(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await disconnectGoogleDrive();
      setSyncConfig(getCloudSyncConfig());
      showToast('Google Drive disconnected', 'success');
    } catch {
      showToast('Failed to disconnect Google Drive', 'danger');
    }
  };

  const handleSyncGoogle = async () => {
    if (googleSyncing) return;
    setGoogleSyncing(true);
    try {
      const result = await syncWithGoogleDrive((progress) => {
        setGoogleProgress(progress);
      });
      setSyncConfig(getCloudSyncConfig());
      void refreshHealth();
      showToast(
        `Google Drive synced (${result.syncedCounts.moments} moments, ${result.syncedCounts.activities} activities)`,
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Google Drive sync failed', 'danger');
    } finally {
      setGoogleSyncing(false);
      setGoogleProgress(null);
    }
  };

  const handleToggleGoogleAutoSync = () => {
    const updated = {
      ...syncConfig,
      googleDrive: {
        ...syncConfig.googleDrive,
        autoSync: !syncConfig.googleDrive.autoSync,
      },
    };
    saveCloudSyncConfig(updated);
    setSyncConfig(updated);
    showToast(
      updated.googleDrive.autoSync ? 'Google Drive auto-sync enabled' : 'Auto-sync disabled',
      'success'
    );
  };

  const handleConnectICloud = async () => {
    try {
      await connectICloud({ appleId: appleIdDraft });
      setSyncConfig(getCloudSyncConfig());
      setICloudModalOpen(false);
      showToast('Connected to iCloud container', 'success');
      await handleSyncICloud();
    } catch (err) {
      showToast(err.message || 'iCloud connection failed', 'danger');
    }
  };

  const handleDisconnectICloud = async () => {
    try {
      await disconnectICloud();
      setSyncConfig(getCloudSyncConfig());
      showToast('iCloud disconnected', 'success');
    } catch {
      showToast('Failed to disconnect iCloud', 'danger');
    }
  };

  const handleSyncICloud = async () => {
    if (iCloudSyncing) return;
    setICloudSyncing(true);
    try {
      const result = await syncWithICloud((progress) => {
        setICloudProgress(progress);
      });
      setSyncConfig(getCloudSyncConfig());
      void refreshHealth();
      showToast(
        `iCloud synced (${result.syncedCounts.moments} moments, ${result.syncedCounts.activities} activities)`,
        'success'
      );
    } catch (err) {
      showToast(err.message || 'iCloud sync failed', 'danger');
    } finally {
      setICloudSyncing(false);
      setICloudProgress(null);
    }
  };

  const handleToggleICloudAutoSync = () => {
    const updated = {
      ...syncConfig,
      iCloud: {
        ...syncConfig.iCloud,
        autoSync: !syncConfig.iCloud.autoSync,
      },
    };
    saveCloudSyncConfig(updated);
    setSyncConfig(updated);
    showToast(
      updated.iCloud.autoSync ? 'iCloud auto-sync enabled' : 'Auto-sync disabled',
      'success'
    );
  };

  const handleConflictResolutionChange = (resolution) => {
    const updated = {
      ...syncConfig,
      conflictResolution: resolution,
    };
    saveCloudSyncConfig(updated);
    setSyncConfig(updated);
    showToast(`Sync conflict resolution set to ${resolution}`, 'success');
  };

  const renderCloudSync = () => (
    <section className="db-actions-section" aria-labelledby="db-sync-title">
      <div className="db-section-heading">
        <h2 id="db-sync-title">Cloud Sync (Google Drive &amp; iCloud)</h2>
        <p>Keep your entire life library automatically synchronized and backed up across devices.</p>
      </div>

      <div className="space-y-4">
        {/* Google Drive Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Database size={20} />
              </span>
              <div>
                <strong className="block text-sm text-slate-900 dark:text-slate-100">Google Drive</strong>
                <small className="text-xs text-slate-500 dark:text-slate-400">
                  {syncConfig.googleDrive.connected
                    ? `Connected · ${syncConfig.googleDrive.userEmail || syncConfig.googleDrive.userName || 'Authorized account'}`
                    : 'Not connected'}
                </small>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                syncConfig.googleDrive.connected
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {syncConfig.googleDrive.connected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last synced: <strong>{prettyDate(syncConfig.googleDrive.lastSyncTime)}</strong>
          </div>

          {googleProgress && (
            <div className="text-xs p-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center gap-2">
              <RefreshCw size={13} className="animate-spin" />
              <span>{googleProgress.message || 'Syncing with Google Drive…'}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {syncConfig.googleDrive.connected ? (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(syncConfig.googleDrive.autoSync)}
                    onChange={handleToggleGoogleAutoSync}
                    className="rounded text-emerald-600"
                  />
                  <span>Auto-sync enabled</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncGoogle}
                    disabled={googleSyncing}
                    className="primaryButton text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} className={googleSyncing ? 'animate-spin' : ''} />
                    <span>{googleSyncing ? 'Syncing…' : 'Sync Now'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="secondaryButton text-xs py-1.5 px-2.5"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="primaryButton text-xs py-1.5 px-3"
              >
                Connect Google Drive
              </button>
            )}
          </div>
        </div>

        {/* iCloud Card */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                <HardDrive size={20} />
              </span>
              <div>
                <strong className="block text-sm text-slate-900 dark:text-slate-100">Apple iCloud</strong>
                <small className="text-xs text-slate-500 dark:text-slate-400">
                  {syncConfig.iCloud.connected
                    ? `Connected · ${syncConfig.iCloud.appleId || 'iCloud Container'}`
                    : 'Not connected'}
                </small>
              </div>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                syncConfig.iCloud.connected
                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {syncConfig.iCloud.connected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Last synced: <strong>{prettyDate(syncConfig.iCloud.lastSyncTime)}</strong>
          </div>

          {iCloudProgress && (
            <div className="text-xs p-2 rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 flex items-center gap-2">
              <RefreshCw size={13} className="animate-spin" />
              <span>{iCloudProgress.message || 'Syncing with iCloud…'}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {syncConfig.iCloud.connected ? (
              <>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(syncConfig.iCloud.autoSync)}
                    onChange={handleToggleICloudAutoSync}
                    className="rounded text-sky-600"
                  />
                  <span>Auto-sync enabled</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncICloud}
                    disabled={iCloudSyncing}
                    className="primaryButton text-xs py-1.5 px-3 flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700"
                  >
                    <RefreshCw size={13} className={iCloudSyncing ? 'animate-spin' : ''} />
                    <span>{iCloudSyncing ? 'Syncing…' : 'Sync Now'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectICloud}
                    className="secondaryButton text-xs py-1.5 px-2.5"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setICloudModalOpen(true)}
                className="primaryButton text-xs py-1.5 px-3 bg-sky-600 hover:bg-sky-700"
              >
                Connect Apple iCloud
              </button>
            )}
          </div>
        </div>

        {/* Conflict Resolution Policy Selector */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Sync &amp; Import Conflict Resolution</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose how LifeHub handles conflicting items when synchronizing with cloud or importing files.
            </p>
          </div>

          <fieldset className="db-resolution">
            <legend className="sr-only">Choose conflict resolution policy</legend>
            <label className={syncConfig.conflictResolution === 'merge-safe' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="cloud-sync-resolution"
                value="merge-safe"
                checked={syncConfig.conflictResolution === 'merge-safe'}
                onChange={() => handleConflictResolutionChange('merge-safe')}
              />
              <span>
                <strong>Merge Safe Data (Recommended)</strong>
                <small>Import all non-conflicting items and preserve current local records for conflicts.</small>
              </span>
              <Check size={16} aria-hidden="true" />
            </label>
            <label className={syncConfig.conflictResolution === 'use-backup-version' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="cloud-sync-resolution"
                value="use-backup-version"
                checked={syncConfig.conflictResolution === 'use-backup-version'}
                onChange={() => handleConflictResolutionChange('use-backup-version')}
              />
              <span>
                <strong>Use Cloud Version</strong>
                <small>Replace conflicting local records with the latest cloud / imported version.</small>
              </span>
              <Check size={16} aria-hidden="true" />
            </label>
            <label className={syncConfig.conflictResolution === 'keep-existing' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="cloud-sync-resolution"
                value="keep-existing"
                checked={syncConfig.conflictResolution === 'keep-existing'}
                onChange={() => handleConflictResolutionChange('keep-existing')}
              />
              <span>
                <strong>Keep Local Data</strong>
                <small>Keep current local versions unchanged for any conflicting records.</small>
              </span>
              <Check size={16} aria-hidden="true" />
            </label>
          </fieldset>
        </div>

        {/* Data Scope Note */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
          <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong>100% of User Data Protected:</strong> Every single record—moments, standalone activities, memories, expenses, incomes, custom code lists, attachments, and preferences—is synced and backed up together using LifeHub's verified conflict resolution engine.
          </div>
        </div>
      </div>

      {iCloudModalOpen && (
        <ModalDialog title="Connect to Apple iCloud" onClose={() => setICloudModalOpen(false)}>
          <div className="space-y-3.5">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Connect your iCloud Drive or CloudKit container to synchronize your LifeHub records across Apple and web devices.
            </p>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Apple ID or Account Note <span className="event-form-optional">Optional</span>
              <input
                type="text"
                value={appleIdDraft}
                onChange={(e) => setAppleIdDraft(e.target.value)}
                placeholder="e.g. user@icloud.com"
                className="w-full mt-1"
                autoFocus
              />
            </label>
            <div className="dialog-actions pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setICloudModalOpen(false)}
                className="secondaryButton"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnectICloud}
                className="primaryButton bg-sky-600 hover:bg-sky-700"
              >
                Connect Container
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </section>
  );

  const versionInfo = getDatabaseVersionInfo();
  const healthy = persistentReady && !health.loading && !health.error;
  const totalRecords = Object.values(health.counts).reduce((total, count) => total + count, 0);
  const configurationItemCount = Object.values(health.codeLists || {}).reduce((total, count) => total + count, 0);
  const storageUsedPercent = storage?.quota ? Math.min(100, Math.round((storage.usage / storage.quota) * 100)) : 0;
  const platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || 'This device';
  const friendlyConflicts = useMemo(() => summarizeConflicts(restorePreview?.conflicts || []), [restorePreview]);
  const canResolveRestore = Boolean(restorePreview && (restorePreview.canRestore || restorePreview.conflicts?.every((conflict) => conflict.reason === 'id-conflict')));
  const hasRestoreConflicts = Number(restorePreview?.summary?.conflicted || 0) > 0;
  const restoreProtectedRecordCount = [...PERSONAL_BACKUP_DOMAINS].reduce((count, domain) => count + (restoreCandidate?.payload?.[domain]?.length || 0), 0);

  const renderProtection = () => (
    <section className="db-protection-card" aria-label="Data protection status">
      <div className="db-protection-status">
        <ShieldCheck size={20} aria-hidden="true" />
        <strong>{verificationStatus ? 'Backup file verified' : 'No verified backup file'}</strong>
      </div>
      <div className="db-protection-facts">
        <div><span>Backup Created</span><strong>{prettyDate(protectionBackup?.createdAt)}</strong></div>
        <div><span>File Integrity</span><strong className={verificationStatus ? 'is-verified' : ''}>{verificationStatus ? <><CheckCircle2 size={15} aria-label="Verified" />{lastVerified ? <small>Checked {prettyDate(lastVerified)}</small> : null}</> : 'Not verified'}</strong></div>
        <div><span>Device</span><strong>{protectionBackup?.deviceName || getFilenameDeviceName(protectionBackup?.filename || '') || principal?.deviceName || 'This device'}</strong></div>
        <div><span>Records in File</span><strong>{Number(protectionBackup?.recordCount || 0).toLocaleString()}</strong></div>
      </div>
      <p className="db-protection-freshness-note">Verification checks this backup file’s integrity; it does not confirm that it includes changes made after the backup date.</p>
    </section>
  );

  const renderBackup = () => (
    <>
      <section className="db-actions-section" aria-labelledby="db-actions-title">
        <div className="db-section-heading"><h2 id="db-actions-title">Backup &amp; Restore</h2><p>Everything stays in your hands.</p></div>
        <label className="db-attachment-backup-mode"><span>Attachment backup</span><DropdownSelect value={attachmentMode} disabled={busy} onChange={(event) => setAttachmentMode(event.target.value)} aria-label="Attachment backup mode"><option value="metadata-only">Metadata Only · references only</option><option value="include-attachments">Include Attachments · local copies only</option></DropdownSelect></label>
        <div className="db-action-grid">
          <button className={`db-action-card db-action-create ${!verificationStatus ? 'is-primary' : ''}`} type="button" disabled={busy || !principalId} onClick={() => void prepareBackup()}>
            <span className="db-action-icon"><Download size={19} /></span><span className="db-action-copy"><strong>{busy ? 'Preparing backup…' : verificationStatus ? 'Create another backup' : 'Create Backup'}</strong><small>{verificationStatus ? 'Save a fresh copy of your data' : 'Private, verified and saved to your device'}</small></span><ChevronRight className="db-action-arrow" size={17} />
          </button>
          <button className="db-action-card db-action-restore" type="button" disabled={busy} onClick={() => setRestoreSourceDialogOpen(true)}><span className="db-action-icon"><Upload size={19} /></span><span className="db-action-copy"><strong>{restoreCandidate ? 'Choose a different backup' : 'Restore Backup'}</strong><small>{restoreCandidate ? 'Select another file' : 'Choose where to import from'}</small></span><ChevronRight className="db-action-arrow" size={17} /></button>
          <label className="db-action-card db-action-verify"><span className="db-action-icon"><FileCheck2 size={19} /></span><span className="db-action-copy"><strong>Verify Backup</strong><small>Check a backup file’s integrity</small></span><ChevronRight className="db-action-arrow" size={17} /><input type="file" accept="application/json,.json" hidden disabled={busy} onChange={(event) => void verifyFile(event.target.files?.[0])} /></label>
        </div>
      </section>

      {restoreCandidate && restorePreview ? <section className="db-card db-restore-preview-card" aria-labelledby="db-restore-title">
        <div className="db-restore-title-row"><div><h2 id="db-restore-title">Restore Preview</h2><p>Review this backup before restoring.</p></div><button type="button" className="db-text-button" onClick={() => { setRestoreCandidate(null); setRestoreFilename(''); setRestorePreview(null); setRestoreResolution('keep-existing'); setStatus(''); }}>Clear</button></div>
        <div className="db-preview-meta">
          <div><span>Backup Date</span><strong>{prettyDate(restoreCandidate.createdAt || restoreCandidate.manifest?.createdAt)}</strong></div>
          <div><span>Device</span><strong>{restoreCandidate.manifest?.deviceName || restoreCandidate.deviceName || getFilenameDeviceName(restoreFilename) || 'DN device'}</strong></div>
          <div><span>Protected Records</span><strong>{restoreProtectedRecordCount.toLocaleString()}</strong></div>
        </div>
        <div className="db-preview-contains"><h3>Contains</h3><div>{['Moments', 'Activities', 'Memories', 'Attachments', 'Expenses', 'Income', 'Configuration'].map((item) => <span key={item}>{item}</span>)}</div></div>
        {hasRestoreConflicts ? <>
          <div className="db-conflict-summary" role="status"><strong>{restorePreview.summary.conflicted} {restorePreview.summary.conflicted === 1 ? 'conflict needs' : 'conflicts need'} your attention</strong>{friendlyConflicts.map(({ domain, count }) => <span key={domain}>{domain} · {count} {count === 1 ? 'item' : 'items'}</span>)}</div>
          <fieldset className="db-resolution"><legend>Choose how to resolve conflicts</legend>
            <label className={restoreResolution === 'keep-existing' ? 'is-selected' : ''}><input type="radio" name="restore-resolution" value="keep-existing" checked={restoreResolution === 'keep-existing'} onChange={() => setRestoreResolution('keep-existing')} /><span><strong>Keep Existing Data</strong><small>Keep the current version of conflicting items.</small></span><Check size={16} aria-hidden="true" /></label>
            <label className={restoreResolution === 'use-backup-version' ? 'is-selected' : ''}><input type="radio" name="restore-resolution" value="use-backup-version" checked={restoreResolution === 'use-backup-version'} onChange={() => setRestoreResolution('use-backup-version')} /><span><strong>Use Backup Version</strong><small>Replace conflicting items with the backup version.</small></span><Check size={16} aria-hidden="true" /></label>
            <label className={restoreResolution === 'merge-safe' ? 'is-selected' : ''}><input type="radio" name="restore-resolution" value="merge-safe" checked={restoreResolution === 'merge-safe'} onChange={() => setRestoreResolution('merge-safe')} /><span><strong>Merge Safe Data</strong><small>Add non-conflicting items and keep current versions.</small></span><Check size={16} aria-hidden="true" /></label>
          </fieldset>
        </> : <div className="db-ready-to-restore"><CheckCircle2 size={17} /><strong>Ready to Restore</strong></div>}
        <button type="button" className="db-primary-button db-restore-button" disabled={busy || !canResolveRestore} onClick={() => void restoreBackup()}><Upload size={16} />Restore to this device</button>
        <p className="db-privacy-note"><ShieldCheck size={14} />Nothing changes until you confirm the restore.</p>
      </section> : null}

      <input ref={restoreFileInput} type="file" accept="application/json,.json" hidden disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; setRestoreSourceDialogOpen(false); void prepareRestore(file); }} />

      {destinationDialogOpen ? <ModalDialog title="Create Backup" onClose={cancelBackupDestination} className="db-destination-dialog">
        <p className="db-destination-intro">Choose where to save this verified backup. DN keeps your data on this device; this does not turn on sync.</p>
        <div className="db-destination-options">
          <button type="button" disabled={busy} onClick={() => pendingBackup ? void savePreparedBackup('device') : void prepareBackup()}><Download size={18} /><span><strong>Save to Device</strong><small>Download the backup file</small></span><ChevronRight size={17} /></button>
          <button type="button" disabled={busy} onClick={() => pendingBackup ? void savePreparedBackup('icloud') : void prepareBackup()}><HardDrive size={18} /><span><strong>Save to iCloud Drive</strong><small>Choose Save to Files, then iCloud Drive</small></span><ChevronRight size={17} /></button>
          <button type="button" disabled={busy} onClick={() => pendingBackup ? void savePreparedBackup('google') : void prepareBackup()}><Database size={18} /><span><strong>Save to Google Drive</strong><small>{isGoogleDriveConfigured() ? 'Google is used only for this file transfer' : 'Requires Google Drive setup for this DN deployment'}</small></span><ChevronRight size={17} /></button>
        </div>
        {busy ? <p className="db-destination-progress" role="status">Preparing verified backup…</p> : null}
      </ModalDialog> : null}

      {restoreSourceDialogOpen ? <ModalDialog title="Restore Backup" onClose={() => setRestoreSourceDialogOpen(false)} className="db-destination-dialog">
        <p className="db-destination-intro">Choose a source. The selected file will use DN’s existing validation and restore preview.</p>
        <div className="db-destination-options">
          <button type="button" onClick={() => { setRestoreSourceDialogOpen(false); restoreFileInput.current?.click(); }}><Upload size={18} /><span><strong>Import from Device</strong><small>Choose a backup file stored on this device</small></span><ChevronRight size={17} /></button>
          <button type="button" onClick={() => { setRestoreSourceDialogOpen(false); restoreFileInput.current?.click(); }}><HardDrive size={18} /><span><strong>Import from iCloud Drive</strong><small>Choose iCloud Drive in the system file picker</small></span><ChevronRight size={17} /></button>
          <button type="button" onClick={() => { setRestoreSourceDialogOpen(false); void pickBackupFromGoogleDrive().then((file) => file && prepareRestore(file)).catch((error) => showToast(error?.message || 'Google Drive import failed.', 'danger')); }}><Database size={18} /><span><strong>Import from Google Drive</strong><small>{isGoogleDriveConfigured() ? 'Select a DN backup file in Google Drive' : 'Requires Google Drive setup for this DN deployment'}</small></span><ChevronRight size={17} /></button>
        </div>
      </ModalDialog> : null}
    </>
  );

  const renderData = () => (
    <section className="db-card db-protected-content" aria-labelledby="db-content-title">
      <div className="db-card-heading"><span className="db-card-icon"><Database size={19} /></span><div><h2 id="db-content-title">Your Data</h2><p>Your personal library and configuration included in backups</p></div><span className="db-content-total">{health.loading ? '…' : `${totalRecords + configurationItemCount} items`}</span></div>
      {health.error ? <div className="db-error"><CircleAlert size={16} /><span>We couldn’t check your local content.</span><button type="button" onClick={() => void refreshHealth()}>Try again</button></div> : health.loading ? <div className="db-skeleton" aria-label="Checking your saved content" /> : <>
        <div className="db-data-grid">{DATA_ITEMS.map(({ key, label, icon: Icon }) => <div className="db-data-item" key={key}><span className="db-data-icon"><Icon size={16} /></span><span>{label}</span><strong>{health.counts[key] || 0}</strong></div>)}</div>
        <div className="db-configuration"><div><h3>Configuration Items</h3><p>{configurationItemCount} items across your saved settings and lists</p></div><div className="db-config-grid">{CONFIG_ITEMS.map(([, label]) => <div className="db-config-item" key={label}><span>{label}</span><Check size={14} aria-hidden="true" /></div>)}</div></div>
      </>}
    </section>
  );

  const renderDevice = () => (
    <section className="db-card db-device-card" aria-labelledby="db-device-title">
      <div className="db-card-heading"><span className="db-card-icon db-icon-violet"><Smartphone size={19} /></span><div><h2 id="db-device-title">Device &amp; Storage</h2><p>Your DN library stays in this browser profile</p></div></div>
      <div className="db-device-name-block"><label className="db-device-name"><span>Device name</span><input value={deviceName} maxLength={64} onChange={(event) => setDeviceName(event.target.value)} /><button type="button" className="db-text-button" onClick={() => void saveDeviceName()}>Save</button></label><small>{platform}</small></div>
      <div className="db-device-status-grid">
        <div className="db-device-status-item"><span className={`db-device-status-icon ${healthy ? 'is-good' : health.loading ? '' : 'is-error'}`}>{healthy ? <CheckCircle2 size={17} /> : health.loading ? <Database size={17} /> : <CircleAlert size={17} />}</span><span><small>Database Health</small><strong>{healthy ? 'Healthy and ready' : health.loading ? 'Checking locally…' : 'Needs attention'}</strong></span><small className="db-device-version">v{versionInfo.current}</small></div>
        <div className="db-device-status-item"><span className="db-device-status-icon"><Layers3 size={17} /></span><span><small>App Version</small><strong>{import.meta.env.VITE_APP_VERSION || 'dev'}</strong></span></div>
        <div className="db-device-status-item db-storage-status"><span className="db-device-status-icon"><HardDrive size={17} /></span><span><small>Storage Usage</small><strong>{storage ? `${formatBytes(storage.usage)} used` : 'Estimate unavailable'}</strong></span>{storage?.quota ? <><strong className="db-storage-amount">{storageUsedPercent}%</strong><span className="db-storage-progress" aria-label={`${storageUsedPercent}% of estimated storage used`}><i style={{ width: `${storageUsedPercent}%` }} /></span></> : null}</div>
      </div>
      <p className="db-device-foot">Storage estimates are approximate and may include other data saved by this browser for DN.</p>
    </section>
  );

  const renderDiagnostics = () => (
    <section className="db-card db-diagnostics-page" aria-labelledby="db-diagnostics-title">
      <div className="db-card-heading"><span className="db-card-icon db-icon-violet"><Layers3 size={19} /></span><div><h2 id="db-diagnostics-title">Advanced Diagnostics</h2><p>Technical details for troubleshooting.</p></div></div>
      {health.loading ? <p>Checking…</p> : <div className="db-diagnostics-list">{DIAGNOSTIC_TABLES.map(([, label]) => <div key={label}><span>{label}</span><strong>{health.diagnostics?.[label] ?? '—'}</strong></div>)}</div>}
    </section>
  );

  const sectionLabels = {
    sync: 'Cloud Sync (Google Drive & iCloud)',
    backup: 'Backup & Restore',
    data: 'Your Data',
    device: 'Device & Storage',
    diagnostics: 'Advanced Diagnostics',
  };

  return (
    <div className="settings-page feature-page db-page">
      <header className="db-heading">
        <Link to="/settings" className="db-back-link">‹ <span>Settings</span></Link>
        {activeSection === 'overview' ? <>
          <span className="db-eyebrow">Your information, in your care</span>
          <h1>Data &amp; Backup</h1>
        </> : <button type="button" className="db-destination-back" onClick={() => { setActiveSection('overview'); setStatus(''); }}>‹ <span>Data &amp; Backup</span></button>}
      </header>

      {activeSection === 'overview' ? <>
        {renderProtection()}
        <nav className="db-secondary-nav" aria-label="Data and backup navigation">
          <button
            type="button"
            onClick={() => { setActiveSection('sync'); setStatus(''); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#edf7f2', borderRadius: '12px', border: '1px solid #1f6f5d', color: '#1f6f5d', fontWeight: 600, textDecoration: 'none', marginBottom: '8px', cursor: 'pointer', width: '100%' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Cloud size={18} /><span>Cloud Sync (Google Drive &amp; iCloud)</span></span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
          {Object.entries(sectionLabels).map(([key, label]) => (
            key === 'sync' ? null : (
              <button key={key} type="button" onClick={() => { setActiveSection(key); setStatus(''); if (key === 'backup') void primeGoogleDrive().catch(() => {}); }}>
                <span>{label}</span><ChevronRight size={17} aria-hidden="true" />
              </button>
            )
          ))}
        </nav>
      </> : null}

      {activeSection === 'sync' && renderCloudSync()}
      {activeSection === 'backup' && renderBackup()}
      {activeSection === 'data' && renderData()}
      {activeSection === 'device' && renderDevice()}
      {activeSection === 'diagnostics' && renderDiagnostics()}

      {activeSection !== 'overview' && status ? <p className="db-page-status" role="status">{status}</p> : null}
      {activeSection === 'device' ? <p className="db-storage-note"><HardDrive size={14} />Storage estimates are approximate and may include other data saved by this browser for DN.</p> : null}
    </div>
  );
}
