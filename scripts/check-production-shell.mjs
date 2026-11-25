import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { seedGuest } from '../e2e/fixtures.js';
const root = resolve('dist');
const output = resolve('.verification/production-shell');
await readFile(resolve(root, 'index.html')); // Run npm run build first.
await mkdir(output, { recursive:true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json', '.webmanifest':'application/manifest+json', '.woff2':'font/woff2' };
let networkAvailable = true;
let rejectAboutAsset = false;
const server = createServer(async (req, res) => {
  if (!networkAvailable) { req.socket.destroy(); return; }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (rejectAboutAsset && /\/assets\/About-.*\.js$/.test(pathname)) { res.writeHead(503); res.end(); return; }
  const path = resolve(root, '.' + pathname);
  if (!path.startsWith(root + '/') && path !== root) { res.writeHead(403); res.end(); return; }
  let actual = path, data;
  try { data = await readFile(actual); } catch {
    if (extname(path)) { res.writeHead(404); res.end(); return; }
    actual = resolve(root, 'index.html'); data = await readFile(actual);
  }
  res.writeHead(200, { 'Content-Type':types[extname(actual)] || 'application/octet-stream', 'Cache-Control':'no-cache' }); res.end(data);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
let browser;
try {
  browser = await chromium.launch({ args:['--no-sandbox'] });
  const context = await browser.newContext({ baseURL:`http://127.0.0.1:${server.address().port}`, viewport:{ width:390, height:844 }, reducedMotion:'reduce' });
  const page = await context.newPage();
  const errors = await seedGuest(page);
  const firestoreAsset = /\/assets\/config-[^/]+\.js$/;
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name:'Open Book a lakeside stay', exact:true })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const startupAssets = await page.evaluate(async () => [
    ...performance.getEntriesByType('resource').map(({ name }) => name),
    ...(await Promise.all((await caches.keys()).map(async (name) => (
      (await (await caches.open(name)).keys()).map(({ url }) => url)
    )))).flat(),
  ]);
  expect(startupAssets.some((url) => firestoreAsset.test(new URL(url).pathname))).toBe(false);
  await page.goto('/events/moment-one/gallery');
  // The opened Moment's hero is the single page-level heading; the compact
  // shared route label is a styled span, not a duplicate h1.
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.dn-moment-hero-swipe h1')).toContainText('Weekend in Ooty');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  const studioAsset = /\/assets\/MomentPdfStudio-[^/]+\.(js|css)$/;
  const openedStudioAssets = [];
  page.on('request', (request) => {
    if (studioAsset.test(new URL(request.url()).pathname)) openedStudioAssets.push(request.url());
  });
  const initialResources = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name));
  expect(initialResources.some((url) => studioAsset.test(new URL(url).pathname))).toBe(false);
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  await page.getByRole('button', { name:'Open quick create menu', exact:true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name:'Attachment', exact:true }).click();
  const original = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await (await chooser).setFiles({ name:'Offline original.png', mimeType:'image/png', buffer:original });
  await page.getByRole('dialog', { name:'Save attachment', exact:true }).getByRole('button', { name:'Save attachment', exact:true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k => localStorage.getItem(k)));
  for (const route of ['/dashboard','/activities','/events/moment-one/story','/events/moment-one/activities/shared','/events/moment-one/transactions','/financials/transactions','/insights','/settings/code-lists','/settings/about','/events/moment-one/pdf']) {
    if (route.endsWith('/pdf')) expect(openedStudioAssets).toHaveLength(0);
    await page.goto(route); await expect(page.locator('h1:visible,h2:visible').first()).toBeVisible();
    if (route.endsWith('/pdf')) {
      await expect(page.getByRole('button', { name:'Download customized PDF' })).toBeEnabled({ timeout:20000 });
      expect(openedStudioAssets.length).toBeGreaterThan(0);
    }
  }
  await context.setOffline(true);
  await page.goto('/events/moment-one/story');
  await expect(page.locator('.dn-v2-story')).toContainText('Book a lakeside stay');
  await page.getByRole('link', { name:'Gallery', exact:true }).click();
  await page.getByRole('button', { name:'Preview Offline original.png', exact:true }).click();
  const preview = page.getByRole('dialog', { name:'Offline original.png', exact:true });
  await expect(preview.locator('img')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await preview.getByRole('button', { name:'Download original', exact:true }).click();
  const bytes = await readFile(await (await downloaded).path());
  expect(bytes.equals(original)).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name:'PDF Studio', exact:true }).click();
  await expect(page.getByRole('button', { name:'Download customized PDF' })).toBeEnabled({ timeout:20000 });
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name:'Download customized PDF' }).click();
  const pdf = await readFile(await (await pdfDownload).path());
  expect(pdf.subarray(0,8).toString()).toBe('%PDF-1.4');
  await page.screenshot({ path:resolve(output, 'offline-pdf-390.png') });
  await page.goto('/dashboard');
  await page.getByRole('button', { name:'Open quick create menu', exact:true }).click();
  await page.getByRole('button', { name:'Life moment', exact:true }).click();
  const momentForm = page.getByRole('dialog', { name:'Create a life moment' });
  await expect(momentForm.getByRole('button', { name:'Save moment' })).toBeVisible();
  await momentForm.getByRole('button', { name:'Cancel', exact:true }).click();
  await page.getByRole('button', { name:'Open quick create menu', exact:true }).click();
  await page.getByRole('button', { name:'Task', exact:true }).click();
  const taskForm = page.getByRole('dialog', { name:'New Task', exact:true });
  await taskForm.getByLabel('Task title', { exact:true }).fill('Offline draft');
  await expect(taskForm.getByRole('button', { name:'Create Task', exact:true })).toBeEnabled();
  await taskForm.getByRole('button', { name:'Cancel', exact:true }).click();
  const after = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k => localStorage.getItem(k)));
  expect(after).toEqual(before); expect(errors).toEqual([]);
  // Start on Tasks in a new installation. Neither Login, Home nor Data & Backup
  // has been visited. Stop the origin as well as disconnecting the browser.
  const fresh = await browser.newContext({ baseURL: `http://127.0.0.1:${server.address().port}`, viewport: { width: 430, height: 932 } });
  const coldPage = await fresh.newPage();
  const guestTask = JSON.stringify([{ id: 'offline-guest-task', title: 'Collect the parcel', priority: 'medium', status: 'in-progress' }]);
  await coldPage.addInitScript((task) => {
    if (sessionStorage.getItem('fixture-started')) return;
    localStorage.setItem('dn_guest_mode', 'true');
    localStorage.setItem('dn_guest_tasks', task);
    sessionStorage.setItem('fixture-started', 'true');
  }, guestTask);
  await coldPage.goto('/tasks');
  await expect(coldPage.getByText('Collect the parcel', { exact: true })).toBeVisible();
  await coldPage.waitForFunction(() => navigator.serviceWorker.controller);
  const initialCache = await coldPage.evaluate(async () => {
    const cache = await caches.open((await caches.keys()).find(key => key.startsWith('dn-shell-')));
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  expect(initialCache.some(path => /\/LoginPage-.*\.js$/.test(path))).toBe(true);
  expect(initialCache.some(path => /\/DashboardHome-.*\.js$/.test(path))).toBe(true);
  expect(initialCache.some(path => /\/(?:DataBackup|Settings|MomentPdfStudio)-.*\.js$/.test(path))).toBe(false);
  networkAvailable = false;
  await fresh.setOffline(true);
  await coldPage.getByRole('button', { name: 'Open profile and account menu' }).click();
  await coldPage.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(coldPage.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await coldPage.getByRole('button', { name: 'Continue as Guest' }).click();
  await expect(coldPage).toHaveURL(/\/dashboard$/);
  await expect(coldPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  const unavailable = '/settings/data-backup?from=bookmark#data-guide';
  let documentLoads = 0;
  coldPage.on('domcontentloaded', () => { documentLoads++; });
  await coldPage.goto(unavailable);
  const offlineHeading = coldPage.getByRole('heading', { name: 'This screen isn’t available offline' });
  await expect(offlineHeading).toBeFocused();
  await expect(coldPage.getByRole('button', { name: 'Retry this screen' })).toBeDisabled();
  expect(documentLoads).toBe(1);
  await coldPage.getByRole('link', { name: 'Go to Home' }).click();
  await expect(coldPage.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();

  await coldPage.goto(unavailable);
  await expect(offlineHeading).toBeVisible();
  networkAvailable = true;
  await fresh.setOffline(false);
  await expect(coldPage.getByText('You’re back online. Retry to open this screen.')).toBeVisible();
  await coldPage.getByRole('button', { name: 'Retry this screen' }).click();
  await expect(coldPage).toHaveURL(/\/settings\/data-backup\?from=bookmark#data-guide$/);
  await expect(coldPage.locator('#data-guide')).toBeFocused();
  expect(await coldPage.evaluate(() => localStorage.getItem('dn_guest_tasks'))).toBe(guestTask);
  // An old or temporarily unavailable online chunk may refresh once. An
  // unrelated successful parent route must not restart that refresh cycle.
  rejectAboutAsset = true;
  documentLoads = 0;
  await coldPage.goto('/settings/about?from=bookmark');
  await expect.poll(() => documentLoads).toBe(2);
  await expect(coldPage.getByRole('heading', { name: 'This page couldn’t load' })).toBeVisible();
  await expect(coldPage.getByRole('button', { name: 'Retry this screen' })).toBeEnabled();
  rejectAboutAsset = false;
  await coldPage.getByRole('button', { name: 'Retry this screen' }).click();
  await expect(coldPage.getByRole('heading', { name: 'About DN', exact: true }).first()).toBeVisible();
  await expect(coldPage.getByRole('button', { name: 'Retry this screen' })).toHaveCount(0);
  await fresh.close();
  const result = { manifestName:manifest.name, worker:await page.evaluate(() => navigator.serviceWorker.controller.scriptURL), cacheNames:await page.evaluate(() => caches.keys()), coldOfflineLogoutAndGuestReturn:true, uncachedRouteHomeAndOnlineRetry:true, boundedOnlineRefresh:true, guestDashboardWithoutFirestore:true, offlineStory:true, offlineOriginalExactBytes:bytes.length, offlinePdfBytes:pdf.length, offlineQuickCreate:true, recordsUnchanged:true, pageErrors:errors };
  await writeFile(resolve(output, 'results.json'), JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
