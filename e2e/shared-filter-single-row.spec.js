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

async function assertReadablePhoneRule(page) {
  const measurement = await page.locator('.dn-refine-sheet .dn-condition-rule').first().evaluate((rule) => {
    const [field, comparison, value, remove] = [...rule.children].map((node) => {
      const r = node.getBoundingClientRect();
      return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, height:r.height, width:r.width };
    });
    const box = rule.getBoundingClientRect();
    return { field, comparison, value, remove,
      box:{ left:box.left, right:box.right, top:box.top, bottom:box.bottom, height:box.height },
      pageWidth:document.documentElement.scrollWidth };
  });
  const { field, comparison, value, remove, box } = measurement;
  // DN 2.3: full-width field above operator/value, with a separate Remove column.
  expect(field.bottom).toBeLessThanOrEqual(comparison.top + 3);
  expect(Math.abs(comparison.top - value.top)).toBeLessThanOrEqual(4);
  expect(field.right).toBeLessThanOrEqual(remove.left + 2);
  expect(comparison.right).toBeLessThanOrEqual(value.left + 2);
  expect(value.right).toBeLessThanOrEqual(remove.left + 2);
  expect(remove.left).toBeGreaterThanOrEqual(box.left - 1);
  expect(remove.right).toBeLessThanOrEqual(box.right + 1);
  expect(remove.top).toBeGreaterThanOrEqual(box.top - 1);
  expect(remove.bottom).toBeLessThanOrEqual(box.bottom + 1);
  expect(remove.width).toBeGreaterThanOrEqual(43.9);
  expect(remove.height).toBeGreaterThanOrEqual(43.9);
  expect(box.height).toBeGreaterThanOrEqual(88);
  expect(box.height).toBeLessThanOrEqual(220);
  expect(measurement.pageWidth).toBeLessThanOrEqual(page.viewportSize().width + 1);
}

for (const [route, label] of routes) {
  for (const [width, height] of [[320, 640], [390, 844]]) {
    test(`${label}: filter field, comparison, value and remove stay readable on two rows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page);
      await page.goto(route);
      const refine = page.getByRole('button', { name: /^Filters and sort/ }).first();
      await expect(refine).toBeVisible();
      await refine.click();
      const add = page.getByRole('button', { name: 'Add filter', exact: true }).first();
      await add.click();
      const rule = page.locator('.dn-refine-sheet .dn-condition-rule').first();
      await expect(rule).toBeVisible();
      await rule.getByRole('combobox', { name: 'Filter by' }).click();
      await page.locator('.dropdown-menu-portal [role="option"]').first().click();
      await expect(rule.getByRole('combobox', { name: 'Comparison' })).toBeEnabled();
      await assertReadablePhoneRule(page);
      await expect(rule.getByRole('button', { name: 'Remove filter' })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test('numeric range stays within a readable phone rule without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const errors = await seedGuest(page);
  await page.goto('/financials/transactions');
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  const rule = page.locator('.dn-refine-sheet .dn-condition-rule').first();
  await rule.getByRole('combobox', { name: 'Filter by' }).click();
  await page.getByRole('option', { name: 'Amount', exact: true }).click();
  await rule.getByRole('combobox', { name: 'Comparison' }).click();
  await page.getByRole('option', { name: 'Between', exact: true }).click();
  await expect(rule.locator('.dn-condition-range input')).toHaveCount(2);
  await assertReadablePhoneRule(page);
  expect(errors).toEqual([]);
});
