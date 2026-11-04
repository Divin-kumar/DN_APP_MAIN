import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Account UI integration with an injected transport; no real account writes.
test('signed-in Tasks await saves, retain failures, receive updates and clear on account switch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/src/services/accountTaskService.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    const rows = new Map(); let receive;
    window.taskTransport = { fail: false, push: (tasks) => { rows.clear(); tasks.forEach(t=>rows.set(t.id,t)); receive?.([...rows.values()]); } };
    export const watchAccountTasks=(uid,guard,next)=>{receive=tasks=>{guard();next(tasks)};queueMicrotask(()=>receive([...rows.values()]));return()=>{receive=null}};
    export const writeAccountTask=async(uid,task)=>{await new Promise(r=>setTimeout(r,100));if(window.taskTransport.fail)throw Error('Save failed. Try again.');rows.set(task.id,task);receive?.([...rows.values()]);return task};
    export const removeAccountTask=async(uid,id)=>{rows.delete(id);receive?.([...rows.values()]);return true};
    export const listAccountTasks=async()=>[...rows.values()];export const mergeAccountTasks=async()=>({added:0,conflicts:0});export const detachAccountTaskLinks=async()=>{};
  ` }));
  await seedGuest(page); await page.goto('/tasks');
  await expect(page.locator('.dn-header').getByRole('heading', { name: 'Tasks', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const app = (await import('/src/store/useAppStore.js')).default;
    const events = (await import('/src/store/useEventStore.js')).default;
    events.setState({ loadEvents: () => {}, events: [], loadedFor: 'user:test-account', activeLoadKey: 'user:test-account' });
    app.setState({ user: { uid: 'test-account', displayName: 'Test' }, isGuest: false });
  });
  await expect(page.getByText('A clear start')).toBeVisible();
  // Drive the existing route via history without losing the injected session.
  await page.evaluate(() => { history.pushState({}, '', '/tasks?create=1'); dispatchEvent(new PopStateEvent('popstate')); });
  await page.getByLabel('Task title', { exact: true }).fill('Synced Task');
  await page.evaluate(() => { window.taskTransport.fail = true; });
  await page.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Save failed' })).toBeVisible();
  await expect(page.getByLabel('Task title', { exact: true })).toHaveValue('Synced Task');
  await page.evaluate(() => { window.taskTransport.fail = false; });
  await page.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.dn-independent-task-row')).toContainText('Synced Task');
  await page.evaluate(() => window.taskTransport.push([{ id: 'remote', title: 'Changed on another device', status: 'completed', priority: 'medium' }]));
  await expect(page.locator('.dn-independent-task-row')).toContainText('Changed on another device');
  await expect(page.locator('.dn-task-metrics')).toContainText('1 Completed');
  await page.evaluate(async () => {
    (await import('/src/store/useAppStore.js')).default.setState({ user: null, isGuest: true });
  });
  await expect(page.getByText('Changed on another device')).toHaveCount(0);
});
