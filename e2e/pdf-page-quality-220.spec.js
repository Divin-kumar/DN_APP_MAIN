import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { seedGuest } from './fixtures.js';

test('experimental enhanced PDF uses larger real page JPEGs and preserves records', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events/moment-one/pdf');
  const studio = page.locator('.dn-pdf-studio-page');
  const control = studio.getByRole('combobox', { name: 'PDF page image quality' });
  const download = studio.getByRole('button', { name: 'Download customized PDF' });
  await expect(studio.getByRole('img', { name: 'Rendered PDF page 1' })).toBeVisible();
  await expect(control).toContainText('Standard');
  const unchanged = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  const first = page.waitForEvent('download');
  await download.click();
  const standard = (await readFile(await (await first).path())).toString('latin1');
  expect(standard).toMatch(/\/Width 982 \/Height 1389/);
  await control.click();
  await page.getByRole('listbox', { name: 'PDF page image quality' })
    .getByRole('option', { name: /^Enhanced/ }).click();
  await expect(download).toBeDisabled();
  await studio.getByRole('button', { name: 'Update preview' }).click();
  await expect(download).toBeEnabled({ timeout: 30000 });
  const second = page.waitForEvent('download');
  await download.click();
  const enhanced = (await readFile(await (await second).path())).toString('latin1');
  expect(enhanced).toMatch(/\/Width 1785 \/Height 2526/);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(unchanged);
  expect(errors).toEqual([]);
});
