import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// In-flight account/demo switches must not briefly show a foreign ledger.
// Only the current Guest/account AND isolated-sample snapshot can supply cards
// and Income/Expense/Balance totals. This test mutates in-memory stores only.
for (const [width, height, theme] of [[320, 640, 'light'], [390, 844, 'dark'], [430, 932, 'light']]) {
  test(`Transactions hide stale Guest sample totals during a workspace switch at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/financials/transactions');

    const summary = page.locator('.dn-finance-summary');
    const cards = page.locator('.dn-transactions-results .dn-transaction-card');
    await expect(summary).toBeVisible();
    await expect(cards).toHaveCount(4);
    const guestRecords = await page.evaluate(() =>
      ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)));
    const before = await summary.innerText();

    // Same guest:anonymous load key, but these store contents belong to a
    // different isolated sample. The financial summary must disappear.
    await page.evaluate(async () => {
      const incomes = (await import('/src/store/useIncomeStore.js')).default;
      const expenses = (await import('/src/store/useExpenseStore.js')).default;
      incomes.setState({
        activeLoadKey: 'guest:anonymous', loadedFor: 'guest:anonymous',
        activeSample: 'tour', loadedSample: 'tour', loading: false, error: null,
        incomes: [{ id: 'another-demo-income', amount: 999999, name: 'Do not render' }],
      });
      expenses.setState({
        activeLoadKey: 'guest:anonymous', loadedFor: 'guest:anonymous',
        activeSample: 'tour', loadedSample: 'tour', loading: false, error: null,
        expenses: [{ id: 'another-demo-expense', amount: 999999, name: 'Do not render' }],
      });
    });
    await expect(summary).toHaveCount(0);
    await expect(cards).toHaveCount(0);
    await expect(page.getByText('Do not render')).toHaveCount(0);

    // Re-select the real Guest workspace; no records are written or changed.
    await page.evaluate(async () => {
      const incomes = (await import('/src/store/useIncomeStore.js')).default;
      const expenses = (await import('/src/store/useExpenseStore.js')).default;
      await Promise.all([
        incomes.getState().loadIncomes(null, true),
        expenses.getState().loadExpenses(null, true),
      ]);
    });
    await expect(summary).toBeVisible();
    await expect(cards).toHaveCount(4);
    await expect(summary).toContainText('Income');
    await expect(summary).toContainText('Balance');
    expect(await summary.innerText()).toBe(before);
    expect(await page.evaluate(() =>
      ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)))).toEqual(guestRecords);
    expect(errors).toEqual([]);
  });
}
