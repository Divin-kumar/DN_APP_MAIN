import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { addOriginal, fixtureMoments, seedGuest, swipe } from './fixtures.js';

test('direct detail/refresh uses both IDs, shows safe formatted notes and never rewrites source records', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.getByRole('heading', { name: 'Book a lakeside stay', exact: true })).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.activity-description')).toContainText('<script>alert("literal")</script>');
  await expect(page.locator('.activity-description img, .activity-description script, .activity-description a')).toHaveCount(0);
  await expect(page.locator('.activity-cover img')).toHaveCount(0);
  await expect(page.locator('.activity-cover')).toContainText('No cover photo');
  await expect(page.locator('.mobile-tab[aria-current="page"]')).toHaveText('Activities');
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.reload(); await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  await page.goto('/events/missing/activities/shared');
  await expect(page.getByRole('heading', { name: 'Activity not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Activities' })).toHaveAttribute('href', '/activities');
  await page.goto('/events/moment-two/activities/shared');
  await expect(page.locator('h1')).toHaveText('A different activity with the same ID');
  expect(errors).toEqual([]);
});

test('normal card/keyboard selection opens detail, menus and attachment controls do not navigate', async ({ page }) => {
  await seedGuest(page); await addOriginal(page);
  await page.goto('/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(card).toBeVisible();
  await expect(page.locator('.event-activity-complete, .event-activity-complete-static')).toHaveCount(0);
  const trigger = card.getByRole('button', { name: 'Activity options', exact: true });
  const size = await trigger.boundingBox(); expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44);
  await trigger.click(); await expect(page.getByRole('menu')).toBeVisible();
  await expect(page).toHaveURL(/\/activities$/);
  expect(await page.getByRole('menuitem').last().innerText()).toBe('Delete');
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await card.getByRole('button', { name: 'Preview Activity photo 0.png' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); await expect(page).toHaveURL(/\/activities$/);
  await page.keyboard.press('Escape');
  await card.focus(); await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  await page.goBack(); await expect(card).toBeVisible();
  await card.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
});

test('edit stays on detail, cancel restores focus/scroll, failed save retains draft and retry succeeds', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities/shared');
  const edit = page.getByRole('button', { name: 'Edit', exact: true }).first();
  await edit.click(); const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Activity title', exact: true }).fill('Changed title');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(edit).toBeFocused(); await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await edit.click();
  await dialog.getByRole('textbox', { name: 'Activity title', exact: true }).fill('Saved title');
  await page.evaluate(async () => {
    const store = (await import('/src/store/useEventStore.js')).default;
    const original = store.getState().updateEventItem;
    store.setState({ updateEventItem: async () => { throw new Error('Synthetic save failure. Please retry.'); } });
    window.__dnRestoreWriter = () => store.setState({ updateEventItem: original });
  });
  await dialog.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Synthetic save failure');
  await expect(dialog.getByRole('textbox', { name: 'Activity title', exact: true })).toHaveValue('Saved title');
  await page.evaluate(() => window.__dnRestoreWriter());
  await dialog.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page.locator('h1')).toHaveText('Saved title');
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  const source = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
  expect(source[0].activities[0].extra).toEqual({ retained: true });
  expect(source[0].activities[0].expenses).toHaveLength(2);
  expect(source[1].activities[0].title).toBe('A different activity with the same ID');
});

test('deliberate left swipe completes/reopens, while short/vertical/right motion does not commit', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  const state = () => card.locator('.event-activity-status');
  await swipe(page, card, { distance: 25 }); await expect(state()).toHaveText('In progress');
  await swipe(page, card, { distance: 10, vertical: 75 }); await expect(state()).toHaveText('In progress');
  await swipe(page, card, { distance: -120 }); await expect(state()).toHaveText('In progress');
  await swipe(page, card); await expect(state()).toHaveText('Completed');
  await expect(page).toHaveURL(/\/activities$/);
  await swipe(page, card); await expect(state()).toHaveText('In progress');
  await expect(page.getByRole('status').filter({ hasText: 'Activity reopened' })).toBeAttached();
  const values = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')));
  expect(values[0].activities[1].completed).toBe(true);
  expect(values[1].activities[0].completed).toBe(false);
});

test('menus expose accessible state actions; only one opens; Cancel/Restore and confirmed Delete retain finance', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  const first = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  const second = page.getByRole('group', { name: 'Open Choose the train', exact: true });
  await first.getByRole('button', { name: 'Activity options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Complete', exact: true })).toBeVisible();
  await second.getByRole('button', { name: 'Activity options' }).click();
  await expect(page.getByRole('menu')).toHaveCount(1);
  await expect(page.getByRole('menuitem', { name: 'Reopen', exact: true })).toBeVisible();
  const menu = await page.getByRole('menu').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.x + menu.width).toBeLessThanOrEqual(390);
  expect(menu.y + menu.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
  await first.getByRole('button', { name: 'Activity options' }).click();
  await page.getByRole('menuitem', { name: 'Cancel', exact: true }).click();
  await expect(first).toHaveCount(0);
  await page.getByRole('button', { name: 'Filters and sort', exact: true }).click();
  await page.locator('#activities-status-filter').click(); await page.getByRole('option', { name: 'Cancelled', exact: true }).click();
  const cancelled = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await swipe(page, cancelled); await expect(cancelled.locator('.event-activity-status')).toHaveText('Cancelled');
  await expect(page.getByRole('menuitem', { name: 'Restore', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Restore', exact: true }).click();
  await page.getByRole('button', { name: /Filters and sort/ }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await first.getByRole('button', { name: 'Activity options' }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete activity?' })).toBeVisible();
  const ledger = await page.evaluate(() => localStorage.getItem('dn_guest_expenses'));
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(first).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_expenses'))).toBe(ledger);
  await page.goto('/events/moment-one/transactions');
  await expect(page.getByRole('group', { name: 'Totals for this Moment' })).toContainText('₹100');
  await expect(page.getByRole('list', { name: 'Linked transactions' })).not.toContainText('Parking');
  await expect(page.getByRole('list', { name: 'Linked transactions' })).toContainText('Room deposit');
});

test('Moment Transactions has six reachable tabs, full-Moment totals, independent filters and in-place forms', async ({ page }) => {
  const errors = await seedGuest(page); await page.goto('/events/moment-one/transactions');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(page.locator('.mobile-tab[aria-current="page"]')).toHaveText('Moments');
  const tabs = page.locator('.event-workspace-nav a');
  expect(await tabs.allTextContents()).toEqual(['Overview', 'Activities3', 'Transactions', 'Timeline', 'Memories1', 'Attachments']);
  const bounds = await tabs.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
  expect(new Set(bounds).size).toBe(1);
  const totals = page.getByRole('group', { name: 'Totals for this Moment' });
  await expect(totals).toContainText('₹1,000'); await expect(totals).toContainText('₹120'); await expect(totals).toContainText('₹880');
  await expect(page.getByRole('list', { name: 'Linked transactions' })).not.toContainText('Unrelated expense');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.locator('#moment-transaction-type').click(); await page.getByRole('option', { name: 'Expense', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search Moment transactions' }).fill('Parking');
  await expect(page.getByRole('list', { name: 'Linked transactions' })).toContainText('Parking');
  await expect(page.getByRole('list', { name: 'Linked transactions' })).not.toContainText('Trip fund');
  await expect(totals).toContainText('₹1,000');
  await page.getByRole('button', { name: 'Add transaction', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Linked Moment', exact: true })).toContainText('Weekend in Ooty');
  await dialog.getByRole('combobox', { name: 'Linked Activity', exact: true }).click();
  await expect(page.getByRole('listbox')).not.toContainText('A different activity');
  await page.keyboard.press('Escape');
  await dialog.getByRole('spinbutton').fill('50');
  await dialog.getByRole('textbox', { name: 'Title *', exact: true }).fill('Moment coffee');
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(page).toHaveURL(/\/events\/moment-one\/transactions$/);
  await expect(totals).toContainText('₹170');
  await page.reload(); await expect(totals).toContainText('₹170');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Moment contents' })).toContainText('Transactions');
  await page.goBack(); await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await page.goForward(); await expect(page.getByRole('navigation', { name: 'Moment contents' })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const [label, width, height] of [['portrait', 300, 800], ['square', 600, 600], ['panoramic', 2400, 400], ['tiny', 1, 1]]) {
  test(`${label} original fills exactly one landscape cover and object URLs release on navigation`, async ({ page }) => {
    await seedGuest(page); const reference = await addOriginal(page, { width, height });
    await page.goto('/events/moment-one/activities/shared');
    const image = page.locator('.activity-cover img'); await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('alt', 'Activity photo 0.png');
    await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBe(width);
    expect(await image.evaluate((node) => getComputedStyle(node).objectFit)).toBe('cover');
    const frame = await page.locator('.activity-cover').boundingBox(); expect(frame.width).toBeGreaterThan(frame.height);
    await expect(page.getByRole('button', { name: 'Preview Activity photo 0.png' })).toBeAttached();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0].attachments[1]);
    expect(stored.assetId).toBe(reference.assetId); expect(stored.size).toBe(reference.size);
    await page.locator('.mobile-tab').filter({ hasText: 'Home' }).click();
    await expect.poll(() => page.evaluate(() => window.__dnUrls.created.every((url) => window.__dnUrls.revoked.includes(url)))).toBe(true);
  });
}

test('broken originals and metadata-only attachments use an honest fallback; Moment-only photos are excluded', async ({ page }) => {
  const moments = fixtureMoments(); moments[0].attachments = [
    { id: 'moment-only', type: 'image/png', name: 'Moment image', assetId: 'a'.repeat(64), storage: 'local' },
    { id: 'pdf', type: 'application/pdf', name: 'PDF', activityId: 'shared' },
    { id: 'missing', type: 'image/png', name: 'Missing photo', activityId: 'shared', assetId: 'b'.repeat(64), storage: 'local' },
  ];
  await seedGuest(page, { moments }); await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('.activity-cover')).toContainText('Cover photo unavailable');
  await expect(page.locator('.activity-cover img')).toHaveCount(0);
  await page.goto('/events/moment-one/activities/completed');
  await expect(page.locator('.activity-cover')).toContainText('No cover photo');
});

test('many attachment references share one original; preview/download preserve its hash and cover stays stable during editing', async ({ page }) => {
  await seedGuest(page); const original = await addOriginal(page, { count: 18 });
  await page.goto('/events/moment-one/activities/shared');
  const cover = page.locator('.activity-cover img'); await expect(cover).toHaveCount(1);
  const source = await cover.getAttribute('src');
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('textbox', { name: 'Activity title', exact: true }).fill('New title, same original');
  await page.getByRole('dialog').getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('New title, same original');
  await expect(cover).toHaveAttribute('src', source);
  await expect(page.locator('.activity-attachments .dn-attachment-tile')).toHaveCount(18);
  await page.getByRole('button', { name: 'Preview Activity photo 0.png', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.dn-attachment-original')).toBeVisible();
  const downloadWait = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download original', exact: true }).click();
  const download = await downloadWait;
  const bytes = await readFile(await download.path());
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(original.assetId);
  expect(bytes.length).toBe(original.size);
  const count = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('dn_attachment_originals', 1);
    request.onsuccess = () => { const query = request.result.transaction('files').objectStore('files').count(); query.onsuccess = () => { request.result.close(); resolve(query.result); }; query.onerror = reject; };
    request.onerror = reject;
  }));
  expect(count).toBe(1);
});

test('Dashboard tap opens detail and Ctrl+Enter deliberately completes without navigating or opening Edit', async ({ page }) => {
  await seedGuest(page); await page.goto('/dashboard');
  const row = page.getByRole('button', { name: 'Open Book a lakeside stay', exact: true });
  await row.click(); await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goBack(); await expect(row).toBeVisible();
  await row.focus(); await page.keyboard.press('Control+Enter');
  await expect(row).toHaveCount(0); await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('status').filter({ hasText: 'Activity completed' })).toBeAttached();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0].activities[0].completed)).toBe(true);
});

test.describe('Chromium touch emulation', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('vertical touch scroll and short movement do not complete; a deliberate left touch swipe completes once', async ({ page }) => {
    await seedGuest(page); await page.goto('/activities');
    const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
    const client = await page.context().newCDPSession(page);
    const touch = async (dx, dy) => {
      await card.scrollIntoViewIfNeeded();
      const rect = await card.boundingBox(), x = rect.x + Math.min(210, rect.width - 55), y = rect.y + 25;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let step = 1; step <= 8; step += 1) await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8, id: 1 }],
      });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await touch(-24, 0); await expect(card.locator('.event-activity-status')).toHaveText('In progress');
    await touch(4, -110); await expect(card.locator('.event-activity-status')).toHaveText('In progress');
    await touch(-160, 0); await expect(card.locator('.event-activity-status')).toHaveText('Completed');
    await expect(page).toHaveURL(/\/activities$/);
    await client.detach();
  });
});
