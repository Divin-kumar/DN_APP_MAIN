import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

for (const [width, height, theme] of [[320,640,'dark'],[390,844,'light'],[430,932,'dark'],[844,390,'light'],[1280,900,'light']]) {
  test(`Task editor tap actions preserve drafts and linked records ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/tasks?create=1&moment=moment-one&activity=shared');
    const create = page.getByRole('dialog', { name: 'New Task' });
    await create.getByLabel('Task title').fill('Keep travel originals');
    await expect(create.getByRole('group', { name: 'Task actions' })).toHaveCount(0);
    await create.getByRole('button', { name: 'Create Task' }).click();
    const records = () => page.evaluate(() => ['dn_guest_eventGroups','dn_guest_expenses','dn_guest_incomes'].map(k => localStorage.getItem(k)));
    const tasks = () => page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')));
    const original = await tasks();
    const baseline = await records();
    await page.getByRole('button', { name: 'Edit Keep travel originals' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Task' });
    await editor.getByLabel('Notes (optional)').fill('Unsaved draft stays here');
    const actions = editor.getByRole('group', { name: 'Task actions' });
    await actions.scrollIntoViewIfNeeded();
    for (const button of await actions.getByRole('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect(await editor.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await testInfo.attach(`task-editor-actions-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await editor.getByRole('button', { name: 'Delete Task…', exact: true }).click();
    await expect(editor.getByRole('heading', { name: 'Delete Task?' })).toBeFocused();
    expect(await tasks()).toEqual(original);
    await editor.getByRole('button', { name: 'Keep editing' }).click();
    await expect(editor.getByRole('button', { name: 'Delete Task…', exact: true })).toBeFocused();
    await expect(editor.getByLabel('Notes (optional)')).toHaveValue('Unsaved draft stays here');
    await editor.getByRole('button', { name: 'Cancel Task…', exact: true }).click();
    await expect(editor.getByText('Unsaved edits will not be saved.')).toBeVisible();
    await testInfo.attach(`task-action-confirm-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await editor.getByRole('button', { name: 'Cancel Task', exact: true }).click();
    await expect(editor).toBeHidden();
    expect((await tasks())[0]).toMatchObject({ status: 'cancelled', notes: '', momentId: 'moment-one', activityId: 'shared' });
    await page.getByRole('button', { name: 'Edit Keep travel originals' }).click();
    await editor.getByRole('button', { name: 'Restore Task…', exact: true }).click();
    await editor.getByRole('button', { name: 'Restore Task', exact: true }).click();
    await expect(editor).toBeHidden();
    expect((await tasks())[0].status).toBe('in-progress');
    await page.getByRole('button', { name: 'Edit Keep travel originals' }).click();
    await editor.getByRole('button', { name: 'Delete Task…', exact: true }).click();
    await editor.getByRole('button', { name: 'Delete Task', exact: true }).click();
    await expect(editor).toBeHidden();
    expect(await tasks()).toEqual([]);
    expect(await records()).toEqual(baseline);
    expect(errors).toEqual([]);
  });
}
