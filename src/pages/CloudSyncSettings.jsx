import { useState, useEffect } from 'react';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Shield,
  Smartphone,
  HardDrive,
  Info,
  Check,
  ChevronRight,
  ArrowRight,
  Lock,
  Layers,
} from 'lucide-react';
import useAppStore from '../store/useAppStore';
import {
  getCloudSyncConfig,
  saveCloudSyncConfig,
  connectGoogleDrive,
  disconnectGoogleDrive,
  syncWithGoogleDrive,
  connectICloud,
  disconnectICloud,
  syncWithICloud,
} from '../services/cloudSyncService';
import ModalDialog from '../components/common/ModalDialog';

export default function CloudSyncSettings() {
  const showToast = useAppStore((state) => state.showToast);
  const [syncConfig, setSyncConfig] = useState(getCloudSyncConfig());
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleProgress, setGoogleProgress] = useState(null);
  const [iCloudSyncing, setICloudSyncing] = useState(false);
  const [iCloudProgress, setICloudProgress] = useState(null);
  const [iCloudModalOpen, setICloudModalOpen] = useState(false);
  const [appleIdDraft, setAppleIdDraft] = useState('');

  // Re-read config on events
  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) setSyncConfig(e.detail);
    };
    window.addEventListener('lifehub:sync-config-updated', handleUpdate);
    return () => window.removeEventListener('lifehub:sync-config-updated', handleUpdate);
  }, []);

  const formatTimestamp = (iso) => {
    if (!iso) return 'Never synced';
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  // Google Drive Handlers
  const handleConnectGoogle = async () => {
    try {
      setGoogleProgress({ message: 'Authorizing with Google…' });
      await connectGoogleDrive();
      setSyncConfig(getCloudSyncConfig());
      showToast('Connected to Google Drive', 'success');
      // Trigger initial sync
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

  // iCloud Handlers
  const handleOpenICloudModal = () => {
    setAppleIdDraft(syncConfig.iCloud.appleId || '');
    setICloudModalOpen(true);
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

  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="cloud-sync-page max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Sync &amp; Cloud Backup
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Keep your moments, activities, categories, and settings synchronized across devices using your personal cloud storage.
        </p>
      </div>

      {/* Security & Local-First Assurance */}
      <div className="flex items-start gap-3 p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl">
        <Shield size={20} className="text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 dark:text-emerald-200">
          <p className="font-semibold mb-0.5">Local-First &amp; Zero Credential Exposure</p>
          <p className="text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
            Your LifeHub database remains 100% on this device and works offline. Cloud sync merges changes using monotonic revision timestamps and stable record IDs to prevent duplicates. Access tokens are kept strictly in-memory and never written to storage or telemetry logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* PROVIDER 1: Google Drive */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Cloud size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Google Drive
                  </h3>
                  <span className="text-xs text-slate-500">Google OAuth · drive.file scope</span>
                </div>
              </div>

              {syncConfig.googleDrive.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Not Connected
                </span>
              )}
            </div>

            {/* Provider Details */}
            {syncConfig.googleDrive.connected ? (
              <div className="space-y-3 mb-5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {syncConfig.googleDrive.userEmail || 'Google Account'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Synced</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatTimestamp(syncConfig.googleDrive.lastSyncTime)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sync Target</span>
                    <span className="text-slate-500 font-mono text-[11px]">lifehub_sync_envelope.json</span>
                  </div>
                </div>

                {/* Progress bar */}
                {googleProgress && (
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span>{googleProgress.message || 'Syncing…'}</span>
                      <span>{googleProgress.percent || 0}%</span>
                    </div>
                    <div className="w-full bg-blue-200/50 dark:bg-blue-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${googleProgress.percent || 20}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {syncConfig.googleDrive.syncError && !googleProgress && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{syncConfig.googleDrive.syncError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncGoogle}
                      disabled={googleSyncing}
                      className="px-2 py-1 text-[11px] font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 rounded-lg shrink-0 cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Auto-sync Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Automatic Sync
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Sync when online and on record changes
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleGoogleAutoSync}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      syncConfig.googleDrive.autoSync ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        syncConfig.googleDrive.autoSync ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                Connect your Google account to automatically synchronize all your life moments, activities, and settings to your personal Google Drive in the background.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            {syncConfig.googleDrive.connected ? (
              <>
                <button
                  type="button"
                  onClick={handleSyncGoogle}
                  disabled={googleSyncing}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={googleSyncing ? 'animate-spin' : ''} />
                  <span>{googleSyncing ? 'Syncing…' : 'Sync Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Cloud size={16} />
                <span>Connect Google Drive</span>
              </button>
            )}
          </div>
        </section>

        {/* PROVIDER 2: iCloud */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Cloud size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Sync with iCloud
                  </h3>
                  <span className="text-xs text-slate-500">
                    {isIos ? 'Apple Device Container' : 'CloudKit Web Services'}
                  </span>
                </div>
              </div>

              {syncConfig.iCloud.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                  Not Connected
                </span>
              )}
            </div>

            {/* Provider Details */}
            {syncConfig.iCloud.connected ? (
              <div className="space-y-3 mb-5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {syncConfig.iCloud.appleId || 'Apple ID'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Container</span>
                    <span className="text-slate-500 font-mono text-[11px] truncate max-w-[170px]">
                      {syncConfig.iCloud.containerId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Synced</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatTimestamp(syncConfig.iCloud.lastSyncTime)}
                    </span>
                  </div>
                </div>

                {/* Progress */}
                {iCloudProgress && (
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200/60 rounded-xl text-xs text-purple-800 dark:text-purple-300 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span>{iCloudProgress.message || 'Syncing…'}</span>
                      <span>{iCloudProgress.percent || 0}%</span>
                    </div>
                    <div className="w-full bg-purple-200/50 dark:bg-purple-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${iCloudProgress.percent || 20}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {syncConfig.iCloud.syncError && !iCloudProgress && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{syncConfig.iCloud.syncError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncICloud}
                      disabled={iCloudSyncing}
                      className="px-2 py-1 text-[11px] font-semibold bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 rounded-lg shrink-0 cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Platform Distinction Note */}
                <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <Info size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {isIos
                      ? 'iOS PWA: Synchronizing with Apple iCloud Container via device sandbox storage.'
                      : 'Browser Web: CloudKit Web Services mode stores sync container records securely for this browser.'}
                  </span>
                </div>

                {/* Auto-sync Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                      Automatic Sync
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Sync when online and on updates
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleICloudAutoSync}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      syncConfig.iCloud.autoSync ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        syncConfig.iCloud.autoSync ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Sync your LifeHub records with Apple iCloud. On iOS devices, uses the device iCloud container; on other browsers, connects via CloudKit Web container.
                </p>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                    <Smartphone size={13} /> Platform Architecture Notice
                  </div>
                  <p>
                    {isIos
                      ? 'Running on iOS: Direct Apple ecosystem sync container ready.'
                      : 'Running in Web Browser: Web-safe CloudKit container configuration.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
            {syncConfig.iCloud.connected ? (
              <>
                <button
                  type="button"
                  onClick={handleSyncICloud}
                  disabled={iCloudSyncing}
                  className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={iCloudSyncing ? 'animate-spin' : ''} />
                  <span>{iCloudSyncing ? 'Syncing…' : 'Sync Now'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectICloud}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleOpenICloudModal}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Cloud size={16} />
                <span>Connect with iCloud</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Sync Strategy Details Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Layers size={16} className="text-emerald-600" />
          Conflict Resolution &amp; Sync Architecture
        </h3>
        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <li className="flex items-start gap-2">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Stable Record IDs:</strong> Every moment, activity, expense, and category uses invariant UUIDs across synchronizations, preventing record duplication.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Timestamp-Based Resolution:</strong> If an activity is modified on two devices, the latest edit (by <code>updatedAt</code> timestamp) is preserved automatically.</span>
          </li>
          <li className="flex items-start gap-2">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Offline Queue:</strong> If you are offline when syncing or editing, changes are retained in the local IndexedDB database and queued to sync once an internet connection is re-established.</span>
          </li>
        </ul>
      </div>

      {/* iCloud Connect Modal */}
      {iCloudModalOpen && (
        <ModalDialog
          title="Connect with iCloud"
          onClose={() => setICloudModalOpen(false)}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Authorize LifeHub to synchronize moments, activities, and settings with your Apple iCloud account.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Apple ID / Device Identifier
              </label>
              <input
                type="text"
                value={appleIdDraft}
                onChange={(e) => setAppleIdDraft(e.target.value)}
                placeholder="e.g. user@icloud.com or Apple ID"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
            </div>

            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-xs text-purple-800 dark:text-purple-300">
              Container ID: <code>iCloud.com.lifehub.personal</code>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setICloudModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConnectICloud}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs"
              >
                Authorize &amp; Connect
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </div>
  );
}
