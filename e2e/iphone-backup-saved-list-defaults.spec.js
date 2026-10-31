import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// A backup restores the user's saved Settings baselines, not the currently
// browsed Refine state. The additional object is optional within v3.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  test(`Guest JSON backup includes independent List defaults at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page);
    await page.goto('/settings/code-lists#list-order');
    const sort = page.getByRole('group', { name: 'Sort Activities in settings' });
    await sort.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Title', exact: true }).click();
    await page.getByRole('button', { name: /Activities filters/ }).click();
    const conditions = page.locator('.dn-code-list-filter-editor .dn-conditions');
    await conditions.getByRole('button', { name: 'Add filter' }).click();
    const rule = conditions.locator('.dn-condition-rule').last();
    await rule.getByRole('combobox', { name: 'Filter by' }).click();
    await page.getByRole('option', { name: 'Priority', exact: true }).click();
    await rule.getByRole('combobox', { name: 'Value for Priority' }).click();
    await page.getByRole('option', { name: 'High', exact: true }).click();

    await page.goto('/settings');
    await page.getByRole('button', { name: /Data & Backup/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let json = '';
    for await (const chunk of stream) json += chunk.toString('utf8');
    const backup = JSON.parse(json);
    expect(backup.backupVersion).toBe(3);
    expect(backup.settings.listViewDefaults.activities.filters.field).toBe('title');
    expect(backup.settings.listViewDefaults.activities.group.children.some(
      (child) => child.kind === 'rule' && child.field === 'activity.priority' && child.value === 'high',
    )).toBe(true);
    expect(backup.settings.listViewDefaults.moments.filters.field).toBe('date');
    expect(backup.settings.listViewDefaults.transactions.filters.sort).toBe('date-desc');
    expect(backup.moments.length).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}
