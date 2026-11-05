import { test, expect } from '@playwright/test';
import { seedGuest, calendarDate } from './fixtures.js';

test('Universal Task creation stays on Dashboard and offers View, with compact defaults', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const modal = page.getByRole('dialog', { name: 'New Task' });
  const due = modal.locator('input[type="date"]');
  const today = await page.evaluate(() => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  });
  await expect(due).toHaveValue(today);
  await expect(modal.getByRole('combobox', { name: 'Priority' })).toBeHidden();
  await expect(modal.locator('textarea')).toBeHidden();
  await modal.getByText('More options', { exact: true }).click();
  await expect(modal.locator('textarea')).toBeVisible();
  await modal.getByRole('textbox', { name: 'Task title' }).fill('A quiet Task from Dashboard');
  await modal.getByRole('button', { name: 'Create Task' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard$/);
  const toast = page.locator('.app-toast');
  await expect(toast).toContainText('Task added successfully');
  await toast.getByRole('button', { name: 'View' }).click();
  await expect(page).toHaveURL(/\/tasks\?task=/);
  await expect(page.locator('.dn-independent-task-row.is-dashboard-selected')).toContainText('A quiet Task from Dashboard');
  expect(errors).toEqual([]);
});

test('Dashboard Tasks begin hidden, show four rows and scroll without chrome', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/tasks');
  const dates = Array.from({ length: 7 }, (_, index) => calendarDate(index + 1));
  await page.evaluate(async (dates) => {
    const store = (await import('/src/store/useTaskStore.js')).default;
    store.getState().loadTasks();
    dates.forEach((date, index) => store.getState().saveTask({ title: 'Preview task ' + index, dueDate: date }));
  }, dates);
  await page.goto('/dashboard');
  const panel = page.locator('.dn-dashboard-tasks');
  await expect(panel.locator('.dn-dashboard-task-row')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Show Tasks on dashboard' }).click();
  await expect(panel.locator('.dn-dashboard-task-row')).toHaveCount(7);
  const metrics = await panel.locator('.dn-dashboard-tasks-rows').evaluate((node) => {
    const css = getComputedStyle(node);
    return { height: node.clientHeight, scrollHeight: node.scrollHeight, scrollbar: css.scrollbarWidth, visible: node.clientHeight / 68 };
  });
  expect(metrics.height).toBe(272);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);
  expect(metrics.scrollbar).toBe('none');
  expect(metrics.visible).toBe(4);
  await panel.locator('.dn-dashboard-tasks-rows').evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await expect(panel.locator('.dn-dashboard-tasks-rows')).toHaveJSProperty('scrollTop', 204);
  expect(errors).toEqual([]);
});

test('Activity Detail attachment uses universal + and retains Activity link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('.activity-attachments').getByRole('button', { name: 'Add attachment' })).toHaveCount(0);
  await expect(page.locator('.activity-attachment-hint')).toContainText('Add using +');
  await page.getByRole('button', { name: 'Open quick create menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Attachment', exact: true }).click();
  const file = await chooser;
  await file.setFiles({ name: 'keepsake-note.txt', mimeType: 'text/plain', buffer: Buffer.from('A real small attachment') });
  await expect(page.locator('.activity-attachments')).toContainText('keepsake-note.txt');
  const linked = await page.evaluate(() => {
    const moments = JSON.parse(localStorage.getItem('dn_guest_eventGroups'));
    return moments[0].attachments.find((item) => item.name === 'keepsake-note.txt');
  });
  expect(linked?.activityId).toBe('shared');
  expect(errors).toEqual([]);
});

test('Dragging a filter creates a pointer-transparent visual outside its clipped list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters and sort/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Activity filters' });
  await dialog.getByRole('button', { name: 'Clear all', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add filter' }).click();
  await dialog.getByRole('button', { name: 'Add filter' }).click();
  const grip = dialog.locator('.dn-condition-rule').first().getByRole('button', { name: 'Drag to reorder filter' });
  const rect = await grip.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await expect(dialog.locator('.is-drag-source')).toHaveCount(1);
  const first = await dialog.locator('.dn-condition-children').first().boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, first.y - 35, { steps: 8 });
  const ghost = page.locator('body > .dn-condition-drag-float');
  await expect(ghost).toHaveCount(1);
  const snapshot = await ghost.evaluate((node) => {
    const style = getComputedStyle(node);
    const visual = node.getBoundingClientRect();
    return { position: style.position, pointer: style.pointerEvents, top: visual.top, inert: node.inert };
  });
  expect(snapshot.position).toBe('fixed');
  expect(snapshot.pointer).toBe('none');
  expect(snapshot.inert).toBe(true);
  expect(snapshot.top).toBeLessThan(first.y);
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(errors).toEqual([]);
});
