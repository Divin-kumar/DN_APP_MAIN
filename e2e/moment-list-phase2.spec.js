import { test, expect } from '@playwright/test';
import { addOriginal, seedGuest } from './fixtures.js';

test('Phase 2 Moment discovery is responsive, readable and action-safe', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/events');
  const cards = page.locator('.dn-v2-moment-card');
  await expect(cards).toHaveCount(2);
  const card = page.getByRole('group', { name: /Weekend in Ooty/ });
  await expect(card.getByRole('button', { name: /Open Weekend in Ooty/ })).toBeVisible();
  await expect(card.getByText('Choose the train')).toBeVisible();
  await expect(card.locator('.event-story-status')).toContainText('In progress');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box.width).toBeGreaterThan(160);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await card.getByRole('button', { name: /Actions for Weekend in Ooty/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Archive', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'PDF Studio', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toEqual(before);
  expect(errors).toEqual([]);
});

test('Phase 2 optional local photo cover uses an actual saved original', async ({ page }) => {
  const errors = await seedGuest(page);
  await addOriginal(page);
  await page.goto('/events');
  const card = page.getByRole('group', { name: /Weekend in Ooty/ });
  await expect(card.locator('.dn-v2-moment-cover img')).toBeVisible();
  await expect(card.getByText('Choose the train')).toBeVisible();
  expect(errors).toEqual([]);
});

// DN 2.1 phone QA: Moment card's action button must not shrink below a
// 44px tappable square or overlap the open-card title and metadata.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('Moment card action target and adjacent text at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events');
    const card = page.getByRole('group', { name: /Weekend in Ooty/ });
    const action = card.getByRole('button', { name: /Actions for Weekend in Ooty/ });
    const copy = card.locator('.dn-v2-moment-copy');
    await expect(action).toBeVisible();
    await expect(card.getByRole('button', { name: /Open Weekend in Ooty/ })).toBeVisible();
    const bounds = await action.boundingBox();
    const content = await copy.boundingBox();
    const surface = await card.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThanOrEqual(content.x + content.width - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(surface.x + surface.width + 1);
    expect(bounds.y).toBeGreaterThanOrEqual(surface.y);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(surface.y + surface.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    await action.click();
    await expect(page.getByRole('menuitem', { name: 'Archive', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'PDF Studio', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toEqual(original);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Archive', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
