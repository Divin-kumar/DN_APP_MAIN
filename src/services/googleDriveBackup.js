const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

const config = () => ({
  clientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '',
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
  appId: import.meta.env.VITE_GOOGLE_APP_ID || '',
});

let gisScriptPromise;
let pickerScriptPromise;

const loadScript = (src, existing) => {
  if (existing) return existing;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google Drive components could not be loaded.'));
    document.head.appendChild(script);
  });
  return promise;
};

const getAccessToken = async (prompt) => {
  const { clientId } = config();
  if (!clientId) throw new Error('Google Drive is not configured for this DN deployment.');
  gisScriptPromise = loadScript('https://accounts.google.com/gsi/client', gisScriptPromise);
  await gisScriptPromise;
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => response?.access_token
        ? resolve(response.access_token)
        : reject(new Error(response?.error_description || response?.error || 'Google Drive permission was not granted.')),
      error_callback: (error) => reject(new Error(error?.message || 'Google Drive authorization was cancelled.')),
    });
    client.requestAccessToken({ prompt });
  });
};

export const isGoogleDriveConfigured = () => Boolean(config().clientId && config().apiKey && config().appId);

export const primeGoogleDrive = async () => {
  if (!isGoogleDriveConfigured()) return;
  gisScriptPromise = loadScript('https://accounts.google.com/gsi/client', gisScriptPromise);
  await gisScriptPromise;
  await loadPicker();
};

export const uploadBackupToGoogleDrive = async ({ blob, filename }) => {
  const token = await getAccessToken('');
  const metadata = { name: filename, mimeType: 'application/json', description: 'DN local backup. Not synchronized.' };
  const body = new FormData();
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  body.append('file', blob, filename);
  const response = await fetch(DRIVE_UPLOAD_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status}).`);
  return response.json();
};

const loadPicker = async () => {
  pickerScriptPromise = loadScript('https://apis.google.com/js/api.js', pickerScriptPromise);
  await pickerScriptPromise;
  await new Promise((resolve) => window.gapi.load('picker', { callback: resolve }));
};

export const pickBackupFromGoogleDrive = async () => {
  const { apiKey, appId } = config();
  if (!apiKey || !appId) throw new Error('Google Drive file selection is not configured for this DN deployment.');
  const token = await getAccessToken('');
  await loadPicker();
  return new Promise((resolve, reject) => {
    const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setMimeTypes('application/json')
        .setQuery('DN_Backup_'))
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setTitle('Choose a DN backup')
      .setCallback(async (data) => {
        if (data.action === window.google.picker.Action.CANCEL) return resolve(null);
        if (data.action !== window.google.picker.Action.PICKED) return;
        const document = data.docs?.[0];
        if (!document?.id) return reject(new Error('No backup file was selected.'));
        try {
          const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(document.id)}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) throw new Error(`Google Drive download failed (${response.status}).`);
          const blob = await response.blob();
          resolve(new File([blob], document.name || 'DN_Backup.json', { type: 'application/json' }));
        } catch (error) {
          reject(error);
        }
      });
    picker.build().setVisible(true);
  });
};

export const saveBackupToFiles = async ({ blob, filename }) => {
  if (typeof File !== 'undefined' && navigator.canShare?.({ files: [new File([blob], filename, { type: 'application/json' })] }) && navigator.share) {
    await navigator.share({ title: filename, files: [new File([blob], filename, { type: 'application/json' })] });
    return 'shared';
  }
  return 'unsupported';
};
