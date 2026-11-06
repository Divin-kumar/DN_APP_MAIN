import { test, expect } from '@playwright/test';
import { addOriginal, seedGuest } from './fixtures.js';

test('Moment card opens its own detail hero through a shared visual name', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/events');
  const card = page.locator('.dn-v2-moment-card', { hasText: 'Weekend in Ooty' });
  const opener = card.locator('.dn-v2-moment-open');
  await expect(opener).toBeVisible();
  const name = await opener.evaluate((element) => element.style.viewTransitionName);
  expect(name).toMatch(/^dn-moment-card-/);
  await opener.click();
  await expect(page).toHaveURL(/\/events\/moment-one\/story$/);
  const hero = page.locator('.event-moment-hero');
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.evaluate((element) => element.style.viewTransitionName)).toBe(name);
  expect(errors).toEqual([]);
});

test('Gallery thumbnail opens original without changing its bytes or linked record', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await addOriginal(page, { width: 600, height: 900, count: 1 });
  await page.goto('/events/moment-one/gallery');
  const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const tile = page.getByRole('button', { name: 'Preview Moment-only.png' });
  const thumb = tile.locator('img');
  await expect(thumb).toBeVisible();
  const name = await thumb.evaluate((node) => node.style.viewTransitionName);
  expect(name).toMatch(/^dn-gallery-photo-/);
  await tile.click();
  const dialog = page.getByRole('dialog', { name: 'Moment-only.png' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img.dn-attachment-original')).toHaveAttribute('src', /blob:/);
  await expect.poll(() => dialog.locator('img.dn-attachment-original').evaluate((node) => node.style.viewTransitionName)).toBe(name);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(thumb).toHaveAttribute('src', /blob:/);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
  expect(errors).toEqual([]);
});

for (const width of [390, 1280]) {
  test('Universal plus morphs without swapping the action or hiding keyboard access at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await seedGuest(page);
    await page.goto('/dashboard');
    const trigger = page.getByRole('button', { name: 'Open quick create menu' });
    await expect(trigger).toBeVisible();
    await expect(trigger.locator('.dn-create-glyph')).toHaveCount(1);
    await trigger.click();
    await expect(page.getByRole('button', { name: 'Task', exact: true })).toBeVisible();
    const open = page.locator('.dn-command-trigger');
    await expect(open).toHaveAttribute('aria-expanded','true');
    await expect(open.locator('.dn-create-glyph')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Open quick create menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(errors).toEqual([]);
  });
}

test('Moment section underline follows the selected tab without changing route destinations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/events/moment-one/story');
  const nav = page.locator('.dn-moment-nav');
  await expect(nav.locator('.dn-moment-nav-motion-underline')).toHaveCount(1);
  await nav.getByRole('link', { name: 'Gallery' }).click();
  await expect(page).toHaveURL(/\/events\/moment-one\/gallery$/);
  await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('aria-label', 'Gallery');
  await expect(nav.locator('[aria-current="page"] .dn-moment-nav-motion-underline')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('Applied filter motion keeps OR semantics and never mutates records', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.addInitScript(() => {
    const key = 'dn_list_state_guest_conditions%3Aactivities';
    if (localStorage.getItem('dn_motion_filter_seed')) return;
    localStorage.setItem(key, JSON.stringify({ migrationVersion: 1, group: { id: 'root', kind: 'group', join: 'OR', children: [
      { id: 'motion-open', kind: 'rule', field: 'activity.status', operator: 'eq', value: 'in-progress' },
      { id: 'motion-done', kind: 'rule', field: 'activity.status', operator: 'eq', value: 'completed' },
    ] } }));
    localStorage.setItem('dn_motion_filter_seed', '1');
  });
  await page.goto('/activities');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const chips = page.locator('.dn-condition-chip-rail .dn-condition-chip');
  await expect(chips).toHaveCount(2);
  await chips.first().getByRole('button', { name: /^Remove filter/ }).click();
  await expect(chips).toHaveCount(1);
  const group = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_list_state_guest_conditions%3Aactivities')).group);
  expect(group.join).toBe('OR');
  expect(group.children).toHaveLength(1);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  expect(errors).toEqual([]);
});

test('Loading fade and shared transition defer to Reduce Motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await seedGuest(page);
  await page.goto('/events');
  const list = page.locator('.life-journey.dn-motion-loaded');
  await expect(list).toBeVisible();
  await expect.poll(() => list.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.locator('.dn-v2-moment-card').first().locator('.dn-v2-moment-open').click();
  await expect(page).toHaveURL(/\/events\/[^/]+\/story$/);
  expect(errors).toEqual([]);
});
