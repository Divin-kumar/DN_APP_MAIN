import { test, expect } from '@playwright/test';
import { accountScope, addOriginal, seedGuest } from './fixtures.js';

const detail = '/events/moment-one/activities/shared';
async function editCover(page) { await page.getByRole('button', { name: 'Reposition cover photo', exact: true }).click(); }
async function zoomIn(page, times = 1) {
  for (let index = 0; index < times; index++) await page.getByRole('button', { name: 'Zoom in cover photo', exact: true }).click();
}

test('cover zoom buttons have bounds, Reset restores the fit, and Done/Cancel preserve the saved choice without record writes', async ({ page }) => {
  await seedGuest(page); await addOriginal(page, { width: 600, height: 1200 }); await page.goto(detail);
  const cover = page.locator('.activity-cover'), photo = cover.locator('img');
  await expect(photo).toHaveAttribute('data-cover-zoom', '1');
  await expect(page.locator('.activity-detail-page')).toHaveCSS('touch-action', 'pan-y pinch-zoom');
  await expect(cover).toHaveCSS('touch-action', 'pan-y');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await editCover(page);
  await expect(cover).toHaveCSS('touch-action', 'none');
  await expect(page.getByRole('button', { name: 'Zoom out cover photo', exact: true })).toBeDisabled();
  await zoomIn(page, 8); await expect(photo).toHaveAttribute('data-cover-zoom', '3');
  await expect(page.getByRole('button', { name: 'Zoom in cover photo', exact: true })).toBeDisabled();
  await cover.focus();
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
  const bounds = await cover.boundingBox(), imageBounds = await photo.boundingBox();
  expect(imageBounds.x).toBeLessThanOrEqual(bounds.x + 1); expect(imageBounds.y).toBeLessThanOrEqual(bounds.y + 1);
  expect(imageBounds.x + imageBounds.width).toBeGreaterThanOrEqual(bounds.x + bounds.width - 1);
  expect(imageBounds.y + imageBounds.height).toBeGreaterThanOrEqual(bounds.y + bounds.height - 1);
  await page.getByRole('button', { name: 'Reset cover photo', exact: true }).click();
  await expect(photo).toHaveAttribute('data-cover-zoom', '1'); await expect(photo).toHaveCSS('object-position', '50% 50%');
  await zoomIn(page, 3); await cover.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload(); await expect(photo).toHaveAttribute('data-cover-zoom', '1.75');
  await editCover(page); await zoomIn(page); await cover.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(photo).toHaveAttribute('data-cover-zoom', '1.75');
  expect(await photo.evaluate((node) => [node.naturalWidth, node.naturalHeight])).toEqual([600, 1200]);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('cover zoom is remembered per photo and isolated between Guest and synthetic Accounts', async ({ page }) => {
  await seedGuest(page); await addOriginal(page, { count: 2 }); await page.goto(detail);
  const photo = page.locator('.activity-cover img');
  const saveZoom = async (times) => { await editCover(page); await zoomIn(page, times); await page.getByRole('button', { name: 'Done', exact: true }).click(); };
  const choose = async (index) => { await page.getByRole('button', { name: 'Choose cover photo', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: `Use as cover: Activity photo ${index}.png`, exact: true }).click(); };
  await saveZoom(2); await choose(1); await expect(photo).toHaveAttribute('data-cover-zoom', '1');
  await saveZoom(4); await choose(0); await expect(photo).toHaveAttribute('data-cover-zoom', '1.5');
  const moments = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
  await page.evaluate(async (moments) => {
    const files = await import('/src/services/attachmentService.js');
    const originals = await files.exportAttachmentFiles(moments, { isGuest: true });
    for (const uid of ['zoom-owner-a', 'zoom-owner-b']) await files.restoreAttachmentFiles(moments, originals, { uid, isGuest: false });
  }, moments);
  await accountScope(page, 'zoom-owner-a', moments); await expect(photo).toHaveAttribute('data-cover-zoom', '1');
  await saveZoom(3);
  await accountScope(page, 'zoom-owner-b', moments); await expect(photo).toHaveAttribute('data-cover-zoom', '1');
  await accountScope(page, 'zoom-owner-a', moments); await expect(photo).toHaveAttribute('data-cover-zoom', '1.75');
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
});

test.describe('Chromium two-finger cover zoom', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('pinch starts cover editing, zooms without paging, and inward pinch returns to the fit', async ({ page }) => {
    await seedGuest(page); await addOriginal(page, { width: 1200, height: 600 }); await page.goto(detail);
    const photo = page.locator('.activity-cover img');
    await expect(page.getByRole('button', { name: 'Reposition cover photo', exact: true })).toBeVisible();
    const session = await page.context().newCDPSession(page), cover = page.locator('.activity-cover');
    const pinch = async (from, to) => {
      const bounds = await cover.boundingBox(), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      const points = (radius) => [{ x: x - radius, y, id: 1 }, { x: x + radius, y, id: 2 }];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
      for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + (to - from) * step / 6) });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await pinch(35, 80);
    await expect(cover).toHaveClass(/is-repositioning/);
    await expect.poll(async () => Number(await photo.getAttribute('data-cover-zoom'))).toBeGreaterThan(1.5);
    await expect(page).toHaveURL(/\/moment-one\/activities\/shared$/);
    await expect(page.getByRole('button', { name: 'Next activity', exact: true })).toBeDisabled();
    await pinch(80, 20); await expect(photo).toHaveAttribute('data-cover-zoom', '1');
    await cover.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page).toHaveURL(/\/moment-one\/activities\/shared$/);
  });
});
