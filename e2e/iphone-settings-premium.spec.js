import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Chromium is not a substitute for physical iPhone Safari testing.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Settings overview stays calm, readable and functional at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      const home = page.locator('.dn-settings-home');
      const cards = home.locator('.settings-section');
      await expect(cards).toHaveCount(4);

      const measures = await cards.evaluateAll((nodes) => nodes.map((card) => {
        const toggle = card.querySelector('.settings-accordion-toggle');
        const chevron = toggle.querySelector('.settings-accordion-indicator');
        const cardRect = card.getBoundingClientRect();
        const toggleRect = toggle.getBoundingClientRect();
        const chevronRect = chevron.getBoundingClientRect();
        return {
          left: cardRect.left, right: cardRect.right,
          radius: parseFloat(getComputedStyle(card).borderTopLeftRadius),
          height: toggleRect.height, chevron: chevronRect.width,
          chevronHeight: chevronRect.height, svg: Boolean(chevron.querySelector('svg')),
        };
      }));
      expect(measures.every((item) => item.left >= -1 && item.right <= width + 1)).toBe(true);
      expect(measures.every((item) => item.radius >= 14 && item.height >= 60)).toBe(true);
      // The accordion BUTTON is the 68px+ tap target; chevron is decorative.
      expect(measures.every((item) => item.chevron >= 17 && item.chevronHeight >= 17 && item.svg)).toBe(true);

      const preferences = page.getByRole('button', { name: /Appearance & preferences/ });
      const backup = page.getByRole('button', { name: /Data & Backup/ });
      await expect(preferences).toHaveAttribute('aria-expanded', 'false');
      await preferences.click();
      await expect(preferences).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByText('Default currency', { exact: true })).toBeVisible();

      await backup.click();
      await expect(backup).toHaveAttribute('aria-expanded', 'true');
      await expect(preferences).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('button', { name: 'Export backup' })).toBeVisible();
      await expect(home.getByRole('link', { name: 'Open Code Lists page' })).toHaveAttribute('href', '/settings/code-lists');
      await expect(home.getByRole('link', { name: 'Open About page' })).toHaveAttribute('href', '/settings/about');

      const geometry = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        homeRight: document.querySelector('.dn-settings-home').getBoundingClientRect().right,
      }));
      expect(geometry.pageWidth).toBeLessThanOrEqual(width + 1);
      expect(geometry.homeRight).toBeLessThanOrEqual(width + 1);
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
