import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Guest browser coverage, not a physical Safari/VoiceOver assertion.
for (const [width, height, theme] of [[1280, 900, 'light'], [1024, 768, 'dark']]) {
  test(`desktop + exposes and focuses its action choices at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/dashboard');
    const source = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ]);

    const plus = page.locator('.dn-quick-create-trigger');
    await expect(plus).toBeVisible();
    await plus.focus();
    await plus.press('Enter');
    await expect(plus).toHaveAttribute('aria-expanded', 'true');
    await expect(plus).toHaveAttribute('aria-controls', 'dn-desktop-quick-create');
    const menu = page.locator('#dn-desktop-quick-create');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'group');
    await expect(menu).toHaveAttribute('aria-label', 'Quick create actions');
    const actions = menu.getByRole('button');
    await expect(actions.first()).toBeFocused();
    await expect(actions.first()).toHaveText('Life moment');
    await page.keyboard.press('Tab');
    await expect(actions.nth(1)).toBeFocused();
    await expect(actions.nth(1)).toHaveText('Activity');

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(plus).toBeFocused();
    await expect(plus).toHaveAttribute('aria-expanded', 'false');

    await plus.press(' ');
    await expect(actions.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(plus).toBeFocused();

    // Pointer opens do not forcibly focus an action.
    await page.locator('.brand-lockup').click();
    await plus.click();
    await expect(menu).toBeVisible();
    await expect(actions.first()).not.toBeFocused();
    await page.locator('.brand-lockup').click();
    await expect(menu).toHaveCount(0);
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ])).toEqual(source);
    expect(errors).toEqual([]);
  });
}

test('desktop keyboard action opens a transaction form without record writes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors = await seedGuest(page);
  await page.goto('/activities');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_expenses'));
  const plus = page.locator('.dn-quick-create-trigger');
  await plus.focus();
  await plus.press('Enter');
  const menu = page.locator('#dn-desktop-quick-create');
  await expect(menu.getByRole('button', { name: 'Life moment' })).toBeFocused();
  await menu.getByRole('button', { name: 'Transaction', exact: true }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Add Transaction' });
  await expect(dialog).toBeVisible();
  await expect(menu).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_expenses'))).toBe(before);
  expect(errors).toEqual([]);
});
