import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium geometry and menu keyboard behavior; native Safari and VoiceOver remain separate gates.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('Account menu remains premium, useful and safe on ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      const trigger = page.getByRole('button', { name: 'Open profile and account menu' });
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const menu = page.getByRole('menu', { name: 'Profile and account' });
      await expect(menu).toBeVisible();
      await expect(menu.getByText('Guest account')).toBeVisible();
      const choices = menu.getByRole('menuitem');
      await expect(choices).toHaveCount(5);
      const sizes = await menu.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const items = [...element.querySelectorAll('[role="menuitem"]')]
          .map((item) => item.getBoundingClientRect().height);
        const button = document.querySelector('.profile-trigger').getBoundingClientRect();
        const themeButton = document.querySelector('.theme-toggle').getBoundingClientRect();
        return { menuLeft: rect.left, menuRight: rect.right, menuBottom: rect.bottom,
          bodyWidth: document.documentElement.scrollWidth,
          triggerHeight: button.height, triggerWidth: button.width,
          themeButtonHeight: themeButton.height, themeButtonWidth: themeButton.width, items };
      });
      expect(sizes.menuLeft).toBeGreaterThanOrEqual(-1);
      expect(sizes.menuRight).toBeLessThanOrEqual(width + 1);
      expect(sizes.menuBottom).toBeLessThanOrEqual(height + 1);
      expect(sizes.bodyWidth).toBeLessThanOrEqual(width + 1);
      expect(sizes.triggerHeight).toBeGreaterThanOrEqual(44);
      expect(sizes.triggerWidth).toBeGreaterThanOrEqual(44);
      expect(sizes.themeButtonHeight).toBeGreaterThanOrEqual(44);
      expect(sizes.themeButtonWidth).toBeGreaterThanOrEqual(44);
      expect(sizes.items.every((item) => item >= 44)).toBe(true);
      await menu.getByRole('menuitem', { name: 'Settings' }).click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(menu).toHaveCount(0);
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}

test('Account menu supports Arrow keys, Home/End and Escape with focus return', async ({ page }) => {
  const errors = await seedGuest(page, { theme: 'dark' });
  await page.goto('/dashboard');
  const trigger = page.getByRole('button', { name: 'Open profile and account menu' });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Profile and account' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Profile' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Transactions' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: 'Logout' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.getByRole('menuitem', { name: 'Profile' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(errors).toEqual([]);
});
