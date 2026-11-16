import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

for (const [width, theme] of [[320, 'dark'], [430, 'light']]) {
  test(`Planning surfaces remain readable and operable at ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 740 });
    const errors = await seedGuest(page, { theme, moments: [],
      incomes: [{ id: 'salary', name: 'Salary', type: 'Salary', amount: 52000, date: '2026-11-01' }],
      expenses: [{ id: 'rent', name: 'Home rent', category: 'Housing', amount: 12500, date: '2026-11-02' }] });
    await page.addInitScript(() => {
      if (!localStorage.getItem('dn_glass_seeded')) {
        localStorage.setItem('dn_guest_expense_plans', JSON.stringify([{ id: 'internet', name: 'Home internet', amount: 799,
          category: 'Home', dueDate: '2026-11-16', paymentMethod: 'Online', updatedAt: '2026-11-15T12:00:00Z',
          repeat: { frequency: 'monthly', anchorDate: '2026-11-16' } }]));
        localStorage.setItem('dn_guest_tasks', JSON.stringify([{ id: 'weekly', title: 'Review weekly expenses',
          dueDate: '2026-11-16', status: 'in-progress',
          repeat: { frequency: 'weekly', anchorDate: '2026-11-16', seriesId: 'weekly' } }]));
        localStorage.setItem('dn_glass_seeded', 'true');
      }
    });
    const capture = async (name) => {
      await page.evaluate(async () => {
        await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished));
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
      const dialog = page.getByRole('dialog');
      if (await dialog.count()) {
        const box = await dialog.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(await dialog.locator('.dn-modal-body').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      }
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
    };
    await page.goto('/insights');
    await page.getByRole('button', { name: 'Finance', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Report month', exact: true })).toBeVisible();
    await expect(page.locator('.dn-finance-report .lucide-chevron-right, .dn-finance-report .lucide-chevron-down, .dn-finance-report .lucide-arrow-up-right, .dn-finance-report .lucide-arrow-down-left')).toHaveCount(0);
    await capture('finance');
    await page.getByRole('button', { name: 'Compare months', exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await capture('comparison');
    await page.getByRole('button', { name: 'Breakdown', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Expenses by category' })).toBeVisible();
    await capture('breakdown');
    await page.goto('/financials/transactions#expense-plans');
    await expect(page.getByRole('dialog', { name: 'Upcoming expenses', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Manage plan/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Edit schedule', exact: true })).toBeVisible();
    await capture('bill');
    await capture('manage');
    await page.getByRole('button', { name: 'Edit schedule', exact: true }).click();
    await page.locator('.dn-repeat-disclosure > summary').click();
    await expect(page.getByRole('radio', { name: 'Monthly', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Save expense plan' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('dialog')).toContainText('Record each payment when it is paid.');
    await capture('repeat');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: /Skip this occurrence/ }).click();
    await expect(page.getByRole('button', { name: 'Skip occurrence', exact: true })).toBeInViewport({ ratio: 1 });
    await capture('skip');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'End repeat', exact: true }).click();
    await capture('end');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Record payment for Home internet' }).click();
    await expect(page.getByRole('button', { name: 'Save payment', exact: true })).toBeInViewport({ ratio: 1 });
    await capture('payment');
    await page.getByRole('button', { name: 'Save payment', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Payment recorded.');
    await capture('success');
    await page.getByRole('button', { name: 'View payment', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Payment details', exact: true })).toContainText('₹799');
    await capture('receipt');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.goto('/tasks');
    const task = page.locator('[data-task-id="weekly"]');
    await expect(task).toBeVisible();
    // Guard against the older shared list rule silently erasing the new surface.
    expect(await task.evaluate(el => getComputedStyle(el).backgroundImage)).not.toBe('none');
    await capture('tasks');
    await task.click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await page.locator('.dn-repeat-disclosure > summary').click();
    await expect(page.getByRole('radio', { name: 'Weekly', exact: true })).toBeChecked();
    await capture('task-repeat');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await task.click();
    await page.getByRole('menuitem', { name: 'Pause repeat', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Pause repeat?', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause repeat', exact: true })).not.toHaveClass(/modal-danger-button/);
    await capture('task-pause');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(errors).toEqual([]);
  });
}
