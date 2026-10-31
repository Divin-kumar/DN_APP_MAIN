import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium layout/route coverage; installed iPhone Safari remains unverified.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Moment workspace keeps one elegant, usable tab rail at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/events/moment-one/story');

      const nav = page.locator('.event-workspace-nav.dn-moment-nav');
      const items = nav.locator('a');
      await expect(items).toHaveCount(5);
      expect(await items.allTextContents()).toEqual(['Story', 'Activities3', 'Transactions', 'Gallery', 'PDF Studio']);
      await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', '/events/moment-one/story');
      await expect(page.locator('.dn-moment-panel #dn-moment-panel-title')).toHaveText('Your Moment Story');
      await expect(page.locator('.dn-moment-panel .dn-workspace-section-heading')).toHaveCount(0);

      const initial = await nav.evaluate((element) => {
        const links = [...element.querySelectorAll('a')];
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left:box.left, right:box.right,
          rows:links.map((link) => Math.round(link.getBoundingClientRect().top)),
          targets:links.map((link) => link.getBoundingClientRect().height),
          iconVisibility:links.map((link) => getComputedStyle(link.querySelector('svg')).display),
          topBorder:parseFloat(style.borderTopWidth),
          radius:parseFloat(style.borderTopLeftRadius),
          scrollWidth:element.scrollWidth, clientWidth:element.clientWidth,
          pageWidth:document.documentElement.scrollWidth,
        };
      });
      expect(initial.left).toBeGreaterThanOrEqual(-1);
      expect(initial.right).toBeLessThanOrEqual(width + 1);
      expect(new Set(initial.rows).size).toBe(1);
      expect(initial.targets.every((height) => height >= 44)).toBe(true);
      expect(initial.iconVisibility.every((display) => display !== 'none')).toBe(true);
      expect(initial.topBorder).toBe(0);
      expect(initial.radius).toBe(0);
      expect(initial.pageWidth).toBeLessThanOrEqual(width + 1);

      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      await nav.locator('a[href="/events/moment-one/gallery"]').click();
      await expect(page.locator('.dn-moment-panel #dn-moment-panel-title')).toHaveText('Gallery');
      await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute('href', '/events/moment-one/gallery');
      await expect.poll(() => nav.evaluate((element) => {
        const outer = element.getBoundingClientRect();
        const active = element.querySelector('[aria-current="page"]').getBoundingClientRect();
        return active.left >= outer.left - 1 && active.right <= outer.right + 1;
      })).toBe(true);
      await nav.locator('a[href="/events/moment-one/story"]').click();
      await expect(page.locator('.dn-moment-panel #dn-moment-panel-title')).toHaveText('Your Moment Story');
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
