import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-232: the checkpoint precedes this source refinement. No test mutates
// signed-in data; use Guest fixtures and assert no persistence side effects.
// Chromium layouts are not a replacement for VoiceOver and physical Safari.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`premium hierarchy, type and controls remain coherent at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      const before = await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ]);

      const plus = page.locator('.dn-command-trigger');
      await expect(plus).toBeVisible();
      await plus.click();
      const dock = page.getByRole('navigation', {name:'Main navigation'});
      await expect(dock.getByRole('link')).toHaveText(['Home','Moments','Activities','Tasks','Finance']);
      const sizes = await dock.getByRole('link').evaluateAll(items => items.map(e => ({font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height})));
      expect(sizes.every(s => s.font >= 12 && s.height >= 44)).toBe(true);
      await expect(page.getByRole('button',{name:'Transaction',exact:true})).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(plus).toBeVisible();

      await page.goto('/events');
      await expect(page.getByRole('searchbox', { name: 'Search moments' })).toBeVisible();
      await expect(page.locator('.dn-v2-moment-card').first()).toBeVisible();
      await page.goto('/activities');
      await expect(page.getByRole('searchbox', { name: 'Search activities and Moments' })).toBeVisible();
      await expect(page.locator('.dn-v2-activity-card').first()).toBeVisible();
      await page.goto('/financials/transactions');
      await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('.dn-finance-summary-grid')).toBeVisible();
      const transactionScroll = await page.locator('.dn-transactions-results').evaluate((element) =>
        ({ overflow: getComputedStyle(element).overflowY, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
      expect(['auto', 'scroll'].includes(transactionScroll.overflow)).toBe(true);

      await page.goto('/events/moment-one/story');
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('.dn-moment-metric')).toHaveCount(3);
      const sectionNav = page.locator('.dn-moment-nav');
      await expect(sectionNav).toBeVisible();
      expect(await sectionNav.locator('a').first().evaluate((item) =>
        parseFloat(getComputedStyle(item).fontSize))).toBeGreaterThanOrEqual(12);

      await page.goto('/settings/data-backup');
      await expect(page.getByRole('heading', { name: 'Data & Backup' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export backup' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Clear local' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete online' })).toHaveCount(0);
      const guideSize = await page.locator('.dn-data-page .dn-data-location-item p').first()
        .evaluate((item) => parseFloat(getComputedStyle(item).fontSize));
      expect(guideSize).toBeGreaterThanOrEqual(13);

      const screen = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        main: document.querySelectorAll('main').length,
      }));
      expect(screen.width).toBeLessThanOrEqual(screen.viewport + 1);
      expect(screen.main).toBe(1);
      expect(await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ])).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}

test('Insights milestone search accurately describes its limited scope', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/insights');
  await expect(page.getByRole('searchbox', { name: 'Search milestones in Insights' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
});
