import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic network-status events protect presentation; native offline PWA
// storage/sync tests remain a separate release verification gate.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('Offline Guest cue keeps the page usable at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      const original = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      const banner = page.getByRole('status', { name: /Offline. Guest data is stored on this device/ });
      await expect(banner).toHaveCount(0);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(banner).toBeVisible();
      await expect(banner).toHaveText('Offline · Guest data stays here');
      await expect(banner).toHaveAttribute('aria-atomic', 'true');
      const rect = await banner.evaluate((node) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, height: r.height,
          viewport: window.innerWidth, contentWidth: document.documentElement.scrollWidth,
          background: getComputedStyle(node).backgroundColor };
      });
      expect(rect.left).toBeGreaterThanOrEqual(-1);
      expect(rect.right).toBeLessThanOrEqual(width + 1);
      expect(rect.height).toBeGreaterThanOrEqual(28);
      expect(rect.height).toBeLessThanOrEqual(43);
      expect(rect.contentWidth).toBeLessThanOrEqual(width + 1);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(banner).toHaveCount(0);
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(original);
      expect(errors).toEqual([]);
    });
  }
}
