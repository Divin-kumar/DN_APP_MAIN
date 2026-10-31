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
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
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
  await page.goto('/events/moment-one/gallery');
  // The opened Moment's hero is the single page-level heading; the compact
  // shared route label is a styled span, not a duplicate h1.
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.dn-moment-hero-swipe h1')).toContainText('Weekend in Ooty');
  await page.waitForFunction(() => navigator.serviceWorker.controller);
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
    await page.goto(route); await expect(page.locator('h1:visible,h2:visible').first()).toBeVisible();
    if (route.endsWith('/pdf')) await expect(page.getByRole('button', { name:'Download customized PDF' })).toBeEnabled({ timeout:20000 });
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
  const after = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k => localStorage.getItem(k)));
  expect(after).toEqual(before); expect(errors).toEqual([]);
  const result = { manifestName:manifest.name, worker:await page.evaluate(() => navigator.serviceWorker.controller.scriptURL), cacheNames:await page.evaluate(() => caches.keys()), offlineStory:true, offlineOriginalExactBytes:bytes.length, offlinePdfBytes:pdf.length, recordsUnchanged:true, pageErrors:errors };
  await writeFile(resolve(output, 'results.json'), JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
