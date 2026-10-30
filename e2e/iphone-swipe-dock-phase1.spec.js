import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// The shared swipe popup also serves the keyboard-accessible Activity menu.
// Simulated safe areas verify placement math, not physical iPhone gestures.
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'dark'], [430, 932, 'light']]) {
  test('Activity swipe popup respects iPhone dock safe area at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events/moment-one/activities/shared');
    await page.addStyleTag({ content: 'html[data-theme] { --dn-safe-area-bottom: 34px !important; }' });
    const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));

    await page.getByRole('button', { name: 'Activity options', exact: true }).click();
    const menu = page.getByRole('menu', { name: /Actions for/ });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
    const popup = await menu.boundingBox();
    const dock = await page.locator('.mobile-tabbar').boundingBox();
    expect(popup.y + popup.height).toBeLessThanOrEqual(dock.y - 8 + 1);

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    const after = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });
}
