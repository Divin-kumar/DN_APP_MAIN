import { test, expect } from '@playwright/test';
import { calendarDate, seedGuest } from './fixtures.js';

for (const [route, selector, field, save] of [
  ['/tasks', '.dn-independent-task-row', 'Task title', 'Save Task'],
  ['/activities', '.dn-v2-activity-card', 'Activity title', 'Save activity'],
  ['/financials/transactions', '.dn-v2-transaction-card', 'Title *', 'Save Changes'],
]) {
  test('filtered edit returns to its row on ' + route, async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });
    const rows = Array.from({ length: 40 }, (_, i) => ({
      id: 'record-' + i, title: (i ? 'Family ' : 'Other ') + i, date: calendarDate(1),
      priority: 'medium', dueDate: calendarDate(1), status: 'in-progress',
    }));
    await seedGuest(page, { moments: [{ id: 'family', name: 'Personal', type: 'Project', date: calendarDate(1), activities: rows }],
      expenses: rows.map(row => ({ ...row, name: row.title, amount: 10, category: 'Food', paymentMethod: 'Cash' })), incomes: [] });
    await page.addInitScript(entries => localStorage.setItem('dn_guest_tasks', JSON.stringify(entries)), rows);
    await page.goto(route);
    const search = page.getByRole('searchbox');
    await search.fill('Family');
    const cards = page.locator(selector);
    await expect(cards).toHaveCount(39);
    const row = cards.filter({ hasText: /Family 25/ });
    await row.scrollIntoViewIfNeeded();
    const before = await row.boundingBox();
    await row.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: field, exact: true }).fill('Family 25 edited');
    await dialog.getByRole('button', { name: new RegExp(save, 'i') }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toContainText('Family 25 edited');
    await expect(search).toHaveValue('Family');
    await expect.poll(() => row.evaluate(el => el.contains(document.activeElement))).toBe(true);
    expect(Math.abs((await row.boundingBox()).y - before.y)).toBeLessThan(5);
  });
}
