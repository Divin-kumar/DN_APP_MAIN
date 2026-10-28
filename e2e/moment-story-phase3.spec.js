import { test, expect } from '@playwright/test';
import { addOriginal, seedGuest } from './fixtures.js';

test('Phase 3 reads original Activity dates and shows future, undated and legacy notes separately', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/events/moment-one/overview');
  const story = page.locator('.dn-v2-story');
  await expect(story).toBeVisible();
  await expect(story.getByRole('region', { name: 'Recorded chapters' })).toContainText('Choose the train');
  await expect(story.getByRole('region', { name: 'Upcoming activities' })).toContainText('Book a lakeside stay');
  await expect(story.getByRole('region', { name: 'Activities without dates' })).toContainText('A cancelled plan');
  await expect(story.getByRole('region', { name: 'Legacy reflections' })).toContainText('Planning together');
  await expect(story.getByRole('button', { name: 'Add introduction' })).toBeVisible();
  await story.getByRole('link', { name: /Choose the train/ }).click();
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/completed$/);
  expect(errors).toEqual([]);
});

test('old Memories bookmarks show preserved reflections and no redundant navigation', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/events/moment-one/memories');
  await expect(page.getByRole('heading', { name: 'Your Moment Story' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Legacy reflections' })).toContainText('Planning together');
  await expect(page.locator('.event-workspace-nav a')).toHaveCount(4);
  await expect(page.locator('.event-workspace-nav')).not.toContainText('Memories');
  await expect(page.getByRole('button', { name: /Remove Planning together/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('real original photos stay with their Moment or Activity in a responsive Story', async ({ page }) => {
  const errors = await seedGuest(page);
  await addOriginal(page);
  await page.goto('/events/moment-one/overview');
  const story = page.locator('.dn-v2-story');
  await expect(story.locator('.dn-v2-story-intro .dn-attachment-gallery img')).toBeVisible();
  const linkedTile = story.locator('[data-story-activity="shared"] .dn-attachment-tile');
  await expect(linkedTile).toBeAttached();
  await linkedTile.scrollIntoViewIfNeeded();
  await expect(linkedTile.locator('img')).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 840 });
    await expect(story).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
