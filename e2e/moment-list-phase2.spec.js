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
    // Browser geometry can differ by a fraction of a CSS pixel (CI 43.99997px).
    // CSS declares a 44px square, so allow only subpixel rasterization.
    expect(bounds.width).toBeGreaterThanOrEqual(43.95);
    expect(bounds.height).toBeGreaterThanOrEqual(43.95);
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


// DN 2.1: the single-Moment back link is a real navigation control, not
// decorative microtext. Verify touch geometry without changing Guest records.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('Moment detail All moments link is readable and tappable at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events/moment-one/overview');
    const back = page.getByRole('link', { name: 'All moments', exact: true });
    await expect(back).toBeVisible();
    const metrics = await back.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      const text = getComputedStyle(node);
      return { width: bounds.width, height: bounds.height, right: bounds.right,
        fontSize: parseFloat(text.fontSize), outlineStyle: text.outlineStyle,
        pageWidth: document.documentElement.scrollWidth };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(43.95);
    expect(metrics.height).toBeGreaterThanOrEqual(43.95);
    expect(metrics.fontSize).toBeGreaterThanOrEqual(12);
    expect(metrics.right).toBeLessThanOrEqual(width + 1);
    expect(metrics.pageWidth).toBeLessThanOrEqual(width + 1);
    const before = await page.evaluate(() => [
      'dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses',
    ].map((key) => localStorage.getItem(key)));
    await back.focus();
    await expect(back).toBeFocused();
    await expect(back).toHaveCSS('outline-style', 'solid');
    await back.click();
    await expect(page).toHaveURL(/\/events\/?$/);
    await expect(page.getByRole('group', { name: /Weekend in Ooty/ })).toBeVisible();
    await page.goto('/events/moment-one/activities');
    await expect(page.getByRole('link', { name: 'All moments', exact: true })).toBeVisible();
    const after = await page.evaluate(() => [
      'dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses',
    ].map((key) => localStorage.getItem(key)));
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });
}
