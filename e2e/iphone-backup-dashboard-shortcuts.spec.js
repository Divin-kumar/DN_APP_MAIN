import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Restoring an old settings-only file should not erase current Guest
// Favorites/Recently Opened entries that are absent from that file.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  test(`legacy settings-only restore preserves Guest Dashboard shortcuts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page);
    await page.goto('/settings');
    const expected = ['moment-one', 'moment-two'];
    await page.evaluate((ids) => {
      localStorage.setItem('dn_favorite_event_ids_guest', JSON.stringify([ids[0]]));
      localStorage.setItem('dn_recent_event_ids_guest', JSON.stringify([ids[1]]));
    }, expected);
    const before = await page.evaluate(() =>
      ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
    await page.getByRole('button', { name: 'Data & Backup' }).click();
    const legacy = { exportedAt: '2026-10-19T12:00:00.000Z', data: { dn_preferences: { theme: 'dark' } } };
    await page.getByLabel('Choose a DN backup JSON file').setInputFiles({
      name: 'older-settings-only.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(legacy), 'utf8'),
    });
    const dialog = page.getByRole('dialog', { name: 'Review backup restore' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Legacy settings-only backup');
    await dialog.getByRole('button', { name: 'Confirm restore' }).click();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('dn_favorite_event_ids_guest')))
      .toBe(JSON.stringify([expected[0]]));
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('dn_recent_event_ids_guest')))
      .toBe(JSON.stringify([expected[1]]));
    await expect.poll(async () => page.evaluate(() =>
      ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('explicitly empty v3 Dashboard shortcuts clear them only after confirmed restore', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/settings');
  await page.evaluate(() => {
    localStorage.setItem('dn_favorite_event_ids_guest', JSON.stringify(['moment-one']));
    localStorage.setItem('dn_recent_event_ids_guest', JSON.stringify(['moment-two']));
  });
  const backup = await page.evaluate(async () => {
    const { createBackupDocument } = await import('/src/services/backupService.js');
    const { DEFAULT_CODE_LISTS } = await import('/src/utils/codeLists.js');
    return createBackupDocument({ codeLists: DEFAULT_CODE_LISTS,
      dashboardConfiguration: { favorites: [], recent: [] } });
  });
  await page.getByRole('button', { name: 'Data & Backup' }).click();
  await page.getByLabel('Choose a DN backup JSON file').setInputFiles({
    name: 'clear-dashboard-shortcuts.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8'),
  });
  const dialog = page.getByRole('dialog', { name: 'Review backup restore' });
  await expect(dialog).toBeVisible();
  // Reading the backup is non-destructive.
  expect(await page.evaluate(() => localStorage.getItem('dn_favorite_event_ids_guest'))).toBe('["moment-one"]');
  await dialog.getByRole('button', { name: 'Confirm restore' }).click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('dn_favorite_event_ids_guest'))).toBe('[]');
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('dn_recent_event_ids_guest'))).toBe('[]');
  expect(errors).toEqual([]);
});
