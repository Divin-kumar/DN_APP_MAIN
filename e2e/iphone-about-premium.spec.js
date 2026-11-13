import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { seedGuest } from './fixtures.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// Synthetic Chromium coverage. Physical iPhone Safari, VoiceOver and signed-in data remain separate gates.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`About keeps release controls visible and its guide calm at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings/about');
      await expect(page.getByRole('heading', { name: 'About DN', exact: true })).toBeVisible();
      const root = page.locator('.dn-premium-about');
      if (process.env.VITE_DEPLOY_ENV !== 'Firebase development') {
        await expect(root.getByRole('region', { name: 'Pending production' })).toHaveCount(0);
      }
      await expect(root.locator('.about-summary-item')).toHaveCount(4);
      await expect(root.getByText('Build date', { exact: true })).toBeVisible();
      await expect(root.getByText('Environment', { exact: true })).toBeVisible();
      await expect(root.getByRole('button', { name: 'Refresh app' })).toBeVisible();
      await expect(root.getByRole('heading', { name: 'What\'s New', exact: false })).toBeVisible();
      await expect(root.getByRole('heading', { name: 'Your Data', exact: true })).toBeVisible();
      await expect(root.locator('.about-guide-grid details')).toHaveCount(11);
      const history = root.locator('.dn-about-release-entry');
      await expect(root.getByRole('heading', { name: 'Version History' })).toBeVisible();
      // Preserve every documented release while allowing future releases to be added.
      const versions = await history.evaluateAll(items => items.map(item => item.dataset.version));
      expect(versions).toEqual(expect.arrayContaining([
        '2.3.4', '2.3.3', '2.3.2', '2.3.1', '2.3.0', '2.2.0',
        '2.1.4', '2.1.3', '2.1.2', '2.1.1', '2.1.0',
        '2.0.3', '2.0.2', '2.0.1', '2.0.0',
      ]));
      expect(new Set(versions).size).toBe(versions.length);
      expect(versions).toEqual([...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })));
      const installedVersion = (await root.locator('.about-summary-item').nth(1).locator('strong').innerText()).trim();
      const installedEntry = root.locator(`.dn-about-release-entry[data-version="${installedVersion.slice(1)}"]`);
      await expect(installedEntry).toHaveCount(1);
      await expect(installedEntry.locator('.dn-about-release-status')).toHaveText('Installed');
      await expect(root.locator('.dn-about-release-status').filter({ hasText: /^Installed$/ })).toHaveCount(1);
      await expect(root.getByRole('heading', { name: `What's New in ${installedVersion}` })).toBeVisible();
      // Release history must start with the installed build, not a stale fixed version.
      await expect(history.first()).toHaveAttribute('data-version', installedVersion.slice(1));
      await expect(history.last()).toHaveAttribute('data-version', '2.0.0');
      const archive = root.locator('.dn-about-history .dn-about-pending-details');
      await expect(archive).not.toHaveAttribute('open');
      await expect(history.last()).toBeHidden();
      await archive.locator(':scope > summary').click();
      await expect(history.last()).not.toHaveAttribute('open');
      await history.last().locator('summary').click();
      await expect(history.last()).toHaveAttribute('open');
      await expect(history.last().getByText(/Moment Story offers Journal, Diary and Tasks/)).toBeVisible();
      const legacyHistory = root.locator('.dn-about-release-entry[data-version="2.0.1"]');
      await legacyHistory.locator('summary').click();
      await expect(legacyHistory.getByText(/not documented precisely enough/)).toBeVisible();
      await history.last().locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(history.last()).not.toHaveAttribute('open');
      const releaseGeometry = await history.evaluateAll((items) => items.map((item) => {
        const summary = item.querySelector('summary');
        const rect = summary.getBoundingClientRect();
        return { height:rect.height,left:rect.left,right:rect.right };
      }));
      expect(releaseGeometry.every((item) => item.height >= 44
        && item.left >= -1 && item.right <= width + 1)).toBe(true);

      const before = await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
        .map(key => localStorage.getItem(key)));
      const entries = root.locator('.dn-about-guide-entry');
      await expect(entries.first()).not.toHaveAttribute('open');
      await entries.first().locator('summary').click();
      await expect(entries.first()).toHaveAttribute('open');
      await expect(entries.first().getByText(/A short personal greeting/)).toBeVisible();
      await expect(entries.nth(1)).not.toHaveAttribute('open');
      await entries.first().locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(entries.first()).not.toHaveAttribute('open');
      const geom = await page.evaluate(() => {
        const bounds = el => { const r = el.getBoundingClientRect(); return { left:r.left,right:r.right,height:r.height,y:r.y }; };
        const guide = [...document.querySelectorAll('.dn-about-guide-entry > summary')].map(bounds);
        const refresh = bounds(document.querySelector('.dn-premium-about .about-refresh-button'));
        const row = bounds(document.querySelector('.dn-premium-about .about-refresh-row'));
        const cards = [...document.querySelectorAll('.dn-premium-about > .settings-section')].map(bounds);
        return { pageWidth:document.documentElement.scrollWidth, guide,refresh,row,cards };
      });
      expect(geom.pageWidth).toBeLessThanOrEqual(width + 1);
      expect(geom.guide.every(item => item.height >= 44)).toBe(true);
      expect(geom.cards.every(item => item.left >= -1 && item.right <= width + 1)).toBe(true);
      expect(geom.refresh.height).toBeGreaterThanOrEqual(44);
      expect(geom.refresh.right).toBeLessThanOrEqual(width + 1);
      expect(geom.row.height).toBeLessThanOrEqual(110);
      await page.locator('.dn-header').getByRole('link',{name:'Back to Settings'}).click();
      await expect(page).toHaveURL(/\/settings$/);
      expect(await page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses']
        .map(key => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}


test('About development ledger shows the build and newest pending commits first', async ({ page }) => {
  test.skip(process.env.VITE_DEPLOY_ENV !== 'Firebase development', 'Requires the development Hosting configuration.');
  await page.setViewportSize({ width: 320, height: 640 });
  const errors = await seedGuest(page, { theme: 'dark' });
  const oldest = '7a2292e27952854cfd4caff2e0708f02de57b065';
  const newest = '8ed4a6c12a9f92d8f0d886a8414cfd415e5288bb';
  await page.route('**/dn-pending-release.json', (route) => route.fulfill({
    json: {
      status: 'ready',
      sourceSha: newest,
      production: { version: '2.3.10', sha: 'c'.repeat(40) },
      commits: [oldest, newest].map((sha, index) => ({
        sha, title: index ? 'Make creation defaults save state clear' : 'Earlier search update',
        details: index ? 'Preserve an unsaved choice if the browser rejects a write.' : '',
        date: index ? '2026-11-13T06:00:00Z' : '2026-11-08T06:00:00Z',
        url: `https://github.com/Divin-kumar/DN_APP_MAIN/commit/${sha}`,
      })),
    },
  }));
  await page.goto('/settings/about');
  const pending = page.getByRole('region', { name: 'Pending production' });
  const metadata = pending.locator('.dn-about-pending-meta');
  await expect(metadata).toContainText('Development build');
  await expect(metadata).toContainText('8ed4a6c');
  await expect(metadata).toContainText('Last production release');
  await expect(metadata).toContainText('v2.3.10');
  await expect(page.getByRole('heading', { name: 'Last production highlights' })
    .locator('..')).toContainText('Released in v2.3.10');
  await expect(pending.getByText(/Appearance shows which creation defaults need saving/)).toBeVisible();

  const summary = pending.locator('summary');
  await expect(summary).toHaveText('2 pending commits');
  await summary.focus();
  await page.keyboard.press('Enter');
  const commits = pending.getByRole('article');
  await expect(commits).toHaveCount(2);
  await expect(commits.first()).toContainText('Make creation defaults save state clear');
  await expect(commits.first()).toContainText('Preserve an unsaved choice');
  await expect(commits.last()).toContainText('Earlier search update');
  await expect(commits.first().getByRole('link')).toHaveAttribute('href', `https://github.com/Divin-kumar/DN_APP_MAIN/commit/${newest}`);
  expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  expect(errors).toEqual([]);
});

test('About development ledger starts fresh after a production release', async ({ page }) => {
  test.skip(process.env.VITE_DEPLOY_ENV !== 'Firebase development', 'Requires the development Hosting configuration.');
  await seedGuest(page);
  const sha = 'a'.repeat(40);
  await page.route('**/dn-pending-release.json', route => route.fulfill({
    json: { status: 'ready', sourceSha: sha, production: { version, sha }, commits: [] },
  }));
  await page.goto('/settings/about');
  const pending = page.getByRole('region', { name: 'Pending production' });
  await expect(pending.getByText(/Everything recorded here is now in production/)).toBeVisible();
  await expect(pending.locator('article, details')).toHaveCount(0);
  await expect(page.locator('.dn-about-history .dn-about-release-entry:visible')).toHaveCount(1);
});
