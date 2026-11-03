import { test, expect } from '@playwright/test';
import { seedGuest, accountScope } from './fixtures.js';

for (const width of [320, 390, 1280]) {
  test(`independent Guest Tasks create, filter, edit and complete without altering Activities at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 780 : 900 });
    const errors = await seedGuest(page);
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
    const source = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_expenses'), localStorage.getItem('dn_guest_incomes'),
    ]);
    await page.getByRole('button', { name: 'New Task' }).click();
    const editor = page.getByRole('dialog', { name: 'New Task' });
    await editor.getByLabel('Task title').fill('Remember the travel documents');
    await editor.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByText('Remember the travel documents', { exact: true })).toBeVisible();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: 'Remember the travel documents', momentId: '', activityId: '', dueDate: '', dueTime: '' });

    await page.getByRole('button', { name: 'Refine', exact: true }).click();
    const refine = page.getByRole('dialog', { name: 'Refine Tasks' });
    await refine.getByRole('group', { name: 'Status filter' }).getByRole('button', { name: 'Completed' }).click();
    await expect(refine.getByRole('status')).toContainText('0 matching Tasks');
    await expect(page.getByText('Remember the travel documents', { exact: true })).toBeVisible();
    await refine.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('Remember the travel documents', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Complete Remember the travel documents' }).click();
    await expect(page.getByRole('button', { name: 'Reopen Remember the travel documents' })).toBeVisible();
    await page.getByRole('button', { name: 'Edit Remember the travel documents' }).click();
    await page.getByRole('dialog', { name: 'Edit Task' }).getByLabel('Notes (optional)').fill('Keep the originals');
    await page.getByRole('dialog', { name: 'Edit Task' }).getByRole('button', { name: 'Save Task' }).click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')));
    expect(saved[0].status).toBe('completed');
    expect(saved[0].notes).toBe('Keep the originals');

    await page.getByRole('button', { name: 'Refine', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Refine Tasks' });
    await sheet.getByRole('group', { name: 'Status filter' }).getByRole('button', { name: 'Completed' }).click();
    await sheet.getByRole('button', { name: 'Show results' }).click();
    await expect(page.getByText('Remember the travel documents', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_expenses'), localStorage.getItem('dn_guest_incomes'),
    ])).toEqual(source);
    const dimensions = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    expect(dimensions.actual).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(errors).toEqual([]);
  });
}

test('universal + Task under Activity Detail keeps parent links but never creates an Activity', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('.activity-detail-page')).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'New Task' });
  await editor.getByLabel('Task title').fill('Call the hotel separately');
  await editor.getByRole('button', { name: 'Create Task' }).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')));
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ momentId: 'moment-one', activityId: 'shared' });
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toEqual(before);
  expect(errors).toEqual([]);
});

test('independent Guest Tasks remain private and are never exposed as account Tasks', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/tasks');
  await page.evaluate(() => localStorage.setItem('dn_guest_tasks', JSON.stringify([
    { id: 'private-task', title: 'Private', status: 'in-progress', dueDate: '', dueTime: '', momentId: '', activityId: '' },
  ])));
  const before = await page.evaluate(() => localStorage.getItem('dn_guest_tasks'));
  await accountScope(page, 'synthetic-account', []);
  await expect(page.getByText('Account Tasks aren’t available yet')).toBeVisible();
  await expect(page.getByText('Private', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_tasks'))).toEqual(before);
  expect(errors).toEqual([]);
});
