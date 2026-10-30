import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Chromium checks cover responsive geometry, not native iOS Safari.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('compact Home exposes Moments sooner at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/dashboard');

    const saved = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const greeting = page.locator('.dashboard-greeting[aria-label="Dashboard greeting"]');
    await expect(greeting.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(greeting.locator('time')).toBeVisible();
    await expect(greeting.locator('.dashboard-greeting-copy')).toHaveCount(0);

    const card = await greeting.boundingBox();
    expect(card.height).toBeGreaterThanOrEqual(94);
    expect(card.height).toBeLessThan(150);
    const moments = page.getByRole('region', { name: 'Moments', exact: true });
    const momentBox = await moments.boundingBox();
    expect(momentBox.y).toBeGreaterThanOrEqual(card.y + card.height - 1);
    expect(momentBox.y).toBeLessThan(height * 0.58);
    await expect(moments.getByRole('group', { name: 'Moment dates' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Activities', exact: true })).toBeVisible();

    await moments.getByRole('button', { name: 'On This Day' }).click();
    await expect(moments.getByRole('button', { name: 'On This Day' })).toHaveAttribute('aria-pressed', 'true');
    await moments.getByRole('button', { name: 'Upcoming' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const after = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    expect(after).toEqual(saved);
    expect(errors).toEqual([]);
  });
}
