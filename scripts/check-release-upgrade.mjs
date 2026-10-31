import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { seedGuest } from '../e2e/fixtures.js';

const previousRoot = resolve(process.env.DN_UPGRADE_PREVIOUS_DIST || '.verification/phase9/previous/dist');
const currentRoot = resolve('dist');
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const previousVersion = process.env.DN_UPGRADE_PREVIOUS_VERSION || '1.0.35';
await Promise.all([readFile(resolve(previousRoot, 'index.html')), readFile(resolve(currentRoot, 'index.html'))]);
const output = resolve('.verification/release-upgrade');
await mkdir(output, { recursive:true });
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.woff2':'font/woff2' };
let current = false;
const server = createServer(async (req, res) => {
  const root = current ? currentRoot : previousRoot;
  let path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(root + '/') && path !== root) { res.writeHead(403); res.end(); return; }
  let bytes;
  try { bytes = await readFile(path); } catch {
    if (extname(path)) { res.writeHead(404); res.end(); return; }
    path = resolve(root, 'index.html'); bytes = await readFile(path);
  }
  res.writeHead(200, { 'Content-Type':types[extname(path)] || 'application/octet-stream', 'Cache-Control':'no-cache' }); res.end(bytes);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const snapshot = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort()
  .filter((key) => /^(dn_guest_(eventGroups|incomes|expenses)$|dn_preferences$|dn_theme_choice$|dn_list_state_)/.test(key))
  .map((key) => [key, localStorage.getItem(key)])));
const results = [];
let browser;
try {
  browser = await chromium.launch({ args:['--no-sandbox'] });
  for (const mode of ['fresh-navigation', 'in-app-refresh']) {
    current = false;
    const context = await browser.newContext({ baseURL:`http://127.0.0.1:${server.address().port}`, viewport:{ width:390, height:844 }, reducedMotion:'reduce', timezoneId:'Asia/Kolkata' });
    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const seen = new WeakSet();
        const observePrompts = () => document.querySelectorAll('.app-toast').forEach((node) => {
          if (seen.has(node) || !node.textContent.includes('A new version is available. Refresh to update.')) return;
          seen.add(node);
          const key = 'dn_verify_upgrade_prompts';
          sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) || 0) + 1));
        });
        new MutationObserver(observePrompts).observe(document, { childList:true, subtree:true, characterData:true });
      });
      const errors = await seedGuest(page);
      await page.goto('/events/moment-one/gallery');
      await page.waitForFunction(() => navigator.serviceWorker.controller);
      await page.getByRole('button', { name:'Open quick create menu', exact:true }).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name:'Attachment', exact:true }).click();
      const original = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
      await (await chooser).setFiles({ name:'Upgrade original.png', mimeType:'image/png', buffer:original });
      await page.getByRole('dialog', { name:'Save attachment', exact:true }).getByRole('button', { name:'Save attachment', exact:true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.goto('/events');
      await page.getByRole('button', { name:/^Filters/ }).click();
      await page.getByRole('searchbox', { name:'Search events', exact:true }).fill('Ooty');
      await expect(page.locator('.life-journey-items .event-story-main')).toHaveCount(1);
      await page.goto('/settings/about');
      // The compact premium About header no longer renders a version badge.
      // Use the labeled Version value that exists in both release shells.
      const aboutVersion = page.locator('.about-summary-item')
        .filter({ has: page.locator('.about-summary-label', { hasText: /^Version$/ }) })
        .locator('strong');
      await expect(aboutVersion).toHaveText(`v${previousVersion}`);
      const before = await snapshot(page);
      current = true;
      if (mode === 'fresh-navigation') {
        await page.reload();
        await expect(aboutVersion).toHaveText(`v${version}`);
        await page.getByRole('button', { name:'Refresh', exact:true }).click({ timeout:20000 });
      } else {
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
        await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
        await page.getByRole('button', { name:'Refresh app', exact:true }).click();
      }
      await expect(aboutVersion).toHaveText(`v${version}`);
      await page.waitForFunction(async (version) => {
        const reg = await navigator.serviceWorker.getRegistration();
        return [reg?.waiting, reg?.active].some((worker) => worker && new URL(worker.scriptURL).searchParams.get('v') === version);
      }, version);
      await page.screenshot({ path:resolve(output, mode + '-about.png') });
      expect(await snapshot(page)).toEqual(before);
      await page.goto('/events');
      await page.getByRole('button', { name:/^Filters/ }).click();
      // The upgraded premium Moments search has a new accessible name;
      // the user's persisted query must remain unchanged after the update.
      await expect(page.getByRole('searchbox', { name:'Search moments', exact:true })).toHaveValue('Ooty');
      await page.goto('/events/moment-one/gallery');
      await page.getByRole('button', { name:'Preview Upgrade original.png', exact:true }).click();
      const preview = page.getByRole('dialog', { name:'Upgrade original.png', exact:true });
      const download = page.waitForEvent('download');
      await preview.getByRole('button', { name:'Download original', exact:true }).click();
      expect((await readFile(await (await download).path())).equals(original)).toBe(true);
      await page.keyboard.press('Escape');
      await context.setOffline(true);
      await page.goto('/events/moment-one/story');
      await expect(page.locator('.dn-v2-story')).toContainText('Book a lakeside stay');
      const promptCount = await page.evaluate(() => Number(sessionStorage.getItem('dn_verify_upgrade_prompts') || 0));
      const repeatPrompt = promptCount - (mode === 'fresh-navigation' ? 1 : 0);
      expect(repeatPrompt).toBe(0);
      expect(await snapshot(page)).toEqual(before);
      expect(errors).toEqual([]);
      results.push({ mode, previousVersion, version, recordsAndPreferencesUnchanged:true, originalExactBytes:original.length, offlineStory:true, promptCount, repeatPrompt, pageErrors:errors });
    } finally { await context.close(); }
  }
  await writeFile(resolve(output, 'results.json'), JSON.stringify(results,null,2));
  console.log(JSON.stringify(results));
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
