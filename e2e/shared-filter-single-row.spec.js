import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// All embedded condition editors share one geometry contract. Test synthetic
// 320px and 390px viewports; native iOS Safari is a separate manual QA gate.
const routes = [
  ['/financials/transactions', 'Transactions'],
  ['/events', 'Moments'],
  ['/activities', 'Activities'],
  ['/events/moment-one/activities', 'Moment Activities'],
  ['/events/moment-one/transactions', 'Moment Transactions'],
];

async function assertOneRow(page) {
  const measurement = await page.locator('.dn-list-controls-panel .dn-condition-rule').first().evaluate((rule) => {
    const [field, comparison, value, remove] = [...rule.children].map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
    });
    const rect = rule.getBoundingClientRect();
    return { field, comparison, value, remove, rowHeight: rect.height, rowLeft: rect.left, rowRight: rect.right,
      pageWidth: document.documentElement.scrollWidth };
  });
  const { field, comparison, value, remove } = measurement;
  expect(Math.max(field.top, comparison.top, value.top, remove.top) -
    Math.min(field.top, comparison.top, value.top, remove.top)).toBeLessThanOrEqual(3);
  expect(field.right).toBeLessThanOrEqual(comparison.left + 2);
  expect(comparison.right).toBeLessThanOrEqual(value.left + 2);
  // On small iPhones the value may scroll beneath a pinned remove control.
  // Measure reachable geometry after scrolling, not the offscreen scroll area.
  expect(remove.right).toBeLessThanOrEqual(measurement.rowRight + 1);
  const pin = await page.locator('.dn-list-controls-panel .dn-condition-rule').first().evaluate((rule) => {
    const overflow = getComputedStyle(rule).overflowX;
    const scrollable = rule.scrollWidth > rule.clientWidth + 1;
    rule.scrollLeft = rule.scrollWidth;
    const box = rule.getBoundingClientRect();
    const icon = rule.querySelector('.dn-condition-icon').getBoundingClientRect();
    return { overflow, scrollable, left: box.left, right: box.right,
      iconLeft: icon.left, iconRight: icon.right };
  });
  if (pin.scrollable) {
    expect(pin.overflow).toBe('auto');
    expect(pin.iconLeft).toBeGreaterThanOrEqual(pin.left - 1);
    expect(pin.iconRight).toBeLessThanOrEqual(pin.right + 1);
  }
  expect(remove.height).toBeGreaterThanOrEqual(44);
  expect(measurement.rowHeight).toBeLessThanOrEqual(62);
  expect(measurement.pageWidth).toBeLessThanOrEqual(page.viewportSize().width + 1);
}

for (const [route, label] of routes) {
  for (const [width, height] of [[320, 640], [390, 844]]) {
    test(`${label}: filter field, comparison, value and remove remain on one row at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page);
      await page.goto(route);
      const refine = page.getByRole('button', { name: /^Filters and sort/ }).first();
      await expect(refine).toBeVisible();
      await refine.click();
      const add = page.getByRole('button', { name: 'Add filter', exact: true }).first();
      await add.click();
      const rule = page.locator('.dn-list-controls-panel .dn-condition-rule').first();
      await expect(rule).toBeVisible();
      await rule.getByRole('combobox', { name: 'Filter by' }).click();
      await page.locator('.dropdown-menu-portal [role="option"]').first().click();
      await expect(rule.getByRole('combobox', { name: 'Comparison' })).toBeEnabled();
      await assertOneRow(page);
      await expect(rule.getByRole('button', { name: 'Remove filter' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test('numeric range remains inside one row without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const errors = await seedGuest(page);
  await page.goto('/financials/transactions');
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  const rule = page.locator('.dn-list-controls-panel .dn-condition-rule').first();
  await rule.getByRole('combobox', { name: 'Filter by' }).click();
  await page.getByRole('option', { name: 'Amount', exact: true }).click();
  await rule.getByRole('combobox', { name: 'Comparison' }).click();
  await page.getByRole('option', { name: 'Between', exact: true }).click();
  await expect(rule.locator('.dn-condition-range input')).toHaveCount(2);
  await assertOneRow(page);
  expect(errors).toEqual([]);
});
