import { test, expect } from '@playwright/test';
import { stat } from 'node:fs/promises';
import { seedGuest } from './fixtures.js';

test('a backup above 50 MiB exports, previews without writes and restores exact originals through Settings', async ({ page, browser, baseURL }) => {
  test.setTimeout(150000);
  const moments = [{ id: 'phase7-moment', name: 'A complete family record', date: '2026-10-28',
    type: 'Vacation', notes: 'Exact தமிழ் 🏡 writing\nKeep **formatting** and <p>literal tags</p>.',
    activities: [{ id: 'phase7-activity', title: 'A day without a recorded date', date: '', completed: false, expenses: [] }],
    memories: [{ id: 'phase7-reflection', title: 'Before the trip', body: 'Keep this legacy note.' }], attachments: [] }];
  const errors = await seedGuest(page, { moments,
    incomes: [{ id: 'phase7-income', name: 'Trip fund', amount: 100, date: '2026-10-28', type: 'Other', paymentMethod: 'Online' }],
    expenses: [{ id: 'phase7-expense', name: 'Tickets', amount: 20, date: '2026-10-28', category: 'Other',
      eventId: 'phase7-moment', activityId: 'phase7-activity', paymentMethod: 'Cash' }] });
  await page.goto('/settings#backup');
  const hashes = await page.evaluate(async () => {
    const { attachmentRepository } = await import('/src/services/attachmentService.js');
    const moments = JSON.parse(localStorage.getItem('dn_guest_eventGroups'));
    const hashes = [];
    for (let index = 0; index < 6; index += 1) {
      const blob = new Blob([new Uint8Array(7 * 1024 * 1024).fill(index + 1)], { type: 'application/octet-stream' });
      const reference = await attachmentRepository.save(blob, { isGuest: true });
      hashes.push(reference.assetId);
      moments[0].attachments.push({ ...reference, id: 'phase7-file-' + index, name: 'Original ' + index + '.bin',
        type: blob.type, size: blob.size, activityId: index % 2 ? 'phase7-activity' : null });
    }
    localStorage.setItem('dn_guest_eventGroups', JSON.stringify(moments));
    localStorage.setItem('dn_favorite_event_ids_guest', JSON.stringify(['phase7-moment']));
    return hashes;
  });
  const download = page.waitForEvent('download', { timeout: 60000 });
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const exported = await download;
  const path = await exported.path();
  expect((await stat(path)).size).toBeGreaterThan(50 * 1024 * 1024);
  await expect(page.getByRole('status').filter({ hasText: '6 original attachment files' })).toBeVisible();

  const destination = await browser.newContext({ baseURL });
  try {
    const restored = await destination.newPage();
    const restoreErrors = await seedGuest(restored, { moments: [], incomes: [], expenses: [] });
    await restored.goto('/settings#backup');
    await restored.getByLabel('Choose a DN backup JSON file').setInputFiles(path);
    const review = restored.getByRole('dialog', { name: 'Review backup restore' });
    await expect(review).toBeVisible({ timeout: 60000 });
    await expect(review).toContainText('6 original files');
    const before = await restored.evaluate(async (assetId) => {
      const { attachmentRepository } = await import('/src/services/attachmentService.js');
      let originalExists = false;
      try { await attachmentRepository.read({ assetId, storage: 'local' }, { isGuest: true }); originalExists = true; }
      catch { /* Preview must not have saved originals. */ }
      return { originalExists, records: JSON.parse(localStorage.getItem('dn_guest_eventGroups')) };
    }, hashes[0]);
    expect(before).toEqual({ originalExists: false, records: [] });
    await Promise.all([restored.waitForEvent('load'), review.getByRole('button', { name: 'Confirm restore' }).click()]);
    const result = await restored.evaluate(async () => {
      const { attachmentRepository, attachmentAssetId } = await import('/src/services/attachmentService.js');
      const moments = JSON.parse(localStorage.getItem('dn_guest_eventGroups'));
      const digests = [];
      for (const attachment of moments[0].attachments) digests.push(await attachmentAssetId(await attachmentRepository.read(attachment, { isGuest: true })));
      return { moment: moments[0], digests,
        incomes: JSON.parse(localStorage.getItem('dn_guest_incomes')),
        expenses: (await import('/src/services/expenseService.js')).getGuestExpenses(),
        favorites: JSON.parse(localStorage.getItem('dn_favorite_event_ids_guest')) };
    });
    expect(result.digests).toEqual(hashes);
    expect(result.moment.notes).toBe(moments[0].notes);
    expect(result.moment.activities[0].date).toBe('');
    expect(result.moment.memories[0].body).toBe('Keep this legacy note.');
    expect(result.moment.attachments[1].activityId).toBe('phase7-activity');
    expect(result.incomes[0].paymentMethod).toBe('Online');
    expect(result.expenses[0].paymentMethod).toBe('Cash');
    expect(result.favorites).toEqual(['phase7-moment']);
    expect(restoreErrors).toEqual([]);
  } finally { await destination.close(); }
  expect(errors).toEqual([]);
});

test('backup reading can be cancelled before confirmation or persistence and the same file can be selected again', async ({ page }) => {
  const errors = await seedGuest(page, { moments: [], incomes: [], expenses: [] });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/settings#backup');
  const backup = await page.evaluate(async () => {
    const { createBackupDocument } = await import('/src/services/backupService.js');
    const { DEFAULT_CODE_LISTS } = await import('/src/utils/codeLists.js');
    const originalRead = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      const result = originalRead.call(this);
      return new Promise((resolve) => { window.__finishBackupRead = async () => resolve(await result); });
    };
    window.__restoreBackupReader = () => { Blob.prototype.arrayBuffer = originalRead; };
    return createBackupDocument({ moments: [{ id: 'cancelled-file-moment', name: 'Only restore after confirmation', activities: [], attachments: [], memories: [] }],
      codeLists: DEFAULT_CODE_LISTS, settings: { restoreCodeLists: false } });
  });
  const payload = { name: 'cancel-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) };
  const picker = page.getByLabel('Choose a DN backup JSON file');
  await picker.setInputFiles(payload);
  await page.getByRole('button', { name: 'Cancel preparation', exact: true }).click();
  await page.evaluate(() => { window.__restoreBackupReader(); void window.__finishBackupRead(); });
  await expect(page.getByRole('status')).toContainText('Backup reading cancelled');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await expect(page.getByRole('dialog', { name: 'Review backup restore' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual([]);
  await picker.setInputFiles(payload);
  const review = page.getByRole('dialog', { name: 'Review backup restore' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual([]);
  expect(errors).toEqual([]);
});

test('new Guest backup guidance is versioned and older edited tours wait for explicit refresh', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await page.goto('/settings');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data') || 'null')?.imagesReady), { timeout: 20000 }).toBe(true);
  const existing = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dn_dev_fixture_data'));
    data.demoVersion = 'an-earlier-edition';
    data.events[0].notes = 'My own edited demonstration';
    localStorage.setItem('dn_dev_fixture_data', JSON.stringify(data));
    return data.events[0].notes;
  });
  await page.reload();
  const panel = page.getByRole('region', { name: 'Explore DN guest demo' });
  await expect(panel).toContainText('Updated examples available');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data')).events[0].notes)).toBe(existing);
  await panel.getByRole('button', { name: 'Refresh demo' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data')).imagesReady), { timeout: 20000 }).toBe(true);
  const current = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data')));
  expect(current.events[0].notes).toContain('Data & Backup');
  expect(current.demoVersion).toBe('2026.10.29.2');
  expect(current.events[2].notes).toContain('Payment Methods');
  for (const destination of ['Story', 'Gallery', 'PDF Studio']) expect(current.events[0].notes).toContain(destination);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups') || '[]')).toBe('[]');
});
