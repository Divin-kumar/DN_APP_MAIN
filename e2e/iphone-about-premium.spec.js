import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Chromium coverage. Physical iPhone Safari, VoiceOver and signed-in data remain separate gates.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`About keeps release controls visible and its guide calm at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings/about');
      await expect(page.getByRole('heading', { name: 'About DN', exact: true })).toBeVisible();
      const root = page.locator('.dn-premium-about');
      await expect(root.locator('.about-summary-item')).toHaveCount(4);
      await expect(root.getByText('Build date', { exact: true })).toBeVisible();
      await expect(root.getByText('Environment', { exact: true })).toBeVisible();
      await expect(root.getByRole('button', { name: 'Refresh app' })).toBeVisible();
      await expect(root.getByRole('heading', { name: 'What\'s New', exact: false })).toBeVisible();
      await expect(root.getByRole('heading', { name: 'Your Data', exact: true })).toBeVisible();
      await expect(root.locator('.about-guide-grid details')).toHaveCount(10);
      const history = root.locator('.dn-about-release-entry');
      await expect(root.getByRole('heading', { name: 'Version History' })).toBeVisible();
      await expect(history).toHaveCount(9);
      const installedVersion = (await root.locator('.about-summary-item').nth(1).locator('strong').innerText()).trim();
      const installedEntry = root.locator(`.dn-about-release-entry[data-version="${installedVersion.slice(1)}"]`);
      await expect(installedEntry.locator('.dn-about-release-status')).toHaveText('Installed');
      await expect(root.getByRole('heading', { name: `What's New in ${installedVersion}` })).toBeVisible();
      // Release history must start with the installed build, not a stale fixed version.
      await expect(history.first()).toHaveAttribute('data-version', installedVersion.slice(1));
      await expect(history.last()).toHaveAttribute('data-version', '2.0.0');
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
