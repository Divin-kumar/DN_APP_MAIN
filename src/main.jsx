import { migrateLegacyStorage } from './utils/storageMigration';
/*
  This is the very first code that runs when the app loads.
  It mounts the React app into the browser, enables client-side routing,
  and loads the global styling used across the whole application.

  In simple language:
  - the browser opens the app
  - the app knows how to change pages without reloading
  - the whole UI gets its visual styles
*/
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import useAppStore from './store/useAppStore';
import { readServiceWorkerVersion, shouldPromptForServiceWorkerUpdate } from './utils/serviceWorkerUpdate';
import { initializeFirebaseAnalytics } from './firebase/config';
import './index.css';
import './design-system.css';
import './PremiumUX2026.css';

const applyDocumentTheme = (theme) => {
  const normalizedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = normalizedTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    normalizedTheme === 'light' ? '#f3f6fb' : '#0b1020',
  );
};

try {
  migrateLegacyStorage();
  const storedPreferences = JSON.parse(localStorage.getItem('dn_preferences') || '{}');
  applyDocumentTheme(storedPreferences.theme || 'dark');
} catch {
  applyDocumentTheme('dark');
}

const APP_VERSION = String(import.meta.env.VITE_APP_VERSION || 'dev');
if (import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void initializeFirebaseAnalytics();
  }, { once: true });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const hadController = Boolean(navigator.serviceWorker.controller);
      if (hadController) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
      }

      const registration = await navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`, { scope: '/', updateViaCache: 'none' });
      let notifiedWaitingWorker = null;
      const notifyUpdateReady = async () => {
        const waitingWorker = registration.waiting;
        if (!waitingWorker || waitingWorker === notifiedWaitingWorker) return;
        const activeWorker = registration.active || navigator.serviceWorker.controller;
        const [activeVersion, waitingVersion] = await Promise.all([
          readServiceWorkerVersion(activeWorker), readServiceWorkerVersion(waitingWorker),
        ]);
        if (registration.waiting !== waitingWorker || notifiedWaitingWorker === waitingWorker
          || (registration.active || navigator.serviceWorker.controller) !== activeWorker) return;
        const shouldNotify = shouldPromptForServiceWorkerUpdate({
          hasController: hadController,
          activeVersion,
          waitingVersion,
          currentVersion: APP_VERSION,
        });
        if (!shouldNotify) return;
        notifiedWaitingWorker = waitingWorker;
        useAppStore.getState().showToast('A new version is available. Refresh to update.', 'success', {
          label: 'Refresh',
          duration: 10000,
          onClick: () => waitingWorker.postMessage({ type: 'SKIP_WAITING' }),
        });
      };
      if (registration.waiting) void notifyUpdateReady();
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        installingWorker?.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') void notifyUpdateReady();
        });
      });
      await registration.update();
    } catch (error) {
      console.warn('DN offline app shell could not be registered:', error);
    }
  }, { once: true });
}

// BrowserRouter gives every screen access to URL-based navigation.
// React.StrictMode helps detect problems during development by running logic twice.
// This is mainly used to catch mistakes while developers are building the app.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
