import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, swipe, openUniversalTransaction, accountScope } from './fixtures.js';

// Only the Firestore store edge is mocked; file IO uses the real scoped IndexedDB repository.

test('Moment Activities is read-only, still opens Detail, and the retired Timeline URL shows Overview', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(card).toBeVisible();
  await expect(card).not.toHaveAttribute('aria-expanded');
  await expect(card.getByRole('button', { name: 'Activity options' })).toHaveCount(0);
  await expect(page.locator('.workspace-activities .dn-swipe-complete')).toHaveCount(0);
  await expect(page.locator('.workspace-activities').getByRole('button', { name: /Edit|Delete|Complete|Reopen|Add transaction|Link existing/ })).toHaveCount(0);
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await swipe(page, card);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  await page.goto('/events/moment-one/timeline');
  await expect(page.locator('.event-workspace-nav a')).toHaveCount(5);
  await expect(page.locator('.event-workspace-nav a').filter({ hasText: 'Timeline' })).toHaveCount(0);
  await expect(page.locator('.event-workspace-nav [aria-current="page"]')).toHaveText('Overview');
  await page.getByRole('navigation', { name: 'Moment contents' }).getByRole('link', { name: /Activities/ }).click();
  await card.focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  await page.getByRole('button', { name: 'Activity options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
});

test('contextual transaction rows have no edit, delete, swipe or Add controls; main Finance keeps editing', async ({ page }) => {
  await seedGuest(page);
  for (const route of ['/events/moment-one/activities/shared', '/events/moment-one/transactions']) {
    await page.goto(route);
    const history = page.getByRole('list', { name: 'Linked transactions' });
    await expect(history).toContainText('Room deposit');
    const ledger = await page.evaluate(() => localStorage.getItem('dn_guest_expenses'));
    const row = history.getByRole('listitem').filter({ hasText: 'Room deposit' });
    await row.getByText('Room deposit', { exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await swipe(page, row);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await row.locator('summary').click();
    await expect(row.locator('details')).toHaveAttribute('open', '');
    await expect(page.getByRole('button', { name: 'Add transaction', exact: true })).toHaveCount(0);
    await expect(history.getByRole('button')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_expenses'))).toBe(ledger);
  }
  await page.getByRole('link', { name: 'Manage transactions', exact: true }).click();
  await expect(page).toHaveURL(/\/financials\/transactions$/);
  const financeRow = page.getByRole('listitem').filter({ hasText: 'Room deposit' });
  await financeRow.getByText('Room deposit', { exact: true }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit Transaction' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(card.getByRole('button', { name: 'Activity options' })).toHaveCount(0);
  await card.click();
  await page.getByRole('button', { name: 'Activity options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Add transaction', exact: true })).toHaveCount(0);
});

test('signed-in attachments save locally, survive reload and keep bytes out of cloud metadata', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  const requests = [];
  page.on('request', (request) => { if (/firebasestorage\.googleapis\.com|storage\.googleapis\.com/.test(request.url())) requests.push(request.url()); });
  const moments = fixtureMoments();
  await accountScope(page, 'local-owner-A', moments);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
  await page.locator('.activity-attachments input[type="file"]').setInputFiles({ name: 'Account original.png', mimeType: 'image/png', buffer: png });
  const cover = page.locator('.activity-cover img');
  await expect(cover).toHaveAttribute('alt', 'Account original.png');
  await expect.poll(() => cover.evaluate((node) => node.naturalWidth)).toBe(1);
  const saved = await page.evaluate(() => window.__dnAccountWrites.at(-1));
  expect(saved.attachments).toHaveLength(1);
  const reference = saved.attachments[0];
  expect(reference.storage).toBe('local');
  expect(reference.name).toBe('Account original.png');
  expect(Object.keys(reference).sort()).toEqual(['activityId', 'assetId', 'createdAt', 'id', 'name', 'size', 'storage', 'type']);
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await accountScope(page, 'local-owner-A', [saved]);
  await expect.poll(() => cover.evaluate((node) => node.naturalWidth)).toBe(1);
  const portable = await page.evaluate(async (moment) => {
    const files = await import('/src/services/attachmentService.js');
    const originals = await files.exportAttachmentFiles([moment], { uid: 'local-owner-A', isGuest: false });
    const restored = await files.restoreAttachmentFiles([moment], originals, { uid: 'local-owner-B', isGuest: false });
    return { originals, restored };
  }, saved);
  expect(portable.originals[0].assetId).toBe(reference.assetId);
  expect(Buffer.from(portable.originals[0].base64, 'base64')).toEqual(png);
  expect(portable.restored[0].attachments[0].storage).toBe('local');
  expect(requests).toEqual([]);
  // A third account/device with only metadata cannot borrow A or B's original.
  await accountScope(page, 'local-owner-C', [saved]);
  await expect(page.locator('.activity-cover')).toContainText('Cover photo unavailable');
  await expect(page.locator('.activity-cover img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview Account original.png', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('unavailable on this device');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Download original' })).toHaveCount(0);
});

test('universal + is the only transaction creation entry and blocks repeated submission while saving', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/transactions');
  await expect(page.getByRole('button', { name: 'Add transaction', exact: true })).toHaveCount(0);
  await openUniversalTransaction(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Linked Moment', exact: true })).toContainText('Weekend in Ooty');
  await dialog.getByRole('textbox', { name: 'Title *', exact: true }).fill('Universal coffee');
  await dialog.getByRole('spinbutton').fill('30');
  await page.evaluate(async () => {
    const store = (await import('/src/store/useExpenseStore.js')).default;
    const original = store.getState().addExpense;
    window.__dnUniversalCalls = 0;
    store.setState({ addExpense: async (...args) => { window.__dnUniversalCalls += 1; await new Promise((resolve) => { window.__dnFinishUniversal = resolve; }); return original(...args); } });
  });
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => window.__dnUniversalCalls)).toBe(1);
  await page.evaluate(() => window.__dnFinishUniversal());
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/events\/moment-one\/transactions$/);
  await expect(page.getByRole('list', { name: 'Linked transactions' })).toContainText('Universal coffee');
  await expect(page.getByRole('button', { name: 'Open quick create menu', exact: true })).toBeFocused();
});

test('an obsolete universal transaction draft closes on scope change without writing into either scope', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  const ledger = await page.evaluate(() => localStorage.getItem('dn_guest_expenses'));
  await openUniversalTransaction(page);
  await page.getByRole('dialog').getByRole('textbox', { name: 'Title *', exact: true }).fill('Obsolete Guest draft');
  await accountScope(page, 'new-owner', fixtureMoments());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Obsolete Guest draft', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_expenses'))).toBe(ledger);
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
  await openUniversalTransaction(page);
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Title *', exact: true })).toHaveValue('');
});
