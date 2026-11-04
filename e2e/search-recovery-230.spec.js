import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Guest only. Data sources and existing Refine state remain intact.
const routes = [
  { path: '/events', name: 'Search moments' },
  { path: '/activities', name: 'Search activities and Moments' },
  { path: '/financials/transactions', name: 'Search transactions' },
];
for (const width of [320, 390]) {
  for (const { path, name } of routes) {
    test(`Search clear preserves records on ${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 790 });
      const errors = await seedGuest(page, { theme: width === 320 ? 'dark' : 'light' });
      await page.goto(path);
      const input = page.getByRole('searchbox', { name });
      const original = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)));
      await input.fill('no-match-search-recovery-999');
      const clear = page.getByRole('button', { name: 'Clear search', exact: true });
      await expect(clear).toBeVisible();
      expect((await clear.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await clear.click();
      await expect(input).toHaveValue('');
      await expect(clear).toHaveCount(0);
      await page.waitForTimeout(240); // Past the normal debounced commit window.
      await expect(input).toHaveValue('');
      expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
        .map((key) => localStorage.getItem(key)))).toEqual(original);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      expect(errors).toEqual([]);
    });
  }
  test(`Task search and empty-state recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 790 });
    const errors = await seedGuest(page, { theme: width === 320 ? 'dark' : 'light' });
    await page.goto('/tasks');
    await page.evaluate(() => localStorage.setItem('dn_guest_tasks', JSON.stringify([
      { id: 'recovery-one', title: 'Review photographs', notes: '', status: 'in-progress',
        priority: 'medium', momentId: '', activityId: '', dueDate: '', dueTime: '' },
    ])));
    await page.reload();
    await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_tasks'));
    const input = page.getByRole('searchbox', { name: 'Search Tasks' });
    await input.fill('no-match-search-recovery-999');
    await expect(page.getByRole('heading', { name: 'No matching Tasks' })).toBeVisible();
    const emptyAction = page.locator('.dn-task-empty-actions').getByRole('button', { name: 'Clear search' });
    await expect(emptyAction).toBeVisible();
    await emptyAction.click();
    await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
    await input.fill('another-unmatched-query');
    const inline = page.getByRole('button', { name: 'Clear Task search' });
    await expect(inline).toBeVisible();
    expect((await inline.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await inline.click();
    await expect(input).toHaveValue('');
    await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_tasks'))).toBe(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
