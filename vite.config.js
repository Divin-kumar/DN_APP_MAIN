import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
const BUILD_ID = `${APP_VERSION}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const DEPLOYED_AT = process.env.VITE_DEPLOYED_AT || new Date().toISOString();
const DEPLOY_ENV = process.env.VITE_DEPLOY_ENV || (process.env.NODE_ENV === 'production' ? 'Production' : 'Test');

const pwaShellPlugin = () => ({
  name: 'dn-pwa-shell',
  apply: 'build',
  generateBundle(_, bundle) {
    const entryFiles = new Set();
    const addEntryAndImports = (fileName) => {
      if (entryFiles.has(fileName)) return;
      entryFiles.add(fileName);
      const output = bundle[fileName];
      if (output?.type === 'chunk') output.imports.forEach(addEntryAndImports);
    };
    Object.values(bundle)
      .filter((output) => output.type === 'chunk' && output.isEntry)
      .forEach((output) => addEntryAndImports(output.fileName));
    Object.keys(bundle)
      .filter((fileName) => fileName.startsWith('assets/') && fileName.endsWith('.css'))
      .forEach((fileName) => entryFiles.add(fileName));
    const entryAssets = [...entryFiles].map((fileName) => `/${fileName}`);
    const precacheUrls = [...new Set(['/', '/index.html', '/manifest.webmanifest', '/dn-icon.svg', ...entryAssets])];
    const workerSource = `
const CACHE_PREFIX = 'dn-shell-';
const CACHE_NAME = CACHE_PREFIX + '${BUILD_ID}';
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (
      (await caches.match('/index.html')) || (await caches.match('/'))
    )));
    return;
  }

  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  if (url.pathname.startsWith('/assets/') && /\\.(?:js|css|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }));
  }
});
`;

    this.emitFile({ type: 'asset', fileName: 'sw.js', source: workerSource });
  },
});

export default defineConfig({
  plugins: [react(), pwaShellPlugin()],
  cacheDir: process.env.DN_BROWSER_TEST === '1' ? '.verification/vite-browser-cache' : undefined,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
    'import.meta.env.VITE_DEPLOYED_AT': JSON.stringify(DEPLOYED_AT),
    'import.meta.env.VITE_DEPLOY_ENV': JSON.stringify(DEPLOY_ENV),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
