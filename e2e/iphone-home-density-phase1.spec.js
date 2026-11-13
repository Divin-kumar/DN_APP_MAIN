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
    // Approved compact greeting measures about 80px at narrow iPhone widths.
    expect(card.height).toBeGreaterThanOrEqual(76);
    expect(card.height).toBeLessThan(150);
    const moments = page.getByRole('region', { name: 'Moments', exact: true });
    const momentBox = await moments.boundingBox();
    expect(momentBox.y).toBeGreaterThanOrEqual(card.y + card.height - 1);
    expect(momentBox.y).toBeLessThan(height * 0.58);
    const momentDates = moments.getByRole('group', { name: 'Moment dates' });
    const activities = page.getByRole('region', { name: 'Activities', exact: true });
    const activityDates = activities.getByRole('group', { name: 'Activity dates' });
    await expect(momentDates).toBeVisible();
    await expect(activityDates).toBeVisible();

    // Date switches remain 44px touch targets, visibly readable on phones
    // and within each section header, never forcing horizontal scrolling.
    for (const segment of [momentDates, activityDates]) {
      for (const button of await segment.getByRole('button').all()) {
        const style = await button.evaluate((node) => {
          const buttonBox = node.getBoundingClientRect();
          const parentBox = node.closest('.dashboard-upcoming-card').getBoundingClientRect();
          return {
            font: parseFloat(getComputedStyle(node).fontSize),
            height: buttonBox.height,
            right: buttonBox.right,
            cardRight: parentBox.right,
          };
        });
        expect(style.font).toBeGreaterThanOrEqual(13);
        expect(style.height).toBeGreaterThanOrEqual(43.9);
        expect(style.right).toBeLessThanOrEqual(style.cardRight + 1);
      }
    }
    await activities.getByRole('button', { name: 'On This Day' }).click();
    await expect(activities.getByRole('button', { name: 'On This Day' })).toHaveAttribute('aria-pressed','true');
    await activities.getByRole('button', { name: 'Upcoming' }).click();

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
