import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Source-preserving Guest UI checks on synthetic Chromium, not a signed-in Firebase or Safari release gate.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('Storage scope remains visible without crowding first fold at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      const recordsBefore = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      const banner = page.getByRole('note', { name: /Guest mode: your data is stored locally on this device/ });
      await expect(banner).toBeVisible();
      await expect(banner).toHaveText('Guest · On this device');
      await expect(banner.locator('svg')).toBeVisible();
      const position = await banner.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const topCard = document.querySelector('.dn-route-transition').getBoundingClientRect();
        return {
          left: rect.left, right: rect.right, height: rect.height, bottom: rect.bottom,
          nextContentTop: topCard.top, scrollWidth: document.documentElement.scrollWidth,
          theme: document.documentElement.dataset.theme,
        };
      });
      expect(position.left).toBeGreaterThanOrEqual(-1);
      expect(position.right).toBeLessThanOrEqual(width + 1);
      expect(position.height).toBeGreaterThanOrEqual(22);
      expect(position.height).toBeLessThanOrEqual(32);
      expect(position.nextContentTop).toBeGreaterThanOrEqual(position.bottom);
      expect(position.scrollWidth).toBeLessThanOrEqual(width + 1);
      expect(position.theme).toBe(theme);
      await page.goto('/financials/transactions');
      await expect(page.getByRole('note', { name: /Guest mode: your data is stored locally on this device/ }))
        .toHaveText('Guest · On this device');
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(recordsBefore);
      expect(errors).toEqual([]);
    });
  }
}
