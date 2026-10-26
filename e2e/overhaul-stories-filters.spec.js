import { test, expect } from '@playwright/test';
import { accountScope, addOriginal, fixtureMoments, seedGuest } from './fixtures.js';

async function selectConditionOption(page, name, option) {
  await page.getByRole('combobox', { name, exact: true }).last().click();
  const search = page.locator('.dropdown-menu-portal input[type="search"]');
  if (await search.count()) await search.fill(option);
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('Moments default to recorded Event Date, including across past and future years', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].date = '2027-11-20'; moments[1].date = '2025-01-08';
  moments[0].createdAt = '2024-01-01'; moments[1].createdAt = '2026-12-31';
  await seedGuest(page, { moments });
  await page.goto('/events');
  const cards = page.locator('.life-journey-items .event-story-main');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText('A separate Moment');
  await expect(cards.nth(1)).toContainText('Weekend in Ooty');
  await expect(cards.nth(0)).toContainText('08 Jan 2025');
  await page.reload();
  await expect(cards.nth(0)).toContainText('A separate Moment');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('combobox', { name: 'Sort moments field', exact: true })).toBeVisible();
});

test('Summary photos belong to their Moment/Activity card, never a footer gallery', async ({ page }) => {
  await seedGuest(page); await addOriginal(page, { count: 3 });
  await page.goto('/events');
  const card = page.getByRole('group', { name: /Weekend in Ooty/ });
  await card.focus(); await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Summary', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Moment summary', exact: true });
  const activity = dialog.locator('.event-summary-activities li').filter({ hasText: 'Book a lakeside stay' });
  await expect(activity.locator('.dn-attachment-tile')).toHaveCount(3);
  await expect(activity).toContainText('Book a lakeside stay');
  await expect(dialog.locator('.moment-summary-media').first().locator('.dn-attachment-tile')).toHaveCount(1);
  await expect(dialog.locator('.moment-summary-attachments')).toHaveCount(0);
});

test('Dashboard sections remember separate visibility choices across reloads', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Hide Moments on dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide Activities on dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Show Activities on dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide Moments on dashboard' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show Activities on dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide Moments on dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Show Moments on dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Show Activities on dashboard' }).click();
  await expect(page.getByRole('button', { name: 'Hide Activities on dashboard' })).toBeVisible();
});

test('the compact Activity Filters panel remembers its last filter and offers no preset or group controls', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('button', { name: 'Advanced filters', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await selectConditionOption(page, 'Filter by', 'Activity name');
  await selectConditionOption(page, 'Comparison', 'Contains');
  await page.getByRole('textbox', { name: 'Value for Activity name', exact: true }).fill('Book a');
  await expect(page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Remove filter Activity name Contains Book a/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save filter|Add filter group/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Saved|Recent|Favorites/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Remove filter Activity name Contains Book a/ }).click();
  await expect(page.getByRole('group', { name: 'Open A different activity with the same ID', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Product filter choices stay limited while large named Moment choices remain searchable and virtualized', async ({ page }) => {
  const moments = Array.from({ length: 160 }, (_, index) => ({ id: `private-moment-${index}`, name: `Plan ${String(index).padStart(3, '0')}`,
    type: 'Personal', date: '2026-10-26',
    metadata: index === 0 ? { future: Object.fromEntries(Array.from({ length: 100 }, (_, field) => [`field${field}`, `value${field}`])) } : undefined,
    activities: [{ id: `private-activity-${index}`, title: `Task ${String(index).padStart(3, '0')}`, completed: false }] }));
  await seedGuest(page, { moments }); await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter by', exact: true }).click();
  const fields = await page.getByRole('option').allTextContents();
  expect(fields.length).toBeLessThanOrEqual(15);
  expect(fields.join(' ')).not.toMatch(/metadata|future|field99|private-|\bid\b| · /i);
  await page.keyboard.press('Escape');
  await selectConditionOption(page, 'Filter by', 'Moment');
  await selectConditionOption(page, 'Comparison', 'Is');
  await page.getByRole('combobox', { name: 'Value for Moment', exact: true }).click();
  await expect(page.locator('.dropdown-options-scroll.is-virtual')).toBeVisible();
  expect(await page.getByRole('option').count()).toBeLessThan(30);
  await page.getByRole('searchbox', { name: 'Search options', exact: true }).fill('Plan 159');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('group', { name: 'Open Task 159', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Open Task 000', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('numeric ranges keep both boundaries and existing nested OR rules retain their logic without group-creation controls', async ({ page }) => {
  await seedGuest(page);
  await page.addInitScript(() => {
    const group = { id: 'root', kind: 'group', join: 'AND', children: [
      { id: 'range', kind: 'rule', field: 'amount', operator: 'between', value: ['', ''] },
      { id: 'legacy-or', kind: 'group', join: 'OR', children: [{ id: 'lower-bound', kind: 'rule', field: 'amount', operator: 'gt', value: '' }] },
    ] };
    localStorage.setItem('dn_list_state_guest_conditions%3Atransactions', JSON.stringify({ group, migrationVersion: 1, saved: [], recent: [], history: [] }));
  });
  await page.goto('/financials');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('spinbutton', { name: 'From Amount', exact: true }).fill('99');
  await page.getByRole('spinbutton', { name: 'To Amount', exact: true }).fill('101');
  await expect(page.getByRole('button', { name: /Remove filter Amount Between 99 – 101/ })).toBeVisible();
  await expect(page.locator('.dn-transaction-copy strong', { hasText: 'Room deposit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add filter group', exact: true })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Value for Amount', exact: true }).fill('50');
  await expect(page.getByRole('button', { name: /Remove filter AND › OR · Amount Greater than 50/ })).toBeVisible();
});

test('An uncommitted filter draft cannot cross a Guest to synthetic Account scope switch', async ({ page }) => {
  const moments = fixtureMoments();
  await seedGuest(page, { moments });
  await page.addInitScript(() => {
    const value = { group: { id: 'root', kind: 'group', join: 'AND', children: [{ id: 'same-rule', kind: 'rule', field: 'name', operator: 'contains', value: '' }] }, saved: [], recent: [], history: [], migrationVersion: 1 };
    for (const scope of ['guest', 'account:filter-owner']) {
      localStorage.setItem(`dn_list_state_${encodeURIComponent(scope)}_${encodeURIComponent('conditions:moments')}`, JSON.stringify(value));
    }
  });
  await page.goto('/events');
  await page.evaluate(async () => { await Promise.all([import('/src/store/useAppStore.js'), import('/src/store/useEventStore.js'), import('/src/store/useIncomeStore.js'), import('/src/store/useExpenseStore.js')]); });
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('textbox', { name: 'Value for Moment name', exact: true }).fill('Weekend');
  await accountScope(page, 'filter-owner', moments);
  await expect(page.getByRole('textbox', { name: 'Value for Moment name', exact: true })).toHaveValue('');
  // Observe beyond the 220ms debounce so a delayed cross-scope write would run.
  await page.waitForTimeout(350);
  await expect.poll(() => page.evaluate(() => {
    const key = `dn_list_state_${encodeURIComponent('account:filter-owner')}_${encodeURIComponent('conditions:moments')}`;
    return JSON.parse(localStorage.getItem(key)).group.children[0].value;
  }), { timeout: 1200 }).toBe('');
  await expect(page.getByRole('button', { name: /Remove filter Moment name Contains Weekend/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
});
