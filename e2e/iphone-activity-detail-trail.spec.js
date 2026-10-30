import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Chromium geometry/interaction coverage; native iPhone Safari remains a release gate.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Activity Detail parent trail is compact and usable at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/events/moment-one/activities/shared');

      await expect(page.getByRole('heading', { name: 'Book a lakeside stay', exact: true })).toBeVisible();
      const parent = page.getByRole('navigation', { name: 'Parent Moment' });
      const link = parent.getByRole('link', { name: 'Weekend in Ooty — family plans and memories' });
      await expect(link).toHaveAttribute('href', '/events/moment-one/activities');
      await expect(parent.getByText('Vacation', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Back to Activities' })).toBeVisible();
      await expect(page.locator('.activity-detail-facts .activity-status-pill')).toBeVisible();

      const geometry = await page.evaluate(() => {
        const nav = document.querySelector('.activity-parent-context');
        const link = nav.querySelector('a');
        const title = document.querySelector('.activity-detail-heading h1');
        const bounds = (node) => { const rect = node.getBoundingClientRect(); return { left:rect.left, right:rect.right, height:rect.height }; };
        return {
          parent: bounds(nav), link: bounds(link), title: bounds(title),
          pageWidth: document.documentElement.scrollWidth,
          ellipsis: getComputedStyle(link.querySelector('span')).textOverflow,
        };
      });
      expect(geometry.parent.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.parent.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.link.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.link.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.link.height).toBeGreaterThanOrEqual(44);
      expect(geometry.title.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.ellipsis).toBe('ellipsis');
      expect(geometry.pageWidth).toBeLessThanOrEqual(width + 1);

      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      await link.click();
      await expect(page).toHaveURL(/moment-one.*activities$/);
      expect(new URL(page.url()).pathname).toBe('/events/moment-one/activities');
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
