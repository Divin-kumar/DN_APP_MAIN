import { test, expect } from '@playwright/test';
import { calendarDate, fixtureMoments, seedGuest, swipe } from './fixtures.js';

// CHG-226: visual polish only. Keep Activity cover behavior, transaction
// semantic identity, swipe actions, detail disclosure and Guest records.
for (const [width, height, theme] of [[320, 640, 'light'], [390, 844, 'dark'], [430, 932, 'light']]) {
  test(`photo-led Activities remain readable with status and overdue cues at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    moments[0].activities[0].date = calendarDate(-2);
    moments[0].activities[0].title = 'Book the family lakeside accommodation with an accessible guest room';
    const errors = await seedGuest(page, { theme, moments });
    await page.goto('/activities');
    const list = page.locator('.activities-page .event-activity-list');
    const activity = list.locator('.dn-v2-activity-card.is-overdue').filter({ hasText: moments[0].activities[0].title });
    await expect(activity).toBeVisible();
    await expect(activity.locator('.event-activity-status')).toBeVisible();
    await expect(activity.locator('.dn-v2-activity-cover:not(.has-photo)')).toBeVisible();
    await expect(activity.locator('.dn-v2-activity-cover-action')).toBeVisible();
    await expect(activity.locator('.event-activity-context')).toContainText('Past due');
    const visual = await activity.evaluate((card) => {
      const title = card.querySelector('.event-activity-title-row > strong').getBoundingClientRect();
      const status = card.querySelector('.event-activity-status').getBoundingClientRect();
      const cover = card.querySelector('.dn-v2-activity-cover').getBoundingClientRect();
      const due = card.querySelector('.event-activity-context > span:last-child');
      const dueColor = getComputedStyle(due).color;
      const root = card.getBoundingClientRect();
      return { cardRight: root.right, coverWidth: cover.width, statusTop: status.top,
        titleTop: title.top, statusRight: status.right, dueColor,
        originalColor: getComputedStyle(card.querySelector('.event-activity-moment-name')).color,
        scrollWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth };
    });
    expect(visual.scrollWidth).toBeLessThanOrEqual(visual.viewportWidth + 1);
    expect(visual.statusRight).toBeLessThanOrEqual(visual.cardRight + 1);
    expect(Math.abs(visual.titleTop - visual.statusTop)).toBeLessThan(7);
    expect(visual.coverWidth).toBeGreaterThanOrEqual(79);
    expect(visual.dueColor).not.toBe(visual.originalColor);

    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    await swipe(page, activity, { distance: -100 });
    await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });

  test(`Transactions use compact semantic accents and preserve details and swipe at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme, incomes: [
      { id: 'income-test', name: 'Payment received for an exceptionally detailed description', amount: 123456789, date: calendarDate(-1), type: 'Other' },
    ], expenses: [
      { id: 'expense-test', name: 'Family grocery purchase', amount: 1750, date: calendarDate(-1), category: 'Groceries', eventId: 'moment-one', description: 'Weekly plan' },
    ] });
    await page.goto('/financials/transactions');
    const rows = page.getByRole('list', { name: 'Filtered transactions' });
    const income = rows.locator('.dn-v2-transaction-card.is-income');
    const expense = rows.locator('.dn-v2-transaction-card.is-expense');
    await expect(income).toHaveCount(1);
    await expect(expense).toHaveCount(3);
    await expect(income.locator('.dn-transaction-value')).toContainText('₹');
    await expect(expense.locator('.dn-transaction-value')).toContainText('₹');
    const layout = await rows.evaluate((container) => ({
      cardTypes: [...container.querySelectorAll('.dn-v2-transaction-card')].map((card) => {
        const style = getComputedStyle(card);
        const icon = card.querySelector('.dn-transaction-icon');
        const amount = card.querySelector('.dn-transaction-value').getBoundingClientRect();
        const right = card.getBoundingClientRect().right;
        return { className: card.className, accent: style.getPropertyValue('--dn-record-accent').trim(),
          iconWidth: icon.getBoundingClientRect().width, amountRight: amount.right, cardRight: right };
      }),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(layout.cardTypes).toHaveLength(4);
    expect(new Set(layout.cardTypes.filter((item) => item.className.includes('is-income')).map((item) => item.accent)).size).toBe(1);
    expect(new Set(layout.cardTypes.filter((item) => item.className.includes('is-expense')).map((item) => item.accent)).size).toBe(1);
    expect(layout.cardTypes.find((item) => item.className.includes('is-income')).accent)
      .not.toBe(layout.cardTypes.find((item) => item.className.includes('is-expense')).accent);
    for (const item of layout.cardTypes) {
      expect(item.iconWidth).toBeGreaterThanOrEqual(31);
      expect(item.amountRight).toBeLessThanOrEqual(item.cardRight + 1);
    }
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

    const details = rows.locator('.dn-v2-transaction-card.is-expense').filter({ hasText: 'Family grocery purchase' }).locator('details.dn-transaction-details');
    await expect(details).not.toHaveAttribute('open', '');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    await details.locator('summary').click();
    await expect(details).not.toHaveAttribute('open', '');

    const before = await page.evaluate(() => ['dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    await swipe(page, rows.locator('.dn-v2-transaction-card.is-expense').filter({ hasText: 'Family grocery purchase' }), { distance: 100 });
    await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);
    expect(await page.evaluate(() => ['dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}
