import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Shared component layout, not page-specific patches. Browser geometry is a
// regression guard; it does not replace a native iOS Safari device check.
for (const [route, label] of [
  ['/financials/transactions', 'transactions'],
  ['/events', 'moments'],
  ['/activities', 'activities'],
  ['/events/moment-one/activities', 'moment activities'],
]) {
  for (const [width, height] of [[320, 640], [390, 844]]) {
    test(`Refine top row is compact and shared by ${label} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page);
      await page.goto(route);
      const refine = page.getByRole('button', { name: /^Filters and sort/ }).first();
      await expect(refine).toBeVisible();
      await refine.click();

      const panel = page.locator('.dn-list-controls-panel').first();
      const actions = panel.locator('.dn-list-controls-action-line');
      const field = actions.locator('.sort-control [role="combobox"]');
      const direction = actions.locator('.dn-sort-direction');
      const reset = actions.getByRole('button', { name: 'Reset', exact: true });
      const builder = panel.locator('.dn-list-controls-builder');

      await expect(actions).toBeVisible();
      await expect(field).toBeVisible();
      await expect(direction).toBeVisible();
      await expect(reset).toBeVisible();
      await expect(builder).toBeVisible();
      const geometry = await page.evaluate(() => {
        const panel = document.querySelector('.dn-list-controls-panel');
        const row = panel.querySelector('.dn-list-controls-action-line');
        const targets = [
          row.querySelector('.sort-control [role="combobox"]'),
          row.querySelector('.dn-sort-direction'),
          row.querySelector('.dn-list-controls-reset'),
        ].map((node) => {
          const r = node.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
        });
        const body = panel.querySelector('.dn-list-controls-builder').getBoundingClientRect();
        const bounds = panel.getBoundingClientRect();
        return { targets, bodyTop: body.top, panelLeft: bounds.left, panelRight: bounds.right, pageWidth: document.documentElement.scrollWidth };
      });
      const [sortBox, dirBox, resetBox] = geometry.targets;
      expect(Math.max(...geometry.targets.map((item) => item.top)) - Math.min(...geometry.targets.map((item) => item.top))).toBeLessThanOrEqual(5);
      expect(geometry.targets.every((item) => item.height >= 43.5)).toBe(true);
      expect(sortBox.left).toBeGreaterThanOrEqual(geometry.panelLeft - 1);
      expect(sortBox.right).toBeLessThanOrEqual(dirBox.left + 2);
      expect(dirBox.right).toBeLessThanOrEqual(resetBox.left + 2);
      expect(resetBox.right).toBeLessThanOrEqual(geometry.panelRight + 1);
      expect(sortBox.bottom).toBeLessThanOrEqual(geometry.bodyTop + 1);
      expect(geometry.pageWidth).toBeLessThanOrEqual(width + 1);

      const before = (await direction.textContent()).trim();
      expect(['Asc', 'Desc']).toContain(before);
      await direction.click();
      await expect(direction).toContainText(before === 'Asc' ? 'Desc' : 'Asc');
      await reset.click();
      await expect(direction).toContainText(before);
      expect(errors).toEqual([]);
    });
  }
}

test('selected sort value adjusts field width without moving right-side actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/events');
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  const actions = page.locator('.dn-list-controls-panel .dn-list-controls-action-line');
  const field = actions.getByRole('combobox', { name: 'Sort moments field' });
  const direction = actions.locator('.dn-sort-direction');
  const reset = actions.getByRole('button', { name: 'Reset' });
  const first = await field.boundingBox();
  const rightBefore = await Promise.all([direction, reset].map((element) => element.boundingBox()));
  await field.click();
  await page.getByRole('option', { name: 'Name', exact: true }).click();
  const second = await field.boundingBox();
  const rightAfter = await Promise.all([direction, reset].map((element) => element.boundingBox()));
  expect(first.width).toBeGreaterThan(second.width + 6);
  for (let i = 0; i < 2; i += 1) {
    expect(Math.abs(rightBefore[i].x - rightAfter[i].x)).toBeLessThanOrEqual(2);
  }
  await reset.click();
  expect(errors).toEqual([]);
});
