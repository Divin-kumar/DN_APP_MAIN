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
const schedule = (dialog) => dialog.locator('.dn-repeat-disclosure > summary');

test.describe('Recurring sheets on short phone screens', () => {
  test.use({ isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });

  test('long Task titles keep the scheduled date clear of the confirmation buttons', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    const errors = await seedGuest(page, empty);
    const title = 'Review the household maintenance and payment schedule '.repeat(9).trim();
    await page.addInitScript((taskTitle) => {
      localStorage.setItem('dn_guest_tasks', JSON.stringify([{ id: 'long-repeat', title: taskTitle,
        status: 'in-progress', dueDate: '2026-11-14', dueTime: '18:30',
        repeat: { frequency: 'monthly', anchorDate: '2026-11-14', seriesId: 'long-repeat' } }]));
    }, title);
    await page.goto('/tasks');
    await page.locator('[data-task-id="long-repeat"]').tap();
    await page.getByRole('menuitem', { name: 'Pause repeat', exact: true }).tap();
    const pause = page.getByRole('dialog', { name: 'Pause repeat?' });
    const date = pause.locator('time');
    const cancel = pause.getByRole('button', { name: 'Cancel', exact: true });
    await expect(pause.getByText(title, { exact: true })).toBeVisible();
    await expect(date).toHaveAttribute('datetime', '2026-11-14T18:30');
    await expect(date).toBeInViewport({ ratio: 1 });
    await expect.poll(() => date.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      return element.contains(hit);
    })).toBe(true);
    expect((await date.boundingBox()).y).toBeLessThan((await cancel.boundingBox()).y);
    const before = await readGuest(page, 'dn_guest_tasks');
    await cancel.tap();
    await expect(pause).toBeHidden();
    expect(await readGuest(page, 'dn_guest_tasks')).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('landscape payment options scroll above a separate Save footer', async ({ page }) => {
    await page.setViewportSize({ width: 932, height: 430 });
    const errors = await seedGuest(page, empty);
    await page.addInitScript(() => {
      localStorage.setItem('dn_guest_expense_plans', JSON.stringify([{ id: 'home-internet', name: 'Home internet',
        amount: 799, category: 'Home', dueDate: '2026-11-14', paymentMethod: 'Online', updatedAt: '2026-11-13T12:00:00Z',
        repeat: { frequency: 'monthly', anchorDate: '2026-11-14' } }]));
    });
    await page.goto('/financials/transactions#expense-plans');
    const plans = page.getByRole('dialog', { name: 'Upcoming expenses' });
    await plans.getByRole('button', { name: 'Record payment for Home internet' }).tap();
    const payment = page.getByRole('dialog', { name: 'Record payment' });
    const save = payment.getByRole('button', { name: 'Save payment' });
    await expect(save).toBeInViewport({ ratio: 1 });
    await expect(more(payment)).toBeInViewport({ ratio: 1 });
    await expect.poll(() => save.evaluate((button) => {
      const body = button.closest('[role="dialog"]').querySelector('.dn-modal-body');
      return button.form === body.querySelector('form') && !body.contains(button)
        && body.getBoundingClientRect().bottom <= button.getBoundingClientRect().top;
    })).toBe(true);
    await more(payment).tap();
    await expect(payment.getByLabel('Payment time', { exact: true })).toBeVisible();
    await expect(save).toBeInViewport({ ratio: 1 });
    await payment.getByLabel('Amount paid *', { exact: true }).fill('0');
    await save.tap();
    await expect(payment).toBeVisible();
    expect(await readGuest(page, 'dn_guest_expenses')).toEqual([]);
    await payment.getByLabel('Amount paid *', { exact: true }).fill('825');
    await save.tap();
    await expect(plans.getByRole('status')).toContainText('Payment recorded. Next due 14 Dec 2026.');
    expect((await readGuest(page, 'dn_guest_expenses')).map(({ amount }) => amount)).toEqual([825]);
    expect(errors).toEqual([]);
  });
});

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
  await expect(schedule(draft)).toContainText('Once');
  await schedule(draft).click();
  await expect(repeat(draft, 'Once')).toBeChecked();
  await repeat(draft, 'Monthly').check();
  await expect(draft.getByLabel('Notes (optional)')).toBeHidden();
  await expect(draft.getByRole('status')).toContainText('28 Feb 2026');
  await draft.getByLabel('Due date', { exact: true }).fill('');
  const createTask = draft.getByRole('button', { name: 'Create Task' });
  await expect(draft.getByRole('status')).toHaveText('Choose a due date to repeat.');
  await expect(createTask).toBeDisabled();
  await schedule(draft).click();
  await expect(schedule(draft).getByText('Choose a due date to repeat.')).toBeVisible();
  await draft.getByLabel('Due date', { exact: true }).fill('2026-01-31');
  await draft.getByLabel('Task time', { exact: true }).fill('18:30');
  await expect(schedule(draft).locator('time')).toHaveAttribute('datetime', '2026-02-28');
  await expect(schedule(draft).locator('time')).toBeVisible();
  await createTask.click();
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
  const viewNext = page.getByRole('button', { name: 'View next', exact: true });
  await expect(page.locator('.app-toast')).toContainText('Next due 28 Feb 2026 · 18:30.');
  await viewNext.click();
  await expect(recurring).toBeFocused();
  await expect(recurring).toHaveClass(/is-dashboard-selected/);
  await expect(recurring).toHaveAccessibleDescription(/Next occurrence, 28 Feb 2026 · 18:30/);
  await expect(page.getByText('Next occurrence ·', { exact: false }).filter({ hasText: '28 Feb 2026' })).toBeVisible();
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Skip this occurrence', exact: true }).click();
  const skip = page.getByRole('dialog', { name: 'Skip this Task?' });
  await expect(skip.getByText('Read the meter', { exact: true })).toBeVisible();
  await expect(skip.locator('dl > div').filter({ hasText: 'Scheduled for' }).locator('time')).toHaveAttribute('datetime', '2026-02-28T18:30');
  await expect(skip.locator('dl > div').filter({ hasText: 'Next due' }).locator('time')).toHaveAttribute('datetime', '2026-03-31T18:30');
  await expect(skip.getByText('This occurrence goes into Task history as cancelled.')).toBeVisible();
  const tasksBeforeSkip = await readGuest(page, 'dn_guest_tasks');
  await skip.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(2);
  expect(await readGuest(page, 'dn_guest_tasks')).toEqual(tasksBeforeSkip);
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Skip this occurrence', exact: true }).click();
  await skip.getByRole('button', { name: 'Skip occurrence', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(3);
  expect((await readGuest(page, 'dn_guest_tasks')).map((task) => [task.dueDate, task.status])).toEqual([
    ['2026-01-31', 'completed'], ['2026-02-28', 'cancelled'], ['2026-03-31', 'in-progress'],
  ]);
  await expect(page.locator('.app-toast')).toContainText('Next due 31 Mar 2026 · 18:30.');
  await viewNext.click();
  await expect(recurring).toBeFocused();
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Pause repeat', exact: true }).click();
  const pause = page.getByRole('dialog', { name: 'Pause repeat?' });
  await expect(pause.locator('time')).toHaveAttribute('datetime', '2026-03-31T18:30');
  await expect(pause).toContainText('Resume repeat brings back this due date.');
  const beforePause = await readGuest(page, 'dn_guest_tasks');
  await pause.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await readGuest(page, 'dn_guest_tasks')).toEqual(beforePause);
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Pause repeat', exact: true }).click();
  await pause.getByRole('button', { name: 'Pause repeat', exact: true }).click();
  const paused = list.locator('article').filter({ hasText: 'Repeat paused' });
  await expect(paused).toHaveCount(1);
  await expect(page.locator('.app-toast')).toContainText('Repeat paused.');
  await expect(list.locator('article')).toHaveCount(3);
  expect((await readGuest(page, 'dn_guest_tasks')).at(-1)).toMatchObject({ status: 'cancelled', dueDate: '2026-03-31', dueTime: '18:30' });
  await paused.click();
  await expect(page.getByRole('menuitem', { name: 'Resume repeat', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const pausedEditor = page.getByRole('dialog', { name: 'Edit Task' });
  await expect(schedule(pausedEditor)).toContainText('Monthly · Paused');
  await expect(schedule(pausedEditor).locator('time')).toHaveCount(0);
  await pausedEditor.getByRole('button', { name: 'Resume repeat…', exact: true }).click();
  await expect(pausedEditor.getByRole('heading', { name: 'Resume repeat?' })).toBeFocused();
  await expect(pausedEditor.locator('time')).toHaveAttribute('datetime', '2026-03-31T18:30');
  await pausedEditor.getByRole('button', { name: 'Resume repeat', exact: true }).click();
  await expect(recurring).toHaveCount(1);
  await expect(page.locator('.app-toast')).toContainText('Repeat resumed. Due 31 Mar 2026 · 18:30.');
  expect((await readGuest(page, 'dn_guest_tasks')).at(-1)).toMatchObject({ status: 'in-progress', dueDate: '2026-03-31', dueTime: '18:30' });
  await recurring.click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Task' });
  const taskFutureNotice = 'Future repeats start from this due date.';
  await expect(edit.getByText(taskFutureNotice)).toHaveCount(0);
  await edit.getByLabel('Due date', { exact: true }).fill('2026-04-30');
  await expect(schedule(edit).locator('time')).toHaveAttribute('datetime', '2026-05-30');
  await expect(schedule(edit).getByText(taskFutureNotice)).toBeVisible();
  await edit.getByLabel('Due date', { exact: true }).fill('2026-03-31');
  await expect(edit.getByText(taskFutureNotice)).toHaveCount(0);
  await schedule(edit).click();
  await repeat(edit, 'Once').check();
  await expect(edit.getByRole('status')).toHaveText('Saving ends this repeat.');
  await schedule(edit).click();
  await expect(schedule(edit).getByText('Saving ends this repeat.')).toBeVisible();
  await edit.getByRole('button', { name: 'Save Task', exact: true }).click();
  await expect(recurring).toHaveCount(0);
  await page.reload();
  await expect(list.locator('article')).toHaveCount(3);
  expect((await readGuest(page, 'dn_guest_tasks')).every((task) => !task.repeat)).toBe(true);
  expect(await readGuest(page, 'dn_guest_expenses')).toEqual([]);
  expect(errors).toEqual([]);
});

test('View next highlights a just-created Task outside the current filters without changing them', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-14T12:00:00.000Z'));
  const errors = await seedGuest(page, empty);
  await page.addInitScript(() => {
    localStorage.setItem('dn_guest_tasks', JSON.stringify([{ id: 'weekly-meter', title: 'Read the meter', status: 'in-progress',
      dueDate: '2026-11-12', repeat: { frequency: 'weekly', anchorDate: '2026-11-12', seriesId: 'meter' } }]));
  });
  await page.goto('/tasks');
  await page.getByRole('button', { name: 'Refine', exact: true }).click();
  const refine = page.getByRole('dialog', { name: 'Refine Tasks' });
  await refine.getByRole('button', { name: 'Add filter', exact: true }).click();
  await choose(page, refine, 'Filter by', 'Due timing');
  await choose(page, refine, 'Value for Due timing', 'Overdue');
  await refine.getByRole('button', { name: 'Show results' }).click();
  const list = page.locator('.dn-task-list');
  await list.locator('article').click();
  await page.getByRole('menuitem', { name: 'Done', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(0);
  await page.getByRole('button', { name: 'View next', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(1);
  await expect(list.locator('article')).toBeFocused();
  await expect(list.locator('article').getByRole('img', { name: '19 Nov 2026', exact: true })).toBeVisible();
  await expect(page.getByText('Selected Task is shown outside your current filters.')).toBeVisible();
  await expect(list.locator('article')).toHaveAccessibleDescription(/Next occurrence, 19 Nov 2026\./);
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(list.locator('article')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('Task due labels in Asia/Kolkata', () => {
  test.use({ timezoneId: 'Asia/Kolkata' });

  test('repeating Tasks show today, overdue and paused states and refresh at the local day boundary', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.clock.setFixedTime(new Date('2026-11-14T18:29:00.000Z'));
    const errors = await seedGuest(page, { ...empty, theme: 'dark' });
    await page.addInitScript(() => {
      const task = (id, title, dueDate, status = 'in-progress') => ({ id, title, dueDate, status,
        repeat: { frequency: 'weekly', anchorDate: dueDate, seriesId: id } });
      localStorage.setItem('dn_guest_tasks', JSON.stringify([
        task('meter', 'Read the electricity meter', '2026-11-14'),
        task('water', 'Check the water filter', '2026-11-13'),
        task('paused', 'Pick up a prescription', '2026-11-13', 'cancelled'),
      ]));
    });
    await page.goto('/tasks');
    const row = (id) => page.locator(`[data-task-id="${id}"]`);
    await expect(row('meter')).toContainText('Due today');
    await expect(row('meter')).toHaveAccessibleDescription(/Due today.*14 Nov 2026.*Repeats weekly/);
    await expect(row('water').getByText('Overdue', { exact: true })).toBeVisible();
    await expect(row('paused')).toContainText('Repeat paused');
    await expect(row('paused').getByText('Overdue', { exact: true })).toHaveCount(0);
    const stored = await readGuest(page, 'dn_guest_tasks');
    await page.clock.setFixedTime(new Date('2026-11-14T18:31:00.000Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(row('meter').getByText('Overdue', { exact: true })).toBeVisible();
    await expect(row('meter')).toHaveAccessibleDescription(/Overdue.*14 Nov 2026.*Repeats weekly/);
    expect(await readGuest(page, 'dn_guest_tasks')).toEqual(stored);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
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
  await expect(draft.getByLabel('Date *', { exact: true })).toBeVisible();
  await schedule(draft).click();
  await repeat(draft, 'Monthly').check();
  const dueDate = draft.getByLabel('Due date *', { exact: true });
  const savePlan = draft.getByRole('button', { name: 'Save expense plan', exact: true });
  await dueDate.fill('9999-12-31');
  await expect(savePlan).toBeDisabled();
  await expect(draft.getByRole('status')).toHaveText('Choose a date with room for another occurrence.');
  await dueDate.fill('2026-01-31');
  await expect(draft.getByRole('status')).toContainText('28 Feb 2026');
  await schedule(draft).click();
  await expect(dueDate).toHaveValue('2026-01-31');
  await expect(schedule(draft).getByText('28 Feb 2026', { exact: true })).toBeVisible();
  await savePlan.click();
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
  await expect(recordPayment).toHaveAccessibleDescription(/₹799 Overdue.*31 Jan 2026.*Monthly/);
  await recordPayment.getByText('Record', { exact: true }).click();
  const payment = page.getByRole('dialog', { name: 'Record payment', exact: true });
  await expect(payment.getByRole('heading', { name: 'Record payment' })).toBeFocused();
  expect(await sheet.getAttribute('aria-labelledby')).toBe(await payment.getByRole('heading').getAttribute('id'));
  await page.keyboard.press('Shift+Tab');
  await expect(payment.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await payment.getByRole('heading', { name: 'Record payment' }).focus();
  await page.keyboard.press('Tab');
  await expect(payment.getByRole('button', { name: 'Back to upcoming expenses' })).toBeFocused();
  await payment.getByRole('button', { name: 'Back to upcoming expenses' }).click();
  await expect(plans).toContainText('31 Jan 2026');
  expect(await readGuest(page, 'dn_guest_expenses')).toEqual([]);
  await recordPayment.click();
  await expect(payment.getByRole('combobox', { name: 'Transaction Type', exact: true })).toHaveCount(0);
  await expect(payment.getByLabel('Paid on *', { exact: true })).toBeVisible();
  await expect(payment.locator('time')).toHaveText(['31 Jan 2026', '28 Feb 2026']);
  await expect(payment.getByLabel('Title', { exact: true })).toBeHidden();
  await expect(payment.getByLabel('Amount paid *', { exact: true })).toHaveValue('799');
  await payment.getByLabel('Amount paid *', { exact: true }).fill('825');
  await payment.getByLabel('Paid on *', { exact: true }).fill('2026-02-03');
  await payment.getByRole('radio', { name: 'Online' }).check();
  await more(payment).click();
  await payment.getByLabel('Title', { exact: true }).fill('Internet receipt');
  await payment.getByLabel('Payment time', { exact: true }).fill('19:45');
  await choose(page, payment, 'Linked Moment', 'Home plans');
  await choose(page, payment, 'Linked Activity', 'Internet connection');
  await payment.getByRole('button', { name: 'Save payment' }).click();
  await expect(payment).toHaveCount(0);
  await expect(total).toHaveText('₹825');
  expect((await readGuest(page, 'dn_guest_eventGroups'))[0].activities[0].expenses[0].amount).toBe(825);
  await expect(plans.getByRole('status')).toHaveText('Payment recorded. Next due 28 Feb 2026.');
  await expect(plans.getByRole('listitem')).toContainText('28 Feb 2026');
  const viewPayment = plans.getByRole('button', { name: 'View payment', exact: true });
  await viewPayment.click();
  const receipt = page.getByRole('dialog', { name: 'Payment details', exact: true });
  await expect(receipt.getByRole('heading', { name: 'Payment details' })).toBeFocused();
  await expect(receipt).toContainText('Internet receipt');
  await expect(receipt).toContainText('Home internet');
  await expect(receipt).toContainText('₹825');
  await expect(receipt).toContainText('3 Feb 2026 · 19:45');
  await expect(receipt).toContainText('Online');
  await expect(receipt).toContainText('31 Jan 2026');
  await expect(receipt).toContainText('28 Feb 2026');
  await receipt.getByRole('button', { name: 'Back to upcoming expenses' }).click();
  await expect(viewPayment).toBeFocused();
  expect(await readGuest(page, 'dn_guest_expenses')).toHaveLength(1);
  const manage = plans.getByRole('button', { name: 'Manage plan for Home internet' });
  await manage.click();
  const planActions = page.getByRole('dialog', { name: 'Manage expense plan' });
  const editSchedule = planActions.getByRole('button', { name: 'Edit schedule', exact: true });
  const skipOccurrence = planActions.getByRole('button', { name: /Skip this occurrence/ });
  const endRepeat = planActions.getByRole('button', { name: 'End repeat', exact: true });
  await editSchedule.click();
  const edit = page.getByRole('dialog', { name: 'Edit expense plan' });
  await expect(edit.getByLabel('Expected amount *', { exact: true })).toHaveValue('799');
  const expenseDueDate = edit.getByLabel('Due date *', { exact: true });
  const expensePreview = edit.getByRole('group', { name: 'Repeat', exact: true }).getByRole('status');
  await expect(expenseDueDate).toHaveValue('2026-02-28');
  await expect(schedule(edit)).toContainText('Monthly · Next 31 Mar 2026');
  await schedule(edit).click();
  await expect(expensePreview).toHaveText('Next repeat 31 Mar 2026');
  await repeat(edit, 'Weekly').check();
  await expect(expensePreview.locator('time')).toHaveAttribute('datetime', '2026-03-07');
  await expect(expensePreview).toContainText('Future repeats start from this due date.');
  await repeat(edit, 'Monthly').check();
  await expect(expensePreview).toHaveText('Next repeat 31 Mar 2026');
  await expenseDueDate.fill('2026-03-15');
  await expect(expensePreview.locator('time')).toHaveAttribute('datetime', '2026-04-15');
  await expect(expensePreview).toContainText('Future repeats start from this due date.');
  await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(editSchedule).toBeFocused();
  await skipOccurrence.click();
  const skip = page.getByRole('dialog', { name: 'Skip this expense?' });
  await expect(skip.getByText('Home internet', { exact: true })).toBeVisible();
  await expect(skip.locator('dl > div').filter({ hasText: 'Scheduled for' }).locator('time')).toHaveAttribute('datetime', '2026-02-28');
  await expect(skip.locator('dl > div').filter({ hasText: 'Next due' }).locator('time')).toHaveAttribute('datetime', '2026-03-31');
  await expect(skip.getByText('Spending totals reflect recorded payments.')).toBeVisible();
  const plansBeforeSkip = await readGuest(page, 'dn_guest_expense_plans');
  await skip.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(skipOccurrence).toBeFocused();
  expect(await readGuest(page, 'dn_guest_expense_plans')).toEqual(plansBeforeSkip);
  await skipOccurrence.click();
  await skip.getByRole('button', { name: 'Skip occurrence', exact: true }).click();
  await expect(plans.getByRole('status')).toHaveText('Occurrence skipped. Next due 31 Mar 2026.');
  await expect(plans.getByRole('listitem')).toContainText('31 Mar 2026');
  await manage.click();
  await editSchedule.click();
  await edit.getByLabel('Expected amount *', { exact: true }).fill('850');
  await edit.getByRole('button', { name: 'Save expense plan', exact: true }).click();
  await expect(plans.getByRole('status')).toHaveText('Expense plan saved.');
  await expect(plans.getByRole('listitem')).toContainText('₹850');
  await manage.click();
  await endRepeat.click();
  const end = page.getByRole('dialog', { name: 'End this expense plan?' });
  await expect(end.getByText('Home internet', { exact: true })).toBeVisible();
  await expect(end.locator('dl > div').filter({ hasText: 'Upcoming bill' }).locator('time')).toHaveAttribute('datetime', '2026-03-31');
  await expect(end).toContainText('Recorded payments stay in Transactions.');
  const plansBeforeEnd = await readGuest(page, 'dn_guest_expense_plans');
  await end.getByRole('button', { name: 'Back to manage expense plan' }).click();
  await expect(endRepeat).toBeFocused();
  expect(await readGuest(page, 'dn_guest_expense_plans')).toEqual(plansBeforeEnd);
  await endRepeat.click();
  await end.getByRole('button', { name: 'End repeat', exact: true }).click();
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
  const dueToday = plans.getByRole('region', { name: 'Due today' });
  const overdue = plans.getByRole('region', { name: 'Overdue' });
  const later = plans.getByRole('region', { name: 'Later' });
  await expect(plans.getByRole('region').first()).toHaveAccessibleName('Due today');
  await expect(dueToday.getByRole('listitem')).toContainText('Mobile');
  await expect(dueToday.getByRole('heading')).toHaveText('Due today1 bill');
  await expect(overdue.getByRole('listitem')).toContainText('Internet');
  await expect(later.getByRole('listitem')).toContainText('Insurance');
  await plans.getByRole('button', { name: 'Close dialog' }).click();
  const trigger = page.getByRole('button', { name: /Upcoming expenses/ });
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('1 due today · 1 overdue');
  await expect(plans).toBeHidden();
  await trigger.click();
  for (const title of ['Mobile', 'Internet']) {
    await plans.getByRole('button', { name: `Record payment for ${title}` }).click();
    const payment = page.getByRole('dialog', { name: 'Record payment', exact: true });
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await payment.getByRole('button', { name: 'Save payment' }).click();
    await expect(plans.getByRole('status')).toContainText('Payment recorded.');
    await expect(later.getByRole('button', { name: `Record payment for ${title}` })).toBeVisible();
  }
  await expect(dueToday).toBeHidden();
  await expect(overdue).toBeHidden();
  await expect(later.getByRole('listitem')).toHaveCount(3);
  await expect(later.getByRole('heading')).toContainText('3 bills');
  await expect(trigger).toContainText('Next 12 Dec 2026');
  await expect(page.locator('.dn-finance-metric-expense strong')).toHaveText('₹200');
  expect((await readGuest(page, 'dn_guest_expenses')).map(({ name }) => name)).toEqual(expect.arrayContaining(['Internet', 'Mobile']));
  expect(errors).toEqual([]);
});

test('returning to a long expense list keeps the scroll position and shows payment feedback', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 680 });
  await page.clock.setFixedTime(new Date('2026-11-14T12:00:00.000Z'));
  const errors = await seedGuest(page, { ...empty, theme: 'dark' });
  await page.addInitScript(() => {
    localStorage.setItem('dn_guest_expense_plans', JSON.stringify(Array.from({ length: 18 }, (_, index) => {
      const number = index + 1;
      const dueDate = `2026-10-${String(number).padStart(2, '0')}`;
      return { id: `bill-${number}`, name: `Bill ${number}`, amount: 100, category: 'Home', dueDate,
        repeat: { frequency: 'monthly', anchorDate: dueDate }, paymentMethod: 'Online', updatedAt: '2026-11-01T12:00:00.000Z' };
    })));
  });
  await page.goto('/financials/transactions#expense-plans');
  const plans = page.getByRole('dialog', { name: 'Upcoming expenses', exact: true });
  const body = plans.locator('.dn-modal-body');
  const recordPayment = plans.getByRole('button', { name: 'Record payment for Bill 12', exact: true });
  const manage = plans.getByRole('button', { name: 'Manage plan for Bill 12', exact: true });
  await expect(manage).toBeVisible();
  // Sample the offset when the action fires, after browser actionability scrolling.
  const openedAt = await body.evaluateHandle((element) => {
    const offsets = [];
    element.addEventListener('click', (event) => {
      if (event.target.closest('[data-plan-action]')) offsets.push(element.scrollTop);
    });
    return offsets;
  });
  await body.evaluate((element) => {
    const button = element.querySelector('[data-plan-id="bill-12"] [data-plan-action="payment"]');
    element.scrollTop += button.getBoundingClientRect().top - element.getBoundingClientRect().top - 200;
  });
  const heading = plans.getByRole('region', { name: 'Overdue' }).getByRole('heading');
  await expect(heading).toBeInViewport({ ratio: 1 });
  await expect.poll(() => heading.evaluate((element) => {
    const scrollBody = element.closest('.dn-modal-body');
    const bodyTop = scrollBody.getBoundingClientRect().top + scrollBody.clientTop + parseFloat(getComputedStyle(scrollBody).paddingTop);
    return Math.abs(element.getBoundingClientRect().top - bodyTop);
  })).toBeLessThanOrEqual(1);
  await expect(manage).toBeInViewport({ ratio: 1 });
  await expect(recordPayment).toBeInViewport({ ratio: 1 });
  const [paymentBox, manageBox] = await recordPayment.evaluate((button) => {
    const sibling = button.closest('[data-plan-id]').querySelector('[data-plan-action="manage"]');
    return [button.getBoundingClientRect().toJSON(), sibling.getBoundingClientRect().toJSON()];
  });
  expect(paymentBox.y + paymentBox.height / 2).toBeCloseTo(manageBox.y + manageBox.height / 2, 0);
  expect(paymentBox.height).toBeGreaterThanOrEqual(44);
  expect(manageBox.height).toBeGreaterThanOrEqual(44);
  await manage.click();
  const beforeManage = await openedAt.evaluate((offsets) => offsets[0]);
  expect(beforeManage).toBeGreaterThan(300);
  const manageView = page.getByRole('dialog', { name: 'Manage expense plan', exact: true });
  await manageView.getByRole('button', { name: 'Back to upcoming expenses' }).click();
  await expect(manage).toBeFocused();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(beforeManage);
  await recordPayment.click();
  const beforePayment = await openedAt.evaluate((offsets) => offsets[1]);
  const payment = page.getByRole('dialog', { name: 'Record payment', exact: true });
  const back = payment.getByRole('button', { name: 'Back to upcoming expenses' });
  expect((await back.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await back.click();
  await expect(recordPayment).toBeFocused();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(beforePayment);
  await recordPayment.click();
  const beforeSave = await openedAt.evaluate((offsets) => offsets[2]);
  await payment.getByRole('button', { name: 'Save payment' }).click();
  const feedback = plans.getByRole('status');
  await expect(feedback).toHaveText('Payment recorded. Next due 12 Nov 2026.');
  await expect(feedback).toBeInViewport({ ratio: 1 });
  expect(await body.evaluate((element) => element.scrollTop)).toBe(beforeSave);
  const viewPayment = plans.getByRole('button', { name: 'View payment' });
  await expect(viewPayment).toBeInViewport({ ratio: 1 });
  await viewPayment.click();
  await page.getByRole('dialog', { name: 'Payment details' }).getByRole('button', { name: 'Back to upcoming expenses' }).click();
  await expect(viewPayment).toBeFocused();
  expect(await body.evaluate((element) => element.scrollTop)).toBe(beforeSave);
  await recordPayment.click();
  await payment.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(recordPayment).toBeFocused();
  await expect(viewPayment).toBeVisible();
  await expect(feedback).toHaveText('Payment recorded. Next due 12 Nov 2026.');
  await viewPayment.click();
  await expect(page.getByRole('dialog', { name: 'Payment details' })).toContainText('Bill 12');
  await page.getByRole('dialog', { name: 'Payment details' }).getByRole('button', { name: 'Back to upcoming expenses' }).click();
  await expect(plans.getByRole('region', { name: 'Overdue' }).getByRole('listitem').last()).toContainText('Bill 12');
  expect((await readGuest(page, 'dn_guest_expenses')).map(({ name }) => name)).toEqual(['Bill 12']);
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
