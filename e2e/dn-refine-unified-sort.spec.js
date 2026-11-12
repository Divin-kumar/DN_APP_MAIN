import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic touch Chromium only; native iPhone Safari is a separate QA gate.
test.use({ hasTouch: true, isMobile: true });
const routes = [
  { route: '/events', trigger: /^Filters and sort/ },
  { route: '/activities', trigger: /^Filters and sort/ },
  { route: '/financials', trigger: /^Filters and sort/ },
  { route: '/tasks', trigger: /^Refine$/ },
];
for (const width of [320, 390, 430]) {
  for (const { route, trigger } of routes) {
    test(`${route}: two-column sorts, reversible draft and safe Cancel at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 320 ? 640 : width === 390 ? 844 : 932 });
      const errors = await seedGuest(page);
      await page.goto(route);
      const snapshot = () => page.evaluate(() => ({
        records: ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses', 'dn_guest_tasks']
          .map((key) => localStorage.getItem(key)),
        settings: Object.fromEntries(Object.keys(localStorage).filter((key) =>
          key.startsWith('dn_list_state_')).sort().map((key) => [key, localStorage.getItem(key)])),
      }));
      await page.getByRole('button', { name: trigger }).first().tap();
      const sheet = page.getByRole('dialog').last();
      await expect(sheet).toBeVisible();
      // Initial list-state migration is a legitimate first-open write.
      // Observe it before comparing the Cancel draft's persisted state.
      if (route !== '/tasks') {
        const domain = route === '/events' ? 'moments'
          : route === '/activities' ? 'activities' : 'transactions';
        await expect.poll(() => page.evaluate((scope) => {
          const key = `dn_list_state_guest_${encodeURIComponent('conditions:' + scope)}`;
          return JSON.parse(localStorage.getItem(key) || 'null')?.migrationVersion || 0;
        }, domain)).toBeGreaterThanOrEqual(1);
      }
      const before = await snapshot();
      const sorts = sheet.locator('.dn-refine-sort-chips');
      const geometry = await sorts.evaluate((node) => ({
        columns: getComputedStyle(node).gridTemplateColumns.split(' ').length,
        overflow: node.scrollWidth - node.clientWidth,
        bounds: { left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right },
        items: [...node.querySelectorAll('button')].map((button) => {
          const r = button.getBoundingClientRect();
          return { left: r.left, right: r.right, height: r.height };
        }),
      }));
      expect(geometry.columns).toBe(2);
      expect(geometry.overflow).toBeLessThanOrEqual(1);
      expect(geometry.items.length).toBeGreaterThanOrEqual(3);
      for (const item of geometry.items) {
        expect(item.height).toBeGreaterThanOrEqual(43.9);
        expect(item.left).toBeGreaterThanOrEqual(geometry.bounds.left - 1);
        expect(item.right).toBeLessThanOrEqual(geometry.bounds.right + 1);
      }
      const selected = sorts.locator('button[aria-pressed="true"]');
      await expect(selected).toHaveCount(1);
      const initial = await selected.getAttribute('aria-label');
      const reverse = sheet.getByRole('button', { name: /^Reverse sort direction/ });
      await expect(reverse).toBeVisible();
      expect((await reverse.boundingBox()).height).toBeGreaterThanOrEqual(43.9);
      await reverse.tap();
      const updated = await selected.getAttribute('aria-label');
      expect(updated).not.toBe(initial);
      expect(updated).toMatch(/ascending|descending/);
      await expect(sheet.locator('.dn-refine-sort-direction-current strong')).not.toBeEmpty();
      await sheet.getByRole('button', { name: 'Cancel', exact: true }).tap();
      await expect(sheet).toHaveCount(0);
      expect(await snapshot()).toEqual(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width + 1);
      expect(errors).toEqual([]);
    });
  }
}
