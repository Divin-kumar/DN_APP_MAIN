import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// One Settings baseline per top-level list. Working filters may be changed
// independently, and the Refine Reset restores saved Settings values.
const lists = [
  { domain: 'moments', label: 'Moments', path: '/events', option: 'Name', field: 'Sort moments field' },
  { domain: 'activities', label: 'Activities', path: '/activities', option: 'Title', field: 'Sort activities field' },
  { domain: 'transactions', label: 'Transactions', path: '/financials/transactions', option: 'Title', field: 'Sort transactions field' },
];
for (const config of lists) {
  for (const [width, height, theme] of [[320, 640, 'light'], [390, 844, 'dark'], [430, 932, 'light']]) {
    test(config.label + ' restores independent Settings sort defaults at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings/code-lists'); // Seed runs on navigation, not about:blank.
      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)));
      const settingsOrder = page.getByRole('group', { name: 'Sort ' + config.label + ' in settings' });
      await settingsOrder.getByRole('combobox').click();
      await page.getByRole('option', { name: config.option, exact: true }).click();
      await settingsOrder.getByRole('button', { name: 'Sort descending' }).click();
      await expect(settingsOrder.getByRole('button', { name: 'Sort ascending' })).toBeVisible();

      await page.goto(config.path);
      await page.getByRole('button', { name: /^Filters and sort/ }).click();
      const actions = page.locator('.dn-list-controls-panel .dn-list-controls-action-line');
      const field = actions.getByRole('combobox', { name: config.field });
      await expect(field).toContainText(config.option);
      await expect(actions.getByRole('button', { name: 'Sort ascending' })).toBeVisible();

      // Change the live view; it must not rewrite the saved Settings baseline.
      await actions.getByRole('button', { name: 'Sort ascending' }).click();
      await expect(actions.getByRole('button', { name: 'Sort descending' })).toBeVisible();
      await actions.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(field).toContainText(config.option);
      await expect(actions.getByRole('button', { name: 'Sort ascending' })).toBeVisible();

      await page.goto('/settings/code-lists');
      const originalSetting = page.getByRole('group', { name: 'Sort ' + config.label + ' in settings' });
      await expect(originalSetting.getByRole('combobox')).toContainText(config.option);
      await expect(originalSetting.getByRole('button', { name: 'Sort ascending' })).toBeVisible();
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}

test('Activity filter defaults stay in Settings and Reset restores their condition', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/settings/code-lists');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.getByRole('button', { name: /Activities filters/ }).click();
  const editor = page.locator('.dn-code-list-filter-editor .dn-conditions');
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Add filter' }).click();
  const rule = editor.locator('.dn-condition-rule').last();
  await rule.getByRole('combobox', { name: 'Filter by' }).click();
  await page.getByRole('option', { name: 'Priority', exact: true }).click();
  await rule.getByRole('combobox', { name: 'Value for Priority' }).click();
  await page.getByRole('option', { name: 'High priority', exact: true }).click();
  await expect(editor.getByRole('region', { name: 'Active filters' })).toContainText('Priority');

  await page.goto('/activities');
  const cards = page.locator('.dn-v2-activity-card');
  await expect(cards).toHaveCount(1);
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  await page.locator('.dn-list-controls-panel .dn-conditions').getByRole('button', { name: 'Clear all' }).click();
  await expect(cards).toHaveCount(4);
  await page.locator('.dn-list-controls-panel .dn-list-controls-action-line').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(cards).toHaveCount(1);
  await page.goto('/settings/code-lists');
  await page.getByRole('button', { name: /Activities filters/ }).click();
  await expect(page.locator('.dn-code-list-filter-editor .dn-conditions').getByRole('region', { name: 'Active filters' })).toContainText('Priority');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toEqual(before);
  expect(errors).toEqual([]);
});
