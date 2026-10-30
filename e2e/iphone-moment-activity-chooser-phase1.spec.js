import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// The Moments-list Activity chooser is a separate entry path from universal +.
// Chromium validates focus intent, not the physical Safari software keyboard.
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark']]) {
  test('Moment-list Activity chooser does not force phone keyboard at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events?create=activity');
    const picker = page.getByRole('dialog', { name: 'Choose a life moment', exact: true });
    await expect(picker).toBeVisible();

    const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    await picker.locator('.activity-event-option-main').first().click();
    const dialog = page.getByRole('dialog', { name: 'Add an activity', exact: true });
    const title = dialog.getByRole('textbox', { name: 'Activity title', exact: true });
    await expect(title).toBeVisible();
    await expect(title).not.toBeFocused();
    expect(await title.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
    await expect(dialog.getByLabel('Activity date', { exact: true })).toBeVisible();

    await title.click();
    await expect(title).toBeFocused();
    await title.fill('Unsaved phone chooser draft');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    const after = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    expect(after).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}
