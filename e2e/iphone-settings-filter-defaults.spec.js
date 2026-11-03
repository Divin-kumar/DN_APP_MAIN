import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// One saved Settings baseline per top-level list, edited independently of
// temporary Refine drafts. Sort chips do not persist until Show results.
const lists = [
  { label: 'Moments', path: '/events', settings: 'Sort Moments in settings', sort: 'Sort moments', option: 'Name' },
  { label: 'Activities', path: '/activities', settings: 'Sort Activities in settings', sort: 'Sort activities', option: 'Title' },
  { label: 'Transactions', path: '/financials/transactions', settings: 'Sort Transactions in settings', sort: 'Sort transactions', option: 'Title' },
];
for (const config of lists) {
  for (const [width, height, theme] of [[320, 640, 'light'], [390, 844, 'dark'], [430, 932, 'light']]) {
    test(config.label + ' restores separate saved defaults at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings/list-defaults');
      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)));
      const settingsOrder = page.getByRole('group', { name: config.settings });
      const savedSort = settingsOrder.getByRole('button', { name: 'Sort by ' + config.option, exact: true });
      await savedSort.click(); // Changing the field always begins ascending.
      const ascending = settingsOrder.getByRole('button', { name: 'Sort by ' + config.option + ', ascending' });
      await expect(ascending).toHaveAttribute('aria-pressed', 'true');
      await ascending.click(); // Tapping the selected field reverses direction.
      await expect(settingsOrder.getByRole('button', { name: 'Sort by ' + config.option + ', descending' })).toBeVisible();

      await page.goto(config.path);
      await page.getByRole('button', { name: /^Filters and sort/ }).click();
      let sheet = page.getByRole('dialog');
      const chips = sheet.getByRole('group', { name: config.sort });
      await expect(chips.getByRole('button', { name: new RegExp('^Sort by ' + config.option + ', descending') })).toBeVisible();
      await chips.getByRole('button', { name: new RegExp('^Sort by ' + config.option + ', descending') }).click();
      await expect(chips.getByRole('button', { name: new RegExp('^Sort by ' + config.option + ', ascending') })).toBeVisible();
      await sheet.getByRole('button', { name: 'Show results' }).click();
      await page.getByRole('button', { name: /^Filters and sort/ }).click();
      sheet = page.getByRole('dialog');
      await sheet.getByRole('button', { name: 'Reset', exact: true }).click();
      await expect(chips.getByRole('button', { name: new RegExp('^Sort by ' + config.option + ', descending') })).toBeVisible();
      await sheet.getByRole('button', { name: 'Show results' }).click();

      await page.goto('/settings/list-defaults');
      const saved = page.getByRole('group', { name: config.settings });
      await expect(saved.getByRole('button', { name: 'Sort by ' + config.option + ', descending' })).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}

test('Activity filter baseline Reset stages conditions until Show results', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/settings/list-defaults');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.getByRole('button', { name: /Activities filters/ }).click();
  const editor = page.locator('.dn-code-list-filter-editor .dn-conditions');
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
  let sheet = page.getByRole('dialog', { name: 'Activity filters' });
  await sheet.getByRole('button', { name: 'Clear all' }).click();
  await expect(cards).toHaveCount(1); // Draft only.
  await sheet.getByRole('button', { name: 'Show results' }).click();
  await expect(cards).toHaveCount(4);
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  sheet = page.getByRole('dialog', { name: 'Activity filters' });
  await sheet.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(cards).toHaveCount(4);
  await sheet.getByRole('button', { name: 'Show results' }).click();
  await expect(cards).toHaveCount(1);
  await page.goto('/settings/list-defaults');
  await page.getByRole('button', { name: /Activities filters/ }).click();
  await expect(page.locator('.dn-code-list-filter-editor .dn-conditions')
    .getByRole('region', { name: 'Active filters' })).toContainText('Priority');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toEqual(before);
  expect(errors).toEqual([]);
});
