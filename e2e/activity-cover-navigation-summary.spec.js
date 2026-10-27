import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addOriginal, activityDetailAction, fixtureMoments, seedGuest } from './fixtures.js';
import { setActivityStatusCondition } from './fixtures.js';

async function drag(page, locator, dx, dy = 0) {
  await locator.scrollIntoViewIfNeeded(); const rect = await locator.boundingBox();
  const x = rect.x + rect.width * (dx > 0 ? .28 : .72), y = rect.y + rect.height * .5;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
}

test('mobile cover occupies 40% of the viewport; choose/reposition persist without changing originals or records', async ({ page }) => {
  await seedGuest(page); await addOriginal(page, { width: 600, height: 1200, count: 2 });
  await page.goto('/events/moment-one/activities/shared');
  const cover = page.locator('.activity-cover'), photo = cover.locator('img');
  await expect(photo).toHaveAttribute('alt', 'Activity photo 0.png');
  const bounds = await cover.boundingBox(); expect(Math.abs(bounds.height - 844 * .4)).toBeLessThan(2);
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.getByRole('button', { name: 'Reposition cover photo', exact: true }).click();
  await drag(page, cover, 0, 70); await expect(page).toHaveURL(/\/moment-one\/activities\/shared$/);
  await cover.getByRole('button', { name: 'Done', exact: true }).click();
  const position = await photo.evaluate((node) => node.style.objectPosition); expect(position).not.toBe('50% 50%');
  await expect(page.getByRole('button', { name: 'Reposition cover photo', exact: true })).toBeFocused();
  const choose = async (name) => {
    await page.getByRole('button', { name: 'Choose cover photo', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: `Use as cover: ${name}`, exact: true }).click();
    await expect(photo).toHaveAttribute('alt', name);
    await expect(page.getByRole('button', { name: 'Choose cover photo', exact: true })).toBeFocused();
  };
  await choose('Activity photo 1.png'); await expect(photo).toHaveCSS('object-position', '50% 50%');
  await choose('Activity photo 0.png'); expect(await photo.evaluate((node) => node.style.objectPosition)).toBe(position);
  await page.reload(); await expect(photo).toHaveAttribute('alt', 'Activity photo 0.png');
  await expect.poll(() => photo.evaluate((node) => node.style.objectPosition)).toBe(position);
  await page.getByRole('button', { name: 'Reposition cover photo', exact: true }).click();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
  expect(await photo.evaluate((node) => node.style.objectPosition)).toBe(position);
  expect(await photo.evaluate((node) => [node.naturalWidth, node.naturalHeight])).toEqual([600, 1200]);
  await expect(photo).toHaveCSS('object-fit', 'cover');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
});

test('cover panning on a panoramic photo is keyboard accessible and cancelled movement restores the saved position', async ({ page }) => {
  await seedGuest(page); await addOriginal(page, { width: 2400, height: 300 });
  await page.goto('/events/moment-one/activities/shared'); const photo = page.locator('.activity-cover img');
  await page.getByRole('button', { name: 'Reposition cover photo', exact: true }).click();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await expect(photo).toHaveCSS('object-position', '45% 50%');
  await page.getByRole('button', { name: 'Reposition cover photo', exact: true }).click();
  await drag(page, page.locator('.activity-cover'), 100); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(photo).toHaveCSS('object-position', '45% 50%');
  await expect(page).toHaveURL(/\/moment-one\/activities\/shared$/);
});

test('completed Activities require reopening before Edit, and a stale editor cannot save over completion', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities/completed');
  await page.getByRole('button', { name: 'Activity options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Reopen', exact: true }).click();
  await activityDetailAction(page, 'Edit'); const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Activity title', exact: true }).fill('Preserve this draft');
  await page.evaluate(async () => {
    const store = (await import('/src/store/useEventStore.js')).default;
    const parent = store.getState().events.find((item) => item.id === 'moment-one');
    await store.getState().updateEventItem(null, true, { ...parent, activities: parent.activities.map((item) => item.id === 'completed'
      ? { ...item, completed: true, status: 'completed', completedAt: '2026-10-25T12:00:00Z' } : item) });
  });
  await dialog.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Reopen this activity before editing');
  await expect(dialog.getByRole('textbox', { name: 'Activity title', exact: true })).toHaveValue('Preserve this draft');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Choose the train');
  await expect(page.locator('.activity-detail-content > :last-child')).toContainText('Completed25 Oct 2026');
  await page.goto('/activities');
  const completed = page.getByRole('group', { name: 'Open Choose the train', exact: true });
  await expect(completed.getByRole('button', { name: 'Activity options', exact: true })).toHaveCount(0);
  await completed.click();
  await page.getByRole('button', { name: 'Activity options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Reopen', exact: true })).toBeVisible();
});

test('detail swipes follow the Activities sort order across reused child IDs, with short/vertical gestures ignored', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  await page.getByRole('button', { name: /Filters and sort/ }).click();
  await page.getByRole('combobox', { name: 'Sort activities field', exact: true }).click();
  await page.getByRole('option', { name: 'Title', exact: true }).click();
  const titles = await page.locator('.event-activity-title-row > strong').allTextContents();
  expect(titles).toEqual(['A different activity with the same ID', 'Book a lakeside stay', 'Choose the train']);
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.getByRole('group', { name: `Open ${titles[0]}`, exact: true }).click();
  const cover = page.locator('.activity-cover');
  await drag(page, cover, -25); await expect(page.locator('h1')).toHaveText(titles[0]);
  await drag(page, cover, -10, 75); await expect(page.locator('h1')).toHaveText(titles[0]);
  await drag(page, cover, -150); await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  await expect(page.locator('h1')).toHaveText(titles[1]); await expect(page.locator('h1')).toBeFocused();
  await drag(page, cover, -150); await expect(page.locator('h1')).toHaveText(titles[2]);
  await expect(page.getByRole('button', { name: 'Next activity', exact: true })).toBeDisabled();
  await drag(page, cover, -150); await expect(page.locator('h1')).toHaveText(titles[2]);
  await drag(page, cover, 150); await expect(page.locator('h1')).toHaveText(titles[1]);
  await page.goBack(); await expect(page.locator('h1')).toHaveText(titles[2]);
  await page.reload(); await expect(page.locator('h1')).toHaveText(titles[2]);
  await page.getByRole('button', { name: 'Previous activity', exact: true }).click(); await expect(page.locator('h1')).toHaveText(titles[1]);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
});

test('the opening filtered sequence survives completion, while single-result filters never open unrelated Activities', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  await page.getByRole('searchbox', { name: 'Search activities and Moments' }).fill('Book a lakeside stay');
  await page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true }).locator('.event-activity-title-row > strong').click();
  await expect(page.getByRole('navigation', { name: 'Activity navigation' })).toHaveCount(0);
  await drag(page, page.locator('.activity-cover'), -150); await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await page.goto('/activities'); await page.getByRole('searchbox', { name: 'Search activities and Moments' }).fill('');
  await setActivityStatusCondition(page, 'in-progress');
  await page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true }).locator('.event-activity-title-row > strong').click();
  await activityDetailAction(page, 'Close'); await expect(page.locator('.activity-status-pill')).toHaveText('Completed');
  await drag(page, page.locator('.activity-cover'), -150);
  await expect(page).toHaveURL(/\/events\/moment-two\/activities\/shared$/);
});

test('Moment summaries show full text and every photo, and a nested preview closes without closing the summary', async ({ page }) => {
  const moments = fixtureMoments(); moments[0].notes = 'Moment notes. '.repeat(120) + 'END_MOMENT_NOTES';
  moments[0].activities[0].description = 'Activity paragraph.\n'.repeat(80) + 'END_ACTIVITY_DESCRIPTION';
  moments[0].memories[0].body = 'Memory paragraph.\n'.repeat(60) + 'END_MEMORY';
  await seedGuest(page, { moments }); await addOriginal(page, { width: 600, height: 900, count: 3 });
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.goto('/events');
  const momentCard = page.getByRole('group', { name: `${moments[0].name}. Swipe either direction for actions.`, exact: true });
  await momentCard.focus(); await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Summary', exact: true }).click();
  const summary = page.getByRole('dialog', { name: 'Moment summary', exact: true });
  await expect(summary).toContainText('END_MOMENT_NOTES'); await expect(summary).toContainText('END_ACTIVITY_DESCRIPTION'); await expect(summary).toContainText('END_MEMORY');
  await expect(summary.locator('.is-truncated')).toHaveCount(0);
  await expect(summary.getByRole('button', { name: /Show more|Show less/ })).toHaveCount(0);
  await expect(summary.locator('.dn-attachment-tile')).toHaveCount(4);
  await expect(summary.locator('.moment-summary-media .dn-attachment-open strong')).toHaveCount(0);
  const preview = summary.getByRole('button', { name: 'Preview Activity photo 2.png', exact: true });
  await preview.scrollIntoViewIfNeeded(); await expect.poll(() => preview.locator('img').evaluate((node) => node.naturalWidth)).toBe(600);
  const shape = await preview.locator('img').boundingBox(); expect(Math.abs(shape.width / shape.height - 600 / 900)).toBeLessThan(.01);
  await preview.click(); await expect(page.getByRole('dialog')).toHaveCount(2);
  await expect.poll(() => summary.locator('img').evaluateAll((nodes) => nodes.every((node) => node.complete))).toBe(true);
  const scroll = await summary.locator('.dn-modal-body').evaluate((node) => node.scrollTop);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(1); await expect(summary).toBeVisible(); await expect(preview).toBeFocused();
  expect(Math.abs(await summary.locator('.dn-modal-body').evaluate((node) => node.scrollTop) - scroll)).toBeLessThan(2);
  await summary.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.goto('/dashboard');
  await page.locator('.dashboard-moment-row').filter({ hasText: moments[0].name }).locator('.dashboard-upcoming-row').click();
  await expect(summary).toContainText('END_MOMENT_NOTES'); await expect(summary).toContainText('END_ACTIVITY_DESCRIPTION'); await expect(summary).toContainText('END_MEMORY');
  await expect(summary.locator('.is-truncated')).toHaveCount(0);
  await expect(summary.locator('.dn-attachment-tile')).toHaveCount(4);
  await expect(summary.locator('.moment-summary-media .dn-attachment-open strong')).toHaveCount(0);
  await summary.getByRole('button', { name: 'Download summary PDF', exact: true }).scrollIntoViewIfNeeded();
  await expect(summary.getByRole('button', { name: 'Download summary PDF', exact: true })).toBeInViewport();
  const downloaded = page.waitForEvent('download'); await summary.getByRole('button', { name: 'Download summary PDF', exact: true }).click();
  const pdfDownload = await downloaded;
  expect(pdfDownload.suggestedFilename()).toMatch(/-summary\.pdf$/i);
  const bytes = await readFile(await pdfDownload.path());
  const structure = bytes.toString('latin1');
  expect(structure.startsWith('%PDF-1.4')).toBe(true);
  expect(structure).toMatch(/\/Type \/Catalog/);
  expect(Number(structure.match(/\/Count (\d+)/)[1])).toBeGreaterThanOrEqual(3);
  expect(structure).toContain('/Filter /DCTDecode');
  expect(structure).toMatch(/%%EOF/);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  await summary.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__dnUrls.created.every((url) => window.__dnUrls.revoked.includes(url)))).toBe(true);
});

test('cover choices and originals stay isolated when the same IDs are loaded for another Account', async ({ page }) => {
  await seedGuest(page); await addOriginal(page, { count: 2 }); await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  const choose = async (index) => { await page.getByRole('button', { name: 'Choose cover photo', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: `Use as cover: Activity photo ${index}.png`, exact: true }).click(); };
  await choose(1);
  const moments = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
  await page.evaluate(async (moments) => {
    const files = await import('/src/services/attachmentService.js');
    const originals = await files.exportAttachmentFiles(moments, { isGuest: true });
    for (const uid of ['cover-owner-A', 'cover-owner-B']) await files.restoreAttachmentFiles(moments, originals, { uid, isGuest: false });
  }, moments);
  const { accountScope } = await import('./fixtures.js');
  await accountScope(page, 'cover-owner-A', moments);
  await expect(page.locator('.activity-cover img')).toHaveAttribute('alt', 'Activity photo 0.png');
  await choose(1); await expect(page.locator('.activity-cover img')).toHaveAttribute('alt', 'Activity photo 1.png');
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
  await accountScope(page, 'cover-owner-B', moments);
  await expect(page.locator('.activity-cover img')).toHaveAttribute('alt', 'Activity photo 0.png');
  await accountScope(page, 'cover-owner-A', moments);
  await expect(page.locator('.activity-cover img')).toHaveAttribute('alt', 'Activity photo 1.png');
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
});

test.describe('Chromium touch paging and cover positioning', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('touch cover drag repositions only in edit mode; ordinary vertical/short gestures do not page', async ({ page }) => {
    await seedGuest(page); await addOriginal(page, { width: 600, height: 1200 }); await page.goto('/events/moment-one/activities/shared');
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const session = await page.context().newCDPSession(page), cover = page.locator('.activity-cover');
    const touch = async (dx, dy) => {
      await cover.scrollIntoViewIfNeeded(); const rect = await cover.boundingBox(); const x = rect.x + rect.width * .65, y = rect.y + rect.height * .45;
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 6, y: y + dy * step / 6, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await page.getByRole('button', { name: 'Reposition cover photo', exact: true }).click();
    await touch(0, 65); await cover.getByRole('button', { name: 'Done', exact: true }).click();
    expect(await cover.locator('img').evaluate((node) => node.style.objectPosition)).not.toBe('50% 50%');
    await touch(0, 80); await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
    await touch(-25, 0); await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
    await touch(-145, 0); await expect(page).toHaveURL(/\/events\/moment-two\/activities\/shared$/);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  });
});
