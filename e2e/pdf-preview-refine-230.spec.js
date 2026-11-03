import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Guest journeys only. This verifies preview state, not real Safari or printing.
for (const [width, height, theme] of [[320, 740, 'dark'], [390, 844, 'light'], [1280, 900, 'dark']]) {
  test(`PDF Studio keeps pending edits separate from rendered preview at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events/moment-one/pdf');
    const studio = page.locator('.dn-pdf-studio-page');
    const download = studio.getByRole('button', { name: 'Download customized PDF' });
    const rail = studio.locator('.dn-pdf-update-rail');
    const header = studio.locator('.dn-pdf-studio-preview-head small');
    await expect(download).toBeEnabled({ timeout: 30000 });
    await expect(header).toContainText('Journal');
    await expect(rail.getByText('Preview is up to date')).toBeVisible();
    await expect(studio.getByRole('button', { name: 'Update preview' })).toHaveCount(0);
    const saved = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ]);
    await studio.getByRole('combobox', { name: 'PDF story format' }).click();
    await page.getByRole('listbox', { name: 'PDF story format' })
      .getByRole('option', { name: /^Diary/ }).click();
    await expect(studio.getByRole('combobox', { name: 'PDF story format' })).toContainText('Diary');
    await expect(download).toBeDisabled();
    await expect(rail.getByText('Changes pending')).toBeVisible();
    await expect(header).toContainText('Journal');
    await expect(header).not.toContainText('Diary');
    const update = rail.getByRole('button', { name: 'Update preview' });
    await expect(update).toBeVisible();
    await expect(studio.getByRole('button', { name: 'Update preview' })).toHaveCount(1);
    const pagination = studio.locator('.dn-pdf-pagination-option');
    await pagination.scrollIntoViewIfNeeded();
    await expect(update).toBeInViewport();
    const geometry = await rail.evaluate((element) => {
      const b = element.getBoundingClientRect();
      return { top: b.top, left: b.left, right: b.right, width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width + 1);
    await update.click();
    await expect(download).toBeEnabled({ timeout: 30000 });
    await expect(rail.getByText('Preview is up to date')).toBeVisible();
    await expect(update).toHaveCount(0);
    await expect(header).toContainText('Diary');
    await expect(studio.getByText('Settings changed. Update the preview to download.')).toHaveCount(0);
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ])).toEqual(saved);
    expect(errors).toEqual([]);
  });
}
