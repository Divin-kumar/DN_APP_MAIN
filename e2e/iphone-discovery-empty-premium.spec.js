import { test, expect } from '@playwright/test';
import { seedGuest, fixtureMoments } from './fixtures.js';

// Synthetic Guest checks; physical installed Safari, signed-in account and
// actual Firebase release acceptance remain separate gates.
const sections = [
  { route: '/events', title: 'No matching moments', input: 'Search events', cards: '.dn-v2-moment-card', count: 2 },
  { route: '/activities', title: 'No matching activities', input: 'Search activities and Moments', cards: '.dn-v2-activity-card', count: 3 },
];
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    for (const section of sections) {
      test(section.route + ' recovers an empty search at ' + width + 'px ' + theme, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const errors = await seedGuest(page, { theme });
        await page.goto(section.route);
        const records = page.locator(section.cards);
        await expect(records).toHaveCount(section.count);
        const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map((key) => localStorage.getItem(key)));
        await page.getByRole('searchbox', { name: section.input }).fill('no-match-discovery-999');
        const empty = page.locator('.dn-discovery-empty');
        await expect(empty.getByRole('heading', { name: section.title })).toBeVisible();
        const clear = empty.getByRole('button', { name: 'Restore saved defaults' });
        await expect(clear).toBeVisible();
        const geometry = await empty.evaluate((element) => ({
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
          buttonHeight: element.querySelector('button').getBoundingClientRect().height,
          documentWidth: document.documentElement.scrollWidth,
        }));
        expect(geometry.left).toBeGreaterThanOrEqual(-1);
        expect(geometry.right).toBeLessThanOrEqual(width + 1);
        expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
        expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
        await clear.click();
        await expect(records).toHaveCount(section.count);
        await expect(empty).toHaveCount(0);
        await expect(page.getByRole('searchbox', { name: section.input })).toHaveValue('');
        expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
          .map((key) => localStorage.getItem(key)))).toEqual(before);
        expect(errors).toEqual([]);
      });
    }
  }
}
test('A first-use Guest Moment list is not mistaken for a filtered list', async ({ page }) => {
  const errors = await seedGuest(page, { moments: [] });
  await page.goto('/events');
  const empty = page.locator('.dn-discovery-empty');
  await expect(empty.getByRole('heading', { name: 'Your story starts with one moment' })).toBeVisible();
  await expect(empty.getByRole('button')).toHaveCount(0);
  await page.goto('/activities');
  await expect(page.locator('.dn-discovery-empty').getByRole('heading', { name: 'Your activities start with a Moment' })).toBeVisible();
  await expect(page.locator('.dn-discovery-empty').getByRole('button')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('Moments without Activities show a separate first-use message', async ({ page }) => {
  const moments = fixtureMoments().map((moment) => ({ ...moment, activities: [] }));
  const errors = await seedGuest(page, { moments });
  await page.goto('/activities');
  const empty = page.locator('.dn-discovery-empty');
  await expect(empty.getByRole('heading', { name: 'No activities yet' })).toBeVisible();
  await expect(empty.getByRole('button')).toHaveCount(0);
  expect(errors).toEqual([]);
});
