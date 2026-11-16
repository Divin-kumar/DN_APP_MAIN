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
    await expect(create).toBeHidden();
    const original = await tasks();
    const baseline = await records();
    await page.locator('.dn-independent-task-row').filter({ hasText: 'Keep travel originals' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Task' });
    const options = editor.locator('.dn-form-disclosure');
    await options.locator('summary').click();
    const notes = editor.getByLabel('Notes (optional)');
    await notes.fill('Unsaved draft stays here');
    const actions = editor.getByRole('group', { name: 'Task actions' });
    await actions.scrollIntoViewIfNeeded();
    for (const button of await actions.getByRole('button').all()) {
      expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect(await editor.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await testInfo.attach(`task-editor-actions-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    const deleteAction = editor.getByRole('button', { name: 'Delete Task…', exact: true });
    await deleteAction.scrollIntoViewIfNeeded();
    const scrollTop = () => editor.locator('.dn-modal-body').evaluate((body) => body.scrollTop);
    const beforeConfirmation = await scrollTop();
    await deleteAction.click();
    await expect(editor.getByRole('heading', { name: 'Delete Task?' })).toBeFocused();
    await expect(notes).toBeHidden();
    expect(await scrollTop()).toBe(0);
    expect(await tasks()).toEqual(original);
    await editor.getByRole('button', { name: 'Keep editing' }).click();
    await expect(deleteAction).toBeFocused();
    await expect(options).toHaveAttribute('open', '');
    expect(await scrollTop()).toBeCloseTo(beforeConfirmation, 0);
    await expect(notes).toBeVisible();
    await expect(notes).toHaveValue('Unsaved draft stays here');
    await editor.getByRole('button', { name: 'Cancel Task…', exact: true }).click();
    await expect(editor.getByText('Unsaved edits will not be saved.')).toBeVisible();
    await testInfo.attach(`task-action-confirm-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await editor.getByRole('button', { name: 'Cancel Task', exact: true }).click();
    await expect(editor).toBeHidden();
    expect((await tasks())[0]).toMatchObject({ status: 'cancelled', notes: '', momentId: 'moment-one', activityId: 'shared' });
    await page.locator('.dn-independent-task-row').filter({ hasText: 'Keep travel originals' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await editor.getByRole('button', { name: 'Restore Task…', exact: true }).click();
    await editor.getByRole('button', { name: 'Restore Task', exact: true }).click();
    await expect(editor).toBeHidden();
    expect((await tasks())[0].status).toBe('in-progress');
    await page.locator('.dn-independent-task-row').filter({ hasText: 'Keep travel originals' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await editor.getByRole('button', { name: 'Delete Task…', exact: true }).click();
    await editor.getByRole('button', { name: 'Delete Task', exact: true }).click();
    await expect(editor).toBeHidden();
    expect(await tasks()).toEqual([]);
    expect(await records()).toEqual(baseline);
    expect(errors).toEqual([]);
  });
}

test('Task Moment and Activity pickers open to choices with search on demand', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const moments = Array.from({ length: 12 }, (_, index) => ({
    id: `moment-${index}`, name: `Travel plan ${index}`,
    activities: Array.from({ length: 12 }, (_, activity) => ({
      id: `activity-${activity}`, title: `Travel activity ${activity}`,
    })),
  }));
  const errors = await seedGuest(page, { moments });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Task' });
  await dialog.getByLabel('Task title').fill('Pack for the trip');
  await dialog.locator('.dn-form-disclosure > summary').click();
  const moment = dialog.getByRole('combobox', { name: 'Moment (optional)', exact: true });
  const activity = dialog.getByRole('combobox', { name: 'Activity (optional)', exact: true });
  await expect(activity).toBeDisabled();
  for (const [picker, label, query] of [[moment, 'Search linked moments', 'Travel plan 11'], [activity, 'Search linked activities', 'Travel activity 10']]) {
    await picker.click();
    await expect(picker).toBeFocused();
    await expect(page.getByRole('listbox')).toBeVisible();
    const search = page.getByRole('searchbox', { name: label });
    await expect(search).toHaveCount(0);
    await page.getByRole('button', { name: label }).click();
    await expect(search).toBeFocused();
    await search.fill(query);
    await page.getByRole('option', { name: query, exact: true }).click();
    await expect(picker).toBeFocused();
    await expect(picker).toContainText(query);
  }
  await dialog.getByRole('button', { name: 'Create Task' }).click();
  await expect(dialog).toBeHidden();
  const tasks = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')));
  expect(tasks[0]).toMatchObject({ title: 'Pack for the trip', momentId: 'moment-11', activityId: 'activity-10' });
  expect(errors).toEqual([]);
});
