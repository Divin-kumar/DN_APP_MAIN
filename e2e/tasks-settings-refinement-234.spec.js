import { test, expect } from '@playwright/test';
import { seedGuest, fixtureMoments } from './fixtures.js';

test.use({ hasTouch: true, isMobile: true });
for (const [width, theme] of [[320, 'dark'], [430, 'light']]) {
  test(`Task arrival keeps search focus and linked context at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const moments = fixtureMoments();
    const moment = moments[0];
    const task = { id: 'arrival-task', title: 'Review travel documents', notes: 'Keep the original notes',
      status: 'in-progress', priority: 'high', dueDate: '2026-11-07', dueTime: '09:30',
      momentId: moment.id, activityId: moment.activities[0].id };
    const errors = await seedGuest(page, { moments, theme });
    await page.goto('/tasks');
    await page.evaluate((row) => localStorage.setItem('dn_guest_tasks', JSON.stringify([row])), task);
    await page.goto('/tasks?task=arrival-task');
    const row = page.locator('.dn-independent-task-row.is-dashboard-selected');
    await expect(row).toBeFocused();
    await expect(row.locator('.dn-task-context')).toContainText(moment.activities[0].title);
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_tasks'));
    const search = page.getByRole('searchbox', { name: 'Search Tasks' });
    await search.click();
    // Separate key events catch an arrival effect stealing focus after a render.
    for (const key of ['z', 'z', 'z']) {
      await page.keyboard.type(key);
      await expect(search).toBeFocused();
    }
    await expect(search).toHaveValue('zzz');
    await expect(page.locator('.dn-task-dashboard-arrival')).toContainText('outside your current filters');
    await page.getByRole('button', { name: 'Clear Task search' }).click();
    await row.click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit Task' });
    await expect(editor.getByLabel('Due date')).toHaveValue(task.dueDate);
    await editor.locator('.dn-form-disclosure > summary').filter({ hasText: 'More options' }).click();
    await expect(editor.getByLabel('Notes (optional)')).toHaveValue(task.notes);
    await editor.getByLabel('Notes (optional)').fill('Discard this edit');
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_tasks'))).toBe(before);
    await row.click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog', { name: 'Delete Task?' }).getByRole('button', { name: 'Delete Task', exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(page.locator('.dn-task-dashboard-arrival')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });

  test(`Settings text hierarchy is consistent at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await seedGuest(page, { theme });
    for (const [route, selector, size] of [
      ['/settings', '.settings-navigation-hub .settings-hub-copy strong', 15],
      ['/settings', '.settings-navigation-hub .settings-hub-copy small', 13],
      ['/settings/appearance', '.dn-appearance-section-heading h3', 17],
      ['/settings/appearance', '.dn-appearance-theme-copy small', 13],
      ['/settings/list-defaults', '.dn-defaults-factory', 13],
      ['/settings/code-lists', '.dn-code-list-editor-section > .settings-section-heading h3', 17],
    ]) {
      await page.goto(route);
      const targets = page.locator(selector);
      await expect(targets.first()).toBeVisible();
      for (const target of await targets.all()) {
        expect(await target.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(size);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    }
    await testInfo.attach(`settings-${width}-${theme}`, { body: await page.screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
}

test('Task editor preserves a Moment alias and exposes its Activity options', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/tasks');
  await page.evaluate(async () => {
    const events = (await import('/src/store/useEventStore.js')).default;
    const moments = events.getState().events;
    events.setState({ events: moments.map((m, index) => index === 0 ? { ...m, firestoreId: 'legacy-moment' } : m) });
    const tasks = (await import('/src/store/useTaskStore.js')).default;
    tasks.getState().saveTask({ title: 'Alias-linked Task', momentId: 'legacy-moment', activityId: moments[0].activities[0].id });
  });
  const row = page.locator('.dn-independent-task-row').filter({ hasText: 'Alias-linked Task' });
  await row.click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Task' });
  await editor.locator('.dn-form-disclosure > summary').filter({ hasText: 'More options' }).click();
  await expect(editor.getByRole('combobox', { name: 'Moment (optional)' })).not.toContainText('Unavailable');
  await expect(editor.getByRole('combobox', { name: 'Activity (optional)' })).not.toContainText('Unavailable');
  await editor.getByRole('button', { name: 'Save Task', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_tasks'))[0].momentId)).toBe('legacy-moment');
});
