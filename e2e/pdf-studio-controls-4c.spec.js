import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Phase 4C browser acceptance: synthetic Guest content only.
// Verify JPEG parity, accessibility and record immutability on a real Chromium page.
for (const [width, height, theme] of [[320, 740, 'light'], [390, 844, 'dark']]) {
  test(`PDF Studio dropdowns and page folios work at ${width}px in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events/moment-one/pdf');
    const studio = page.locator('.dn-pdf-studio-page');
    const download = studio.getByRole('button', { name: 'Download customized PDF' });
    await expect(download).toBeEnabled({ timeout: 30000 });
    const source = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const fingerprint = () => page.evaluate(async () => {
      const url = document.querySelector('.dn-pdf-preview-page img')?.src;
      const image = new Uint8Array(await (await fetch(url)).arrayBuffer());
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', image))]
        .map((value) => value.toString(16).padStart(2, '0')).join('');
    });
    const original = await fingerprint();
    const format = studio.getByRole('combobox', { name: 'PDF story format' });
    await format.click();
    const listbox = page.getByRole('listbox', { name: 'PDF story format' });
    await expect(listbox.getByRole('option')).toHaveCount(3);
    const geometry = await listbox.evaluate((node) => {
      const box = node.closest('.dropdown-menu-portal').getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(width + 1);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(height + 1);
    await page.keyboard.press('Escape');
    await expect(listbox).toHaveCount(0);
    await expect(format).toBeFocused();

    const folio = studio.getByRole('group', { name: 'PDF page numbering position' });
    await expect(folio.getByRole('button', { name: 'PDF page numbers Right' })).toHaveAttribute('aria-pressed', 'true');
    await folio.getByRole('button', { name: 'PDF page numbers Center' }).click();
    await expect(download).toBeDisabled();
    await studio.getByRole('button', { name: 'Update preview' }).click();
    await expect(download).toBeEnabled({ timeout: 30000 });
    const centered = await fingerprint();
    expect(centered).not.toBe(original);

    await folio.getByRole('button', { name: 'PDF page numbers Hidden' }).click();
    await studio.getByRole('button', { name: 'Update preview' }).click();
    await expect(download).toBeEnabled({ timeout: 30000 });
    const hidden = await fingerprint();
    expect(hidden).not.toBe(centered);
    expect(hidden).not.toBe(original);

    await folio.getByRole('button', { name: 'PDF page numbers Right' }).click();
    await expect(studio.getByRole('checkbox', { name: /Number the cover page/ })).toBeChecked();
    await studio.getByRole('checkbox', { name: /Number the cover page/ }).uncheck();
    await expect(download).toBeDisabled();
    await studio.getByRole('button', { name: 'Update preview' }).click();
    await expect(download).toBeEnabled({ timeout: 30000 });
    const unnumberedCover = await fingerprint();
    expect(unnumberedCover).not.toBe(original);

    // Every PDF checkbox uses a real, keyboard-operable input with a premium
    // switch surface. Optional content should not fill the screen by default.
    const options = studio.locator('details.dn-pdf-content-options');
    await expect(options).not.toHaveAttribute('open', '');
    await expect(options.getByRole('checkbox', { name: /Introduction/ })).not.toBeVisible();
    await expect(options.locator('summary')).toContainText('selected');
    const searchable = studio.getByRole('checkbox', { name: 'Add searchable writing to PDF' });
    const toggleStyle = await searchable.evaluate((node) => {
      const computed = getComputedStyle(node);
      return { appearance: computed.appearance, width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height };
    });
    expect(toggleStyle.appearance).toBe('none');
    expect(toggleStyle.width).toBeGreaterThanOrEqual(44);
    expect(toggleStyle.height).toBeGreaterThanOrEqual(26);
    await options.locator('summary').click();
    await expect(options.getByRole('checkbox', { name: /Introduction/ })).toBeVisible();
    await options.getByRole('checkbox', { name: /Introduction/ }).uncheck();
    await expect(download).toBeDisabled();
    await options.locator('summary').click();
    await expect(options).not.toHaveAttribute('open', '');
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(source);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}

test('Settings correctly describes Story defaults and PDF-only customization without changing records', async ({ page }) => {
  const errors = await seedGuest(page, { theme: 'dark' });
  await page.goto('/settings');
  const source = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.getByRole('link', { name: 'Open Appearance & preferences' }).click();
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  await expect(page.getByRole('region', { name: 'Story and PDF appearance' })
    .getByText(/Story and PDF Studio start with these styles/)).toBeVisible();
  await expect(page.getByText('PDF Studio customization is a separate upcoming 2.2.0 step.')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(source);
  expect(errors).toEqual([]);
});
