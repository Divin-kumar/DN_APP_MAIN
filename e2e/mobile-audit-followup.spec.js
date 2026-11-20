import { expect, test } from '@playwright/test';
import { seedGuest } from './fixtures.js';

test.use({ isMobile: true, hasTouch: true, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });

for (const [width, height, theme] of [[320, 680, 'light'], [320, 680, 'dark'], [430, 932, 'light'], [430, 932, 'dark']]) {
  test(`mobile audit fixes at ${width} × ${height} in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.clock.setFixedTime(new Date('2026-11-20T11:00:00+05:30'));
    const errors = await seedGuest(page, { theme, moments: [{
      id: 'home-project', name: 'Home project', type: 'Personal', date: '2026-11-15',
      activities: [{ id: 'electrician', title: 'Book the electrician', date: '2026-11-22' }],
    }], incomes: [], expenses: [] });
    const tasks = [
      { id: 'overdue-task', title: 'Return the library book', dueDate: '2026-11-17', dueTime: '16:00', status: 'in-progress' },
      { id: 'upcoming-task', title: 'Confirm electrician visit', dueDate: '2026-11-22', dueTime: '09:30', status: 'in-progress' },
      { id: 'packing-task', title: 'Pack snacks for the weekend', dueDate: '2026-11-24', status: 'in-progress' },
    ];
    await page.addInitScript(items => localStorage.setItem('dn_guest_tasks', JSON.stringify(items)), tasks);
    const assertSheetMaterial = async (dialog) => {
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS('background-color', theme === 'dark' ? 'rgb(15, 24, 41)' : 'rgb(231, 239, 252)');
      await expect(dialog).toHaveCSS('background-image', /linear-gradient/);
    };

    await page.goto('/dashboard');
    const plus = page.getByRole('button', { name: 'Open quick create menu', exact: true });
    await page.getByRole('button', { name: 'Show Tasks on dashboard', exact: true }).tap();
    const overdue = page.getByRole('link', { name: 'Open Task Return the library book', exact: true });
    await expect(overdue.getByText('3 days overdue', { exact: true })).toHaveCSS('color',
      theme === 'dark' ? 'rgb(255, 146, 154)' : 'rgb(161, 43, 59)');

    if (width === 320) {
      await expect.poll(() => plus.evaluate((button) => {
        const content = document.querySelector('.dn-content').getBoundingClientRect();
        return button.getBoundingClientRect().top - content.bottom;
      })).toBeGreaterThanOrEqual(4);
    }
    await page.getByRole('button', { name: 'Hide Activities on dashboard', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Show Activities on dashboard', exact: true })).toBeVisible();
    await plus.tap();
    const menu = page.getByRole('dialog', { name: 'Navigate & create', exact: true });
    await assertSheetMaterial(menu);
    await menu.getByRole('button', { name: 'Task', exact: true }).tap();

    const task = page.getByRole('dialog', { name: 'New Task', exact: true });
    await assertSheetMaterial(task);
    const date = task.getByLabel('Due date', { exact: true });
    const time = task.getByLabel('Task time', { exact: true });
    const readable = task.locator('.dn-date-field-readable');
    await expect(date).toHaveValue('2026-11-20');
    await expect(date).toHaveAccessibleDescription('20 Nov 2026');
    await date.fill('2026-05-03');
    await expect(readable).toHaveText('3 May 2026');
    await expect(readable).toHaveAttribute('datetime', '2026-05-03');
    await expect(date).toHaveAccessibleDescription('3 May 2026');
    expect(Math.abs((await date.boundingBox()).y - (await time.boundingBox()).y)).toBeLessThan(2);
    await date.fill('');
    await expect(readable).toHaveCount(0);
    await expect(time).toBeDisabled();

    await task.getByRole('textbox', { name: 'Task title' }).fill('Unsaved Task');
    await task.locator('summary').filter({ hasText: 'More options' }).tap();
    await expect(task.getByRole('radio', { name: 'Monthly', exact: true })).toBeVisible();
    const create = task.getByRole('button', { name: 'Create Task', exact: true });
    const cancel = task.getByRole('button', { name: 'Cancel', exact: true });
    for (const button of [create, cancel]) {
      await expect(button).toBeInViewport({ ratio: 1 });
      await expect(button).toBeEnabled();
      expect(await button.evaluate(element => {
        const footer = element.closest('.dn-modal-form-footer');
        const body = footer?.previousElementSibling;
        const bounds = element.getBoundingClientRect();
        return body?.classList.contains('dn-modal-body')
          && body.getBoundingClientRect().bottom <= bounds.top
          && bounds.bottom <= innerHeight
          && document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.closest('button') === element;
      })).toBe(true);
    }
    await cancel.tap();
    await expect(task).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')))).toEqual(tasks);

    await page.goto('/tasks');
    await page.getByRole('button', { name: 'Refine', exact: true }).tap();
    const refine = page.getByRole('dialog', { name: 'Refine Tasks', exact: true });
    await assertSheetMaterial(refine);
    await expect(refine.getByRole('button', { name: 'Show results', exact: true })).toBeInViewport({ ratio: 1 });
    expect(errors).toEqual([]);
  });
}
