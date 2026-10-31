import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// The owner's prior checklist exercised Cancel; this exercises actual Reset
// with successful scoped record loads and verifies both preference rollback
// and complete record preservation.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  test(`Reset all settings safely restores baseline without deleting Guest records at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page);

    const recordsBefore = await page.evaluate(() =>
      ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
    await page.goto('/settings/code-lists');
    const activityOrder = page.getByRole('group', { name: 'Sort Activities in settings' });
    await activityOrder.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Title', exact: true }).click();
    await activityOrder.getByRole('button', { name: 'Sort descending' }).click();
    await expect(activityOrder.getByRole('button', { name: 'Sort ascending' })).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Reset all settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset all settings?' });
    await expect(dialog).toContainText('Saved default sorting and filters');
    await dialog.getByRole('button', { name: 'Reset all settings', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Settings restored to defaults. Existing records were preserved.')).toBeVisible();

    await page.goto('/settings/code-lists');
    const orderAfter = page.getByRole('group', { name: 'Sort Activities in settings' });
    await expect(orderAfter.getByRole('combobox')).toContainText('Due date');
    await expect(orderAfter.getByRole('button', { name: 'Sort descending' })).toBeVisible();
    expect(await page.evaluate(() =>
      ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(recordsBefore);
    expect(errors).toEqual([]);
  });
}
