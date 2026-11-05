import { test, expect } from '@playwright/test';
import { seedGuest, accountScope } from './fixtures.js';

async function choose(page, name, value) {
  await page.getByRole('combobox', { name, exact: true }).last().click();
  const search = page.locator('.dropdown-menu-portal input[type="search"]');
  if (await search.count()) await search.fill(value);
  await page.getByRole('option', { name: value, exact: true }).click();
}
async function addStatusRule(page, sheet, value) {
  await sheet.getByRole('button', { name: 'Add filter', exact: true }).click();
  await choose(page, 'Filter by', 'Status');
  await choose(page, 'Value for Status', value);
}

for (const width of [320, 390, 1280]) {
  test(`independent Guest Tasks create, filter, edit and complete without altering Activities at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 700 ? 780 : 900 });
    const errors = await seedGuest(page);
    await page.goto('/tasks');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.locator('.dn-tasks-page h2').filter({ hasText: 'Tasks' })).toBeVisible();
    const source = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_expenses'), localStorage.getItem('dn_guest_incomes'),
    ]);
    await expect(page.getByRole('button', { name: 'New Task', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Open quick create menu' }).click();
    await page.getByRole('button', { name: 'Task', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'New Task' });
    await editor.getByLabel('Task title').fill('Remember the travel documents');
    await editor.getByRole('button', { name: 'Create Task' }).click();
    await expect(page.getByText('Remember the travel documents', { exact: true })).toBeVisible();
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')));
    expect(saved).toHaveLength(1);
    const today = await page.evaluate(async () => (await import('/src/utils/momentDates.js')).formatMomentDate(new Date()));
    expect(saved[0]).toMatchObject({ title: 'Remember the travel documents', momentId: '', activityId: '', dueDate: today, dueTime: '' });

    await page.getByRole('button', { name: 'Refine', exact: true }).click();
    const refine = page.getByRole('dialog', { name: 'Refine Tasks' });
    await expect(refine.getByRole('heading', { name: 'Group by' })).toHaveCount(0);
    await expect(refine.locator('.dn-refine-sheet-intro')).toBeVisible();
    await addStatusRule(page, refine, 'Completed');
    await expect(refine.getByRole('status')).toContainText('0 matching Tasks');
    await expect(page.getByText('Remember the travel documents', { exact: true })).toBeVisible();
    await refine.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByText('Remember the travel documents', { exact: true })).toBeVisible();

    await page.locator('.dn-independent-task-row').filter({hasText:'Remember the travel documents'}).click();
    await page.getByRole('menuitem', { name: 'Done', exact:true }).click();
    await expect(page.getByRole('img', {name:'Completed',exact:true})).toBeVisible();
    await page.locator('.dn-independent-task-row').filter({hasText:'Remember the travel documents'}).click();
    await page.getByRole('menuitem', { name: 'Edit', exact:true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit Task' });
    await edit.locator('.dn-form-disclosure > summary').filter({ hasText: 'More options' }).click();
    await edit.getByLabel('Notes (optional)').fill('Keep the originals');
    await page.getByRole('dialog', { name: 'Edit Task' }).getByRole('button', { name: 'Save Task' }).click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks')));
    expect(saved[0].status).toBe('completed');
    expect(saved[0].notes).toBe('Keep the originals');

    await page.getByRole('button', { name: 'Refine', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Refine Tasks' });
    await addStatusRule(page, sheet, 'Completed');
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
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByText('Account Tasks aren’t available yet')).toHaveCount(0);
  await expect(page.getByText('Private', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_tasks'))).toEqual(before);
  expect(errors).toEqual([]);
});

test('Tasks have no grouped subheadings and Dashboard orders Tasks before Moments and Activities', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/tasks');
  await page.evaluate(() => localStorage.setItem('dn_guest_tasks', JSON.stringify([
    { id: 'task-a', title: 'Task A', status: 'in-progress', priority: 'high',
      momentId: '', activityId: '', dueDate: '2026-11-06', dueTime: '' },
    { id: 'task-b', title: 'Task B', status: 'in-progress', priority: 'low',
      momentId: '', activityId: '', dueDate: '2026-11-06', dueTime: '' },
  ])));
  await page.reload();
  await expect(page.locator('.dn-independent-task-row')).toHaveCount(2);
  await expect(page.locator('.dn-task-group')).toHaveCount(0);
  await expect(page.getByText('Task A', { exact: true })).toBeVisible();
  await expect(page.getByText('Task B', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refine', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Refine Tasks' });
  await expect(sheet.getByText('Group by')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-overview.dashboard-compact > section').first()).toBeVisible();
  const order = await page.locator('.dashboard-overview.dashboard-compact > section').evaluateAll((sections) =>
    sections.map((element) => element.getAttribute('aria-label')));
  expect(order).toEqual(['Independent Tasks', 'Moments', 'Activities']);
  expect(errors).toEqual([]);
});
