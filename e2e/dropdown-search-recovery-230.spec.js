import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Shared search is a temporary dropdown-menu query, never a saved Task/filter mutation.
for (const [width, height, theme] of [[320, 740, 'dark'], [390, 844, 'light'], [1280, 900, 'dark']]) {
  test(`searchable Task Refine dropdown can recover without losing its selection at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/tasks');
    const previous = await page.evaluate(() => [
      localStorage.getItem('dn_guest_tasks'), localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_expenses'),
    ]);

    await page.getByRole('button', { name: 'Refine', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Refine Tasks' });
    await sheet.getByRole('button', { name: 'Add filter' }).click();
    const picker = sheet.getByRole('combobox', { name: 'Filter by', exact: true });
    await picker.click();

    const menu = page.locator('.dropdown-menu-portal');
    const search = menu.getByRole('searchbox', { name: 'Search filters' });
    await expect(search).toBeVisible();
    await expect(search).not.toBeFocused();
    await expect(menu.getByRole('button', { name: 'Clear search filters' })).toHaveCount(0);
    const totalOptions = await menu.getByRole('option').count();
    expect(totalOptions).toBeGreaterThan(10);

    await search.fill('missing-filter-name-123456');
    await expect(menu.getByRole('option')).toHaveCount(0);
    await expect(menu.getByRole('status')).toContainText('No matching options');
    const clear = menu.getByRole('button', { name: 'Clear search filters' });
    await expect(clear).toBeVisible();
    const hit = await clear.boundingBox();
    expect(hit.width).toBeGreaterThanOrEqual(43.9);
    expect(hit.height).toBeGreaterThanOrEqual(43.9);
    expect(hit.x).toBeGreaterThanOrEqual(-1);
    expect(hit.x + hit.width).toBeLessThanOrEqual(width + 1);

    await clear.click();
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(menu.getByRole('option')).toHaveCount(totalOptions);
    await expect(menu.getByRole('button', { name: 'Clear search filters' })).toHaveCount(0);

    await search.fill('Status');
    await search.press('Tab');
    await expect(clear).toBeFocused();
    await clear.press('Shift+Tab');
    await expect(search).toBeFocused();
    await search.press('Tab');
    await clear.press('Enter');
    await expect(search).toHaveValue('');
    await expect(search).toBeFocused();
    await expect(menu.getByRole('option')).toHaveCount(totalOptions);

    await search.fill('Stat');
    await search.press('Home');
    expect(await search.evaluate(input => input.selectionStart)).toBe(0);
    await search.press('End');
    expect(await search.evaluate(input => input.selectionStart)).toBe(4);
    await search.evaluate(input => input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', isComposing: true, bubbles: true, cancelable: true,
    })));
    await expect(search).toBeFocused();
    await expect(menu).toBeVisible();
    await search.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(picker).toBeFocused();
    await expect(sheet).toBeVisible();
    await picker.click();
    await search.fill('Status');
    await search.press('Enter');
    await expect(picker).toContainText('Status');
    await expect(menu).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_tasks'), localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_expenses'),
    ])).toEqual(previous);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
