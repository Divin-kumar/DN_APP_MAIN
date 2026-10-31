import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-235: the storage disclosure must stay visible and readable in the
// persistent header without costing a second row of content area.
// Synthetic browser geometry cannot certify installed Safari/VoiceOver.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Guest storage scope stays visible in the top header at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)));

      const header = page.locator('.dn-header');
      const scope = header.getByRole('note', {
        name: /Guest mode: your data is stored locally on this device/,
      });
      await expect(scope).toBeVisible();
      await expect(scope).toHaveText('Guest · On this device');
      await expect(scope.locator('svg')).toBeVisible();
      await expect(header.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(page.locator('.dn-content > .dn-banner.dn-session-banner')).toHaveCount(0);

      const position = await page.evaluate(() => {
        const scope = document.querySelector('.dn-header .dn-shell-scope').getBoundingClientRect();
        const title = document.querySelector('.dn-header .dn-shell-page-title').getBoundingClientRect();
        const header = document.querySelector('.dn-header').getBoundingClientRect();
        const controls = document.querySelector('.dn-header .header-user-controls').getBoundingClientRect();
        const nextContent = document.querySelector('.dn-route-transition').getBoundingClientRect();
        return {
          scopeLeft: scope.left, scopeRight: scope.right,
          scopeTop: scope.top, scopeBottom: scope.bottom,
          titleBottom: title.bottom, headerBottom: header.bottom,
          controlsLeft: controls.left, contentTop: nextContent.top,
          scrollWidth: document.documentElement.scrollWidth,
          theme: document.documentElement.dataset.theme,
        };
      });
      expect(position.scopeLeft).toBeGreaterThanOrEqual(-1);
      expect(position.scopeRight).toBeLessThanOrEqual(position.controlsLeft + 1);
      expect(position.scopeTop).toBeGreaterThanOrEqual(position.titleBottom);
      expect(position.scopeBottom).toBeLessThanOrEqual(position.headerBottom + 1);
      expect(position.contentTop).toBeGreaterThanOrEqual(position.headerBottom);
      expect(position.scrollWidth).toBeLessThanOrEqual(width + 1);
      expect(position.theme).toBe(theme);

      for (const [path, title] of [
        ['/events', 'Moments'],
        ['/activities', 'Activities'],
        ['/financials/transactions', 'Transactions'],
        ['/settings/about', 'About DN'],
      ]) {
        await page.goto(path);
        await expect(header.getByRole('heading', { name: title })).toBeVisible();
        await expect(scope).toHaveText('Guest · On this device');
        await expect(page.locator('.dn-content > .dn-banner.dn-session-banner')).toHaveCount(0);
      }
      await header.getByRole('button', { name: 'Open profile and account menu' }).click();
      await expect(page.getByRole('menu', { name: 'Profile and account' }).getByText('Guest account')).toBeVisible();

      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map(key => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
