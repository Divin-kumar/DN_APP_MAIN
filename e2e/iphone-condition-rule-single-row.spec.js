import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Visual geometry catches the very small-screen regression where Field,
// Comparison, and Value formerly became illegible yet still occupied one row.
// CSS is shared by Moments, Activities, nested Activities, Transactions and
// the saved Settings default editor. Phone controls wrap without overlapping.
const pages = [
  { path: '/events', label: 'Moments', field: 'Status', value: 'In progress' },
  { path: '/activities', label: 'Activities', field: 'Priority', value: 'High priority' },
  { path: '/events/moment-one/activities', label: 'Moment Activities', field: 'Priority', value: 'High priority' },
  { path: '/financials/transactions', label: 'Transactions', field: 'Type', value: 'Income' },
];

async function exerciseRule(page, fieldName, valueName, width) {
  const builder = page.locator('.dn-conditions').first();
  await builder.getByRole('button', { name: 'Add filter' }).click();
  const rule = builder.locator('.dn-condition-rule').last();
  await expect(rule).toBeVisible();
  await rule.getByRole('combobox', { name: 'Filter by' }).click();
  await page.getByRole('option', { name: fieldName, exact: true }).click();
  await rule.getByRole('combobox', { name: `Value for ${fieldName}` }).click();
  await page.getByRole('option', { name: valueName, exact: true }).click();

  const metrics = await rule.evaluate((node) => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        width: rect.width, height: rect.height };
    };
    const entries = [...node.children].map(box);
    const ruleBox = box(node);
    const remove = box(node.querySelector('.dn-condition-icon'));
    const css = getComputedStyle(node);
    return { rule: ruleBox, entries, remove,
      scrollWidth: node.scrollWidth, clientWidth: node.clientWidth,
      overflowX: css.overflowX, columns: css.gridTemplateColumns,
      documentWidth: document.documentElement.scrollWidth };
  });
  // Five controls now share one row: drag grip + Field / Comparison /
  // Value / Remove. The underlying data is unchanged.
  expect(metrics.entries).toHaveLength(5);
  const [field, comparison, value, remove, grip] = metrics.entries;
  expect(metrics.documentWidth).toBeLessThanOrEqual(width + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(Math.abs(field.top - comparison.top)).toBeLessThanOrEqual(5);
  expect(Math.abs(comparison.top - value.top)).toBeLessThanOrEqual(5);
  expect(grip.right).toBeLessThanOrEqual(field.left + 2);
  expect(field.right).toBeLessThanOrEqual(comparison.left + 2);
  expect(comparison.right).toBeLessThanOrEqual(value.left + 2);
  expect(value.right).toBeLessThanOrEqual(remove.left + 2);
  expect(remove.right).toBeLessThanOrEqual(metrics.rule.right + 1);
  expect(remove.width).toBeGreaterThanOrEqual(43.9);
  expect(grip.height).toBeGreaterThanOrEqual(43.9);
  for (const trigger of await rule.locator('.dropdown-trigger').all()) {
    expect(await trigger.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  }
  await page.screenshot({ path: `.verification/readable-filter-${width}.png` });
  await rule.getByRole('button', { name: 'Remove filter' }).click();
  await expect(builder.getByRole('button', { name: 'Add filter' })).toBeVisible();
}

for (const { path, label, field, value } of pages) {
  for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
    for (const theme of ['dark', 'light']) {
      test(`${label} keeps each Refine rule on readable rows without overlap at ${width}px ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const errors = await seedGuest(page, { theme });
        await page.goto(path);
        const before = await page.evaluate(() =>
          ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
            .map(key => localStorage.getItem(key)));
        await page.getByRole('button', { name: /^Filters and sort/ }).first().click();
        await exerciseRule(page, field, value, width);
        expect(await page.evaluate(() =>
          ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
            .map(key => localStorage.getItem(key)))).toEqual(before);
        expect(errors).toEqual([]);
      });
    }
  }
}

for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  test(`Settings default filter editor inherits the same readable layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page);
    await page.goto('/settings/code-lists#list-order');
    await page.getByRole('button', { name: 'Activities filters' }).click();
    await exerciseRule(page, 'Priority', 'High priority', width);
    expect(errors).toEqual([]);
  });
}
