import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addOriginal, fixtureMoments, seedGuest } from './fixtures.js';

const assertRealPdf = async (download) => {
  expect(download.suggestedFilename()).toMatch(/-summary\.pdf$/i);
  const file = await readFile(await download.path());
  const source = file.toString('latin1');
  expect(source.startsWith('%PDF-1.4')).toBe(true);
  expect(source).toContain('/Type /Catalog');
  expect(source).toContain('/Filter /DCTDecode');
  expect(source).toMatch(/startxref\n\d+\n%%EOF/);
  expect(file.length).toBeGreaterThan(15000);
  return { file, source };
};

test('Moments actions export a real multi-page PDF with original photos', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].notes = ('The family enjoyed a beautiful weekend. ').repeat(110);
  const errors = await seedGuest(page, { moments });
  await addOriginal(page, { count: 2 });
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.goto('/events');
  const card = page.getByRole('group', { name: new RegExp('Weekend in Ooty.*Swipe either direction for actions') });
  await card.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'PDF Studio', exact: true }).click();
  const studio = page.getByRole('region', { name: 'PDF Studio', exact: true });
  await expect(studio).toBeVisible();
  await expect(studio.getByRole('img', { name: 'Rendered PDF page 1' })).toBeVisible();
  const downloadButton = studio.getByRole('button', { name: 'Download customized PDF' });
  await expect(downloadButton).toBeEnabled();
  const promise = page.waitForEvent('download');
  await downloadButton.click();
  const { source } = await assertRealPdf(await promise);
  expect(Number(source.match(/\/Count (\d+)/)[1])).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
  expect(errors).toEqual([]);
});

test('editing a linked transaction offers choices first; explicit Moment search works without closing/crashing the form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const moments = [...fixtureMoments(), ...Array.from({ length: 18 }, (_, index) => ({
    id: `moment-extra-${index}`, name: `Plan ${String(index).padStart(3, '0')}`,
    type: 'Personal', date: '2026-10-27', activities: [],
  }))];
  const errors = await seedGuest(page, { moments });
  await page.goto('/financials');
  const card = page.locator('.dn-transaction-card').filter({ hasText: 'Room deposit' }).first();
  await expect(card).toBeVisible();
  await card.locator('.dn-transaction-copy > strong').click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Transaction' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('Room deposit');
  const moment = dialog.getByRole('combobox', { name: 'Linked Moment' });
  await moment.click();
  await expect(page.getByRole('option', { name: moments[0].name, exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search linked moments' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Search linked moments' }).click();
  const search = page.getByRole('searchbox', { name: 'Search linked moments' });
  await expect(search).toBeFocused();
  await search.fill('Plan 017');
  await page.getByRole('option', { name: 'Plan 017', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Linked Moment' })).toContainText('Plan 017');
  await expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('Room deposit');
  await dialog.getByRole('radio', { name: 'Online' }).check();
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog).toHaveCount(0);
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_expenses')));
  expect(rows.find((row) => row.id === 'duplicate').eventId).toBe('moment-extra-17');
  expect(rows.find((row) => row.id === 'duplicate').activityId).toBeFalsy();
  expect(errors).toEqual([]);
});
