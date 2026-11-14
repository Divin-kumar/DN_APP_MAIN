import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { seedGuest } from './fixtures.js';

async function choose(page, form, label, option) {
  await form.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

const repeat = (dialog, frequency) => dialog.getByRole('radio', { name: frequency, exact: true });

const readGuest = (page, key) => page.evaluate((name) => JSON.parse(localStorage.getItem(name) || '[]'), key);
const empty = { moments: [], incomes: [], expenses: [] };
const more = (dialog) => dialog.locator('summary').filter({ hasText: 'More options' });

test('recurring Tasks use the normal list and advance one due date at a time', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, empty);
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  const draft = page.getByRole('dialog', { name: 'New Task' });
  await draft.getByLabel('Task title').fill('Read the meter');
  await draft.getByLabel('Due date', { exact: true }).fill('2026-01-31');
  await expect(repeat(draft, 'Monthly')).toBeHidden();
  await more(draft).click();
  await expect(repeat(draft, 'Once')).toBeChecked();
  await repeat(draft, 'Monthly').check();
  await expect(draft.getByRole('status')).toContainText('28 Feb 2026');
  await draft.getByRole('button', { name: 'Create Task' }).click();
  const list = page.locator('.dn-task-list');
  const recurring = list.locator('article').filter({ hasText: 'Repeats monthly' });
  await expect(recurring).toHaveCount(1);
  await expect(recurring).toContainText('Read the meter');
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Done', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(2);
  expect((await readGuest(page, 'dn_guest_tasks')).map((task) => [task.dueDate, task.status])).toEqual([
    ['2026-01-31', 'completed'], ['2026-02-28', 'in-progress'],
  ]);
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Skip this occurrence', exact: true }).click();
  const skip = page.getByRole('dialog', { name: 'Skip this Task?' });
  await expect(skip).toContainText('31 Mar 2026');
  await skip.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(2);
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Skip this occurrence', exact: true }).click();
  await skip.getByRole('button', { name: 'Skip occurrence', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(3);
  expect((await readGuest(page, 'dn_guest_tasks')).map((task) => [task.dueDate, task.status])).toEqual([
    ['2026-01-31', 'completed'], ['2026-02-28', 'cancelled'], ['2026-03-31', 'in-progress'],
  ]);
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Task' });
  await more(edit).click();
  await repeat(edit, 'Once').check();
  await edit.getByRole('button', { name: 'Save Task', exact: true }).click();
  await expect(recurring).toHaveCount(0);
  await page.reload();
  await expect(list.locator('article')).toHaveCount(3);
  expect((await readGuest(page, 'dn_guest_tasks')).every((task) => !task.repeat)).toBe(true);
  expect(await readGuest(page, 'dn_guest_expenses')).toEqual([]);
  expect(errors).toEqual([]);
});

test('recurring expenses stay outside totals, then post one editable payment and can skip or end', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const errors = await seedGuest(page, { ...empty, moments: [{
    id: 'home', name: 'Home plans', type: 'Personal', date: '2026-01-31',
    activities: [{ id: 'connection', title: 'Internet connection', date: '2026-01-31' }],
  }] });
  await page.goto('/financials/transactions');
  const total = page.locator('.dn-finance-metric-expense strong');
  await expect(total).toHaveText('₹0');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Transaction', exact: true }).click();
  const draft = page.getByRole('dialog', { name: 'Add Transaction' });
  await draft.getByLabel('Amount *', { exact: true }).fill('799');
  await draft.getByLabel('Title *', { exact: true }).fill('Home internet');
  await expect(repeat(draft, 'Monthly')).toBeHidden();
  await more(draft).click();
  await repeat(draft, 'Monthly').check();
  await draft.getByLabel('Due date *', { exact: true }).fill('2026-01-31');
  await expect(draft.getByRole('status')).toContainText('28 Feb 2026');
  await draft.getByRole('button', { name: 'Save expense plan', exact: true }).click();
  await expect(draft).toHaveCount(0);
  await expect(total).toHaveText('₹0');
  expect(await readGuest(page, 'dn_guest_expenses')).toEqual([]);
  expect((await readGuest(page, 'dn_guest_expense_plans'))[0].dueDate).toBe('2026-01-31');
  const upcoming = page.getByRole('button', { name: /Upcoming expenses/ });
  await expect(upcoming).toContainText('1 overdue');
  await upcoming.click();
  const plans = page.getByRole('dialog', { name: 'Upcoming expenses', exact: true });
  const sheet = await plans.elementHandle();
  const recordPayment = plans.getByRole('button', { name: 'Record payment for Home internet' });
  await recordPayment.click();
  const payment = page.getByRole('dialog', { name: 'Record payment', exact: true });
  await expect(payment.getByRole('heading', { name: 'Record payment' })).toBeFocused();
  expect(await sheet.getAttribute('aria-labelledby')).toBe(await payment.getByRole('heading').getAttribute('id'));
  await page.keyboard.press('Tab');
  await expect(payment.getByRole('button', { name: 'Back to upcoming expenses' })).toBeFocused();
  await payment.getByRole('button', { name: 'Back to upcoming expenses' }).click();
  await expect(plans).toContainText('31 Jan 2026');
  expect(await readGuest(page, 'dn_guest_expenses')).toEqual([]);
  await recordPayment.click();
  await expect(payment.getByRole('combobox', { name: 'Transaction Type', exact: true })).toHaveCount(0);
  await expect(payment.getByLabel('Paid on *', { exact: true })).toBeVisible();
  await expect(payment).toContainText('After saving, next due 28 Feb 2026');
  await expect(payment.getByLabel('Title', { exact: true })).toBeHidden();
  await expect(payment.getByLabel('Amount paid *', { exact: true })).toHaveValue('799');
  await payment.getByLabel('Amount paid *', { exact: true }).fill('825');
  await payment.getByRole('radio', { name: 'Online' }).check();
  await more(payment).click();
  await choose(page, payment, 'Linked Moment', 'Home plans');
  await choose(page, payment, 'Linked Activity', 'Internet connection');
  await payment.getByRole('button', { name: 'Save payment' }).click();
  await expect(payment).toHaveCount(0);
  await expect(total).toHaveText('₹825');
  expect((await readGuest(page, 'dn_guest_eventGroups'))[0].activities[0].expenses[0].amount).toBe(825);
  await expect(plans.getByRole('status')).toHaveText('Payment recorded. Next due 28 Feb 2026.');
  await expect(plans.getByRole('listitem')).toContainText('28 Feb 2026');
  const manage = plans.getByRole('button', { name: 'Manage plan for Home internet' });
  await manage.click();
  const planActions = page.getByRole('dialog', { name: 'Manage expense plan' });
  await planActions.getByRole('button', { name: 'Edit schedule', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit expense plan' });
  await expect(edit.getByLabel('Expected amount *', { exact: true })).toHaveValue('799');
  await expect(edit.getByLabel('Due date *', { exact: true })).toHaveValue('2026-02-28');
  await expect(edit.getByRole('group', { name: 'Repeat', exact: true }).getByRole('status')).toContainText('31 Mar 2026');
  await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(planActions).toBeVisible();
  await planActions.getByRole('button', { name: /Skip this occurrence/ }).click();
  await expect(page.getByRole('dialog', { name: 'Skip this expense?' })).toContainText('Next due 31 Mar 2026');
  await page.getByRole('button', { name: 'Skip occurrence', exact: true }).click();
  await expect(plans.getByRole('status')).toHaveText('Occurrence skipped. Next due 31 Mar 2026.');
  await expect(plans.getByRole('listitem')).toContainText('31 Mar 2026');
  await manage.click();
  await planActions.getByRole('button', { name: 'Edit schedule', exact: true }).click();
  await edit.getByLabel('Expected amount *', { exact: true }).fill('850');
  await edit.getByRole('button', { name: 'Save expense plan', exact: true }).click();
  await expect(plans.getByRole('status')).toHaveText('Expense plan saved.');
  await expect(plans.getByRole('listitem')).toContainText('₹850');
  await manage.click();
  await planActions.getByRole('button', { name: 'End repeat', exact: true }).click();
  await page.getByRole('dialog', { name: 'End this expense plan?' }).getByRole('button', { name: 'End repeat', exact: true }).click();
  await expect(plans.getByRole('status')).toHaveText('Expense plan ended.');
  await expect(plans).toContainText('No upcoming expenses');
  await expect(upcoming).toHaveCount(0);
  await plans.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('region', { name: 'Financial totals for matching transactions' })).toBeFocused();
  await expect(total).toHaveText('₹825');
  expect((await readGuest(page, 'dn_guest_expenses')).map((expense) => expense.amount)).toEqual([825]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('an Upcoming expenses link opens the sorted sheet once and supports several payments in place', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-14T12:00:00.000Z'));
  const errors = await seedGuest(page, empty);
  await page.addInitScript(() => {
    const plan = (id, name, dueDate) => ({ id, name, amount: 100, category: 'Home', dueDate,
      repeat: { frequency: 'monthly', anchorDate: dueDate }, paymentMethod: 'Online', updatedAt: '2026-11-01T12:00:00.000Z' });
    localStorage.setItem('dn_guest_expense_plans', JSON.stringify([
      plan('later', 'Insurance', '2026-12-19'), plan('today', 'Mobile', '2026-11-14'), plan('overdue', 'Internet', '2026-11-12'),
    ]));
  });
  await page.goto('/financials/transactions#expense-plans');
  const plans = page.getByRole('dialog', { name: 'Upcoming expenses', exact: true });
  const dueNow = plans.getByRole('region', { name: 'Due now' });
  const later = plans.getByRole('region', { name: 'Later' });
  await expect(dueNow.getByRole('listitem')).toHaveCount(2);
  await expect(dueNow.getByRole('listitem').first()).toContainText('Internet');
  await expect(dueNow.getByRole('listitem').last()).toContainText('Due today');
  await expect(later.getByRole('listitem')).toContainText('Insurance');
  await plans.getByRole('button', { name: 'Close dialog' }).click();
  const trigger = page.getByRole('button', { name: /Upcoming expenses/ });
  await expect(trigger).toBeFocused();
  await expect(plans).toBeHidden();
  await trigger.click();
  for (const title of ['Internet', 'Mobile']) {
    await dueNow.getByRole('button', { name: `Record payment for ${title}` }).click();
    const payment = page.getByRole('dialog', { name: 'Record payment', exact: true });
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await payment.getByRole('button', { name: 'Save payment' }).click();
    await expect(plans.getByRole('status')).toContainText('Payment recorded.');
    await expect(later.getByRole('button', { name: `Record payment for ${title}` })).toBeVisible();
  }
  await expect(dueNow).toBeHidden();
  await expect(later.getByRole('listitem')).toHaveCount(3);
  await expect(page.locator('.dn-finance-metric-expense strong')).toHaveText('₹200');
  expect((await readGuest(page, 'dn_guest_expenses')).map(({ name }) => name)).toEqual(expect.arrayContaining(['Internet', 'Mobile']));
  expect(errors).toEqual([]);
});

test('backup review restores both schedules into Guest and skips an already recorded payment', async ({ page, browser, baseURL }) => {
  const dueDate = '2026-12-31';
  const repeat = { frequency: 'monthly', anchorDate: dueDate };
  const task = { id: 'repeat-meter', title: 'Read the meter', status: 'in-progress', dueDate, repeat: { ...repeat, seriesId: 'meter' } };
  const plan = { id: 'internet', name: 'Home internet', amount: 799, category: 'Home', dueDate, repeat,
    paymentMethod: 'Online', updatedAt: '2026-11-14T12:00:00.000Z' };
  const paid = { id: 'plan-payment-internet-2026-12-31', name: 'Home internet', amount: 825, category: 'Home',
    date: '2026-12-31', paymentMethod: 'Online' };
  await seedGuest(page, { ...empty, expenses: [paid] });
  await page.goto('/settings/data-backup');
  await page.evaluate(({ task, plan }) => {
    localStorage.setItem('dn_guest_tasks', JSON.stringify([task]));
    localStorage.setItem('dn_guest_expense_plans', JSON.stringify([plan]));
  }, { task, plan });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const file = await (await pending).path();
  const backup = JSON.parse(await readFile(file, 'utf8'));
  expect(backup.backupVersion).toBe(5);
  expect(backup.expensePlans.map((item) => item.id)).toEqual([plan.id]);
  expect(backup.expenses.map((item) => item.id)).toEqual([paid.id]);

  const context = await browser.newContext({ baseURL });
  try {
    const destination = await context.newPage();
    await seedGuest(destination, empty);
    await destination.goto('/settings/data-backup');
    for (let attempt = 0; attempt < 2; attempt++) {
      await destination.getByLabel('Choose a DN backup JSON file').setInputFiles(file);
      const review = destination.getByRole('dialog', { name: 'Review backup restore' });
      await expect(review).toContainText('1 expense plan');
      await Promise.all([destination.waitForEvent('load'), review.getByRole('button', { name: 'Confirm restore' }).click()]);
      expect(await readGuest(destination, 'dn_guest_expense_plans')).toMatchObject([{ id: plan.id, dueDate: '2027-01-31' }]);
      expect(await readGuest(destination, 'dn_guest_tasks')).toMatchObject([{ id: task.id, repeat: task.repeat }]);
      expect((await readGuest(destination, 'dn_guest_expenses')).map((item) => item.id)).toEqual([paid.id]);
    }
  } finally { await context.close(); }
});
