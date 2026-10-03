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
import './index.css';
import './design-system.css';

const applyDocumentTheme = (theme) => {
  const normalizedTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = normalizedTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    normalizedTheme === 'light' ? '#f3f6fb' : '#0b1020',
  );
};

try {
  const storedPreferences = JSON.parse(localStorage.getItem('lifehub_preferences') || '{}');
  applyDocumentTheme(storedPreferences.theme || 'dark');
} catch {
  applyDocumentTheme('dark');
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((error) => console.warn('DN offline app shell could not be registered:', error));
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
