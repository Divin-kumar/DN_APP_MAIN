import { test, expect } from '@playwright/test';
import { addOriginal, seedGuest } from './fixtures.js';

// Both Activity entry points must render the same photo-led card. Chromium
// geometry is a regression guard, not a claim of native iOS Safari validation.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('Moment Activities reuse premium Activity card at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/events/moment-one/activities');

      const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
      await expect(card).toBeVisible();
      await expect(card).toHaveClass(/dn-v2-activity-card/);
      await expect(card.locator('.dn-v2-activity-cover')).toBeVisible();
      await expect(card.locator('.dn-v2-activity-cover-symbol')).toBeVisible();
      await expect(card.locator('.event-activity-status')).toHaveText('In progress');
      await expect(card.locator('.event-activity-moment-name')).toHaveCount(0);
      await expect(card.locator('.event-activity-context')).toContainText(/Due|Past due/);
      await expect(card.getByRole('button', { name: 'Activity options' })).toHaveCount(0);
      const measurement = await card.evaluate((node) => {
        const rect = (selector) => node.querySelector(selector).getBoundingClientRect();
        const cover = rect('.dn-v2-activity-cover'), copy = rect('.event-activity-copy');
        const title = rect('.event-activity-title-row strong'), status = rect('.event-activity-status');
        const action = rect('.dn-v2-activity-cover-action');
        return {
          coverWidth: cover.width, coverRight: cover.right, copyLeft: copy.left,
          titleTop: title.top, titleRight: title.right, statusTop: status.top,
          statusLeft: status.left, statusRight: status.right, copyRight: copy.right,
          actionSize: [action.width, action.height], cardRight: node.getBoundingClientRect().right,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(measurement.coverWidth).toBeGreaterThanOrEqual(79.9);
      expect(measurement.coverWidth).toBeLessThanOrEqual(94.1);
      expect(measurement.copyLeft).toBeGreaterThanOrEqual(measurement.coverRight - 1);
      expect(measurement.statusTop).toBeLessThanOrEqual(measurement.titleTop + 8);
      expect(measurement.statusLeft).toBeGreaterThanOrEqual(measurement.titleRight + 4);
      expect(measurement.statusRight).toBeLessThanOrEqual(measurement.copyRight + 1);
      expect(measurement.actionSize.every((n) => n >= 43.9)).toBe(true);
      expect(measurement.cardRight).toBeLessThanOrEqual(width + 1);
      expect(measurement.pageWidth).toBeLessThanOrEqual(width + 1);

      const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
      await card.getByRole('button', { name: 'Manage photos for Book a lakeside stay' }).click();
      await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
      expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
      expect(errors).toEqual([]);
    });
  }
}

test('selected card photo is shared by Moment Activities and All Activities without modifying originals', async ({ page }) => {
  const errors = await seedGuest(page);
  await addOriginal(page, { count: 2 });
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.goto('/events/moment-one/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(card.locator('.dn-v2-activity-cover img')).toBeVisible();
  await card.getByRole('button', { name: 'Choose cover photo for Book a lakeside stay' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose activity cover photo', exact: true });
  const alternate = picker.getByRole('button', { name: 'Use as cover: Activity photo 1.png', exact: true });
  await expect(alternate).toBeEnabled();
  await alternate.click();
  await expect(picker).toHaveCount(0);
  const selected = await page.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.includes('activity-cover%3A'))
    .map(([, raw]) => JSON.parse(raw).imageKey).filter(Boolean));
  expect(selected.some((key) => key.includes('photo-1'))).toBe(true);

  await page.goto('/activities');
  const allCard = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(allCard.locator('.dn-v2-activity-cover img')).toBeVisible();
  await expect(allCard.getByRole('button', { name: 'Choose cover photo for Book a lakeside stay' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true })
    .locator('.dn-v2-activity-cover img')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  expect(errors).toEqual([]);
});
