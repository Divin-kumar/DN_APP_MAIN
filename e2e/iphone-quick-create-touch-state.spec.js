import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-225: iOS may retain :hover and button focus after a tap. The universal +
// must keep its resting premium color through repeated taps and form closing,
// with keyboard focus rings still available for non-touch input.
test.describe('iPhone universal + tap-state regression', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const [width, height, theme] of [[390, 844, 'light'], [430, 932, 'dark']]) {
    test(`center + does not stick in alternate color after touch actions (${width}px, ${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/dashboard');
      const dock = page.getByRole('navigation', { name: 'Main navigation' });
      const plus = dock.locator('.mobile-dock-create-trigger');
      await expect(plus).toBeVisible();
      const color = () => plus.evaluate((button) => {
        const style = getComputedStyle(button);
        return { background: style.backgroundImage, color: style.color, border: style.borderTopColor };
      });
      const resting = await color();
      expect(resting.background).not.toBe('none');

      // Touch hover can remain latched when the same element is tapped again.
      await plus.tap();
      await expect(dock.getByRole('group', { name: 'Quick create actions' })).toBeVisible();
      expect(await color()).toEqual(resting);
      await plus.tap();
      await expect(dock.getByRole('group', { name: 'Quick create actions' })).toHaveCount(0);
      expect(await color()).toEqual(resting);
      await expect(plus).not.toBeFocused();

      // Choosing a menu action and cancelling its dialog must also restore
      // the original + appearance without having to tap elsewhere.
      await plus.tap();
      await dock.getByRole('button', { name: 'Transaction', exact: true }).tap();
      const transaction = page.getByRole('dialog', { name: 'Add Transaction' });
      await expect(transaction).toBeVisible();
      await transaction.getByRole('button', { name: 'Cancel' }).tap();
      await expect(transaction).toHaveCount(0);
      await expect(plus).not.toBeFocused();
      expect(await color()).toEqual(resting);

      // Outside tap closes the menu and never changes the resting fill.
      await plus.tap();
      await page.locator('.brand-lockup').tap();
      await expect(dock.getByRole('group', { name: 'Quick create actions' })).toHaveCount(0);
      expect(await color()).toEqual(resting);
      expect(errors).toEqual([]);
    });
  }
});

// The pointer-only blur must not compromise keyboard operation or Escape's
// intentional return to the trigger.
test('keyboard Escape restores visible focus to + when closing quick create', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/dashboard');
  const plus = page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Open quick create menu' });
  await plus.focus();
  await plus.press('Enter');
  await expect(page.getByRole('group', { name: 'Quick create actions' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Quick create actions' })).toHaveCount(0);
  await expect(plus).toBeFocused();
  expect(errors).toEqual([]);
});
